import { normalizeTelemetry } from '../src/domain/telemetry/normalizeTelemetry';
import { getSensorTemperature } from '../src/domain/telemetry/validateTelemetry';

const now = 1_700_000_000_000;

describe('telemetry compatibility audit', () => {
  it('normalizes firmware temp into temperatureC', () => {
    const result = normalizeTelemetry({
      sensors: [{ id: 0, name: 'T1', temp: -15.5, online: true }],
    }, now);

    expect(result.sensors[0].temperatureC).toBe(-15.5);
    expect(result.sensors[0].valid).toBe(true);
  });

  it('accepts normalized temperatureC input', () => {
    const result = normalizeTelemetry({
      sensors: [{ id: 0, name: 'T1', temperatureC: -12.25, online: true }],
    }, now);

    expect(result.sensors[0].temperatureC).toBe(-12.25);
    expect(result.sensors[0].valid).toBe(true);
  });

  it('keeps legacy temp compatibility', () => {
    const result = normalizeTelemetry({
      sensors: [{ id: 0, name: 'T1', temp: -8.75, online: true }],
    }, now);

    expect(result.sensors[0].temperatureC).toBe(-8.75);
  });

  it('prioritizes temp before alternate raw fields', () => {
    expect(getSensorTemperature({
      temp: -10,
      temperature: -11,
      value: -12,
      current: -13,
    })).toBe(-10);
  });

  it('does not accept NaN or Infinity', () => {
    expect(getSensorTemperature({ temp: NaN })).toBeNull();
    expect(getSensorTemperature({ temp: Infinity })).toBeNull();
    expect(getSensorTemperature({ temp: -Infinity })).toBeNull();
  });

  it('handles offline sensor without crashing', () => {
    const result = normalizeTelemetry({
      sensors: [{ id: 0, name: 'T1', temp: null, online: false }],
    }, now);

    expect(result.sensors[0].status).toBe('offline');
    expect(result.sensors[0].valid).toBe(false);
  });
});
