import { isValidTemperature } from './validateTxvInput';

/**
 * Các dải trạng thái độ quá nhiệt (Superheat Bands)
 */
export const SUPERHEAT_STATUS = Object.freeze({
  MISSING_DATA: 'missing_data',
  PHYSICAL_ANOMALY: 'physical_anomaly',
  LOW: 'low',
  OPTIMAL: 'optimal',
  HIGH: 'high',
});

/**
 * Tính toán độ quá nhiệt thực tế (Actual Superheat - SH) và độ lệch quá nhiệt mục tiêu (ΔSH).
 * Công thức: SH = T_suction - T_evap
 *
 * @param {Object} params
 * @param {number|null} params.suctionTempC - Nhiệt độ hơi hút đo tại bầu TXV (°C)
 * @param {number|null} params.evapTempC - Nhiệt độ bay hơi bão hòa (°C)
 * @param {number} [params.targetShK=6.0] - Quá nhiệt mục tiêu (K, chuẩn Danfoss thường 6.0K)
 * @param {number} [params.lowThresholdK=4.0] - Ngưỡng dưới quá nhiệt tối ưu (K, < 4K nguy cơ ngập lỏng)
 * @param {number} [params.optimalThresholdK=8.0] - Ngưỡng trên quá nhiệt tối ưu (K, > 8K thiếu gas/nghẹt van)
 * @param {number} [params.toleranceK=0.4] - Dung sai cho phép không cần chỉnh vít (K, mặc định ±0.4K)
 * @returns {{ valid: boolean, superheatK: number|null, deltaShK: number|null, isWithinTolerance: boolean, status: string, statusText: string, message: string }}
 */
export function calculateSuperheat({
  suctionTempC,
  evapTempC,
  targetShK = 6.0,
  lowThresholdK = 4.0,
  optimalThresholdK = 8.0,
  toleranceK = 0.4,
} = {}) {
  // 1. Kiểm tra tính hợp lệ của nhiệt độ đầu vào
  if (!isValidTemperature(suctionTempC) || !isValidTemperature(evapTempC)) {
    return {
      valid: false,
      superheatK: null,
      deltaShK: null,
      isWithinTolerance: false,
      status: SUPERHEAT_STATUS.MISSING_DATA,
      statusText: 'THIẾU DỮ LIỆU ĐO',
      message: 'Thiếu nhiệt độ hơi hút (T_suction) hoặc nhiệt độ bay hơi (T_evap) hợp lệ.',
    };
  }

  // 2. Tính SH = T_suction - T_evap (Kelvin / delta °C)
  const superheatK = Number((suctionTempC - evapTempC).toFixed(1));

  // Tính deltaSh nếu targetShK hợp lệ
  const isTargetValid = typeof targetShK === 'number' && Number.isFinite(targetShK);
  const deltaShK = isTargetValid ? Number((superheatK - targetShK).toFixed(1)) : null;
  const isWithinTolerance = deltaShK !== null && Math.abs(deltaShK) <= toleranceK;

  // 3. Chốt an toàn: Heuristic phát hiện bất thường nhiệt động (SH < -5.0K)
  // Ghi chú: Đây là ngưỡng an toàn bảo vệ (safety heuristic), không phải kết luận chẩn đoán tuyệt đối.
  if (superheatK < -5.0) {
    return {
      valid: false,
      superheatK,
      deltaShK,
      isWithinTolerance: false,
      status: SUPERHEAT_STATUS.PHYSICAL_ANOMALY,
      statusText: 'BẤT THƯỜNG NHIỆT ĐỘ • SH ÂM SÂU',
      message: `Quá nhiệt đo được là ${superheatK}K (hơi hút lạnh hơn điểm bay hơi > 5K). Nghi ngờ cảm biến gắn sai vị trí hoặc ngập lỏng nghiêm trọng.`,
    };
  }

  // 4. Phân loại dải quá nhiệt theo chuẩn kỹ thuật Danfoss
  if (superheatK < lowThresholdK) {
    return {
      valid: true,
      superheatK,
      deltaShK,
      isWithinTolerance,
      status: SUPERHEAT_STATUS.LOW,
      statusText: 'QUÁ NHIỆT THẤP • NGUY CƠ NGẬP DỊCH',
      message: `Quá nhiệt thực tế (${superheatK}K) thấp hơn ngưỡng an toàn (${lowThresholdK}K). Cần tăng lực nén lò xo van TXV.`,
    };
  }

  if (superheatK > optimalThresholdK) {
    return {
      valid: true,
      superheatK,
      deltaShK,
      isWithinTolerance,
      status: SUPERHEAT_STATUS.HIGH,
      statusText: 'QUÁ NHIỆT CAO • THIẾU MÔI CHẤT LẠNH',
      message: `Quá nhiệt thực tế (${superheatK}K) vượt ngưỡng tối ưu (${optimalThresholdK}K). Cần mở thêm van TXV hoặc kiểm tra lượng gas.`,
    };
  }

  // Nằm trong dải 4.0K - 8.0K
  if (isWithinTolerance) {
    return {
      valid: true,
      superheatK,
      deltaShK,
      isWithinTolerance: true,
      status: SUPERHEAT_STATUS.OPTIMAL,
      statusText: 'ĐẠT CHUẨN DANFOSS',
      message: `Độ quá nhiệt (${superheatK}K) nằm trong dung sai tối ưu (mục tiêu ${targetShK}K ±${toleranceK}K). Không cần điều chỉnh.`,
    };
  }

  return {
    valid: true,
    superheatK,
    deltaShK,
    isWithinTolerance: false,
    status: deltaShK < 0 ? SUPERHEAT_STATUS.LOW : SUPERHEAT_STATUS.HIGH,
    statusText: deltaShK < 0 ? 'QUÁ NHIỆT THẤP' : 'QUÁ NHIỆT CAO',
    message: deltaShK < 0
      ? `Độ quá nhiệt (${superheatK}K) hơi thấp so với mục tiêu (${targetShK}K).`
      : `Độ quá nhiệt (${superheatK}K) hơi cao so với mục tiêu (${targetShK}K).`,
  };
}
