import { startNetworkMonitoring } from '../src/services/networkMonitor';

describe('networkMonitor service', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('fetches initial state and registers listener with debounce', async () => {
    jest.useFakeTimers();

    let capturedCallback;
    const mockUnsubscribe = jest.fn();
    const initialNetworkState = {
      type: 'wifi',
      isConnected: true,
      isInternetReachable: false,
      details: { ssid: 'TuSmart-TXV-Tuner' }
    };

    const mockNetInfo = {
      fetch: jest.fn().mockResolvedValue(initialNetworkState),
      addEventListener: jest.fn((cb) => {
        capturedCallback = cb;
        return mockUnsubscribe;
      })
    };

    const onNetworkChange = jest.fn();
    const unsubscribe = startNetworkMonitoring(onNetworkChange, {
      NetInfoImpl: mockNetInfo,
      debounceMs: 500
    });

    expect(mockNetInfo.fetch).toHaveBeenCalled();
    expect(mockNetInfo.addEventListener).toHaveBeenCalled();

    // Wait for fetch promise
    await Promise.resolve();

    expect(onNetworkChange).toHaveBeenCalledWith(expect.objectContaining({
      isWifi: true,
      isConnected: true,
      isConnectedToESP32: true,
      hasInternet: false,
      isEsp32Ssid: true
    }));

    // Trigger rapid network state changes (debounced)
    capturedCallback({
      type: 'none',
      isConnected: false,
      details: null
    });
    capturedCallback({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { ssid: 'TuSmart-TXV-Tuner' }
    });

    // Before debounce timer expires, second callback hasn't run yet
    expect(onNetworkChange).toHaveBeenCalledTimes(1);

    // Fast-forward 500ms debounce
    jest.advanceTimersByTime(550);

    expect(onNetworkChange).toHaveBeenCalledTimes(2);
    expect(onNetworkChange).toHaveBeenLastCalledWith(expect.objectContaining({
      isWifi: true,
      isConnected: true,
      hasInternet: true,
      isEsp32Ssid: true
    }));

    unsubscribe();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('gracefully handles fetch errors', async () => {
    const mockNetInfo = {
      fetch: jest.fn().mockRejectedValue(new Error('NetInfo failed')),
      addEventListener: jest.fn(() => jest.fn())
    };

    const onNetworkChange = jest.fn();
    const unsubscribe = startNetworkMonitoring(onNetworkChange, { NetInfoImpl: mockNetInfo });

    await Promise.resolve();
    await Promise.resolve();

    expect(onNetworkChange).toHaveBeenCalledWith(expect.objectContaining({
      isConnected: false,
      isConnectedToESP32: false
    }));

    unsubscribe();
  });
});
