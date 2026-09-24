import { tempToPressure, pressureToTemp } from '../../data/danfossData';
import { isValidTemperature } from './validateTxvInput';

export const ATMOSPHERIC_PRESSURE_BAR = 1.01325;

/**
 * Chuyển đổi áp suất áp kế (bar gauge - barg) sang áp suất tuyệt đối (bar absolute - bara).
 * P_abs = P_gauge + 1.01325 bar
 */
export function barGaugeToAbsolute(barG) {
  if (typeof barG !== 'number' || !Number.isFinite(barG) || barG < -1.0) return null;
  return Number((barG + ATMOSPHERIC_PRESSURE_BAR).toFixed(2));
}

/**
 * Chuyển đổi áp suất tuyệt đối (bar absolute - bara) sang áp suất áp kế (bar gauge - barg).
 * P_gauge = P_abs - 1.01325 bar
 */
export function barAbsoluteToGauge(barA) {
  if (typeof barA !== 'number' || !Number.isFinite(barA) || barA < 0) return null;
  return Number(Math.max(0, barA - ATMOSPHERIC_PRESSURE_BAR).toFixed(2));
}

/**
 * Tính toán nhiệt độ bay hơi bão hòa (T_evap) và áp suất bay hơi (P_evap) theo nguồn được chọn.
 *
 * @param {Object} params
 * @param {string} params.source - Nguồn tính: 't2' | 't1_td' | 'pressure'
 * @param {number|null} [params.t1C] - Nhiệt độ T1 vào dàn (°C)
 * @param {number|null} [params.t2C] - Nhiệt độ T2 ra dàn (°C)
 * @param {number} [params.tdK=7.0] - Độ chênh nhiệt dàn lạnh TD (K)
 * @param {number|null} [params.pressureBarA] - Áp suất bay hơi tuyệt đối (bar a)
 * @param {number|null} [params.pressureBarG] - Áp suất bay hơi áp kế (bar g)
 * @param {string} [params.refrigerantId='R404A'] - Mã môi chất lạnh
 * @returns {{ valid: boolean, evapTempC: number|null, evapPressureBarA: number|null, evapPressureBarG: number|null, error: string|null }}
 */
export function calculateEvaporation({
  source = 't2',
  t1C,
  t2C,
  tdK = 7.0,
  pressureBarA,
  pressureBarG,
  refrigerantId = 'R404A',
} = {}) {
  // Nguồn 1: Cảm biến T2 ra dàn lạnh (Trực tiếp)
  if (source === 't2') {
    if (!isValidTemperature(t2C)) {
      return {
        valid: false,
        evapTempC: null,
        evapPressureBarA: null,
        evapPressureBarG: null,
        error: 'T2_INVALID',
      };
    }

    const evapTempC = Number(t2C.toFixed(1));
    let evapPressureBarA = null;
    let evapPressureBarG = null;

    try {
      evapPressureBarA = tempToPressure(evapTempC, refrigerantId);
      evapPressureBarG = barAbsoluteToGauge(evapPressureBarA);
    } catch {
      // Bỏ qua lỗi tính áp suất phụ
    }

    return {
      valid: true,
      evapTempC,
      evapPressureBarA,
      evapPressureBarG,
      error: null,
    };
  }

  // Nguồn 2: Cảm biến T1 vào dàn trừ đi chênh nhiệt TD
  // Công thức: T_evap = T1 - TD
  if (source === 't1_td') {
    const isTdValid = typeof tdK === 'number' && Number.isFinite(tdK) && tdK >= 0;
    if (!isValidTemperature(t1C) || !isTdValid) {
      return {
        valid: false,
        evapTempC: null,
        evapPressureBarA: null,
        evapPressureBarG: null,
        error: 'T1_OR_TD_INVALID',
      };
    }

    const evapTempC = Number((t1C - tdK).toFixed(1));
    let evapPressureBarA = null;
    let evapPressureBarG = null;

    try {
      evapPressureBarA = tempToPressure(evapTempC, refrigerantId);
      evapPressureBarG = barAbsoluteToGauge(evapPressureBarA);
    } catch {
      // Bỏ qua lỗi tính áp suất phụ
    }

    return {
      valid: true,
      evapTempC,
      evapPressureBarA,
      evapPressureBarG,
      error: null,
    };
  }

  // Nguồn 3: Áp suất hút bay hơi đo từ đồng hồ đo hoặc cảm biến áp suất
  if (source === 'pressure') {
    // Xác định áp suất tuyệt đối BarA
    let effectiveBarA = null;

    if (typeof pressureBarA === 'number' && Number.isFinite(pressureBarA) && pressureBarA > 0) {
      effectiveBarA = pressureBarA;
    } else if (typeof pressureBarG === 'number' && Number.isFinite(pressureBarG) && pressureBarG >= 0) {
      effectiveBarA = barGaugeToAbsolute(pressureBarG);
    }

    if (effectiveBarA === null || effectiveBarA <= 0) {
      return {
        valid: false,
        evapTempC: null,
        evapPressureBarA: null,
        evapPressureBarG: null,
        error: 'PRESSURE_INVALID',
      };
    }

    let evapTempC = null;
    try {
      evapTempC = Number(pressureToTemp(effectiveBarA, refrigerantId).toFixed(1));
    } catch {
      return {
        valid: false,
        evapTempC: null,
        evapPressureBarA: effectiveBarA,
        evapPressureBarG: barAbsoluteToGauge(effectiveBarA),
        error: 'COOLPROP_CONVERGENCE_ERROR',
      };
    }

    return {
      valid: true,
      evapTempC,
      evapPressureBarA: Number(effectiveBarA.toFixed(2)),
      evapPressureBarG: barAbsoluteToGauge(effectiveBarA),
      error: null,
    };
  }

  return {
    valid: false,
    evapTempC: null,
    evapPressureBarA: null,
    evapPressureBarG: null,
    error: 'UNKNOWN_SOURCE',
  };
}
