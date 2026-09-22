export const DELTA_AIR_RANGES = Object.freeze({
  lowMax: 4,
  optimalMax: 12
});

/**
 * Air-side temperature drop across the evaporator.
 * T1 = return/inlet air, T2 = supply/outlet air.
 */
export function calculateDeltaAir(t1, t2) {
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return null;
  return Number((t1 - t2).toFixed(2));
}

export function evaluateDeltaAir(deltaAir) {
  if (!Number.isFinite(deltaAir)) {
    return { status: 'unavailable', text: 'Chưa đủ dữ liệu tính toán' };
  }
  if (deltaAir <= 0) {
    return { status: 'danger', text: 'Khí ra không lạnh hơn khí vào — cần kiểm tra chiều cảm biến hoặc trạng thái dàn lạnh' };
  }
  if (deltaAir < DELTA_AIR_RANGES.lowMax) {
    return { status: 'warning', text: 'Độ giảm nhiệt thấp — kiểm tra tải, lưu lượng gió và khả năng trao đổi nhiệt' };
  }
  if (deltaAir <= DELTA_AIR_RANGES.optimalMax) {
    return { status: 'optimal', text: 'Độ giảm nhiệt qua dàn lạnh đang trong vùng vận hành tham chiếu' };
  }
  return { status: 'warning', text: 'Độ giảm nhiệt cao — kiểm tra lưu lượng gió, bám tuyết và tải nhiệt' };
}
