import {
  createEsp32Error,
  ESP32_ERROR_CODES,
  normalizeEsp32Error,
} from './esp32Errors';

const DEFAULT_TIMEOUT_MS = 5000;

function combineSignals(externalSignal, timeoutSignal) {
  if (!externalSignal) return timeoutSignal;
  if (!timeoutSignal) return externalSignal;

  if (typeof AbortSignal?.any === 'function') {
    return AbortSignal.any([externalSignal, timeoutSignal]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (externalSignal.aborted || timeoutSignal.aborted) {
    controller.abort();
  } else {
    externalSignal.addEventListener('abort', abort, { once: true });
    timeoutSignal.addEventListener('abort', abort, { once: true });
  }

  return controller.signal;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return { text: '', data: null };

  try {
    return { text, data: JSON.parse(text) };
  } catch (error) {
    return { text, data: null, parseError: error };
  }
}

export async function requestEsp32(
  url,
  {
    method = 'GET',
    headers = {},
    body,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = combineSignals(externalSignal, timeoutController.signal);

  try {
    let response;

    try {
      response = await fetch(url, {
        method,
        headers: { Accept: 'application/json', ...headers },
        body,
        signal,
      });
    } catch (error) {
      if (timeoutController.signal.aborted && !externalSignal?.aborted) {
        throw createEsp32Error(
          ESP32_ERROR_CODES.TIMEOUT,
          `ESP32 không phản hồi sau ${timeoutMs} ms`,
          { retryable: true, cause: error },
        );
      }
      throw normalizeEsp32Error(error);
    }

    const bodyResult = await readBody(response);

    if (!response.ok) {
      throw createEsp32Error(
        ESP32_ERROR_CODES.HTTP,
        `ESP32 trả về HTTP ${response.status}`,
        {
          status: response.status,
          retryable: response.status >= 500,
          cause: bodyResult.data ?? bodyResult.text,
        },
      );
    }

    if (bodyResult.parseError) {
      throw createEsp32Error(
        ESP32_ERROR_CODES.INVALID_JSON,
        'ESP32 trả về dữ liệu JSON không hợp lệ',
        { retryable: false, cause: bodyResult.parseError },
      );
    }

    return {
      data: bodyResult.data,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    throw normalizeEsp32Error(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

export { DEFAULT_TIMEOUT_MS };
