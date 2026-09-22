# 🌡️ Danfoss TXV Tuner - Ứng Dụng Căn Chỉnh Van Tiết Lưu Nhiệt

[![Test Status](https://img.shields.io/badge/tests-58%20passed-brightgreen)]()
[![WCAG Contrast](https://img.shields.io/badge/WCAG-AAA%20contrast-brightgreen)]()
[![Expo](https://img.shields.io/badge/Expo-57.0.24-blue)]()
[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-blue)]()
[![CoolProp](https://img.shields.io/badge/CoolProp-NIST%20standard-orange)]()

Ứng dụng Android/iOS/Web chuyên nghiệp hỗ trợ kỹ thuật viên HVAC căn chỉnh **van tiết lưu nhiệt (TXV)** Danfoss và giám sát hiệu suất dàn lạnh qua 3 cảm biến nhiệt độ thời gian thực.

![TXV Tuner Preview](./assets/preview.png)

---

## 🌟 Tính Năng Chính

### 1. Bộ Căn Chỉnh Quá Nhiệt TXV Danfoss

- **13 loại môi chất lạnh** chuẩn CoolProp (NIST):
  - HFC: R134a, R404A, R410A, R32, R407C, R507A
  - HFO: R1234yf, R1234ze
  - Tự nhiên: R290 (Propane), R744 (CO₂), R717 (Ammonia), R600a (Isobutane)
  - Legacy: R22
- **5 dòng van Danfoss TXV**:
  - T2/TE2 (0.5–15.5 kW, 1.2 K/vò²²²ng)
  - TE5 (12–50 kW, 0.5 K/vò²²²ng)
  - TE12 (40–100 kW, 0.3 K/vò²²²ng)
  - TGE (10–140 kW, 0.8 K/vò²²²ng)
  - TU/TCA (thep không gỉ, 1.2 K/vò²²²ng)
- **Khuyến nghị vặn vít** với số vòng chính xác:
  - Quá nhiệt thấp → Sit van (CW)
  - Quá nhiệt cao → Mở van (CCW)
  - Quá nhiệt tối ưu → ✓ OK
- **Biểu đồ Superheat real-time** với 2 đường (actual vs target)

### 2. Giám Sát Cảm Biến Thời Gian Thực

- **3 cảm biến nhiệt độ**:
  - T1: Khí vào dàn lạnh (return air)
  - T2: Khí ra dàn lạnh (supply air)
  - T3: Ống gas hồi về (bầu cảm nhiệt TXV)
- **Độ giảm nhiệt ΔT_air = T1 - T2** với 3 vùng trạng thái:
  - < 4K: ⚠️ CẢNH BÁO (hiệu suất thấp)
  - 4–12K: ✓ TỐI ƯU
  - > 12K: CHÚ Ý (lưu lượng gió thấp)
- **Đồng hồ kim analog** (SkeuoGauge) mô phỏng đồng hồ đo cơ khí
- **Biểu đồ 3 đường** T1/T2/T3 theo thời gian

### 3. Mô Phỏng & Kết Nối ESP32

- **Demo Mode**: Giả lập dữ liệu cảm biến biến thiên ±0.15–0.3K mỗi 2s
- **Live Mode**: Kết nối ESP32 qua WiFi (API `/api/temperatures`)
- **Cấu hình IP/URL** trong Settings modal
- **Trạng thái kết nối**: ESP32 đã kết nối / Mất kết nối / Dữ liệu mô phỏng

### 4. Giao Diện Skeuomorphism Công Nghiệp

- **Vỏ kim loại sơn mờ** với gradient metal top/bottom
- **M màn hình LCD lõm** màu xanh đen (screenBg) với chữ đơn sắc (screenInk)
- **N nút cơ khí nổi** với shadow cơ khí và press travel 1px
- **Đ đèn LED trạng thái** 10×¹⁰px với viền borderStrong
- **Light/Dark mode** với toggle, tự động theo hệ thống
- **Giảm hiệu ứng vật liệu** (reducedEffects) cho thiết bị cũ

---

## 🚀 Hướng Dẫn Cài Đặt

### Yêu Cầu Hệ Thống

- Node.js 18+
- npm 9+
- Expo CLI 6+
- Android Studio (cho Android build) hoặc Xcode (cho iOS)

### Cài Đặt Nhanh

```bash
# 1. Clone repository
git clone https://github.com/thanhtupppp/txv-tuner.git
cd txv-tuner

# 2. Cài đặt dependencies
npm install

# 3. Chạy trên Expo Go (khuyến nghị cho testing)
npm start
# Quet QR code bằng ứng dụng Expo Go trên Android/iOS

# 4. Chạy trên Android Studio Emulator
npm run android

# 5. Chạy trên iOS Simulator (macOS only)
npm run ios

# 6. Chạy trên Web browser
npm run web
```

### Build APK Production

```bash
# Cài EAS CLI
npm install -g eas-cli

# Login Expo
eas login

# Build APK
eas build -p android --profile preview

# Build IPA (iOS)
eas build -p ios --profile preview
```

---

## 🧪 Kiểm Thử Tự Động

### Chạy Toàn Bộ Test Suite

```bash
# Chạy tất cả tests
npm test

# Chạy với verbose output
npm test -- --verbose

# Coverage report (future)
npm test -- --coverage
```

### Test Coverage Theo Phase

| Phase    | Component                                      | Test Cases | Kết Quả             |
| -------- | ---------------------------------------------- | ---------- | ------------------- |
| **1**    | SkeuoKit Primitives                            | 15         | ✅ 15/15            |
| **2**    | Display (SensorCard, TelemetryBar)             | 9          | ✅ 9/9              |
| **3**    | Calculation (InputsGrid, SimCond, ResultPanel) | 14         | ✅ 14/14            |
| **4**    | Integration (Monitor, Tuner, App)              | 12         | ✅ 12/12            |
| **5**    | Bonus: SH Realtime Chart                       | 8          | ✅ 8/8              |
| **Tổng** | **Toà²²2 bộ app**                              | **58**     | ✅ **58/58 (100%)** |

### Kiểm Tra Độ Tương Phản WCAG 2.1

```bash
npm run test:contrast
```

**Kết quả**:

- **Status Badge**: 6.70:1 – 9.40:1 (AA/AAA)
- **LCD Readout**: 11.14:1 (Light), 13.89:1 (Dark) — AAA
- **Tất cả 20 cặp màu** đạt ≥ 4.5:1 (AA), hầu hết đạt ≥ 7:1 (AAA)

---

## 📐 Kiến Trúc Phần Mềm

### Cấu Trúc Thư Mục

```
txv-tuner/
├── src/
│   ├── components/          # UI components
│   │   ├── Header.js
│   │   ├── SensorCard.js
│   │   ├── SkeuoKit.js      # Primitives (LcdWell, Led, Gauge, Panel)
│   │   ├── TxvHistoryChart.js
│   │   ├── TxvInputsGrid.js
│   │   ├── TxvRealtimeChart.js
│   │   ├── TxvResultPanel.js
│   │   ├── TxvTelemetryBar.js
│   │   └── ...
│   ├── screens/             # Màn hình chính
│   │   ├── MonitorScreen.js
│   │   └── TxvTunerScreen.js
│   ├── hooks/               # Custom hooks
│   │   ├── useTemperatures.js
│   │   └── useTxvCalculator.js
│   ├── utils/               # Utility functions
│   │   ├── temperatureMetrics.js
│   │   └── txvRecommendation.js
│   ├── data/                # Dữ liệu CoolProp
│   │   └── danfossData.js
│   └── constants/           # Theme & config
│       ├── theme.js
│       └── txvConfig.js
├── __tests__/               # Unit & integration tests
│   ├── SkeuoKit.test.js
│   ├── DisplayComponents.test.js
│   ├── CalculationComponents.test.js
│   ├── IntegrationScreens.test.js
│   └── TxvRealtimeChart.test.js
├── scripts/                 # Automation scripts
│   └── verify-wcag-contrast.js
├── docs/                    # Tài liệu thiết kế
│   ├── skeuomorphism.md
│   └── design-plan-skeuomorphism.md
└── package.json
```

### Luồng Dữ Liệu

```
ESP32 / Demo Mode
    ↓
useTemperatures hook
    ↓
┌────────────────────┬────────────────────┐
│                    │                    │
MonitorScreen        TxvTunerScreen       App
├─ SensorCard        ├─ TxvTelemetryBar   ├─ Theme toggle
├─ SkeuoGauge        ├─ RefrigerantSel.   ├─ Demo toggle
└─ RealtimeChart     ├─ ValveSelector     └─ Tab switching
                     ├─ TxvInputsGrid
                     ├─ TxvResultPanel
                     └─ TxvRealtimeChart
```

---

## 🔬 Cơ Sở Khoa Học

### Phương Trình CoolProp

Á²p suất bão hòa tính theo phương trình phụ trợ CoolProp (sai số < 0.01% so với NIST REFPROP):

\[
p*{sat} = P_c \cdot \exp\left(rac{T_c}{T} \sum*{i} n_i \left(1 - rac{T}{T_c}
ight)^{t_i}
ight)
\]

Trong đó:

- \(P_c\): Áp suất tới hạn (bar)
- \(T_c\): Nhiệt độ tới hạn (K)
- \(n_i, t_i\): Hệ số phương trình (lấy từ CoolProp database)

### Độ Quá Nhiệt (Superheat)

\[
SH = T*{hơi\ hút} - T*{bay\ hơi} = T*3 - T*{evap}
\]

- **SH tối ưu**: 4–8K (Danfoss khuyến nghị 6K)
- **SH thấp**: < 4K → Ngập dịch compressor
- **SH cao**: > 8K → Quá tải, cháy cuộn dây

### Độ Giảm Nhiệt Khí Qua D dàn Lạnh

\[
\Delta T\_{air} = T_1 - T_2
\]

- **Tối ưu**: 8–12K (AC), 10–15K (tủ đông)
- **Thấp**: < 4K → D dàn bẩn, thiếu gas, quạt yếu
- **Cao**: > 15K → Lưu lượng gió thấp, quá tải

---

## 🎨 Triết Lý Thiết Kế Skeuomorphism

### Nguyên Tắc Cốt Lõ²²²i

1. **Á²nh sáng từ trên**: Highlight `theme.highlight` ở cạnh trên, shadow `theme.borderStrong` ở cạnh dưới
2. **Độ sâu 3 cấp**:
   - Panel nổi: `cardShadow` (elevation 3, bottom border 3px)
   - N nút nổi: `chipShadow` + bottom border 3px
   - Ô lõm: `surfaceInset` / `screenBg` + top border 2px đậm
3. **Chữ số đo**: Luôn MONO + `screenInk` / `screenMuted` trên nền `screenBg`
4. **Trạng thái không phụ thuộc màu**: Kè²²m chữ (✓, "CHUẨN") hoặc viền
5. **Target 48px**: Mọi control ≥ 48×¹⁴⁸px (`SKEUOMORPHISM['--um-skeuomorphism-target-min']`)
6. **Fallback**: Mọi hiệu ứng tự tắt khi `reducedEffects=true`

### Tokens Semantic

```javascript
// src/constants/theme.js
{
  bg: '#cbd0ce',           // Nền app
  surface: '#f0f1eb',      // Vỏ panel
  surfaceInset: '#dfe3dd', // Ô lõm nhẹ
  screenBg: '#182e29',     // Màn hình LCD
  screenInk: '#c6edc0',    // Chữ LCD
  borderStrong: '#6b7e72', // Viền đậm
  highlight: '#ffffff',    // Highlight cạnh trên
  shadowDark: '#56635b',   // Shadow cạnh dưới
  accent: '#225b48',       // Màu chính
  optimal: '#25633f',      // Trạng thái tốt
  warning: '#8c4b16',      // Cảnh báo
  danger: '#a6332b',       // Nguy hiểm
  cold: '#175c79',         // Quá lạnh
}
```

---

## 🛠️ Công Cụ & Thư Viện

### Core Dependencies

| Package                                     | Version  | Mục Đí²²ch               |
| ------------------------------------------- | -------- | ------------------------ |
| `expo`                                      | ~57.0.24 | Framework cross-platform |
| `react-native`                              | 0.86.3   | UI framework             |
| `react-native-svg`                          | 15.15.4  | Vẽ SVG (gauge, chart)    |
| `@react-native-async-storage/async-storage` | 2.2.0    | Lưu IP, calibration      |

### Dev Dependencies

| Package                         | Version | Mục Đí²²ch           |
| ------------------------------- | ------- | -------------------- |
| `jest`                          | ^29.7.0 | Test runner          |
| `jest-expo`                     | ^57.0.5 | Expo preset cho Jest |
| `@testing-library/react-native` | ^14.0.1 | Test UI components   |

---

## 📚 Tài Liệu Tham Khảo

### CoolProp & Nhiệt Động Lực Học

- [CoolProp Official Documentation](https://coolprop.org/)
- [NIST REFPROP Database](https://www.nist.gov/srd/refprop)
- [ASHRAE Fundamentals Handbook](https://www.ashrae.org/)

### Danfoss TXV

- [Danfoss T2/TE2 Datasheet](https://www.danfoss.com/en/products/dcs/valves/thermostatic-expansion-valves-txv/thermostatic-expansion-valves/t2-te2/)
- [Danfoss TEV Adjustment Guide](https://www.danfoss.com/en/service-and-support/technical-support/technical-articles/thermostatic-expansion-valves/)

### Skeuomorphism & Accessibility

- [NN/g: Skeuomorphism](https://www.nngroup.com/articles/skeuomorphism/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design 3](https://m3.material.io/)

---

## 👤 Tác Giả

**Trần Thành Tú**

- GitHub: [@thanhtupppp](https://github.com/thanhtupppp)
- Email: devthanhtu@gmail.com
- Location: Đồng Nai, Việt Nam

---

## 📄 Giấy Phep

MIT License — Xem file [LICENSE](./LICENSE) để biết chi tiết.

---

## 🙏 Lời Cảm Ơn

- **CoolProp team** — Thư viện nhiệt động lực học mã nguồn mở tuyệt vời
- **Danfoss** — Tài liệu kỹ thuật chi tiết về van TXV
- **Expo team** — Framework React Native xuất sắc
- **Testing Library team** — Công cụ test UI tuyệt vời

---

## 📬 Liên Hệ

Nếu bạn có câu hỏi, góp ý, hoặc muốn đóng góp, vui lòng:

1. Tạo [Issue](https://github.com/thanhtupppp/txv-tuner/issues) trên GitHub
2. Gửi email đến devthanhtu@gmail.com
3. Tạo [Pull Request](https://github.com/thanhtupppp/txv-tuner/pulls)

---

**Build with ❤️ for HVAC technicians worldwide**

_Last updated: September 23, 2026_
