import { Platform } from 'react-native';

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
    console.warn('[esp32Service] react-native-sse not available:', err);
    return null;
  }
}

/**
 * Chuẩn hóa địa chỉ IP hoặc Hostname của ESP32 thành URL SSE stream
 */
export function buildStreamUrl(ip) {
  if (!ip) return 'http://192.168.4.1/api/stream';
  let host = String(ip).trim().replace(/^https?:\/\//i, '');
  host = host.split('/')[0]; // Lấy hostname:port nếu có
  return `http://${host}/api/stream`;
}

/**
 * Kết nối luồng Server-Sent Events (SSE) thời gian thực tới ESP32
 * @param {Object} options
 * @param {string} options.ip
 * @param {function} options.onData
 * @param {function} options.onStatusChange - 'connecting' | 'connected' | 'offline'
 * @param {number} [options.retryInterval=3000]
 * @param {any} [options.EventSourceImpl]
 * @returns {function} unsubscribe function
 */
export function subscribeEsp32Stream({
  ip,
  onData,
  onStatusChange = () => {},
  retryInterval = 3000,
  EventSourceImpl = null
}) {
  const EventSourceClass = getEventSourceClass(EventSourceImpl);
  if (!EventSourceClass) {
    console.warn('[esp32Service] No EventSource implementation found.');
    onStatusChange('offline');
    return () => {};
  }

  let es = null;
  let isClosed = false;
  let reconnectTimer = null;

  const url = buildStreamUrl(ip);

  const connect = () => {
    if (isClosed) return;

    onStatusChange('connecting');

    try {
      es = new EventSourceClass(url, {
        headers: {
          Accept: 'text/event-stream'
        }
      });

      // Lắng nghe sự kiện nhiệt độ push từ ESP32
      es.addEventListener('temperatures', (event) => {
        if (isClosed) return;
        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          onStatusChange('connected');
          if (onData) onData(payload);
        } catch (err) {
          console.error('[esp32Service] Parse error:', err);
        }
      });

      es.addEventListener('connected', () => {
        if (!isClosed) onStatusChange('connected');
      });

      if (typeof es.addEventListener === 'function') {
        es.addEventListener('open', () => {
          if (!isClosed) onStatusChange('connected');
        });
      }

      es.addEventListener('error', (err) => {
        if (isClosed) return;
        onStatusChange('offline');
        if (es && typeof es.close === 'function') {
          es.close();
          es = null;
        }

        // Tự động kết nối lại
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          connect();
        }, retryInterval);
      });
    } catch (err) {
      console.warn('[esp32Service] Connection setup error:', err);
      onStatusChange('offline');
      if (!isClosed) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, retryInterval);
      }
    }
  };

  connect();

  return () => {
    isClosed = true;
    clearTimeout(reconnectTimer);
    if (es && typeof es.close === 'function') {
      es.close();
      es = null;
    }
  };
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
