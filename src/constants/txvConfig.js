/**
 * CẤU HÌNH VẬN HÀNH TIÊU CHUẨN CHO HỆ THỐNG DANFOSS TXV TUNER
 * Tuân thủ quy chuẩn nhiệt động học và cẩm nang kỹ thuật Danfoss
 */

export const TXV_CONFIG = Object.freeze({
  defaultRefrigerant: 'R404A',      // Môi chất phổ biến nhất trong hệ thống kho đông
  defaultValve: 'T2_TE2',           // Dòng van tiết lưu nhiệt dạng loe thông dụng nhất
  defaultOpMode: 'live',            // Mặc định kết nối cảm biến thời gian thực
  defaultEvapSource: 't2',          // Cảm biến ngõ ra dàn lạnh (T2) cho độ chính xác cao
  defaultRoomTempC: -20.0,          // Nhiệt độ phòng kho đông tiêu chuẩn (-20°C)
  defaultTdK: 7.0,                  // Độ chênh nhiệt dàn lạnh tiêu chuẩn TD = T_room - T_evap (7K)
  defaultTargetShK: 6.0,            // Độ quá nhiệt chuẩn khuyến nghị Danfoss (dải 4 - 8K)
  defaultEvapTempC: -27.0,          // Nhiệt độ bay hơi tiêu chuẩn (-20 - 7 = -27°C)
  defaultEvapPressureBarA: 2.22,    // Áp suất bay hơi tuyệt đối (bar a) của R404A ở -27°C
  defaultEvapPressureBarG: 1.21,    // Áp suất bay hơi áp kế (bar g) của R404A ở -27°C (2.22 - 1.01325)
  defaultEvapPressureBar: 1.21,     // Mặc định áp kế cho kỹ thuật viên
  defaultSuctionTempC: -21.0,       // Nhiệt độ hơi hút tiêu chuẩn: SH = -21 - (-27) = 6K
  temperatureMinC: -100,            // Giới hạn an toàn cảm biến dưới (-100°C)
  temperatureMaxC: 100,             // Giới hạn an toàn cảm biến trên (+100°C)
  pressureMinBar: 0.01,             // Giới hạn áp suất chân không nhỏ nhất (0.01 bar)
  pressureMaxBar: 200,              // Giới hạn áp suất cao nhất (hỗ trợ cả R744 CO2)
  adjustmentToleranceK: 0.4,        // Dung sai độ lệch quá nhiệt cho phép không cần chỉnh vít (±0.4K)
  defaultMaxTurns: 8,               // Giới hạn số vòng vặn vít tối đa của van Danfoss
  turnIncrement: 0.25,              // Mỗi bước điều chỉnh tối thiểu là 1/4 vòng vít
});

export const SUPERHEAT_BANDS = Object.freeze({
  lowMaxK: 4,      // Dưới 4K: Quá nhiệt quá thấp, nguy cơ ngập dịch về máy nén
  optimalMaxK: 8,  // Từ 4K - 8K: Trạng thái tối ưu chuẩn Danfoss; Trên 8K: Thiếu gas / nghẹt van
});

export default {
  TXV_CONFIG,
  SUPERHEAT_BANDS,
};
