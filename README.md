# 📱 Danfoss TXV Tuner - Ứng Dụng Android Native (React Native / Expo)

Ứng dụng Android độc lập mô phỏng và hỗ trợ căn chỉnh độ quá nhiệt van tiết lưu nhiệt Danfoss TXV (Ref Tools) kết hợp giám sát 3 cảm biến nhiệt độ từ ESP32 Wokwi.

---

## 🚀 Hướng Dẫn Chạy Thử Nghiệm Trên Android

### Cách 1: Chạy ngay trên điện thoại Android qua ứng dụng Expo Go (Khuyến nghị)
1. Cài đặt ứng dụng **Expo Go** miễn phí từ Google Play Store trên điện thoại Android của bạn.
2. Trên máy tính, mở terminal tại thư mục `d:\wokwi\mobile`:
   ```bash
   npx expo start
   ```
3. Mở ứng dụng **Expo Go** trên điện thoại, bấm **Scan QR code** và quét mã QR hiển thị trên màn hình terminal máy tính (đảm bảo điện thoại và máy tính kết nối chung mạng WiFi).

---

### Cách 2: Chạy trên Android Studio Emulator
Nếu máy tính của bạn đã cài sẵn Android Studio và máy ảo Android:
```bash
npm run android
```

---

### Cách 3: Build file APK cài trực tiếp lên điện thoại
Sử dụng Expo Application Services (EAS) để build file `.apk` cài đặt trực tiếp mà không cần xuất bản lên Google Play:
1. Cài đặt EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
2. Đăng nhập và cấu hình build APK:
   ```bash
   eas build -p android --profile preview
   ```
3. Tải file `.apk` sau khi build xong và cài vào điện thoại Android.

---

## 🌟 Tính Năng Trên Android

1. **Bộ căn chỉnh quá nhiệt TXV Danfoss (Ref Tools)**:
   - Danh mục **13 loại môi chất lạnh** chuẩn CoolProp (R134a, R404A, R22, R410A, R32, R290, R507A, R407C, R1234yf, R1234ze, R744, R717, R600a).
   - Danh mục **5 dòng van Danfoss TXV** (T2/TE2, TE5, TE12, TGE, TU/TCA).
   - Mô phỏng **Vít xoay 3D (SVG)** hiển thị chiều quay (CW / CCW) và số vòng cần vặn để đưa độ quá nhiệt về chuẩn tối ưu.
   - Biểu đồ **Lịch sử Superheat** trực quan theo thời gian.
   - Điều khiển nhiệt độ ngưng tụ dàn nóng $T_{cond}$ độc lập.

2. **Giám sát cảm biến thời gian thực**:
   - T1: Nhiệt độ khí vào dàn lạnh.
   - T2: Nhiệt độ khí ra dàn lạnh.
   - T3: Nhiệt độ ống gas hồi về (bầu cảm nhiệt TXV).
   - Tính toán $\Delta T_{air} = T_1 - T_2$ và cảnh báo hiệu suất trao đổi nhiệt dàn lạnh.
   - Đồ thị 3 đường cảm biến Real-Time.

3. **Cấu hình mạng & Demo Mode**:
   - Tích hợp nút bật **🧪 Demo Mode** giả lập dữ liệu cảm biến để trải nghiệm đầy đủ ngay cả khi chưa kết nối phần cứng.
   - Hộp thoại cài đặt IP ESP32 trong mạng LAN (`⚙️`) để kết nối tới thiết bị thực tế hoặc Wokwi gateway.
   - Hỗ trợ giao diện **Sáng / Tối (Light / Dark mode)** với thiết kế Skeuomorphism dạng thiết bị đo: vỏ kim loại, màn hình LCD lõm, nút bấm nổi và chế độ giảm hiệu ứng.
