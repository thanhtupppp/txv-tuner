import { subscribeEsp32Stream } from '../src/services/esp32Service';

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
  });

  it('normalizes IP to /api/stream and opens EventSource', () => {
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const unsubscribe = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      EventSourceImpl: MockEventSource
    });

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];
    expect(instance.url).toBe('http://192.168.4.1/api/stream');
    expect(onStatusChange).toHaveBeenCalledWith('connecting');

    unsubscribe();
    expect(instance.closed).toBe(true);
  });

  it('handles temperatures event and passes parsed json to onData', () => {
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    subscribeEsp32Stream({
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

    expect(onData).toHaveBeenCalledWith(samplePayload);
    expect(onStatusChange).toHaveBeenCalledWith('connected');
  });

  it('handles error event by setting status to offline', () => {
    const onData = jest.fn();
    const onStatusChange = jest.fn();

    const unsubscribe = subscribeEsp32Stream({
      ip: '192.168.4.1',
      onData,
      onStatusChange,
      EventSourceImpl: MockEventSource
    });

    const instance = MockEventSource.instances[0];
    instance.dispatchEvent('error', new Error('Connection lost'));

    expect(onStatusChange).toHaveBeenCalledWith('offline');
    unsubscribe();
  });
});
