/**
 * Validator và Sensor Interlock cho hệ thống điều chỉnh van Danfoss TXV
 * Ngăn chặn tuyệt đối việc đưa ra khuyến nghị điều chỉnh vật lý khi cảm biến bị offline hoặc dữ liệu không hợp lệ.
 */

export const TXV_VALIDATION_CODES = Object.freeze({
  OK: 'OK',
  VALVE_MISSING: 'VALVE_MISSING',
  ESP32_OFFLINE: 'ESP32_OFFLINE',
  T3_OFFLINE: 'T3_OFFLINE',
  T2_OFFLINE: 'T2_OFFLINE',
  T1_OFFLINE: 'T1_OFFLINE',
  INVALID_PRESSURE: 'INVALID_PRESSURE',
  INVALID_SUCTION_TEMP: 'INVALID_SUCTION_TEMP',
  INVALID_EVAP_TEMP: 'INVALID_EVAP_TEMP',
  PHYSICAL_ANOMALY_NEGATIVE_SH: 'PHYSICAL_ANOMALY_NEGATIVE_SH',
});

/**
 * Kiểm tra một giá trị nhiệt độ có phải là số thực hợp lệ trong dải vật lý (-100°C đến 100°C)
 */
export function isValidTemperature(val) {
  return typeof val === 'number' && Number.isFinite(val) && val >= -100 && val <= 100;
}

/**
 * Chuyển đổi chuỗi nhập liệu sang số thực an toàn.
 * Chuỗi rỗng '', chỉ có khoảng trắng, hoặc chữ 'abc' chuyển thành null.
 * Chuỗi '0' hoặc số 0 được coi là hợp lệ (không bị coi là falsy).
 *
 * @param {string|number|null|undefined} val
 * @param {{ min?: number, max?: number }} [range]
 * @returns {number|null}
 */
export function parseTxvNumericInput(val, { min = -100, max = 200 } = {}) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || isNaN(val)) return null;
    return Math.max(min, Math.min(max, val));
  }
  if (typeof val !== 'string') return null;

  const trimmed = val.trim();
  if (trimmed === '') return null;

  // Hỗ trợ trường hợp đang gõ dấu âm hoặc dấu chấm chưa xong
  if (trimmed === '-' || trimmed === '.' || trimmed === '-.' || trimmed === '+') return null;

  const num = Number(trimmed);
  if (!Number.isFinite(num) || isNaN(num)) return null;

  return Math.max(min, Math.min(max, Number(num.toFixed(2))));
}

/**
 * Đánh giá tính hợp lệ của cảm biến và thông số đầu vào cho quyết định điều chỉnh TXV
 *
 * @param {Object} params
 * @param {string} [params.opMode='live'] - 'live' | 'target_room' | 'manual'
 * @param {string} [params.evapSource='t2'] - 't2' | 't1_td' | 'pressure'
 * @param {number|null} [params.liveT1] - Nhiệt độ T1 vào dàn (°C)
 * @param {number|null} [params.liveT2] - Nhiệt độ T2 ra dàn (°C)
 * @param {number|null} [params.liveT3] - Nhiệt độ T3 bầu TXV (°C)
 * @param {boolean} [params.isOnline=true] - Trạng thái kết nối ESP32
 * @param {boolean} [params.isAutoSyncSensors=true] - Cờ đồng bộ tự động cảm biến
 * @param {number|null} [params.suctionTemp] - Nhiệt độ hơi hút (°C)
 * @param {number|null} [params.evapTemp] - Nhiệt độ bay hơi (°C)
 * @param {number|null} [params.evapPressure] - Áp suất bay hơi (bar)
 * @param {number|null} [params.evapPressureBarA] - Áp suất bay hơi tuyệt đối (bar a)
 * @param {number|null} [params.evapPressureBarG] - Áp suất bay hơi áp kế (bar g)
 * @param {Object} [params.valve] - Cấu hình van Danfoss
 * @returns {{ allowed: boolean, status: string, statusText: string, reason: string, message: string|null }}
 */
export function validateTxvInput({
  opMode = 'live',
  evapSource = 't2',
  liveT1,
  liveT2,
  liveT3,
  isOnline = true,
  isAutoSyncSensors = true,
  suctionTemp,
  evapTemp,
  evapPressure,
  evapPressureBarA,
  evapPressureBarG,
  valve,
} = {}) {
  // 1. Kiểm tra van Danfoss
  if (!valve || typeof valve.sensitivity !== 'number') {
    return {
      allowed: false,
      status: 'error',
      statusText: 'THIẾU THÔNG TIN VAN',
      reason: TXV_VALIDATION_CODES.VALVE_MISSING,
      message: 'Không có dữ liệu van. Vui lòng chọn dòng van Danfoss.',
    };
  }

  // 2. Chế độ Live có AutoSync
  if (opMode === 'live' && isAutoSyncSensors) {
    if (isOnline === false) {
      return {
        allowed: false,
        status: 'sensor_offline',
        statusText: 'MẤT KẾT NỐI ESP32 • KHÔNG THỂ ĐỀ XUẤT',
        reason: TXV_VALIDATION_CODES.ESP32_OFFLINE,
        message: 'Mất kết nối với thiết bị ESP32. Đề xuất điều chỉnh bị khóa an toàn.',
      };
    }

    // Cảm biến T3 (Bầu TXV) bắt buộc đối với mọi nguồn tính
    if (!isValidTemperature(liveT3)) {
      return {
        allowed: false,
        status: 'sensor_offline',
        statusText: 'CẢM BIẾN T3 MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
        reason: TXV_VALIDATION_CODES.T3_OFFLINE,
        message: 'Cảm biến T3 (Bầu TXV) mất kết nối hoặc dữ liệu không hợp lệ. Đề xuất điều chỉnh bị khóa để bảo vệ thiết bị.',
      };
    }

    // Kiểm tra theo từng evapSource
    if (evapSource === 't2') {
      if (!isValidTemperature(liveT2)) {
        return {
          allowed: false,
          status: 'sensor_offline',
          statusText: 'CẢM BIẾN T2 MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
          reason: TXV_VALIDATION_CODES.T2_OFFLINE,
          message: 'Cảm biến T2 (Ra dàn) mất kết nối hoặc dữ liệu không hợp lệ khi nguồn bay hơi là T2.',
        };
      }
    } else if (evapSource === 't1_td') {
      if (!isValidTemperature(liveT1)) {
        return {
          allowed: false,
          status: 'sensor_offline',
          statusText: 'CẢM BIẾN T1 MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
          reason: TXV_VALIDATION_CODES.T1_OFFLINE,
          message: 'Cảm biến T1 (Vào dàn) mất kết nối hoặc dữ liệu không hợp lệ khi nguồn bay hơi là T1 - TD.',
        };
      }
    } else if (evapSource === 'pressure') {
      let p = evapPressureBarA;
      if (p === undefined && evapPressureBarG !== undefined && typeof evapPressureBarG === 'number') {
        p = evapPressureBarG >= -1.0 ? evapPressureBarG + 1.01325 : null;
      }
      if (p === undefined) {
        p = evapPressure;
      }
      if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) {
        return {
          allowed: false,
          status: 'invalid_input',
          statusText: 'ÁP SUẤT KHÔNG HỢP LỆ • KHÔNG THỂ ĐỀ XUẤT',
          reason: TXV_VALIDATION_CODES.INVALID_PRESSURE,
          message: 'Áp suất bay hơi không hợp lệ hoặc nhỏ hơn hoặc bằng 0 bar.',
        };
      }
    }
  } else {
    // Manual mode hoặc không auto-sync
    if (!isValidTemperature(suctionTemp)) {
      return {
        allowed: false,
        status: 'invalid_input',
        statusText: 'DỮ LIỆU HƠI HÚT KHÔNG HỢP LỆ',
        reason: TXV_VALIDATION_CODES.INVALID_SUCTION_TEMP,
        message: 'Nhiệt độ hơi hút không hợp lệ. Vui lòng nhập số thực hợp lệ.',
      };
    }
    if (!isValidTemperature(evapTemp)) {
      return {
        allowed: false,
        status: 'invalid_input',
        statusText: 'DỮ LIỆU BAY HƠI KHÔNG HỢP LỆ',
        reason: TXV_VALIDATION_CODES.INVALID_EVAP_TEMP,
        message: 'Nhiệt độ bay hơi không hợp lệ. Vui lòng nhập số thực hợp lệ.',
      };
    }
  }

  return {
    allowed: true,
    status: 'ok',
    statusText: 'DỮ LIỆU CẢM BIẾN HỢP LỆ',
    reason: TXV_VALIDATION_CODES.OK,
    message: null,
  };
}
