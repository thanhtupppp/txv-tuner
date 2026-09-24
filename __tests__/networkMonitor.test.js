import { startNetworkMonitoring } from '../src/services/networkMonitor';

describe('networkMonitor service', () => {
  it('registers listener and detects WiFi connectivity state', () => {
    let capturedCallback;
    const mockUnsubscribe = jest.fn();
    const mockNetInfo = {
      addEventListener: jest.fn((cb) => {
        capturedCallback = cb;
        return mockUnsubscribe;
      })
    };

    const onNetworkChange = jest.fn();
    const unsubscribe = startNetworkMonitoring(onNetworkChange, { NetInfoImpl: mockNetInfo });

    expect(mockNetInfo.addEventListener).toHaveBeenCalled();

    // WiFi connected to ESP32
    capturedCallback({
      type: 'wifi',
      isConnected: true,
      details: { ssid: 'TuSmart-TXV-Tuner' }
    });

    expect(onNetworkChange).toHaveBeenCalledWith(expect.objectContaining({
      isWifi: true,
      isConnected: true,
      isEsp32Ssid: true
    }));

    // WiFi disconnected
    capturedCallback({
      type: 'none',
      isConnected: false,
      details: null
    });

    expect(onNetworkChange).toHaveBeenCalledWith(expect.objectContaining({
      isWifi: false,
      isConnected: false,
      isEsp32Ssid: false
    }));

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
