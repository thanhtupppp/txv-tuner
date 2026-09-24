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
    const mockUnsubscribe = jest.fn();

    esp32Service.subscribeEsp32Stream.mockImplementation(({ onData, onStatusChange }) => {
      capturedOnData = onData;
      capturedOnStatusChange = onStatusChange;
      return mockUnsubscribe;
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
        uptime: 100
      });
      capturedOnStatusChange('connected');
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.data.sensors[0].temp).toBe(-15.5);
    expect(result.current.data.deltaAir).toBe(9.5);
  });
});
