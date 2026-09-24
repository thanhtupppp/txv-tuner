/**
 * Pure domain module downsampling telemetry history.
 * Giảm tải dữ liệu chuỗi thời gian cho biểu đồ di động mà vẫn bảo toàn hình dạng và các điểm cực trị (spikes).
 */

/**
 * Lọc và chuẩn hóa dữ liệu điểm thời gian.
 * Mặc định yêu cầu timestamp hợp lệ (dữ liệu production); chỉ cho phép tạo timestamp giả lập
 * khi allowSyntheticTime = true (dành riêng cho test fixture hoặc demo).
 */
function sanitizePoints(points, valueKey, timeKey, allowSyntheticTime = false) {
  if (!Array.isArray(points)) return [];

  const valid = [];
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (!pt || typeof pt !== 'object') continue;

    let time = pt[timeKey] ?? pt.timestamp ?? pt.time;
    if (time === undefined && allowSyntheticTime) {
      time = i + 1;
    }

    const val = pt[valueKey] ?? pt.actualSh ?? pt.value;

    if (
      typeof time === 'number' &&
      Number.isFinite(time) &&
      time > 0 &&
      typeof val === 'number' &&
      Number.isFinite(val)
    ) {
      valid.push(pt[timeKey] === undefined ? { ...pt, [timeKey]: time } : pt);
    }
  }

  // Sắp xếp thời gian tăng dần nếu chưa đúng thứ tự
  let isSorted = true;
  for (let i = 1; i < valid.length; i++) {
    const prevTime = valid[i - 1][timeKey] ?? valid[i - 1].timestamp ?? valid[i - 1].time;
    const currTime = valid[i][timeKey] ?? valid[i].timestamp ?? valid[i].time;
    if (currTime < prevTime) {
      isSorted = false;
      break;
    }
  }

  if (!isSorted) {
    valid.sort((a, b) => {
      const tA = a[timeKey] ?? a.timestamp ?? a.time;
      const tB = b[timeKey] ?? b.timestamp ?? b.time;
      return tA - tB;
    });
  }

  return valid;
}

/**
 * Thuật toán Time-Bucket Min/Max:
 * Chia dữ liệu thành các thùng thời gian (buckets), trong mỗi thùng chọn ra điểm cực đại và cực tiểu.
 * Đảm bảo các đỉnh quá nhiệt bất thường (spikes) không bao giờ bị mài mòn.
 */
export function downsampleMinMax(points, maxPoints, valueKey = 'actualSh', timeKey = 'timestamp') {
  if (points.length <= maxPoints) return points;
  if (maxPoints <= 2) return [points[0], points[points.length - 1]].slice(0, maxPoints);

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const innerPoints = points.slice(1, -1);

  // Số điểm cần lấy từ các thùng bên trong: tối đa maxPoints - 2
  const targetInnerPoints = maxPoints - 2;
  const numBuckets = Math.max(1, Math.floor(targetInnerPoints / 2));
  const bucketSize = innerPoints.length / numBuckets;

  const selected = [];

  for (let b = 0; b < numBuckets; b++) {
    const startIdx = Math.floor(b * bucketSize);
    const endIdx = Math.min(innerPoints.length, Math.floor((b + 1) * bucketSize));

    if (startIdx >= endIdx) continue;

    let minPt = innerPoints[startIdx];
    let maxPt = innerPoints[startIdx];
    let minVal = minPt[valueKey] ?? minPt.actualSh ?? minPt.value;
    let maxVal = maxPt[valueKey] ?? maxPt.actualSh ?? maxPt.value;

    for (let i = startIdx + 1; i < endIdx; i++) {
      const pt = innerPoints[i];
      const val = pt[valueKey] ?? pt.actualSh ?? pt.value;
      if (val < minVal) {
        minVal = val;
        minPt = pt;
      }
      if (val > maxVal) {
        maxVal = val;
        maxPt = pt;
      }
    }

    if (minPt === maxPt) {
      selected.push(minPt);
    } else {
      const tMin = minPt[timeKey] ?? minPt.timestamp ?? minPt.time;
      const tMax = maxPt[timeKey] ?? maxPt.timestamp ?? maxPt.time;
      if (tMin < tMax) {
        selected.push(minPt, maxPt);
      } else {
        selected.push(maxPt, minPt);
      }
    }
  }

  // Đảm bảo số lượng không vượt quá targetInnerPoints
  let finalInner = selected;
  if (finalInner.length > targetInnerPoints) {
    const step = finalInner.length / targetInnerPoints;
    const sampled = [];
    for (let i = 0; i < targetInnerPoints; i++) {
      sampled.push(finalInner[Math.floor(i * step)]);
    }
    finalInner = sampled;
  }

  return [firstPoint, ...finalInner, lastPoint];
}

/**
 * Thuật toán Largest-Triangle-Three-Buckets (LTTB):
 * Giữ hình dạng đường cong trực quan tốt nhất khi hiển thị biểu đồ SVG.
 */
export function downsampleLTTB(points, maxPoints, valueKey = 'actualSh', timeKey = 'timestamp') {
  if (points.length <= maxPoints) return points;
  if (maxPoints <= 2) return [points[0], points[points.length - 1]].slice(0, maxPoints);

  const sampled = [];
  const every = (points.length - 2) / (maxPoints - 2);

  let a = 0; // Điểm đầu tiên của tam giác
  sampled.push(points[a]);

  for (let i = 0; i < maxPoints - 2; i++) {
    // Tính điểm trung bình của bucket tiếp theo (c)
    let avgX = 0;
    let avgY = 0;
    const avgRangeStart = Math.floor((i + 1) * every) + 1;
    const avgRangeEnd = Math.min(points.length, Math.floor((i + 2) * every) + 1);
    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += (points[j][timeKey] ?? points[j].timestamp ?? points[j].time);
      avgY += (points[j][valueKey] ?? points[j].actualSh ?? points[j].value);
    }
    avgX /= (avgRangeLength || 1);
    avgY /= (avgRangeLength || 1);

    // Tìm điểm trong bucket hiện tại (b) tạo diện tích tam giác lớn nhất với a và avg(c)
    const rangeOffs = Math.floor((i + 0) * every) + 1;
    const rangeTo = Math.min(points.length, Math.floor((i + 1) * every) + 1);

    const pointAX = points[a][timeKey] ?? points[a].timestamp ?? points[a].time;
    const pointAY = points[a][valueKey] ?? points[a].actualSh ?? points[a].value;

    let maxArea = -1;
    let maxAreaPoint = points[rangeOffs];
    let nextA = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      const ptX = points[j][timeKey] ?? points[j].timestamp ?? points[j].time;
      const ptY = points[j][valueKey] ?? points[j].actualSh ?? points[j].value;

      // Diện tích tam giác tính theo tích có hướng
      const area = Math.abs(
        (pointAX - avgX) * (ptY - pointAY) - (pointAX - ptX) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = points[j];
        nextA = j;
      }
    }

    sampled.push(maxAreaPoint);
    a = nextA;
  }

  sampled.push(points[points.length - 1]);
  return sampled;
}

/**
 * Hàm điều phối chính downsampleHistory
 *
 * @param {Array<object>} rawPoints - Mảng dữ liệu lịch sử
 * @param {number} [maxPoints=60] - Số điểm tối đa trả về cho biểu đồ
 * @param {object} [options={}] - Cấu hình thuật toán và key mapping
 * @returns {Array<object>} Mảng điểm đã được nén an toàn
 */
export function downsampleHistory(rawPoints, maxPoints = 60, options = {}) {
  const {
    algorithm = 'minmax',
    valueKey = 'actualSh',
    timeKey = 'timestamp',
    allowSyntheticTime = false,
  } = options;

  const valid = sanitizePoints(rawPoints, valueKey, timeKey, allowSyntheticTime);
  if (valid.length <= maxPoints) {
    return valid;
  }

  if (algorithm === 'lttb') {
    return downsampleLTTB(valid, maxPoints, valueKey, timeKey);
  }

  return downsampleMinMax(valid, maxPoints, valueKey, timeKey);
}

export default {
  downsampleHistory,
  downsampleMinMax,
  downsampleLTTB,
};
