import { TELEMETRY_LIMITS } from './telemetryConstants';

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const isFiniteNumber = (value) => (
  typeof value === 'number' && Number.isFinite(value)
);

function getSensorTemperature(sensor) {
  if (isFiniteNumber(sensor?.temp)) return sensor.temp;
  if (isFiniteNumber(sensor?.temperature)) return sensor.temperature;
  if (isFiniteNumber(sensor?.value)) return sensor.value;
  if (isFiniteNumber(sensor?.current)) return sensor.current;
  return null;
}

export function validateTelemetry(payload, now = Date.now()) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(payload)) {
    return {
      valid: false,
      errors: ['PAYLOAD_NOT_OBJECT'],
      warnings,
    };
  }

  if (!Array.isArray(payload.sensors)) {
    errors.push('SENSORS_NOT_ARRAY');
    return { valid: false, errors, warnings };
  }

  if (payload.sensors.length === 0) {
    warnings.push('SENSORS_EMPTY');
  }

  if (payload.sensors.length > TELEMETRY_LIMITS.maxSensors) {
    errors.push('TOO_MANY_SENSORS');
  }

  payload.sensors.forEach((sensor, index) => {
    if (!isPlainObject(sensor)) {
      errors.push(`SENSOR_${index}_NOT_OBJECT`);
      return;
    }

    if (!Number.isInteger(sensor.id) || sensor.id < 0) {
      errors.push(`SENSOR_${index}_INVALID_ID`);
    }

    const temperature = getSensorTemperature(sensor);
    if (temperature !== null) {
      const { min, max } = TELEMETRY_LIMITS.temperatureC;
      if (temperature < min || temperature > max) {
        errors.push(`SENSOR_${index}_TEMPERATURE_OUT_OF_RANGE`);
      }
    } else if (sensor.online !== false) {
      errors.push(`SENSOR_${index}_TEMPERATURE_INVALID`);
    }

    if (sensor.online !== undefined && typeof sensor.online !== 'boolean') {
      errors.push(`SENSOR_${index}_ONLINE_INVALID`);
    }
  });

  const timestamp = payload.serverTimestamp ?? payload.timestamp;
  if (timestamp !== undefined) {
    if (!isFiniteNumber(timestamp)) {
      errors.push('TIMESTAMP_INVALID');
    } else if (timestamp > now + 60_000) {
      warnings.push('TIMESTAMP_IN_FUTURE');
    } else if (now - timestamp > TELEMETRY_LIMITS.staleAfterMs) {
      warnings.push('TELEMETRY_STALE');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export { getSensorTemperature };
