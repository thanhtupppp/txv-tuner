import {
  TELEMETRY_LIMITS,
  TELEMETRY_SENSOR_STATUS,
} from './telemetryConstants';
import {
  getSensorTemperature,
  validateTelemetry,
} from './validateTelemetry';

function normalizeSensor(sensor, index) {
  const temperatureC = getSensorTemperature(sensor);
  const online = sensor?.online !== false;
  const hasTemperature = temperatureC !== null;

  let status = TELEMETRY_SENSOR_STATUS.OK;
  let reason = null;

  if (!sensor || typeof sensor !== 'object' || Array.isArray(sensor)) {
    status = TELEMETRY_SENSOR_STATUS.INVALID;
    reason = 'SENSOR_NOT_OBJECT';
  } else if (!Number.isInteger(sensor.id) || sensor.id < 0) {
    status = TELEMETRY_SENSOR_STATUS.INVALID;
    reason = 'INVALID_ID';
  } else if (sensor.online === false) {
    status = TELEMETRY_SENSOR_STATUS.OFFLINE;
    reason = 'SENSOR_OFFLINE';
  } else if (!hasTemperature) {
    status = TELEMETRY_SENSOR_STATUS.MISSING;
    reason = 'TEMPERATURE_MISSING';
  } else if (
    temperatureC < TELEMETRY_LIMITS.temperatureC.min
    || temperatureC > TELEMETRY_LIMITS.temperatureC.max
  ) {
    status = TELEMETRY_SENSOR_STATUS.OUT_OF_RANGE;
    reason = 'TEMPERATURE_OUT_OF_RANGE';
  }

  return {
    id: Number.isInteger(sensor?.id) ? sensor.id : index,
    name: sensor?.name || `T${index + 1}`,
    temperatureC: hasTemperature ? temperatureC : null,
    online,
    valid: status === TELEMETRY_SENSOR_STATUS.OK,
    status,
    reason,
  };
}

export function normalizeTelemetry(payload, now = Date.now()) {
  const validation = validateTelemetry(payload, now);
  const sensors = Array.isArray(payload?.sensors)
    ? payload.sensors.map(normalizeSensor)
    : [];

  return {
    ...payload,
    receivedAt: payload?.receivedAt ?? now,
    serverTimestamp: payload?.serverTimestamp ?? payload?.timestamp ?? null,
    sensors,
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}
