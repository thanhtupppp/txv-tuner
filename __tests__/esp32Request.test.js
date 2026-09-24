import { requestEsp32 } from '../src/services/esp32Request';
import { ESP32_ERROR_CODES } from '../src/services/esp32Errors';

function mockResponse({ status = 200, body = '', ok = status >= 200 && status < 300 } = {}) {
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
      () => new Promise((resolve, reject) => {
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
});
