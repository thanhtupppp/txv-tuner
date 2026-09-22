import { TXV_CONFIG } from '../constants/txvConfig';

/**
 * Utility tính toán hướng dẫn và số vòng vặn vít van tiết lưu Danfoss TXV
 * @param {number} actualSh Độ quá nhiệt thực tế đo được (K)
 * @param {number} targetSh Độ quá nhiệt mục tiêu (K, thường là 6.0K)
 * @param {object} valve Đối tượng cấu hình van Danfoss hiện tại
 * @returns {object} Chi tiết hành động điều chỉnh vít van
 */
export function calculateTxvRecommendation(actualSh, targetSh, valve) {
  if (!valve || typeof valve.sensitivity !== 'number') {
    return {
      direction: 'NONE',
      turns: 0,
      turnsFraction: '0 vòng',
      text: 'Không có dữ liệu van. Vui lòng chọn dòng van Danfoss.',
      status: 'error',
      statusText: 'THIẾU THÔNG TIN VAN'
    };
  }

  const sensitivity = valve.sensitivity; // K / vòng
  const diff = actualSh - targetSh;

  // Dải sai số cho phép ±0.4K (Đạt chuẩn tối ưu Danfoss)
  if (Math.abs(diff) <= TXV_CONFIG.adjustmentToleranceK) {
    return {
      direction: 'NONE',
      turns: 0,
      turnsFraction: '0 vòng',
      text: 'Độ quá nhiệt tối ưu! Không cần điều chỉnh vít van.',
      status: 'optimal',
      statusText: 'ĐẠT CHUẨN DANFOSS'
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
      direction: 'CW',
      dirLabel: 'Theo chiều kim đồng hồ (CW / Siết vào)',
      turns: Number(turns),
      turnsFraction: `${turns} vòng`,
      text: `Quá nhiệt thấp (${actualSh}K). Siết ốc theo chiều kim đồng hồ để tăng lực nén lò xo, giảm lượng môi chất qua van.`,
      status: 'low',
      statusText: 'QUÁ NHIỆT THẤP • NGUY CƠ NGẬP DỊCH'
    };
  }

  // SH cao -> thiếu gas -> nới ra CCW để mở rộng tiết lưu
  const turns = calculateTurns(diff);
  return {
    direction: 'CCW',
    dirLabel: 'Ngược chiều kim đồng hồ (CCW / Nới ra)',
    turns: Number(turns),
    turnsFraction: `${turns} vòng`,
    text: `Quá nhiệt cao (${actualSh}K). Nới ốc ngược chiều kim đồng hồ để giảm lực nén lò xo, mở thêm van cho gas vào dàn lạnh.`,
    status: 'high',
    statusText: 'QUÁ NHIỆT CAO • THIẾU MÔI CHẤT LẠNH'
  };
}
