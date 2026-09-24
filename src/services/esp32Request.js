import {
  createEsp32Error,
  ESP32_ERROR_CODES,
  normalizeEsp32Error,
} from './esp32Errors';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_DELAY_MS = 300;

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

function delayWithAbort(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(
        createEsp32Error(
          ESP32_ERROR_CODES.ABORTED,
          'Yêu cầu đã bị hủy',
          { retryable: false },
        ),
      );
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(
            createEsp32Error(
              ESP32_ERROR_CODES.ABORTED,
              'Yêu cầu đã bị hủy',
              { retryable: false },
            ),
          );
        },
        { once: true },
      );
    }
  });
}

/**
 * Thực hiện một lượt HTTP fetch tới ESP32 với timeout và signal kết hợp
 */
async function executeRequestOnce(
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
      if (externalSignal?.aborted) {
        throw createEsp32Error(
          ESP32_ERROR_CODES.ABORTED,
          'Yêu cầu đã bị hủy',
          { retryable: false, cause: error },
        );
      }
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
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Wrapper gọi HTTP ESP32 tổng quát.
 * Có cơ chế retry có kiểm soát an toàn:
 * - Chỉ cho phép retry với các thao tác đọc dữ liệu an toàn (GET, idempotent).
 * - CẤM retry tự động đối với các lệnh điều khiển van TXV (isCommand = true hoặc non-GET) để tránh xung cơ học trùng lặp.
 */
export async function requestEsp32(
  url,
  {
    method = 'GET',
    headers = {},
    body,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    isCommand = false,
  } = {},
) {
  const isNonGet = String(method).toUpperCase() !== 'GET';

  // Khóa an toàn: Cấm auto-retry đối với lệnh điều khiển hoặc non-GET request
  if ((isCommand || isNonGet) && retries > 0) {
    throw createEsp32Error(
      ESP32_ERROR_CODES.COMMAND_SAFETY,
      'Không được phép tự động retry đối với lệnh điều khiển thiết bị (Command) hoặc yêu cầu non-GET',
      { retryable: false },
    );
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await executeRequestOnce(url, {
        method,
        headers,
        body,
        signal: externalSignal,
        timeoutMs,
      });
    } catch (error) {
      if (externalSignal?.aborted) {
        throw createEsp32Error(
          ESP32_ERROR_CODES.ABORTED,
          'Yêu cầu đã bị hủy',
          { retryable: false, cause: error },
        );
      }
      lastError = normalizeEsp32Error(error);

      const isLastAttempt = attempt >= retries;
      const canRetry = lastError.retryable && !isLastAttempt && !externalSignal?.aborted;

      if (!canRetry) {
        throw lastError;
      }

      const delay = retryDelayMs * Math.pow(1.5, attempt);
      await delayWithAbort(delay, externalSignal);
    }
  }

  throw lastError;
}

/**
 * Safe wrapper cho các tác vụ đọc telemetry / stats / health (Idempotent GET).
 * Hỗ trợ retry an toàn khi gặp sự cố mạng hoặc timeout.
 */
export async function requestEsp32SafeRead(url, options = {}) {
  return requestEsp32(url, {
    ...options,
    method: 'GET',
    retries: options.retries ?? 2,
    isCommand: false,
  });
}

/**
 * Safe wrapper cho các lệnh điều khiển van TXV (Mutation / Physical Actuation).
 * Bắt buộc isCommand = true, cấm tuyệt đối auto-retry trên network timeout.
 */
export async function requestEsp32Command(url, options = {}) {
  if (options.retries && options.retries > 0) {
    throw createEsp32Error(
      ESP32_ERROR_CODES.COMMAND_SAFETY,
      'Lệnh điều khiển thiết bị (Command) tuyệt đối không được phép cấu hình tự động retry',
      { retryable: false },
    );
  }

  return requestEsp32(url, {
    ...options,
    method: options.method ?? 'POST',
    retries: 0,
    isCommand: true,
  });
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_RETRY_DELAY_MS };
