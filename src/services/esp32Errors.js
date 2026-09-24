export const ESP32_ERROR_CODES = Object.freeze({
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  HTTP: 'HTTP',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  ABORTED: 'ABORTED',
  DEVICE: 'DEVICE',
  COMMAND_SAFETY: 'COMMAND_SAFETY',
  UNKNOWN: 'UNKNOWN',
});

export function createEsp32Error(code, message, options = {}) {
  const error = new Error(message);
  error.name = 'Esp32Error';
  error.code = code;
  error.status = options.status;
  error.retryable = options.retryable ?? false;
  error.cause = options.cause;
  return error;
}

export function normalizeEsp32Error(error) {
  if (error?.name === 'Esp32Error') return error;

  if (error?.name === 'AbortError') {
    return createEsp32Error(
      ESP32_ERROR_CODES.ABORTED,
      'Yêu cầu đã bị hủy',
      { retryable: false, cause: error },
    );
  }

  if (error instanceof TypeError) {
    return createEsp32Error(
      ESP32_ERROR_CODES.NETWORK,
      'Không thể kết nối đến ESP32',
      { retryable: true, cause: error },
    );
  }

  return createEsp32Error(
    ESP32_ERROR_CODES.UNKNOWN,
    error?.message || 'Lỗi không xác định khi giao tiếp với ESP32',
    { retryable: false, cause: error },
  );
}
