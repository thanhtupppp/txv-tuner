import { subscribeEsp32Stream, fetchEsp32Stats, fetchEsp32Temperatures } from '../src/services/esp32Service';

class MockEventSource {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = {};
    this.closed = false;
    MockEventSource.instances.push(this);
  }

  addEventListener(event, callback) {
    this.listeners[event] = callback;
  }

  dispatchEvent(event, data) {
    if (this.listeners[event]) {
      this.listeners[event](data);
    }
  }

  close() {
    this.closed = true;
  }
}
MockEventSource.instances = [];

describe('esp32Service SSE Streaming', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('normalizes IP to /api/stream and opens EventSource', () => {
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      EventSourceImpl: MockEventSource
    });

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];
    expect(instance.url).toBe('http://192.168.4.1/api/stream');
    expect(onStatusChange).toHaveBeenCalledWith('connecting', expect.any(Object));

    controller.unsubscribe();
    expect(instance.closed).toBe(true);
  });

  it('handles temperatures event and passes parsed json with timestamp enrichment to onData', () => {
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: 'http://192.168.4.1/',
      onData,
      onStatusChange,
      EventSourceImpl: MockEventSource
    });

    const instance = MockEventSource.instances[0];
    expect(instance.url).toBe('http://192.168.4.1/api/stream');

    const samplePayload = {
      sensors: [
        { id: 0, name: 'T1 Vào dàn', temp: -20.5, online: true },
        { id: 1, name: 'T2 Ra dàn', temp: -28.0, online: true },
        { id: 2, name: 'T3 Bầu TXV', temp: -18.2, online: true }
      ],
      deltaAir: 7.5,
      uptime: 45
    };

    instance.dispatchEvent('temperatures', { data: JSON.stringify(samplePayload) });

    expect(onData).toHaveBeenCalledWith(expect.objectContaining({
      deltaAir: 7.5,
      uptime: 45,
      receivedAt: expect.any(Number),
      valid: true,
      sensors: [
        expect.objectContaining({ id: 0, name: 'T1 Vào dàn', temp: -20.5, temperatureC: -20.5, online: true, status: 'ok' }),
        expect.objectContaining({ id: 1, name: 'T2 Ra dàn', temp: -28.0, temperatureC: -28.0, online: true, status: 'ok' }),
        expect.objectContaining({ id: 2, name: 'T3 Bầu TXV', temp: -18.2, temperatureC: -18.2, online: true, status: 'ok' }),
      ],
    }));
    expect(onStatusChange).toHaveBeenCalledWith('connected', expect.any(Object));
    controller.unsubscribe();
  });

  it('handles heartbeat event and invokes onHeartbeat callback', () => {
    const onData = jest.fn();
    const onHeartbeat = jest.fn();
    const onStatusChange = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onHeartbeat,
      onStatusChange,
      EventSourceImpl: MockEventSource
    });

    const instance = MockEventSource.instances[0];
    instance.dispatchEvent('heartbeat', {
      data: JSON.stringify({ alive: true, freeHeap: 185000, uptime: 120 })
    });

    expect(onHeartbeat).toHaveBeenCalledWith(expect.objectContaining({
      alive: true,
      freeHeap: 185000,
      uptime: 120,
      receivedAt: expect.any(Number)
    }));
    expect(onStatusChange).toHaveBeenCalledWith('connected', expect.any(Object));
    controller.unsubscribe();
  });

  it('triggers watchdog timeout when no data/heartbeat arrives within timeout window', () => {
    jest.useFakeTimers();
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      heartbeatTimeoutMs: 5000,
      EventSourceImpl: MockEventSource
    });

    const firstInstance = MockEventSource.instances[0];
    // Giả lập kết nối thành công ban đầu
    firstInstance.dispatchEvent('connected', {});
    expect(onStatusChange).toHaveBeenCalledWith('connected', expect.any(Object));

    // Tua qua thời gian timeout 5000ms
    jest.advanceTimersByTime(5050);

    // Watchdog phải đóng kết nối và kích hoạt reconnect
    expect(firstInstance.closed).toBe(true);
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.objectContaining({
      reason: 'heartbeat_timeout'
    }));

    controller.unsubscribe();
  });

  it('implements exponential backoff and caps at maxAttempts', () => {
    jest.useFakeTimers();
    const onData = jest.fn();
    const onStatusChange = jest.fn();
    const onError = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      onError,
      initialRetryDelay: 1000,
      maxAttempts: 3,
      EventSourceImpl: MockEventSource
    });

    // Lần 1 thất bại
    MockEventSource.instances[0].dispatchEvent('error', new Error('Fail 1'));
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.objectContaining({ attempt: 1, maxAttempts: 3 }));

    // Advance timer 1000ms
    jest.advanceTimersByTime(1050);
    expect(MockEventSource.instances.length).toBe(2);

    // Lần 2 thất bại
    MockEventSource.instances[1].dispatchEvent('error', new Error('Fail 2'));
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.objectContaining({ attempt: 2, maxAttempts: 3 }));

    // Advance timer (1000 * 1.5 = 1500ms)
    jest.advanceTimersByTime(1550);
    expect(MockEventSource.instances.length).toBe(3);

    // Lần 3 thất bại (vượt quá maxAttempts)
    MockEventSource.instances[2].dispatchEvent('error', new Error('Fail 3'));
    expect(onStatusChange).toHaveBeenCalledWith('offline', expect.objectContaining({
      maxAttemptsReached: true,
      attempt: 3
    }));
    expect(onError).toHaveBeenCalled();

    // Không tự động reconnect thêm lần nào nữa
    jest.advanceTimersByTime(30000);
    expect(MockEventSource.instances.length).toBe(3);

    // Nhưng cho phép gọi manual reconnect()
    controller.reconnect();
    expect(MockEventSource.instances.length).toBe(4);

    controller.unsubscribe();
  });

  it('pauses streaming on network disconnect and resumes when network restored', () => {
    let capturedNetworkCallback;
    const mockNetInfo = {
      addEventListener: jest.fn((cb) => {
        capturedNetworkCallback = cb;
        return jest.fn();
      })
    };

    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      EventSourceImpl: MockEventSource,
      networkOptions: { NetInfoImpl: mockNetInfo, debounceMs: 0 }
    });

    expect(MockEventSource.instances.length).toBe(1);

    // Simulate WiFi disconnect
    capturedNetworkCallback({ isConnected: false, type: 'none' });
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(onStatusChange).toHaveBeenCalledWith('offline', expect.objectContaining({
      reason: 'network_disconnected'
    }));

    // Simulate WiFi reconnect
    capturedNetworkCallback({ isConnected: true, type: 'wifi' });
    expect(MockEventSource.instances.length).toBe(2);

    controller.unsubscribe();
  });

  it('detects and warns when sensors are offline', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const controller = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      EventSourceImpl: MockEventSource
    });

    const instance = MockEventSource.instances[0];
    instance.dispatchEvent('temperatures', {
      data: JSON.stringify({
        sensors: [
          { id: 0, name: 'T1 Vào dàn', temp: -20.0, online: true },
          { id: 1, name: 'T2 Ra dàn', temp: null, online: false },
          { id: 2, name: 'T3 Bầu TXV', temp: -18.0, online: true }
        ],
        uptime: 60
      })
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[ESP32] Offline sensors:'),
      expect.stringContaining('T2 Ra dàn')
    );
    expect(onStatusChange).toHaveBeenCalledWith('connected', expect.objectContaining({
      offlineCount: 1
    }));

    warnSpy.mockRestore();
    controller.unsubscribe();
  });
});

describe('esp32Service REST Fallbacks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetchEsp32Temperatures fetches and returns data via safe read', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {},
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          sensors: [{ id: 0, name: 'T1', temp: 25.0, online: true }],
          uptime: 100,
        }),
      ),
    });

    const data = await fetchEsp32Temperatures('192.168.4.1');
    expect(data.sensors[0].temp).toBe(25.0);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.4.1/api/temperatures',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('fetchEsp32Stats fetches system statistics via safe read', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {},
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          freeHeap: 245000,
          uptime: 300,
          clientConnected: true,
        }),
      ),
    });

    const data = await fetchEsp32Stats('192.168.4.1');
    expect(data.freeHeap).toBe(245000);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.4.1/api/stats',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

