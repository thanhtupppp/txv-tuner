import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useTemperatures } from '../src/hooks/useTemperatures';
import * as esp32Service from '../src/services/esp32Service';

jest.mock('../src/services/esp32Service');

describe('useTemperatures lifecycle - AppState, sequential polling, and abort boundary', () => {
  let appStateListener;
  let mockSubscribeController;

  beforeEach(() => {
    jest.clearAllMocks();
    AppState.currentState = 'active';

    // Mock AppState.addEventListener
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'change') {
        appStateListener = listener;
      }
      return {
        remove: jest.fn(() => {
          appStateListener = null;
        }),
      };
    });

    mockSubscribeController = jest.fn();
    mockSubscribeController.unsubscribe = jest.fn();
    mockSubscribeController.reconnect = jest.fn();

    esp32Service.subscribeEsp32Stream.mockImplementation(() => mockSubscribeController);
    esp32Service.fetchEsp32Temperatures.mockResolvedValue({
      sensors: [
        { id: 0, name: 'T1', temperatureC: -20.0, online: true },
        { id: 1, name: 'T2', temperatureC: -27.0, online: true },
        { id: 2, name: 'T3', temperatureC: -21.0, online: true },
      ],
      deltaAir: 7.0,
      uptime: 50,
    });
    esp32Service.fetchEsp32Stats.mockResolvedValue({
      freeHeap: 180000,
      uptime: 60,
      wifiRSSI: -50,
    });
  });

  afterEach(() => {
    AppState.addEventListener.mockRestore?.();
  });

  it('subscribes to stream when active and demo mode is off', async () => {
    const { result } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode(); // Turn off demo
    });

    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledTimes(1);
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '192.168.4.1' })
    );
  });

  it('pauses/unsubscribes SSE stream when app transitions to background or inactive', async () => {
    const { result } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode();
    });
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledTimes(1);

    // Transition to background
    await act(async () => {
      AppState.currentState = 'background';
      appStateListener?.('background');
    });

    // Controller must be unsubscribed
    expect(mockSubscribeController.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes to SSE stream exactly once when returning from background to active', async () => {
    const { result } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode();
    });
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledTimes(1);

    // Go to background
    await act(async () => {
      AppState.currentState = 'background';
      appStateListener?.('background');
    });
    expect(mockSubscribeController.unsubscribe).toHaveBeenCalledTimes(1);

    // Return to active
    await act(async () => {
      AppState.currentState = 'active';
      appStateListener?.('active');
    });

    // Should have subscribed again (total 2 times, exactly 1 active stream)
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes and aborts in-flight operations upon hook unmount', async () => {
    const { result, unmount } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode();
    });
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledTimes(1);

    await act(async () => {
      unmount();
    });

    expect(mockSubscribeController.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('aborts previous requests and re-subscribes when IP changes', async () => {
    const { result } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode();
    });
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '192.168.4.1' })
    );

    // Change IP
    await act(async () => {
      await result.current.saveEsp32Ip('192.168.1.150');
    });

    // Must have unsubscribed old IP controller and created new subscription for new IP
    expect(mockSubscribeController.unsubscribe).toHaveBeenCalled();
    expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '192.168.1.150' })
    );
  });

  it('executes fallback polling sequentially without overlapping requests', async () => {
    jest.useFakeTimers();

    let capturedOnStatusChange;
    esp32Service.subscribeEsp32Stream.mockImplementation(({ onStatusChange }) => {
      capturedOnStatusChange = onStatusChange;
      return mockSubscribeController;
    });

    let activeInFlightRequests = 0;
    let maxConcurrentRequests = 0;

    esp32Service.fetchEsp32Temperatures.mockImplementation(async () => {
      activeInFlightRequests++;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeInFlightRequests);

      // Simulate network latency of 1500ms
      await new Promise((resolve) => setTimeout(resolve, 1500));

      activeInFlightRequests--;
      return {
        sensors: [
          { id: 0, name: 'T1', temperatureC: -20.0, online: true },
          { id: 1, name: 'T2', temperatureC: -27.0, online: true },
          { id: 2, name: 'T3', temperatureC: -21.0, online: true },
        ],
        deltaAir: 7.0,
      };
    });

    const { result } = await renderHook(() => useTemperatures());

    await act(async () => {
      result.current.toggleDemoMode();
    });

    // Simulate SSE offline status to trigger sequential fallback polling
    await act(async () => {
      capturedOnStatusChange('offline', { connected: false, attempt: 3 });
    });

    // Advance timers across multiple polling cycles (each 3000ms wait + 1500ms fetch)
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        jest.advanceTimersByTime(3500);
      });
    }

    // Must NEVER exceed 1 concurrent in-flight request
    expect(maxConcurrentRequests).toBe(1);

    jest.useRealTimers();
  });
});
