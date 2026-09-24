import { TXV_CONFIG } from '../constants/txvConfig';
import { TXV_VALIDATION_CODES } from '../domain/txv/validateTxvInput';

/**
 * Utility tính toán hướng dẫn và số vòng vặn vít van tiết lưu Danfoss TXV.
 * Tích hợp sensor interlock để ngăn chặn khuyến nghị sai khi cảm biến offline hoặc dữ liệu bất thường.
 *
 * @param {number|null} actualSh - Độ quá nhiệt thực tế đo được (K)
 * @param {number} targetSh - Độ quá nhiệt mục tiêu (K, thường là 6.0K)
 * @param {object} valve - Đối tượng cấu hình van Danfoss hiện tại
 * @param {object} [interlock={ allowed: true }] - Kết quả từ sensor interlock validator
 * @returns {object} Chi tiết hành động điều chỉnh vít van
 */
export function calculateTxvRecommendation(actualSh, targetSh, valve, interlock = { allowed: true }) {
  // 1. Kiểm tra khóa liên động cảm biến (Sensor Interlock)
  if (interlock && interlock.allowed === false) {
    return {
      allowed: false,
      value: null,
      turns: null,
      turnsFraction: null,
      direction: 'NONE',
      status: interlock.status || 'sensor_offline',
      statusText: interlock.statusText || 'CẢM BIẾN MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
      reason: interlock.reason || TXV_VALIDATION_CODES.T3_OFFLINE,
      heading: interlock.statusText || 'Không thể đề xuất điều chỉnh',
      text: interlock.message || 'Cảm biến bắt buộc mất kết nối. Đề xuất điều chỉnh vít van bị khóa an toàn.',
    };
  }

  // 2. Kiểm tra tính hợp lệ của giá trị actualSh
  if (typeof actualSh !== 'number' || !Number.isFinite(actualSh) || isNaN(actualSh)) {
    return {
      allowed: false,
      value: null,
      turns: null,
      turnsFraction: null,
      direction: 'NONE',
      status: 'invalid_input',
      statusText: 'THIẾU DỮ LIỆU ĐO QUÁ NHIỆT',
      reason: 'INVALID_ACTUAL_SH',
      heading: 'Thiếu dữ liệu quá nhiệt',
      text: 'Chưa có đủ dữ liệu nhiệt độ đo được để tính toán độ quá nhiệt.',
    };
  }

  // 3. Kiểm tra van Danfoss
  if (!valve || typeof valve.sensitivity !== 'number') {
    return {
      allowed: false,
      value: null,
      turns: null,
      turnsFraction: null,
      direction: 'NONE',
      text: 'Không có dữ liệu van. Vui lòng chọn dòng van Danfoss.',
      status: 'error',
      statusText: 'THIẾU THÔNG TIN VAN',
      reason: TXV_VALIDATION_CODES.VALVE_MISSING,
      heading: 'Thiếu thông tin van',
    };
  }

  // 4. Kiểm tra bất thường nhiệt động học: Quá nhiệt âm sâu (SH < -5.0K)
  if (actualSh < -5.0) {
    return {
      allowed: false,
      value: actualSh,
      turns: null,
      turnsFraction: null,
      direction: 'NONE',
      status: 'physical_anomaly',
      statusText: 'BẤT THƯỜNG NHIỆT ĐỘ • SH ÂM SÂU',
      reason: TXV_VALIDATION_CODES.PHYSICAL_ANOMALY_NEGATIVE_SH,
      heading: 'Nhiệt độ bất thường (SH < -5K)',
      text: `Quá nhiệt đo được là ${actualSh}K (hơi hút lạnh hơn điểm bay hơi > 5K). Nghi ngờ cảm biến gắn sai vị trí hoặc ngập lỏng nghiêm trọng. Khóa đề xuất vặn vít.`,
    };
  }

  const sensitivity = valve.sensitivity; // K / vòng
  const diff = actualSh - targetSh;

  // Dải sai số cho phép ±0.4K (Đạt chuẩn tối ưu Danfoss)
  if (Math.abs(diff) <= TXV_CONFIG.adjustmentToleranceK) {
    return {
      allowed: true,
      value: actualSh,
      direction: 'NONE',
      turns: 0,
      turnsFraction: '0 vòng',
      text: 'Độ quá nhiệt tối ưu! Không cần điều chỉnh vít van.',
      status: 'optimal',
      statusText: 'ĐẠT CHUẨN DANFOSS',
      heading: 'Độ quá nhiệt đã chuẩn tối ưu!',
    };
  }

  const calculateTurns = (difference) => {
    const rawTurns = Math.abs(difference) / sensitivity;
    const turns = Math.min(Number(rawTurns.toFixed(2)), valve.maxTurns || TXV_CONFIG.defaultMaxTurns);
    return (Math.round(turns / TXV_CONFIG.turnIncrement) * TXV_CONFIG.turnIncrement).toFixed(2);
  };

  if (diff < 0) {
    // SH thấp -> thừa gas -> siết vào CW để tăng lực nén lò xo
    const turns = calculateTurns(diff);
    return {
      allowed: true,
      value: actualSh,
      direction: 'CW',
      dirLabel: 'Theo chiều kim đồng hồ (CW / Siết vào)',
      turns: Number(turns),
      turnsFraction: `${turns} vòng`,
      text: `Quá nhiệt thấp (${actualSh}K). Siết ốc theo chiều kim đồng hồ để tăng lực nén lò xo, giảm lượng môi chất qua van.`,
      status: 'low',
      statusText: 'QUÁ NHIỆT THẤP • NGUY CƠ NGẬP DỊCH',
      heading: `👉 Xoay ${turns} vòng CÙNG chiều kim đồng hồ (CW)`,
    };
  }

  // SH cao -> thiếu gas -> nới ra CCW để mở rộng tiết lưu
  const turns = calculateTurns(diff);
  return {
    allowed: true,
    value: actualSh,
    direction: 'CCW',
    dirLabel: 'Ngược chiều kim đồng hồ (CCW / Nới ra)',
    turns: Number(turns),
    turnsFraction: `${turns} vòng`,
    text: `Quá nhiệt cao (${actualSh}K). Nới ốc ngược chiều kim đồng hồ để giảm lực nén lò xo, mở thêm van cho gas vào dàn lạnh.`,
    status: 'high',
    statusText: 'QUÁ NHIỆT CAO • THIẾU MÔI CHẤT LẠNH',
    heading: `👉 Xoay ${turns} vòng NGƯỢC chiều kim đồng hồ (CCW)`,
  };
}
