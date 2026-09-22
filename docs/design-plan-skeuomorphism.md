# Kế Hoạch Thiết Kế Skeuomorphism — Từng Component

> Tài liệu kế hoạch cho TXV Tuner. Áp dụng đúng tokens trong `src/constants/theme.js`
> và quy tắc trong `docs/skeuomorphism.md`: vỏ kim loại sơn mờ, LCD lõm xanh, nút cơ khí nổi,
> ánh sáng từ trên, không animation liên tục, mọi hiệu ứng đều có fallback phẳng.

## 0. Nguyên tắc xuyên suốt

| Quy tắc | Cách thực hiện |
|---|---|
| Ánh sáng từ trên | Highlight `theme.highlight` ở cạnh trên, edge tối `theme.borderStrong` / `shadowDark` ở cạnh dưới |
| Độ sâu phân 3 cấp | Panel nổi (`cardShadow`) > nút nổi (`chipShadow` + `borderBottomWidth: 3`) > ô lõm (`surfaceInset` / `screenBg` + `borderTopWidth: 2` đậm) |
| Chữ số đo | Luôn `MONO` + `screenInk` / `screenMuted` trên nền `screenBg` |
| Trạng thái không phụ thuộc màu | Kèm chữ (`✓`, "CHUẨN", nhãn) hoặc viền, không chỉ đổi màu |
| Target 48px | Mọi control chạm được ≥ 48×48 (`SKEUOMORPHISM['--um-skeuomorphism-target-min']`) |
| Fallback | Mọi hiệu ứng lấy từ `theme.cardShadow` / `theme.chipShadow` qua `useMaterial()` → tự tắt khi `reducedEffects` |
| Không gradient tràn | Chỉ dùng SVG gradient có giới hạn (brass, metal), tắt khi `reducedEffects` |

---

## 1. SkeuoKit — tầng primitive (mở rộng)

### 1.1. SkeuoLcdWell (mới — ưu tiên cao nhất)
Ô lõm màn hình đo dùng chung, thay cho việc mỗi component tự style `screenBg`.

- **Anatomy**: nền `screenBg`, `borderRadius: 8`, `borderWidth: 1` màu `borderStrong`,
  `borderTopWidth: 2` màu `shadowDark` (rãnh trên tối = mặt lõm), padding 10/8.
- **Props**: `variant: 'readout' | 'chart'`, `children`.
- **A11y**: không tự có role; label đặt bên ngoài.
- **Dùng cho**: SensorCard, TxvResultPanel metric wells, chart wrapper, telemetry bar, LCD input wells.
- **Loại bỏ trùng lặp**: `TxvInputsGrid.wellInput` (border màu hard-code `#6b7e72`) và
  `TxvResultPanel.metricWell` (border `rgba(0,0,0,0.4)` hard-code) — hợp nhất về 1 nguồn.

### 1.2. SkeuoLed (mới)
- Chấm LED 10×10, `borderRadius: 5`, viền `borderStrong` 1px.
- **Props**: `state: 'ok' | 'warn' | 'error' | 'off'` → màu map sang `optimal | warning | danger | border`.
- Dùng cho: Header connection LED, SensorCard, TelemetryBar, Gauge (đèn giới hạn).

### 1.3. SkeuoGauge (mới — analog needle gauge)
Đồng hồ kim tròn SVG cho ΔT_air và (tùy chọn) superheat.

- **Kích thước**: 150×150 (compact 120×120 khi width < 360).
- **Layers** (từ dưới lên):
  1. Vành ngoài: `Circle` r=72, fill `surfaceRecessed`, stroke `borderStrong` 3px (bezel kim loại).
  2. Mặt số: `Circle` r=58, fill `screenBg` (mặt LCD lõm).
  3. Vạch chia: 11 vạch mỗi 15°; vạch chính dài 8px `screenInk`, vạch phụ 4px `screenMuted`.
  4. Vùng màu: cung 3 vùng (thấp `danger`/0–4K, tối ưu `optimal`/4–12K, cao `warning`/>12K) vẽ dạng cung mảnh 3px trên mép mặt số — kèm nhãn chữ để không phụ thuộc màu.
  5. Kim: `Path` tam giác hẹp, fill `danger` (đỏ đo lường), gốc tròn `Circle` r=5 fill `brass`.
  6. Trục & ốc: `Circle` r=6 fill `brass`, stroke `brassLight`.
- **Chuyển động kim**: chỉ `transform rotate` khi giá trị thay đổi tick (2s), **không** animation liên tục; bỏ transform khi `reducedEffects` (kim nhảy thẳng).
- **A11y**: `accessibilityLabel` đầy đủ, ví dụ "Gim nhiệt không qua dàn lạnh: 7,4 K, trong vùng tham chiếu"; kim là `aria-hidden`.
- **Fallback**: bỏ bezel stroke dày và gradient brass, giữ mặt số + vạch + kim.

### 1.4. SkeuoPanel (mới, tối giản)
Wrapper card chuẩn: `surface` + `border` + `cardShadow` + `borderRadius: 14` + padding 16.
Thay cho pattern lặp `[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]` ở 7 nơi trong code hiện tại.

---

## 2. MonitorScreen (bộ giám sát)

### 2.1. SensorCard (đã xong)
- Vỏ panel + LCD lõm + LED viền + chữ MONO 26px, `minWidth: 140`.
- Màu kim theo kênh: T1 `cold`, T2 `warning`, T3 `purple` (khớp legend chart).
- Xem `SensorCard.js` đã bàn giao.

### 2.2. DeltaAirCard → đổi thành GaugePanel
- **Bố cục**: `SkeuoGauge` bên trái (150px), cột thông tin bên phải (trên mobile dọc thành trên/dưới).
- **Cột thông tin**: tag "HIỆU SUẤT TRAO ĐỔI NHIỆT" (`inkMuted`), giá trị lớn MONO (`optimal`/`warning`/`danger` theo `evaluateDeltaAir`), mô tả trạng thái `inkMuted`.
- **Nút hành động** (tùy chọn phase 3): "Ghi nhận" (lưu snapshot vào history) — dùng `SkeuoButton` chuẩn, không nút riêng.

### 2.3. RealtimeChartCard
- Bọc chart trong `SkeuoLcdWell variant='chart'` (thay `surfaceInset` hiện tại) → chart cũng nằm trên "màn hình" của thiết bị.
- 3 đường: T1 `cold`, T2 `warning`, T3 `purple` — giữ nguyên legend có chấm + chữ.
- Trục Y: `screenMuted` MONO 10px (hiện đang `inkMuted` trên nền `surfaceInset` — chưa đạt chất LCD).
- Không grid nền; giữ 4 vạch ngang tham chiếu mảnh.

---

## 3. TxvTunerScreen (bộ chỉnh TXV)

### 3.1. TxvTelemetryBar (hiện dạng binary trong paste — cần dựng lại)
Thanh 3 kênh mini phía trên, kiểu "đầu dò cắm vào máy".

- **Bố cục**: hàng ngang 3 ô, mỗi ô = LED + nhãn (T1/T2/T3) + giá trị MONO nhỏ 16px.
- **Nền**: `surfaceInset` (lõm nhẹ một bậc so với surface, không LCD sâu).
- **Trạng thái live**: `isOnline` → LED xanh `optimal`; offline → `danger` + giá trị mờ.
- **Chiều cao tối thiểu 48px**, tap vào ô T chuyển `evapSource` tương ứng (T2 / T1-TD) — tái sử dụng logic hiện có.
- Demo Mode: chữ "MÔ PHỎNG" MONO nhỏ cạnh LED `warning`.

### 3.2. RefrigerantSelector & ValveSelector (chips)
- Giữ `SkeuoButton` chip; **chuẩn hóa**: chip chưa chọn = `surfaceInset` (lõm), chip đã chọn = `accent` + `✓` (nổi) — phân cấp "chưa chọn nằm dưới, đã chọn nhấn nổi".
- Header card giữ tag số thứ tự "01 /", "02 /" MONO.
- Thêm 1 dòng mô tả chất/van đang chọn bằng MONO nhỏ (đã có) — không thêm gì khác, tránh rối.

### 3.3. TxvInputsGrid (các ô nhập liệu — cần đồng bộ)
- **wellInput** hiện pha lẫn hai chất liệu: nền `surfaceInset` nhưng chữ `#38bdf8` (xanh web) — không nằm trong tokens. Sửa: nền chuyển sang `screenBg`, chữ `screenInk`, label trên ô chuyển `screenMuted` → đúng chất LCD giống SensorCard.
- Giữ `SkeuoNumberInput` (đã tốt: cho phép nhập "-" trung gian).
- Preset buttons (-6/+6/+18, 4/6/8K): giữ `chipShadow`, thêm `✓` cho preset đang khớp giá trị.

### 3.4. TxvResultPanel
- **metricWell** (SH thực tế, ΔSH): chuyển sang `SkeuoLcdWell`; chữ số 32px MONO giữ nguyên, loại border hard-code.
- **Vít brass**: giữ nguyên recipe gradient (đã chuẩn: bezel `surfaceRecessed` + mặt brass 3-stop + rãnh chữ thập + mũi tên CW/CCW). Cải tiến nhỏ: mũi tên hướng thêm 1 đầu nhai tam giác nhỏ ở cuối cung để rõ chiều (hiện chỉ có cung nét đứt).
- **danfossRuleBox**: giữ `surfaceInset` (note nằm trên vỏ, không trên LCD) — đúng phân cấp.

### 3.5. TxvHistoryChart
- Bọc trong `SkeuoLcdWell` như RealtimeChartCard.
- Trục Y MONO `screenMuted`; đường mục tiêu nét đứt `optimal`; đường thực tế `accent`.
- Giữ logic bounds động (đã fix theo verification record) — không đụng logic.

### 3.6. SimCondPanel
- Ô hiển thị T_cond giữa hàng nút: chuyển thành LCD mini (48px cao, MONO 16px `screenInk` trên `screenBg`) — hiện đang là `surfaceInset` + chữ `warning`.
- 4 nút ±1/±5: giữ `SkeuoButton`, disabled tại 20/65°C đã đúng — chỉ cần LED nhỏ cạnh giá trị báo "chạm giới hạn" (màu `danger`) kèm chữ "MIN"/"MAX".

---

## 4. Header & App shell

### 4.1. Header
- Giữ `MetalFace` gradient vỏ kim loại (đã đúng, tự ẩn khi flat).
- **Badge logo**: hiện là ô LCD (`screenBg`) — giữ, đây là "màn hình nhãn" trên thiết bị.
- **Trạng thái**: LED hiện tại đổi theo demo/connected/offline — chuyển sang `SkeuoLed` cho khớp viền.
- Không thêm gì — header đã ổn.

### 4.2. Bottom navigation
- Tab đang chọn: `surfaceInset` + `borderColor: accent` + `borderBottomWidth: 3` (đang lõm xuống = đang nhấn) — **đảo chiều**: tab đang chọn nên nổi (giữ `chipShadow` + accent border dưới dày), tab không chọn phẳng. Sửa bằng cách bỏ `backgroundColor: theme.surfaceInset` ở tab active trong `App.js`.
- Icon dùng `InstrumentIcon`, label luôn hiển thị (đã có).

---

## 5. Thứ tự triển khai & khối lượng

| Phase | Việc | Files | Ước tính |
|---|---|---|---|
| **0** | Primitives: `SkeuoLcdWell`, `SkeuoLed`, `SkeuoPanel` | SkeuoKit.js | 1 buổi |
| **1** | Monitor: SensorCard (xong) + GaugePanel + chart LCD | MonitorScreen.js, SkeuoKit.js | 1 buổi |
| **2** | Đồng bộ LCD: TxvInputsGrid, TxvResultPanel, SimCondPanel, TxvHistoryChart | 4 files | 1 buổi |
| **3** | TelemetryBar dựng lại + bottom nav + polish brass | TxvTelemetryBar.js, App.js | 1 buổi |
| **4** | Kiểm chứng: export web+android, đo 48px targets, cặp màu tương phản ≥ 4.5:1, flat mode | — | 0.5 buổi |

## 6. Checklist nghiệm thu từng component

- [ ] Nền mọi bề mặt opaque (không trong suốt trừ overlay modal).
- [ ] Không hard-code màu — 100% qua `theme.*`.
- [ ] Mọi control ≥ 48px; chữ số đo dùng MONO.
- [ ] Trạng thái có chữ/viền kèm màu (không phụ thuộc màu đơn thuần).
- [ ] Bật "Giảm hiệu ứng vật liệu" → không còn shadow/bezel, nội dung và trạng thái giữ nguyên.
- [ ] Light + Dark đều đạt tương phản ≥ 4.5:1 (kiểm 20 cặp như verification cũ).
- [ ] Không animation liên tục; chỉ đổi trạng thái theo tick dữ liệu.
