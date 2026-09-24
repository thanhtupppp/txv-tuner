import { Platform } from 'react-native';

const LOG_PREFIX = '[ESP32]';

/**
 * Lấy EventSource phù hợp với nền tảng hiện tại (Web vs React Native)
 */
export function getEventSourceClass(customImpl) {
  if (customImpl) return customImpl;

  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.EventSource : null;
  }

  try {
    const sse = require('react-native-sse');
    return sse.EventSource || sse.default || sse;
  } catch (err) {
    console.warn(`${LOG_PREFIX} react-native-sse not available:`, err);
    return null;
  }
}

/**
 * Chuẩn hóa địa chỉ IP hoặc Hostname của ESP32 thành URL SSE stream
 */
export function buildStreamUrl(ip) {
  if (!ip) return 'http://192.168.4.1/api/stream';
  let host = String(ip).trim().replace(/^https?:\/\//i, '');
  host = host.split('/')[0];
  return `http://${host}/api/stream`;
}

/**
 * Kết nối luồng Server-Sent Events (SSE) thời gian thực tới ESP32
 * Có hỗ trợ Heartbeat Watchdog, Exponential Backoff và giới hạn số lần Reconnect
 *
 * @param {Object} options
 * @param {string} options.ip
 * @param {function} options.onData
 * @param {function} [options.onHeartbeat]
 * @param {function} [options.onStatusChange]
 * @param {function} [options.onError]
 * @param {number} [options.initialRetryDelay=2000]
 * @param {number} [options.maxRetryDelay=30000]
 * @param {number} [options.maxAttempts=10]
 * @param {number} [options.heartbeatTimeoutMs=15000]
 * @param {any} [options.EventSourceImpl]
 * @returns {Function} Hàm unsubscribe có đính kèm method .reconnect()
 */
export function subscribeEsp32Stream({
  ip,
  onData,
  onHeartbeat,
  onStatusChange = () => {},
  onError = () => {},
  initialRetryDelay = 2000,
  maxRetryDelay = 30000,
  maxAttempts = 10,
  heartbeatTimeoutMs = 15000,
  EventSourceImpl = null
}) {
  const EventSourceClass = getEventSourceClass(EventSourceImpl);
  if (!EventSourceClass) {
    console.warn(`${LOG_PREFIX} No EventSource implementation found.`);
    onStatusChange('offline', { connected: false, error: 'NO_EVENT_SOURCE' });
    const noop = () => {};
    noop.unsubscribe = noop;
    noop.reconnect = noop;
    return noop;
  }

  let es = null;
  let isClosed = false;
  let reconnectTimer = null;
  let watchdogTimer = null;
  let reconnectAttempts = 0;

  const url = buildStreamUrl(ip);

  // Watchdog: Tự động phát hiện ESP32 bị treo/đứng luồng
  const resetWatchdog = () => {
    clearTimeout(watchdogTimer);
    if (isClosed || heartbeatTimeoutMs <= 0) return;

    watchdogTimer = setTimeout(() => {
      console.warn(`${LOG_PREFIX} Heartbeat timeout! ESP32 may be frozen.`);
      handleReconnect('heartbeat_timeout', new Error('ESP32 heartbeat timeout'));
    }, heartbeatTimeoutMs);
  };

  const handleReconnect = (reason = 'connection_error', errorObj = null) => {
    clearTimeout(watchdogTimer);
    if (isClosed) return;

    if (es && typeof es.close === 'function') {
      try {
        es.close();
      } catch (e) {}
      es = null;
    }

    reconnectAttempts++;
    console.log(`${LOG_PREFIX} Reconnect attempt ${reconnectAttempts}/${maxAttempts} (reason: ${reason})`);

    if (reconnectAttempts >= maxAttempts) {
      console.error(`${LOG_PREFIX} Max reconnect attempts (${maxAttempts}) reached. Stopped auto-reconnect.`);
      onStatusChange('offline', {
        connected: false,
        reconnecting: false,
        maxAttemptsReached: true,
        attempt: reconnectAttempts,
        maxAttempts,
        reason
      });
      if (onError) onError(errorObj || new Error(`Failed to connect to ESP32 after ${maxAttempts} attempts`));
      return;
    }

    // Exponential Backoff: delay = initialDelay * (1.5 ^ (attempt - 1))
    const delay = Math.min(
      initialRetryDelay * Math.pow(1.5, reconnectAttempts - 1),
      maxRetryDelay
    );

    onStatusChange('reconnecting', {
      connected: false,
      reconnecting: true,
      attempt: reconnectAttempts,
      maxAttempts,
      delay,
      reason
    });

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      console.log(`${LOG_PREFIX} Executing reconnect...`);
      connect();
    }, delay);
  };

  const connect = () => {
    if (isClosed) return;

    console.log(`${LOG_PREFIX} Connecting to SSE stream at ${url}...`);
    onStatusChange('connecting', {
      connected: false,
      reconnecting: reconnectAttempts > 0,
      attempt: reconnectAttempts,
      maxAttempts
    });

    try {
      es = new EventSourceClass(url, {
        headers: {
          Accept: 'text/event-stream'
        }
      });

      // Lắng nghe sự kiện dữ liệu nhiệt độ push từ ESP32
      es.addEventListener('temperatures', (event) => {
        if (isClosed) return;
        resetWatchdog();
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          const payload = {
            ...raw,
            receivedAt: Date.now()
          };

          if (reconnectAttempts > 0) {
            console.log(`${LOG_PREFIX} Reconnected successfully!`);
          }
          reconnectAttempts = 0;

          onStatusChange('connected', {
            connected: true,
            reconnecting: false,
            attempt: 0,
            serverTimestamp: payload.serverTimestamp
          });

          if (onData) onData(payload);
        } catch (err) {
          console.error(`${LOG_PREFIX} Parse error for temperatures:`, err);
        }
      });

      // Lắng nghe sự kiện Heartbeat định kỳ
      es.addEventListener('heartbeat', (event) => {
        if (isClosed) return;
        resetWatchdog();
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          const hbPayload = {
            ...raw,
            receivedAt: Date.now()
          };

          reconnectAttempts = 0;
          onStatusChange('connected', {
            connected: true,
            reconnecting: false,
            attempt: 0
          });

          if (onHeartbeat) onHeartbeat(hbPayload);
        } catch (err) {
          console.error(`${LOG_PREFIX} Parse error for heartbeat:`, err);
        }
      });

      es.addEventListener('connected', () => {
        if (isClosed) return;
        resetWatchdog();
        reconnectAttempts = 0;
        onStatusChange('connected', { connected: true, reconnecting: false, attempt: 0 });
      });

      if (typeof es.addEventListener === 'function') {
        es.addEventListener('open', () => {
          if (isClosed) return;
          resetWatchdog();
          reconnectAttempts = 0;
          onStatusChange('connected', { connected: true, reconnecting: false, attempt: 0 });
        });
      }

      es.addEventListener('error', (err) => {
        if (isClosed) return;
        console.error(`${LOG_PREFIX} SSE connection error:`, err);
        handleReconnect('error_event', err);
      });
    } catch (err) {
      console.error(`${LOG_PREFIX} SSE setup exception:`, err);
      handleReconnect('setup_exception', err);
    }
  };

  connect();

  const unsubscribe = () => {
    isClosed = true;
    clearTimeout(reconnectTimer);
    clearTimeout(watchdogTimer);
    if (es && typeof es.close === 'function') {
      try {
        es.close();
      } catch (e) {}
      es = null;
    }
  };

  const manualReconnect = () => {
    console.log(`${LOG_PREFIX} Manual reconnect triggered by user`);
    isClosed = false;
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
    clearTimeout(watchdogTimer);
    if (es && typeof es.close === 'function') {
      try {
        es.close();
      } catch (e) {}
      es = null;
    }
    connect();
  };

  const controller = () => unsubscribe();
  controller.unsubscribe = unsubscribe;
  controller.reconnect = manualReconnect;

  return controller;
}

/**
 * Fetch một lần qua HTTP REST (dự phòng cho Polling hoặc Health Check)
 */
export async function fetchEsp32Temperatures(ip, timeoutMs = 3000) {
  let host = String(ip).trim().replace(/^https?:\/\//i, '');
  host = host.split('/')[0];
  const url = `http://${host}/api/temperatures`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/**
 * Lấy thông số hệ thống của ESP32 (freeHeap, uptime, wifiRSSI, clientConnected)
 */
export async function fetchEsp32Stats(ip, timeoutMs = 3000) {
  let host = String(ip).trim().replace(/^https?:\/\//i, '');
  host = host.split('/')[0];
  const url = `http://${host}/api/stats`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
