import { subscribeEsp32Stream } from '../src/services/esp32Service';
import { useTemperatures } from '../src/hooks/useTemperatures';
import { renderHook, act as hookAct } from '@testing-library/react-native';
import * as esp32Service from '../src/services/esp32Service';

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

describe('SSE Reconnect and Recovery Behavior', () => {
  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    MockEventSource.instances = [];
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    jest.useRealTimers();
  });

  describe('1. Connection Drop and Exponential Backoff Reconnect', () => {
    it('closes socket on error, calculates exponential backoff delay, and reconnects', () => {
      jest.useFakeTimers();
      const onStatusChange = jest.fn();
      const onData = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onData,
        onStatusChange,
        initialRetryDelay: 1000,
        maxRetryDelay: 10000,
        maxAttempts: 3,
        EventSourceImpl: MockEventSource,
      });

      expect(MockEventSource.instances.length).toBe(1);
      const instance1 = MockEventSource.instances[0];

      // Error event on first connection
      instance1.dispatchEvent('error', new Error('Connection reset by peer'));

      expect(instance1.closed).toBe(true);
      expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.objectContaining({
        connected: false,
        reconnecting: true,
        attempt: 1,
        maxAttempts: 3,
        delay: 1000,
        reason: 'error_event',
      }));

      // Before delay expires, no new EventSource is created
      jest.advanceTimersByTime(500);
      expect(MockEventSource.instances.length).toBe(1);

      // Advance past delay 1000ms
      jest.advanceTimersByTime(550);
      expect(MockEventSource.instances.length).toBe(2);
      const instance2 = MockEventSource.instances[1];
      expect(instance2.closed).toBe(false);

      // Attempt 2 error: backoff delay = 1000 * 1.5 = 1500ms
      instance2.dispatchEvent('error', new Error('Connection refused'));
      expect(instance2.closed).toBe(true);
      expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.objectContaining({
        attempt: 2,
        delay: 1500,
      }));

      // Advance past delay 1500ms
      jest.advanceTimersByTime(1550);
      expect(MockEventSource.instances.length).toBe(3);
      const instance3 = MockEventSource.instances[2];

      // Attempt 3 error: reaches maxAttempts (3) -> stops auto-reconnect
      instance3.dispatchEvent('error', new Error('Host unreachable'));
      expect(instance3.closed).toBe(true);
      expect(onStatusChange).toHaveBeenCalledWith('offline', expect.objectContaining({
        connected: false,
        reconnecting: false,
        maxAttemptsReached: true,
        attempt: 3,
      }));

      // Timers advance further, no more auto-reconnects happen
      jest.advanceTimersByTime(60000);
      expect(MockEventSource.instances.length).toBe(3);

      controller.unsubscribe();
    });
  });

  describe('2. Single Active EventSource Guarantee', () => {
    it('ensures old instances are closed and no duplicate EventSources exist', () => {
      jest.useFakeTimers();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onStatusChange,
        initialRetryDelay: 1000,
        EventSourceImpl: MockEventSource,
      });

      expect(MockEventSource.instances.length).toBe(1);
      const first = MockEventSource.instances[0];

      // Trigger error
      first.dispatchEvent('error', new Error('Drop'));
      expect(first.closed).toBe(true);

      // Trigger reconnect
      jest.advanceTimersByTime(1050);
      expect(MockEventSource.instances.length).toBe(2);
      const second = MockEventSource.instances[1];
      expect(second.closed).toBe(false);

      // Manual reconnect called while second is running
      controller.reconnect();
      expect(second.closed).toBe(true);
      expect(MockEventSource.instances.length).toBe(3);
      const third = MockEventSource.instances[2];
      expect(third.closed).toBe(false);

      // Unsubscribe closes third
      controller.unsubscribe();
      expect(third.closed).toBe(true);
    });
  });

  describe('3. ESP32 Restart Flow after heap_critical', () => {
    it('handles heap_critical warning, disconnects, reconnects upon reboot, and recovers', () => {
      jest.useFakeTimers();
      const onWarning = jest.fn();
      const onData = jest.fn();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onData,
        onWarning,
        onStatusChange,
        initialRetryDelay: 1000,
        EventSourceImpl: MockEventSource,
      });

      const es1 = MockEventSource.instances[0];

      // 1. ESP32 issues critical heap warning before restarting
      es1.dispatchEvent('warning', {
        data: JSON.stringify({
          type: 'heap_critical',
          freeHeap: 2048,
          uptime: 3600,
          message: 'Heap exhausted. Restarting ESP32 in 2 seconds...',
        }),
      });

      expect(onWarning).toHaveBeenCalledWith(expect.objectContaining({
        type: 'heap_critical',
        freeHeap: 2048,
      }));

      // 2. ESP32 restarts -> socket disconnects
      es1.dispatchEvent('error', new Error('Socket closed by server reboot'));
      expect(es1.closed).toBe(true);
      expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.any(Object));

      // 3. Reconnect attempt 1 happens while ESP32 is still booting -> fails
      jest.advanceTimersByTime(1050);
      expect(MockEventSource.instances.length).toBe(2);
      const es2 = MockEventSource.instances[1];
      es2.dispatchEvent('error', new Error('Connection refused (booting)'));
      expect(es2.closed).toBe(true);

      // 4. Reconnect attempt 2 -> ESP32 is back online!
      jest.advanceTimersByTime(1550);
      expect(MockEventSource.instances.length).toBe(3);
      const es3 = MockEventSource.instances[2];
      expect(es3.closed).toBe(false);

      // 5. ESP32 emits fresh sensor data post-restart
      es3.dispatchEvent('temperatures', {
        data: JSON.stringify({
          uptime: 5,
          heartbeat: true,
          sensors: [
            { id: 0, name: 'T1 Vào dàn', temp: -21.0, online: true },
            { id: 1, name: 'T2 Ra dàn', temp: -28.5, online: true },
            { id: 2, name: 'T3 Bầu TXV', temp: -17.9, online: true },
          ],
        }),
      });

      // Stream successfully recovers
      expect(onStatusChange).toHaveBeenCalledWith('connected', expect.objectContaining({
        connected: true,
        attempt: 0,
      }));
      expect(onData).toHaveBeenCalledWith(expect.objectContaining({
        uptime: 5,
        valid: true,
        sensors: expect.arrayContaining([
          expect.objectContaining({ id: 0, temperatureC: -21.0, temp: -21.0, status: 'ok' }),
        ]),
      }));

      controller.unsubscribe();
    });
  });

  describe('4. Heartbeat Watchdog Timeout and Periodic Reset', () => {
    it('triggers watchdog reconnect if heartbeat/data stops, but resets when data arrives', () => {
      jest.useFakeTimers();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onStatusChange,
        heartbeatTimeoutMs: 5000,
        initialRetryDelay: 1000,
        EventSourceImpl: MockEventSource,
      });

      const es1 = MockEventSource.instances[0];

      // Normal heartbeat keeps watchdog alive
      jest.advanceTimersByTime(3000);
      es1.dispatchEvent('heartbeat', { data: JSON.stringify({ alive: true, freeHeap: 180000 }) });

      // Advance another 3000ms (total 6000ms, but reset occurred at 3000ms, so 3000ms elapsed since last reset)
      jest.advanceTimersByTime(3000);
      expect(es1.closed).toBe(false);

      // Now silence for full 5000ms -> watchdog fires
      jest.advanceTimersByTime(5050);
      expect(es1.closed).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Heartbeat timeout! ESP32 may be frozen.'));
      expect(onStatusChange).toHaveBeenCalledWith('reconnecting', expect.objectContaining({
        reason: 'heartbeat_timeout',
      }));

      // Auto-reconnect triggered after timeout
      jest.advanceTimersByTime(1050);
      expect(MockEventSource.instances.length).toBe(2);
      const es2 = MockEventSource.instances[1];
      expect(es2.closed).toBe(false);

      controller.unsubscribe();
    });
  });

  describe('5. Unsubscribe Cleanup on Unmount', () => {
    it('stops all reconnect timers, cancels watchdog, closes socket, and ignores post-unmount events', () => {
      jest.useFakeTimers();
      const onData = jest.fn();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onData,
        onStatusChange,
        initialRetryDelay: 1000,
        heartbeatTimeoutMs: 5000,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      // Unmount / Unsubscribe
      controller.unsubscribe();
      expect(es.closed).toBe(true);

      // Advancing past watchdog or reconnect time does not trigger any reconnect
      jest.advanceTimersByTime(10000);
      expect(MockEventSource.instances.length).toBe(1);

      // Firing events on closed socket does nothing
      es.dispatchEvent('temperatures', {
        data: JSON.stringify({
          sensors: [{ id: 0, temp: -20, online: true }],
        }),
      });

      expect(onData).not.toHaveBeenCalled();
    });
  });

  describe('6. Data Recovery in useTemperatures Hook After Reconnection', () => {
    it('recovers live hook state and updates telemetry history seamlessly across reconnects', async () => {
      jest.useRealTimers();
      const mockController = {
        reconnect: jest.fn(),
        unsubscribe: jest.fn(),
      };

      let capturedOnData;
      let capturedOnStatusChange;

      jest.spyOn(esp32Service, 'subscribeEsp32Stream').mockImplementation((options) => {
        capturedOnData = options.onData;
        capturedOnStatusChange = options.onStatusChange;
        return mockController;
      });

      const { result } = await renderHook(() => useTemperatures());

      // Turn off demo mode
      await hookAct(async () => {
        result.current.toggleDemoMode();
      });

      // 1. Initial live stream data before drop
      await hookAct(async () => {
        capturedOnStatusChange('connected', { connected: true, attempt: 0 });
        capturedOnData({
          receivedAt: 1700000000000,
          sensors: [
            { id: 0, name: 'T1', temperatureC: -20.0, temp: -20.0, online: true },
            { id: 1, name: 'T2', temperatureC: -28.0, temp: -28.0, online: true },
            { id: 2, name: 'T3', temperatureC: -18.0, temp: -18.0, online: true },
          ],
        });
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.data.sensors[0].temperatureC).toBe(-20.0);
      expect(result.current.history).toHaveLength(1);

      // 2. Stream drops connection
      await hookAct(async () => {
        capturedOnStatusChange('reconnecting', { connected: false, reconnecting: true, attempt: 1 });
      });

      expect(result.current.connectionStatus).toBe('reconnecting');
      expect(result.current.reconnectAttempt).toBe(1);

      // 3. Reconnect succeeds and fresh telemetry arrives
      await hookAct(async () => {
        capturedOnStatusChange('connected', { connected: true, reconnecting: false, attempt: 0 });
        capturedOnData({
          receivedAt: 1700000005000,
          sensors: [
            { id: 0, name: 'T1', temperatureC: -19.2, temp: -19.2, online: true },
            { id: 1, name: 'T2', temperatureC: -27.5, temp: -27.5, online: true },
            { id: 2, name: 'T3', temperatureC: -17.6, temp: -17.6, online: true },
          ],
        });
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.reconnectAttempt).toBe(0);
      expect(result.current.data.sensors[0].temperatureC).toBe(-19.2);
      expect(result.current.data.sensors[0].temp).toBe(-19.2);
      expect(result.current.lastUpdate).toBe(1700000005000);
      expect(result.current.history).toHaveLength(2);
      expect(result.current.history[1].t1).toBe(-19.2);

      esp32Service.subscribeEsp32Stream.mockRestore();
    });
  });
});
