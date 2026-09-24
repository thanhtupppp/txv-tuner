import { validateTelemetry } from '../src/domain/telemetry/validateTelemetry';

const now = 1_700_000_000_000;

const sensor = (overrides = {}) => ({
  id: 0,
  temperature: -18.5,
  online: true,
  ...overrides,
});

const payload = (overrides = {}) => ({
  serverTimestamp: now,
  sensors: [
    sensor(),
    sensor({ id: 1, temperature: -12.25 }),
    sensor({ id: 2, temperature: -8.75 }),
  ],
  ...overrides,
});

describe('validateTelemetry', () => {
  it('accepts a valid payload with three sensors', () => {
    expect(validateTelemetry(payload(), now)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it.each([null, undefined, 1, 'payload', []])(
    'rejects a non-object payload: %p',
    (value) => {
      expect(validateTelemetry(value, now).valid).toBe(false);
      expect(validateTelemetry(value, now).errors).toContain('PAYLOAD_NOT_OBJECT');
    },
  );

  it('rejects missing sensors', () => {
    const result = validateTelemetry({ serverTimestamp: now }, now);
    expect(result.errors).toContain('SENSORS_NOT_ARRAY');
  });

  it('rejects sensors that are not an array', () => {
    const result = validateTelemetry({ sensors: {}, serverTimestamp: now }, now);
    expect(result.errors).toContain('SENSORS_NOT_ARRAY');
  });

  it('rejects more than three sensors', () => {
    const result = validateTelemetry(
      payload({ sensors: [sensor(), sensor({ id: 1 }), sensor({ id: 2 }), sensor({ id: 3 })] }),
      now,
    );
    expect(result.errors).toContain('TOO_MANY_SENSORS');
  });

  it('warns when sensors are empty', () => {
    const result = validateTelemetry(payload({ sensors: [] }), now);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('SENSORS_EMPTY');
  });

  it.each([-80, 100])('accepts temperature boundary %p', (temperature) => {
    const result = validateTelemetry(
      payload({ sensors: [sensor({ temperature })] }),
      now,
    );
    expect(result.errors).not.toContain('SENSOR_0_TEMPERATURE_OUT_OF_RANGE');
  });

  it.each([-80.01, 100.01])('rejects out-of-range temperature %p', (temperature) => {
    const result = validateTelemetry(
      payload({ sensors: [sensor({ temperature })] }),
      now,
    );
    expect(result.errors).toContain('SENSOR_0_TEMPERATURE_OUT_OF_RANGE');
  });

  it.each([NaN, Infinity, -Infinity, '18.5'])('rejects invalid temperature %p', (temperature) => {
    const result = validateTelemetry(
      payload({ sensors: [sensor({ temperature })] }),
      now,
    );
    expect(result.errors).toContain('SENSOR_0_TEMPERATURE_INVALID');
  });

  it('allows an offline sensor without a temperature value', () => {
    const result = validateTelemetry(
      payload({ sensors: [sensor({ online: false, temperature: undefined })] }),
      now,
    );
    expect(result.errors).not.toContain('SENSOR_0_TEMPERATURE_INVALID');
  });

  it('rejects an invalid online flag', () => {
    const result = validateTelemetry(
      payload({ sensors: [sensor({ online: 'true' })] }),
      now,
    );
    expect(result.errors).toContain('SENSOR_0_ONLINE_INVALID');
  });

  it('rejects an invalid sensor id', () => {
    const result = validateTelemetry(
      payload({ sensors: [sensor({ id: -1 })] }),
      now,
    );
    expect(result.errors).toContain('SENSOR_0_INVALID_ID');
  });

  it('warns when telemetry is stale', () => {
    const result = validateTelemetry(
      payload({ serverTimestamp: now - 15_001 }),
      now,
    );
    expect(result.warnings).toContain('TELEMETRY_STALE');
  });

  it('warns when timestamp is in the future', () => {
    const result = validateTelemetry(
      payload({ serverTimestamp: now + 60_001 }),
      now,
    );
    expect(result.warnings).toContain('TIMESTAMP_IN_FUTURE');
  });
});
