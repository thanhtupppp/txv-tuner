import { renderHook, act } from '@testing-library/react-native';
import { useTemperatures } from '../src/hooks/useTemperatures';
import * as esp32Service from '../src/services/esp32Service';

jest.mock('../src/services/esp32Service');

describe('useTemperatures hook with SSE streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts in demo mode with initial demo sensors and status', async () => {
    const { result } = await renderHook(() => useTemperatures());

    expect(result.current.isDemoMode).toBe(true);
    expect(result.current.connectionStatus).toBe('demo');
    expect(result.current.data.sensors).toHaveLength(3);
  });

  it('subscribes to ESP32 stream when demo mode is toggled off', async () => {
    let capturedOnData;
    let capturedOnStatusChange;
    let capturedOnHeartbeat;
    const mockController = jest.fn();
    mockController.reconnect = jest.fn();

    esp32Service.subscribeEsp32Stream.mockImplementation(({ onData, onStatusChange, onHeartbeat }) => {
      capturedOnData = onData;
      capturedOnStatusChange = onStatusChange;
      capturedOnHeartbeat = onHeartbeat;
      return mockController;
    });

    const { result } = await renderHook(() => useTemperatures());

    // Toggle demo mode off
    await act(async () => {
      result.current.toggleDemoMode();
    });

    expect(result.current.isDemoMode).toBe(false);
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalled();

    // Simulate incoming stream data
    await act(async () => {
      capturedOnData({
        sensors: [
          { id: 0, name: 'T1 Vào dàn', temp: -15.5, online: true },
          { id: 1, name: 'T2 Ra dàn', temp: -25.0, online: true },
          { id: 2, name: 'T3 Bầu TXV', temp: -12.1, online: true }
        ],
        deltaAir: 9.5,
        uptime: 100,
        receivedAt: 1700000000000
      });
      capturedOnStatusChange('connected', { connected: true, attempt: 0 });
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.data.sensors[0].temp).toBe(-15.5);
    expect(result.current.data.deltaAir).toBe(9.5);
    expect(result.current.lastUpdate).toBeTruthy();

    // Simulate heartbeat event
    await act(async () => {
      capturedOnHeartbeat({
        alive: true,
        freeHeap: 190000,
        uptime: 105
      });
    });
    expect(result.current.heartbeatInfo?.freeHeap).toBe(190000);

    // Simulate reconnect status
    await act(async () => {
      capturedOnStatusChange('reconnecting', { attempt: 2, maxAttempts: 10 });
    });
    expect(result.current.connectionStatus).toBe('reconnecting');
    expect(result.current.reconnectAttempt).toBe(2);

    // Call manual reconnect
    await act(async () => {
      result.current.reconnect();
    });
    expect(mockController.reconnect).toHaveBeenCalled();

    // Check esp32Stats merged from heartbeat
    expect(result.current.esp32Stats?.freeHeap).toBe(190000);
    expect(result.current.esp32Stats?.uptime).toBe(105);

    // Simulate 1 offline sensor
    await act(async () => {
      capturedOnData({
        sensors: [
          { id: 0, name: 'T1 Vào dàn', temp: -15.5, online: true },
          { id: 1, name: 'T2 Ra dàn', temp: null, online: false },
          { id: 2, name: 'T3 Bầu TXV', temp: -12.1, online: true }
        ],
        deltaAir: null,
        uptime: 110
      });
    });

    expect(result.current.offlineSensors).toHaveLength(1);
    expect(result.current.offlineSensors[0].name).toBe('T2 Ra dàn');
  });

  it('caps history length at 30 items to prevent unbounded memory growth', async () => {
    let capturedOnData;
    const mockController = jest.fn();

    esp32Service.subscribeEsp32Stream.mockImplementation(({ onData }) => {
      capturedOnData = onData;
      return mockController;
    });

    const { result } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode();
    });

    // Send 35 data points
    await act(async () => {
      for (let i = 0; i < 35; i++) {
        capturedOnData({
          receivedAt: 1700000000000 + i * 1000,
          sensors: [
            { id: 0, temperatureC: -20 + i * 0.1, online: true },
            { id: 1, temperatureC: -28 + i * 0.1, online: true },
            { id: 2, temperatureC: -18 + i * 0.1, online: true },
          ],
        });
      }
    });

    expect(result.current.history).toHaveLength(30);
    expect(result.current.history[29].t1).toBeCloseTo(-20 + 34 * 0.1, 1);
  });
});
