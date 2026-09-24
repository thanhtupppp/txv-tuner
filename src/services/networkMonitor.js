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
 * Theo dõi trạng thái kết nối mạng (hỗ trợ cả Web và React Native)
 * @param {Function} onNetworkChange Callback nhận { isWifi, isConnected, isEsp32Ssid, type }
 * @param {Object} [options]
 * @param {any} [options.NetInfoImpl] Mock implementation cho unit test
 * @returns {Function} Hàm unsubscribe
 */
export function startNetworkMonitoring(onNetworkChange, options = {}) {
  const NetInfo = getNetInfoImpl(options.NetInfoImpl);

  if (Platform.OS === 'web' && !options.NetInfoImpl) {
    const handleOnline = () => {
      onNetworkChange({
        isWifi: true,
        isConnected: true,
        isEsp32Ssid: true,
        type: 'wifi'
      });
    };

    const handleOffline = () => {
      onNetworkChange({
        isWifi: false,
        isConnected: false,
        isEsp32Ssid: false,
        type: 'none'
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      handleOnline();
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }

  if (NetInfo && typeof NetInfo.addEventListener === 'function') {
    return NetInfo.addEventListener((state) => {
      const isWifi = state.type === 'wifi';
      const ssid = state.details?.ssid;
      const isEsp32Ssid = Boolean(isWifi && ssid && ESP32_SSIDS.includes(ssid));

      onNetworkChange({
        isWifi,
        isConnected: Boolean(state.isConnected),
        isEsp32Ssid,
        type: state.type,
        details: state.details
      });
    });
  }

  return () => {};
}
