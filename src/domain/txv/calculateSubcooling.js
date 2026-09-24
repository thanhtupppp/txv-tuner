import { pressureToTemp } from '../../data/danfossData';
import { isValidTemperature } from './validateTxvInput';

export const SUBCOOLING_STATUS = Object.freeze({
  MISSING_DATA: 'missing_data',
  FLASH_GAS_RISK: 'flash_gas_risk',
  LOW: 'low',
  OPTIMAL: 'optimal',
  HIGH: 'high',
});

/**
 * Tính toán độ quá lạnh thực tế (Subcooling - SC).
 * Công thức nhiệt động: SC = T_cond - T_liquid
 *
 * @param {Object} params
 * @param {number|null} [params.condTempC] - Nhiệt độ ngưng tụ bão hòa T_cond (°C)
 * @param {number|null} [params.liquidTempC] - Nhiệt độ đường lỏng trước van TXV T_liquid (°C)
 * @param {number|null} [params.condPressureBarA] - Áp suất ngưng tụ bão hòa (bar absolute)
 * @param {string} [params.refrigerantId='R404A'] - Mã môi chất lạnh
 * @param {number} [params.targetScK=4.0] - Độ quá lạnh mục tiêu (K, tiêu chuẩn 3.0K - 5.0K)
 * @param {number} [params.toleranceK=1.0] - Dung sai quá lạnh cho phép (±1.0K)
 * @returns {{ valid: boolean, subcoolingK: number|null, deltaScK: number|null, isWithinTolerance: boolean, status: string, statusText: string, message: string }}
 */
export function calculateSubcooling({
  condTempC,
  liquidTempC,
  condPressureBarA,
  refrigerantId = 'R404A',
  targetScK = 4.0,
  toleranceK = 1.0,
} = {}) {
  let effectiveCondTempC = condTempC;

  // Nếu không có condTempC nhưng có áp suất ngưng tụ condPressureBarA
  if (!isValidTemperature(effectiveCondTempC) && typeof condPressureBarA === 'number' && condPressureBarA > 0) {
    try {
      effectiveCondTempC = Number(pressureToTemp(condPressureBarA, refrigerantId).toFixed(1));
    } catch {
      effectiveCondTempC = null;
    }
  }

  // Kiểm tra tính hợp lệ
  if (!isValidTemperature(effectiveCondTempC) || !isValidTemperature(liquidTempC)) {
    return {
      valid: false,
      subcoolingK: null,
      deltaScK: null,
      isWithinTolerance: false,
      status: SUBCOOLING_STATUS.MISSING_DATA,
      statusText: 'THIẾU DỮ LIỆU ĐO QUÁ LẠNH',
      message: 'Thiếu nhiệt độ đường lỏng (T_liquid) hoặc nhiệt độ ngưng tụ (T_cond). Không thể tính độ quá lạnh.',
    };
  }

  // SC = T_cond - T_liquid
  const subcoolingK = Number((effectiveCondTempC - liquidTempC).toFixed(1));

  const isTargetValid = typeof targetScK === 'number' && Number.isFinite(targetScK);
  const deltaScK = isTargetValid ? Number((subcoolingK - targetScK).toFixed(1)) : null;
  const isWithinTolerance = deltaScK !== null && Math.abs(deltaScK) <= toleranceK;

  // Phân tích trạng thái
  if (subcoolingK < 0) {
    return {
      valid: true,
      subcoolingK,
      deltaScK,
      isWithinTolerance: false,
      status: SUBCOOLING_STATUS.FLASH_GAS_RISK,
      statusText: 'NGUY CƠ BỌT KHÍ (FLASH GAS)',
      message: `Độ quá lạnh âm (${subcoolingK}K): Nhiệt độ lỏng cao hơn điểm ngưng tụ. Môi chất bị sôi bùng tạo bọt khí trước van TXV!`,
    };
  }

  if (subcoolingK < 2.0) {
    return {
      valid: true,
      subcoolingK,
      deltaScK,
      isWithinTolerance: false,
      status: SUBCOOLING_STATUS.LOW,
      statusText: 'QUÁ LẠNH THẤP',
      message: `Độ quá lạnh (${subcoolingK}K) thấp hơn mức an toàn (2.0K). Có nguy cơ xuất hiện bọt khí làm sụt giảm năng suất van tiết lưu.`,
    };
  }

  if (subcoolingK > 7.0) {
    return {
      valid: true,
      subcoolingK,
      deltaScK,
      isWithinTolerance: false,
      status: SUBCOOLING_STATUS.HIGH,
      statusText: 'QUÁ LẠNH CAO',
      message: `Độ quá lạnh (${subcoolingK}K) cao hơn bình thường (> 7.0K). Có thể hệ thống thừa gas hoặc dàn ngưng tụ quá lớn.`,
    };
  }

  return {
    valid: true,
    subcoolingK,
    deltaScK,
    isWithinTolerance,
    status: SUBCOOLING_STATUS.OPTIMAL,
    statusText: 'QUÁ LẠNH TỐI ƯU',
    message: `Độ quá lạnh (${subcoolingK}K) đạt chuẩn tối ưu (2.0K - 7.0K). Môi chất lỏng vào van TXV hoàn toàn nguyên chất.`,
  };
}
