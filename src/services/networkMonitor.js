import { Platform } from 'react-native';

const ESP32_SSIDS = ['TuSmart-TXV-Tuner', 'TXV-Tuner-ESP32'];

export function getNetInfoImpl(customImpl) {
  if (customImpl) return customImpl;
  try {
    return require('@react-native-community/netinfo').default;
  } catch (e) {
    return null;
  }
}

/**
 * Định dạng payload trạng thái mạng
 */
function formatNetworkState(state) {
  const isWifi = state?.type === 'wifi';
  const ssid = state?.details?.ssid;
  const isEsp32Ssid = Boolean(isWifi && ssid && ESP32_SSIDS.includes(ssid));
  const isConnected = Boolean(state?.isConnected);
  const isConnectedToESP32 = Boolean(isWifi && (isEsp32Ssid || !ssid));
  const hasInternet = Boolean(isConnected && state?.isInternetReachable !== false);

  return {
    isWifi,
    isConnected,
    isEsp32Ssid,
    isConnectedToESP32,
    hasInternet,
    type: state?.type || 'none',
    details: state?.details || null
  };
}

/**
 * Theo dõi trạng thái kết nối mạng (hỗ trợ cả Web và React Native)
 * Có hỗ trợ Fetch trạng thái ban đầu, Debounce và xử lý ngoại lệ
 *
 * @param {Function} onNetworkChange Callback nhận formatted network state
 * @param {Object} [options]
 * @param {number} [options.debounceMs=800] Thời gian lọc nhiễu mạng (ms)
 * @param {any} [options.NetInfoImpl] Mock implementation cho unit test
 * @returns {Function} Hàm unsubscribe
 */
export function startNetworkMonitoring(onNetworkChange, options = {}) {
  const NetInfo = getNetInfoImpl(options.NetInfoImpl);
  const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 800;

  let debounceTimer = null;
  let isUnsubscribed = false;

  const dispatchState = (state, immediate = false) => {
    if (isUnsubscribed) return;

    const formatted = formatNetworkState(state);

    if (immediate || debounceMs <= 0) {
      clearTimeout(debounceTimer);
      onNetworkChange(formatted);
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isUnsubscribed) {
        onNetworkChange(formatted);
      }
    }, debounceMs);
  };

  if (Platform.OS === 'web' && !options.NetInfoImpl) {
    const handleOnline = () => {
      dispatchState({
        type: 'wifi',
        isConnected: true,
        isInternetReachable: true,
        details: null
      });
    };

    const handleOffline = () => {
      dispatchState({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
        details: null
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      handleOnline();
    }

    return () => {
      isUnsubscribed = true;
      clearTimeout(debounceTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }

  let netInfoUnsub = null;

  if (NetInfo) {
    // 1. Initial Fetch
    if (typeof NetInfo.fetch === 'function') {
      try {
        NetInfo.fetch()
          .then((state) => {
            if (!isUnsubscribed) {
              dispatchState(state, true); // Immediate cho trạng thái ban đầu
            }
          })
          .catch((err) => {
            console.warn('[NetworkMonitor] Fetch failed:', err);
            if (!isUnsubscribed) {
              dispatchState({ isConnected: false, type: 'none' }, true);
            }
          });
      } catch (err) {
        console.warn('[NetworkMonitor] Fetch exception:', err);
        dispatchState({ isConnected: false, type: 'none' }, true);
      }
    }

    // 2. Add Event Listener
    if (typeof NetInfo.addEventListener === 'function') {
      try {
        netInfoUnsub = NetInfo.addEventListener((state) => {
          dispatchState(state, false);
        });
      } catch (err) {
        console.error('[NetworkMonitor] addEventListener failed:', err);
      }
    }
  }

  return () => {
    isUnsubscribed = true;
    clearTimeout(debounceTimer);
    if (typeof netInfoUnsub === 'function') {
      try {
        netInfoUnsub();
      } catch (e) {}
    }
  };
}
