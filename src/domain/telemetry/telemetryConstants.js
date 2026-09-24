export const TELEMETRY_SENSOR_STATUS = Object.freeze({
  OK: 'ok',
  OFFLINE: 'offline',
  INVALID: 'invalid',
  OUT_OF_RANGE: 'out_of_range',
  MISSING: 'missing',
  STALE: 'stale',
});

export const TELEMETRY_LIMITS = Object.freeze({
  maxSensors: 3,
  temperatureC: Object.freeze({
    min: -80,
    max: 100,
  }),
  staleAfterMs: 15_000,
});

export const TELEMETRY_DEFAULTS = Object.freeze({
  unit: 'C',
});
