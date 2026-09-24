import { normalizeTelemetry } from '../src/domain/telemetry/normalizeTelemetry';
import { TELEMETRY_SENSOR_STATUS } from '../src/domain/telemetry/telemetryConstants';

const now = 1_700_000_000_000;

describe('normalizeTelemetry', () => {
  it('normalizes a valid sensor and defaults name if not provided', () => {
    const raw = {
      sensors: [
        { id: 0, temperature: -15.5, online: true },
        { id: 1, name: 'T2 Ra dàn', temperature: -12.3, online: true },
      ],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sensors).toHaveLength(2);

    expect(result.sensors[0]).toEqual({
      id: 0,
      name: 'T1',
      temperatureC: -15.5,
      online: true,
      valid: true,
      status: TELEMETRY_SENSOR_STATUS.OK,
      reason: null,
    });

    expect(result.sensors[1]).toEqual({
      id: 1,
      name: 'T2 Ra dàn',
      temperatureC: -12.3,
      online: true,
      valid: true,
      status: TELEMETRY_SENSOR_STATUS.OK,
      reason: null,
    });
  });

  it('handles ESP32 firmware field temp', () => {
    const raw = {
      sensors: [
        {
          id: 0,
          name: 'T1 Vào dàn',
          temp: -15.5,
          online: true,
        },
      ],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.sensors[0]).toEqual({
      id: 0,
      name: 'T1 Vào dàn',
      temperatureC: -15.5,
      online: true,
      valid: true,
      status: TELEMETRY_SENSOR_STATUS.OK,
      reason: null,
    });
  });

  it.each([
    ['temperature', { id: 0, temperature: -18.25, online: true }, -18.25],
    ['value', { id: 0, value: -14.5, online: true }, -14.5],
    ['current', { id: 0, current: 8.75, online: true }, 8.75],
  ])('falls back to %s when temp is not present', (_, sensorInput, expectedTemp) => {
    const result = normalizeTelemetry({ sensors: [sensorInput] }, now);

    expect(result.sensors[0].temperatureC).toBe(expectedTemp);
    expect(result.sensors[0].status).toBe(TELEMETRY_SENSOR_STATUS.OK);
    expect(result.sensors[0].valid).toBe(true);
  });

  it('marks an offline sensor properly', () => {
    const raw = {
      sensors: [
        {
          id: 0,
          name: 'T1 Vào dàn',
          online: false,
          temp: null,
        },
      ],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.sensors[0]).toEqual({
      id: 0,
      name: 'T1 Vào dàn',
      temperatureC: null,
      online: false,
      valid: false,
      status: TELEMETRY_SENSOR_STATUS.OFFLINE,
      reason: 'SENSOR_OFFLINE',
    });
  });

  it('marks an online sensor without temperature as missing', () => {
    const raw = {
      sensors: [
        {
          id: 0,
          name: 'T1 Vào dàn',
          online: true,
        },
      ],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.sensors[0]).toEqual({
      id: 0,
      name: 'T1 Vào dàn',
      temperatureC: null,
      online: true,
      valid: false,
      status: TELEMETRY_SENSOR_STATUS.MISSING,
      reason: 'TEMPERATURE_MISSING',
    });
  });

  it.each([-80.01, 100.01, 150])(
    'marks sensor with out-of-range temperature (%p) as out_of_range',
    (temp) => {
      const raw = {
        sensors: [
          {
            id: 0,
            temp,
            online: true,
          },
        ],
      };

      const result = normalizeTelemetry(raw, now);

      expect(result.sensors[0].status).toBe(TELEMETRY_SENSOR_STATUS.OUT_OF_RANGE);
      expect(result.sensors[0].reason).toBe('TEMPERATURE_OUT_OF_RANGE');
      expect(result.sensors[0].valid).toBe(false);
      expect(result.sensors[0].temperatureC).toBe(temp);
    },
  );

  it('marks sensor with invalid id as invalid', () => {
    const raw = {
      sensors: [
        { id: -1, temp: 20, online: true },
        { id: 'wrong', temp: 22, online: true },
      ],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.sensors[0].status).toBe(TELEMETRY_SENSOR_STATUS.INVALID);
    expect(result.sensors[0].reason).toBe('INVALID_ID');
    expect(result.sensors[0].valid).toBe(false);

    expect(result.sensors[1].status).toBe(TELEMETRY_SENSOR_STATUS.INVALID);
    expect(result.sensors[1].reason).toBe('INVALID_ID');
    expect(result.sensors[1].valid).toBe(false);
  });

  it('marks non-object sensor element as invalid', () => {
    const raw = {
      sensors: [null, 'invalid'],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.sensors[0].status).toBe(TELEMETRY_SENSOR_STATUS.INVALID);
    expect(result.sensors[0].reason).toBe('SENSOR_NOT_OBJECT');
    expect(result.sensors[0].valid).toBe(false);

    expect(result.sensors[1].status).toBe(TELEMETRY_SENSOR_STATUS.INVALID);
    expect(result.sensors[1].reason).toBe('SENSOR_NOT_OBJECT');
    expect(result.sensors[1].valid).toBe(false);
  });

  it('handles missing or non-array sensors payload', () => {
    const resultNoSensors = normalizeTelemetry({}, now);
    expect(resultNoSensors.sensors).toEqual([]);
    expect(resultNoSensors.valid).toBe(false);
    expect(resultNoSensors.errors).toContain('SENSORS_NOT_ARRAY');

    const resultNonArraySensors = normalizeTelemetry({ sensors: 'not-array' }, now);
    expect(resultNonArraySensors.sensors).toEqual([]);
    expect(resultNonArraySensors.valid).toBe(false);
    expect(resultNonArraySensors.errors).toContain('SENSORS_NOT_ARRAY');
  });

  it('applies default receivedAt and resolves serverTimestamp', () => {
    const resultDefault = normalizeTelemetry({ sensors: [] }, now);
    expect(resultDefault.receivedAt).toBe(now);
    expect(resultDefault.serverTimestamp).toBeNull();

    const resultCustomReceivedAt = normalizeTelemetry(
      { sensors: [], receivedAt: 123456 },
      now,
    );
    expect(resultCustomReceivedAt.receivedAt).toBe(123456);

    const resultServerTimestamp = normalizeTelemetry(
      { sensors: [], serverTimestamp: 999999 },
      now,
    );
    expect(resultServerTimestamp.serverTimestamp).toBe(999999);

    const resultFallbackTimestamp = normalizeTelemetry(
      { sensors: [], timestamp: 888888 },
      now,
    );
    expect(resultFallbackTimestamp.serverTimestamp).toBe(888888);
  });

  it('preserves raw fields at root payload level', () => {
    const raw = {
      uptime: 3600,
      heartbeat: true,
      deltaAir: 4.5,
      rssi: -65,
      firmwareVersion: '1.2.0',
      sensors: [
        {
          id: 0,
          name: 'T1 Vào dàn',
          temp: -16.0,
          online: true,
        },
      ],
    };

    const result = normalizeTelemetry(raw, now);

    expect(result.uptime).toBe(3600);
    expect(result.heartbeat).toBe(true);
    expect(result.deltaAir).toBe(4.5);
    expect(result.rssi).toBe(-65);
    expect(result.firmwareVersion).toBe('1.2.0');
    expect(result.sensors[0].temperatureC).toBe(-16.0);
  });
});
