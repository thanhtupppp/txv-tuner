import React from 'react';
import { render, act as renderAct } from '@testing-library/react-native';
import { renderHook, act as hookAct } from '@testing-library/react-native';
import { subscribeEsp32Stream } from '../src/services/esp32Service';
import { useTemperatures } from '../src/hooks/useTemperatures';
import { SensorCard } from '../src/components/SensorCard';
import { SensorStatus } from '../src/components/StatsModal';
import { MaterialProvider } from '../src/components/SkeuoKit';
import * as esp32Service from '../src/services/esp32Service';

import { AccessibilityInfo } from 'react-native';

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

describe('End-to-End SSE Telemetry Flow', () => {
  let warnSpy;
  let errorSpy;

  beforeAll(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    MockEventSource.instances = [];
    jest.clearAllMocks();
    jest.useRealTimers();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('1. SSE Stream Telemetry Normalization Flow', () => {
    it('receives raw firmware payload with temp, normalizes to temperatureC while keeping alias', () => {
      const onData = jest.fn();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onData,
        onStatusChange,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      const rawFirmwarePayload = {
        uptime: 120,
        heartbeat: true,
        serverTimestamp: 1700000000000,
        deltaAir: 7.5,
        sensors: [
          { id: 0, name: 'T1 Vào dàn', temp: -20.5, online: true },
          { id: 1, name: 'T2 Ra dàn', temp: null, online: false },
          { id: 2, name: 'T3 Bầu TXV', temp: -18.2, online: true },
        ],
      };

      es.dispatchEvent('temperatures', { data: JSON.stringify(rawFirmwarePayload) });

      expect(onData).toHaveBeenCalledTimes(1);
      const emitted = onData.mock.calls[0][0];

      expect(emitted).toMatchObject({
        uptime: 120,
        heartbeat: true,
        deltaAir: 7.5,
        valid: true,
        serverTimestamp: 1700000000000,
        receivedAt: expect.any(Number),
      });

      // Sensor 0: online, valid
      expect(emitted.sensors[0]).toMatchObject({
        id: 0,
        name: 'T1 Vào dàn',
        temperatureC: -20.5,
        temp: -20.5,
        online: true,
        valid: true,
        status: 'ok',
        reason: null,
      });

      // Sensor 1: offline - should not disrupt other sensors
      expect(emitted.sensors[1]).toMatchObject({
        id: 1,
        name: 'T2 Ra dàn',
        temperatureC: null,
        temp: null,
        online: false,
        valid: false,
        status: 'offline',
        reason: 'SENSOR_OFFLINE',
      });

      // Sensor 2: online, valid
      expect(emitted.sensors[2]).toMatchObject({
        id: 2,
        name: 'T3 Bầu TXV',
        temperatureC: -18.2,
        temp: -18.2,
        online: true,
        valid: true,
        status: 'ok',
        reason: null,
      });

      controller.unsubscribe();
    });

    it('safely catches malformed JSON in temperatures event without crashing stream', () => {
      const onData = jest.fn();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onData,
        onStatusChange,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      expect(() => {
        es.dispatchEvent('temperatures', { data: 'invalid json text {{' });
      }).not.toThrow();

      expect(onData).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ESP32] Parse error for temperatures:'),
        expect.any(Error),
      );

      controller.unsubscribe();
    });
  });

  describe('2. Heartbeat Monitoring and Low Heap Warning', () => {
    it('parses heartbeat payload, enriches receivedAt, and updates status', () => {
      const onHeartbeat = jest.fn();
      const onStatusChange = jest.fn();

      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onHeartbeat,
        onStatusChange,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({
          alive: true,
          freeHeap: 185000,
          uptime: 360,
          wifiRSSI: -58,
        }),
      });

      expect(onHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          alive: true,
          freeHeap: 185000,
          uptime: 360,
          wifiRSSI: -58,
          receivedAt: expect.any(Number),
        }),
      );

      expect(onStatusChange).toHaveBeenCalledWith('connected', {
        connected: true,
        reconnecting: false,
        attempt: 0,
      });

      controller.unsubscribe();
    });

    it('emits low heap warning when freeHeap drops below 10000 bytes', () => {
      const onHeartbeat = jest.fn();
      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onHeartbeat,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({
          alive: true,
          freeHeap: 8500,
          uptime: 420,
        }),
      });

      expect(warnSpy).toHaveBeenCalledWith('[ESP32] Low heap warning: 8500 bytes');
      controller.unsubscribe();
    });

    it('does not emit low heap warning when freeHeap is healthy', () => {
      const onHeartbeat = jest.fn();
      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onHeartbeat,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({
          alive: true,
          freeHeap: 45000,
          uptime: 450,
        }),
      });

      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Low heap warning'));
      controller.unsubscribe();
    });

    it('does not spam duplicate low heap warnings on consecutive low heap heartbeats', () => {
      const onHeartbeat = jest.fn();
      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onHeartbeat,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      // First low heap heartbeat -> warns
      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({ alive: true, freeHeap: 8500, uptime: 400 }),
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Second low heap heartbeat -> deduplicated, does not warn again
      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({ alive: true, freeHeap: 8200, uptime: 410 }),
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Heap recovers -> resets flag
      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({ alive: true, freeHeap: 20000, uptime: 420 }),
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Heap drops again -> warns once more
      es.dispatchEvent('heartbeat', {
        data: JSON.stringify({ alive: true, freeHeap: 7500, uptime: 430 }),
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);

      controller.unsubscribe();
    });
  });

  describe('3. Warning Event Handling', () => {
    it('handles warning event with heap_critical and invokes onWarning callback', () => {
      const onWarning = jest.fn();
      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onWarning,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      es.dispatchEvent('warning', {
        data: JSON.stringify({
          type: 'heap_critical',
          freeHeap: 4096,
          message: 'ESP32 heap critical, restart scheduled in 3s',
        }),
      });

      expect(onWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heap_critical',
          freeHeap: 4096,
          message: 'ESP32 heap critical, restart scheduled in 3s',
          receivedAt: expect.any(Number),
        }),
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ESP32] Warning event received from ESP32:'),
        expect.objectContaining({ type: 'heap_critical' }),
      );

      controller.unsubscribe();
    });

    it('handles malformed warning event safely without crashing stream', () => {
      const onWarning = jest.fn();
      const controller = subscribeEsp32Stream({
        ip: '192.168.4.1',
        onWarning,
        EventSourceImpl: MockEventSource,
      });

      const es = MockEventSource.instances[0];

      expect(() => {
        es.dispatchEvent('warning', { data: '{ broken payload' });
      }).not.toThrow();

      expect(onWarning).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ESP32] Parse error for warning event:'),
        expect.any(Error),
      );

      controller.unsubscribe();
    });
  });

  describe('4. Hook and UI Consumers Integration', () => {
    it('connects SSE output to useTemperatures hook and updates SensorCard and StatsModal', async () => {
      const mockController = {
        reconnect: jest.fn(),
        unsubscribe: jest.fn(),
      };

      let capturedOnData;
      let capturedOnHeartbeat;
      let capturedOnStatusChange;

      jest.spyOn(esp32Service, 'subscribeEsp32Stream').mockImplementation((options) => {
        capturedOnData = options.onData;
        capturedOnHeartbeat = options.onHeartbeat;
        capturedOnStatusChange = options.onStatusChange;
        return mockController;
      });

      const { result } = await renderHook(() => useTemperatures());

      expect(esp32Service.subscribeEsp32Stream).toHaveBeenCalled();

      // Simulate incoming normalized telemetry stream event
      const simulatedStreamPayload = {
        uptime: 200,
        deltaAir: 7.5,
        serverTimestamp: 1700000000000,
        receivedAt: 1700000000500,
        valid: true,
        sensors: [
          {
            id: 0,
            name: 'T1 Vào dàn',
            temperatureC: -20.5,
            temp: -20.5,
            online: true,
            valid: true,
            status: 'ok',
            reason: null,
          },
          {
            id: 1,
            name: 'T2 Ra dàn',
            temperatureC: null,
            temp: null,
            online: false,
            valid: false,
            status: 'offline',
            reason: 'SENSOR_OFFLINE',
          },
          {
            id: 2,
            name: 'T3 Bầu TXV',
            temperatureC: -18.2,
            temp: -18.2,
            online: true,
            valid: true,
            status: 'ok',
            reason: null,
          },
        ],
      };

      await hookAct(async () => {
        capturedOnData(simulatedStreamPayload);
        capturedOnStatusChange('connected', { connected: true, attempt: 0 });
      });

      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.data.sensors[0].temperatureC).toBe(-20.5);
      expect(result.current.data.sensors[0].temp).toBe(-20.5);
      expect(result.current.offlineSensors).toHaveLength(1);
      expect(result.current.offlineSensors[0].id).toBe(1);

      // Verify SensorCard renders properly with normalized sensor
      const { getByText: getCardText } = await render(
        <MaterialProvider themeMode="light">
          <SensorCard sensor={result.current.data.sensors[0]} channelIndex={0} />
        </MaterialProvider>,
      );

      expect(getCardText('-20.5')).toBeTruthy();
      expect(getCardText('T1 Vào dàn')).toBeTruthy();
      expect(getCardText('°C')).toBeTruthy();

      // Verify SensorStatus in StatsModal renders both online and offline correctly
      const { getByText: getStatusText } = await render(
        <SensorStatus sensors={result.current.data.sensors} />,
      );

      expect(getStatusText('T1 Vào dàn')).toBeTruthy();
      expect(getStatusText(/● -20.5°C/)).toBeTruthy();
      expect(getStatusText('T2 Ra dàn')).toBeTruthy();
      expect(getStatusText(/○ Mất kết nối \(Offline\)/)).toBeTruthy();

      // Simulate incoming Heartbeat event updating stats
      await hookAct(async () => {
        capturedOnHeartbeat({
          alive: true,
          freeHeap: 72000,
          uptime: 500,
          wifiRSSI: -48,
          receivedAt: 1700000010000,
        });
      });

      expect(result.current.esp32Stats).toMatchObject({
        freeHeap: 72000,
        uptime: 500,
        wifiRSSI: -48,
        clientConnected: true,
      });

      esp32Service.subscribeEsp32Stream.mockRestore();
    });
  });
});
