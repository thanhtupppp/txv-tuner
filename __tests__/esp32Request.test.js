import {
  requestEsp32,
  requestEsp32SafeRead,
  requestEsp32Command,
} from '../src/services/esp32Request';
import { ESP32_ERROR_CODES } from '../src/services/esp32Errors';

function mockResponse({
  status = 200,
  body = '',
  ok = status >= 200 && status < 300,
} = {}) {
  return {
    ok,
    status,
    headers: {},
    text: jest.fn().mockResolvedValue(body),
  };
}

describe('requestEsp32', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('returns parsed JSON for a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ body: JSON.stringify({ alive: true }) }),
    );

    await expect(requestEsp32('http://esp32/api/stats')).resolves.toMatchObject({
      data: { alive: true },
      status: 200,
    });
  });

  it('classifies plain-text HTTP errors as HTTP', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ status: 400, body: 'bad request' }),
    );

    await expect(requestEsp32('http://esp32/api/stats')).rejects.toMatchObject({
      code: ESP32_ERROR_CODES.HTTP,
      status: 400,
      retryable: false,
    });
  });

  it('classifies server errors as retryable HTTP errors', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ status: 500, body: JSON.stringify({ error: 'down' }) }),
    );

    await expect(requestEsp32('http://esp32/api/stats')).rejects.toMatchObject({
      code: ESP32_ERROR_CODES.HTTP,
      status: 500,
      retryable: true,
    });
  });

  it('classifies invalid JSON on a successful response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ body: '{invalid-json' }),
    );

    await expect(requestEsp32('http://esp32/api/stats')).rejects.toMatchObject({
      code: ESP32_ERROR_CODES.INVALID_JSON,
    });
  });

  it('classifies network failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('network down'));

    await expect(requestEsp32('http://esp32/api/stats')).rejects.toMatchObject({
      code: ESP32_ERROR_CODES.NETWORK,
      retryable: true,
    });
  });

  it('classifies explicit aborts', async () => {
    const controller = new AbortController();
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortError);
    controller.abort();

    await expect(
      requestEsp32('http://esp32/api/stats', { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: ESP32_ERROR_CODES.ABORTED,
    });
  });

  it('classifies request timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          const error = new Error('aborted by timeout');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 20);
        }),
    );

    const expectation = expect(
      requestEsp32('http://esp32/api/stats', { timeoutMs: 10 }),
    ).rejects.toMatchObject({
      code: ESP32_ERROR_CODES.TIMEOUT,
    });

    await jest.advanceTimersByTimeAsync(20);

    await expectation;
  });

  describe('Safe Read & Retry Policy', () => {
    it('retries on retryable server error (500) and succeeds on subsequent attempt', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse({ status: 500, body: JSON.stringify({ error: 'busy' }) }),
        )
        .mockResolvedValueOnce(
          mockResponse({ status: 200, body: JSON.stringify({ alive: true }) }),
        );

      const res = await requestEsp32SafeRead('http://esp32/api/stats', {
        retries: 1,
        retryDelayMs: 10,
      });

      expect(res.data).toEqual({ alive: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('retries on network error and succeeds on subsequent attempt', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(
          mockResponse({ status: 200, body: JSON.stringify({ alive: true }) }),
        );

      const res = await requestEsp32SafeRead('http://esp32/api/stats', {
        retries: 2,
        retryDelayMs: 10,
      });

      expect(res.data).toEqual({ alive: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry when encountering non-retryable 4xx client errors', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockResponse({ status: 404, body: 'Not found' }),
      );

      await expect(
        requestEsp32SafeRead('http://esp32/api/stats', {
          retries: 2,
          retryDelayMs: 10,
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.HTTP,
        status: 404,
        retryable: false,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry on invalid JSON on 200 OK', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockResponse({ status: 200, body: 'not-json{{' }),
      );

      await expect(
        requestEsp32SafeRead('http://esp32/api/stats', {
          retries: 2,
          retryDelayMs: 10,
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.INVALID_JSON,
        retryable: false,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('stops retry chain immediately when aborted externally', async () => {
      const controller = new AbortController();
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() => {
          controller.abort();
          return Promise.reject(new TypeError('network fail'));
        });

      await expect(
        requestEsp32SafeRead('http://esp32/api/stats', {
          retries: 2,
          retryDelayMs: 50,
          signal: controller.signal,
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.ABORTED,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Command Safety Policy', () => {
    it('throws COMMAND_SAFETY error if auto-retry is configured for a command', async () => {
      await expect(
        requestEsp32Command('http://esp32/api/valve/position', {
          retries: 2,
          body: JSON.stringify({ targetPosition: 50 }),
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.COMMAND_SAFETY,
        retryable: false,
      });
    });

    it('throws COMMAND_SAFETY error if requestEsp32 has isCommand=true and retries > 0', async () => {
      await expect(
        requestEsp32('http://esp32/api/valve', {
          isCommand: true,
          retries: 1,
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.COMMAND_SAFETY,
      });
    });

    it('throws COMMAND_SAFETY error if requestEsp32 has method POST and retries > 0', async () => {
      await expect(
        requestEsp32('http://esp32/api/valve', {
          method: 'POST',
          retries: 2,
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.COMMAND_SAFETY,
      });
    });

    it('executes a command via POST with retries=0 and does not retry on 500 error', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockResponse({ status: 500, body: JSON.stringify({ error: 'busy' }) }),
      );

      await expect(
        requestEsp32Command('http://esp32/api/valve/position', {
          body: JSON.stringify({ targetPosition: 40 }),
        }),
      ).rejects.toMatchObject({
        code: ESP32_ERROR_CODES.HTTP,
        status: 500,
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('executes a command successfully when ESP32 accepts', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockResponse({
          status: 200,
          body: JSON.stringify({ status: 'accepted', currentPosition: 40 }),
        }),
      );

      const result = await requestEsp32Command('http://esp32/api/valve/position', {
        body: JSON.stringify({ targetPosition: 40 }),
      });

      expect(result.data).toEqual({ status: 'accepted', currentPosition: 40 });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://esp32/api/valve/position',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ targetPosition: 40 }),
        }),
      );
    });
  });
});
