# ESP32 — Mobile App Protocol Contract Specification
**Tài liệu Đặc tả Giao thức Giao tiếp Giữa Mobile App và ESP32 Firmware**

> **Tài liệu tham chiếu:** Firmware [`esp32/esp32_sse.ino`](file:///d:/wokwi/mobile/esp32/esp32_sse.ino)  
> **Phiên bản:** `1.0.0`  
> **Trạng thái:** Active / Baseline Verified  
> **Đối tượng:** Mobile App Client (React Native / Web) & ESP32 Firmware (Arduino C++)

---

## 1. Tổng quan Kiến trúc Giao tiếp

Hệ thống điều khiển và giám sát van tiết lưu điện tử (TXV Tuner) hoạt động theo mô hình Hybrid:
1. **Server-Sent Events (SSE) Stream (`/api/stream`):** Kênh truyền chính một chiều (Server -> Client) liên tục, độ trễ thấp, phục vụ hiển thị nhiệt độ thời gian thực (1 Hz) và giám sát nhịp tim (0.1 Hz).
2. **RESTful HTTP Endpoints:** Kênh phụ phục vụ Polling dự phòng khi SSE không khả dụng, truy vấn thống kê hệ thống (`/api/stats`), và kiểm tra sức khỏe (`/api/health`).

```
┌────────────────────────────────────────────────────────┐
│             Mobile App (React Native Client)           │
│                                                        │
│  useTemperatures Hook  ◄─── Normalization & Validation │
│         ▲                               ▲              │
│         │                               │              │
│   EventSource (SSE)               esp32Request         │
│   Heartbeat Watchdog              Safe Retry Wrapper   │
└─────────┬───────────────────────────────┬──────────────┘
          │ GET /api/stream               │ GET /api/temperatures
          │ (Push 1s & 10s)               │ GET /api/stats, /api/health
          ▼                               ▼
┌────────────────────────────────────────────────────────┐
│             ESP32 Microcontroller (Firmware)           │
│                                                        │
│  OneWire Bus (Pin 4) ───► Dallas DS18B20 (T1, T2, T3)  │
│  WiFi Server (Port 80) ──► AP / STA Mode               │
│                                                        │
│  [CHƯA CÓ]: Endpoint điều khiển van TXV (Phase 6)      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Cấu hình Mạng & Kết nối

### 2.1. Chế độ Wi-Fi
- **Chế độ Access Point (AP) - Mặc định hiện trường:**
  - **SSID:** `TuSmart-TXV-Tuner`
  - **Password:** `12345678` (WPA2-PSK)
  - **IP Gateway / Host:** `192.168.4.1`
  - **HTTP Port:** `80`
- **Chế độ Station (STA) - Môi trường mô phỏng / Lab:**
  - Hỗ trợ kết nối vào mạng Wi-Fi ngoài (ví dụ Wokwi `Wokwi-GUEST`).
  - IP được cấp phát qua DHCP, hiển thị qua cổng Serial 115200 bps.

### 2.2. CORS & HTTP Headers
- ESP32 gửi kèm header `Access-Control-Allow-Origin: *` trên toàn bộ các response HTTP và SSE header nhằm tương thích hoàn toàn với nền tảng Web / Expo Web.

---

## 3. Giao thức Server-Sent Events (SSE) — `/api/stream`

### 3.1. Thiết lập Kết nối
- **Method:** `GET`
- **URL:** `http://<ESP32_IP>/api/stream`
- **Headers:**
  - `Accept: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
- **Response Headers từ ESP32:**
  ```http
  HTTP/1.1 200 OK
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  Access-Control-Allow-Origin: *
  ```

### 3.2. Giới hạn Phần cứng ESP32 (Hardware Constraint)
> [!WARNING]
> **Giới hạn một Client SSE:**  
> Trong `esp32_sse.ino`, firmware khai báo một biến duy nhất `WiFiClient sseClient`.  
> Nếu có thiết bị thứ hai hoặc tab trình duyệt thứ hai mở `/api/stream`, client cũ sẽ bị ghi đè tham chiếu (`sseClient = server.client()`).  
> Client cũ sẽ không còn nhận được event mà không có thông báo đóng rõ ràng. Mobile client cần cơ chế **Heartbeat Watchdog** để phát hiện mất stream khi gặp tình huống này.

---

### 3.3. Danh mục Sự kiện (SSE Events)

#### A. Event `connected`
Được phát ngay khi kết nối TCP SSE được chấp nhận thành công.
- **Tần suất:** Ngay lập tức khi mở stream (1 lần/kết nối).
- **Format:**
  ```text
  event: connected
  data: {"status":"ok"}
  ```

#### B. Event `temperatures` (Telemetry Thời gian thực)
Được phát chu kỳ mỗi **1000 ms** (1 giây/lần).
- **Tần suất:** 1 Hz (`PUSH_INTERVAL_MS = 1000`).
- **Raw Payload JSON:**
  ```json
  {
    "sensors": [
      {
        "id": 0,
        "name": "T1 Vào dàn",
        "temp": 28.5,
        "online": true
      },
      {
        "id": 1,
        "name": "T2 Ra dàn",
        "temp": 12.3,
        "online": true
      },
      {
        "id": 2,
        "name": "T3 Bầu TXV",
        "temp": 8.1,
        "online": true
      }
    ],
    "deltaAir": 16.2,
    "uptime": 1420,
    "heartbeat": true,
    "serverTimestamp": 1420150
  }
  ```

- **Quy tắc Cảm biến & Giá trị:**
  | Trường | Kiểu dữ liệu | Mô tả | Dải giá trị hợp lệ | Trạng thái lỗi / Offline |
  |---|---|---|---|---|
  | `sensors[i].id` | `number` | ID cảm biến (0: T1, 1: T2, 2: T3) | `0, 1, 2` | Luôn có mặt |
  | `sensors[i].name` | `string` | Tên cảm biến cố định | `"T1 Vào dàn"`, `"T2 Ra dàn"`, `"T3 Bầu TXV"` | Luôn có mặt |
  | `sensors[i].temp` | `number \| null` | Nhiệt độ Celsius (°C, làm tròn 1 chữ số thập phân) | `-55.0` đến `125.0` | `null` khi ngắt kết nối hoặc ngoài dải đo |
  | `sensors[i].online` | `boolean` | Cảm biến có phản hồi trên bus 1-Wire | `true` | `false` khi mất cảm biến |
  | `deltaAir` | `number \| null` | Chênh lệch nhiệt độ không khí `T1 - T2` | Số thực (°C) | `null` nếu T1 hoặc T2 `online: false` |
  | `uptime` | `number` | Thời gian ESP32 hoạt động (giây) | `>= 0` | Không âm |
  | `heartbeat` | `boolean` | Cờ xác nhận chu kỳ sống | `true` | |
  | `serverTimestamp` | `number` | Thời điểm phát gói tin (millis) | `>= 0` | |

- **Quy chuẩn Ánh xạ sang Domain Client (Canonical Contract):**
  - Payload từ firmware gửi trường `"temp"`.
  - Domain tầng Mobile (`normalizeTelemetry.js`) chuyển đổi sang chuẩn hóa **`temperatureC`** để bảo đảm tính rõ ràng về đơn vị đo lường.
  - Trường **`temp`** được giữ lại dưới dạng alias nhằm tương thích ngược với các component UI cũ.
  - Client bổ sung thêm trường `status: "ok" | "offline" | "invalid"` và cờ `valid: boolean` cho từng sensor.

#### C. Event `heartbeat` (Nhịp tim Hệ thống)
Được phát chu kỳ mỗi **10000 ms** (10 giây/lần).
- **Tần suất:** 0.1 Hz (`HEARTBEAT_INTERVAL_MS = 10000`).
- **Format:**
  ```text
  event: heartbeat
  data: {"alive":true,"freeHeap":245180,"uptime":1420}
  ```
- **Mục đích:**
  - Giữ cho kết nối TCP không bị timeout bởi NAT / Firewall.
  - Cung cấp `freeHeap` (RAM trống của ESP32 tính bằng byte).
  - Giúp Mobile Client thiết lập **Heartbeat Watchdog** (mặc định ngưỡng 15 giây). Nếu quá 15s không nhận được bất kỳ event nào (`temperatures` hoặc `heartbeat`), client chủ động ngắt socket và kích hoạt tái kết nối (Reconnect Backoff).

#### D. Event `warning` (Client Extension Contract)
- **Tần suất:** Phát sinh khi ESP32 gặp tình trạng bất thường (ví dụ bộ nhớ RAM cạn kiệt `freeHeap < 20000`).
- **Format:**
  ```text
  event: warning
  data: {"code":"heap_critical","freeHeap":18500,"message":"ESP32 free heap is critical"}
  ```
- **Xử lý phía App:** `esp32Service.js` đã hỗ trợ listener `onWarning`. App ghi nhận log cảnh báo và có cơ chế debounce để không spam người dùng.

---

## 4. Giao diện Lập trình RESTful HTTP (REST Fallback & Management)

### 4.1. `GET /api/temperatures` — Polling Dự phòng
- **Mục đích:** Dự phòng khi môi trường không hỗ trợ Server-Sent Events hoặc cần truy vấn nhiệt độ 1 lần (One-shot fetch).
- **Headers:** `Accept: application/json`
- **Response:**
  - **Status:** `200 OK`
  - **Content-Type:** `application/json`
  - **Body:** Cấu trúc JSON tương đồng 100% với event `temperatures` của SSE.

### 4.2. `GET /api/stats` — Thống kê & Chẩn đoán Phần cứng
- **Mục đích:** Phục vụ hiển thị trên màn hình Stats Modal (RAM, thời gian chạy, chất lượng sóng Wi-Fi, trạng thái kết nối).
- **Headers:** `Accept: application/json`
- **Response:**
  - **Status:** `200 OK`
  - **Content-Type:** `application/json`
  - **Ví dụ Payload:**
    ```json
    {
      "freeHeap": 245120,
      "uptime": 1420,
      "clientConnected": true,
      "wifiRSSI": -62,
      "wifiSSID": "TuSmart-TXV-Tuner",
      "wifiIP": "192.168.4.1",
      "wifiGateway": "192.168.4.1",
      "sensorCount": 3
    }
    ```
- **Ý nghĩa các trường:**
  - `freeHeap`: Bộ nhớ heap còn lại (bytes). Dưới 30KB là mức cảnh báo, dưới 15KB là nguy cơ sập.
  - `uptime`: Thời gian hoạt động tính từ lúc cấp nguồn (giây).
  - `clientConnected`: Trạng thái có client đang giữ luồng SSE hay không (`true`/`false`).
  - `wifiRSSI`: Cường độ tín hiệu Wi-Fi (dBm). (Âm càng nhỏ càng mạnh, ví dụ -50 dBm tốt hơn -85 dBm).
  - `sensorCount`: Số lượng cảm biến DS18B20 nhận diện được lúc khởi động.

### 4.3. `GET /api/health` — Kiểm tra Sức khỏe Nhanh
- **Mục đích:** Dùng cho bộ giám sát mạng hoặc kiểm tra kết nối IP hợp lệ trước khi bắt đầu stream.
- **Response:**
  - **Status:** `200 OK`
  - **Content-Type:** `text/plain`
  - **Body:** `"OK"`

---

## 5. Báo cáo Đối chiếu & Các Điểm Thiếu Hụt Firmware (Reality Check & Gaps)

Sau khi rà soát toàn diện tệp firmware [`esp32/esp32_sse.ino`](file:///d:/wokwi/mobile/esp32/esp32_sse.ino), xác định các khoảng trống kỹ thuật sau:

| STT | Thành phần | Trạng thái trong Firmware | Ảnh hưởng & Rủi ro | Giải pháp Khắc phục |
|---|---|---|---|---|
| **1** | **Điều khiển van TXV (Actuation)** | **CHƯA CÓ** (Không có endpoint `/api/valve`, không có mã điều khiển stepper) | App không thể gửi lệnh đóng/mở van vật lý ở phiên bản firmware hiện tại. | Phải đặc tả contract Phase 6 trước; KHÔNG tự ý giả định endpoint khi firmware chưa nạp code điều khiển. |
| **2** | **Phiên bản Giao thức (Protocol Versioning)** | **CHƯA CÓ** (Không có trường `version` trong response) | Client không phân biệt được phiên bản firmware cũ/mới nếu có cập nhật schema sau này. | Quy ước ngầm là v1.0; đề xuất bổ sung `protocolVersion: "1.0.0"` vào `/api/stats` ở đợt cập nhật firmware kế tiếp. |
| **3** | **Request ID / Khóa chống trùng (Idempotency)** | **CHƯA CÓ** | Đối với GET (đọc dữ liệu) thì an toàn, nhưng khi có lệnh ghi (POST/PUT van TXV), việc thiếu `requestId` có thể gây gửi lệnh trùng lặp cơ học. | Bắt buộc triển khai Request ID ở Phase 6. |
| **4** | **Phân biệt Lệnh Đọc vs Lệnh Ghi (Safe vs Non-idempotent)** | Đã tách ở Client | Các tác vụ Đọc (`GET`) được phép tự động retry khi gặp lỗi mạng/timeout; các tác vụ Ghi/Command tuyệt đối KHÔNG tự ý retry mù quáng. | Tách rõ wrapper `requestEsp32SafeRead` và `requestEsp32Command` trong client. |

---

## 6. Đặc tả Giao thức Dự kiến cho Lệnh Điều khiển Van TXV (Phase 6 Specification)

Khi firmware bổ sung module điều khiển động cơ bước cho van tiết lưu điện tử, giao thức lệnh bắt buộc phải tuân thủ nghiêm ngặt các tiêu chuẩn an toàn cơ - điện lạnh:

### 6.1. Endpoint Đề xuất
- **Endpoint:** `POST /api/valve/position`
- **Headers:**
  - `Content-Type: application/json`
  - `X-Request-Id: <uuid-v4>`

### 6.2. Cấu trúc Payload Gửi (Request Body)
```json
{
  "requestId": "c1f7a0c8-4b21-4f12-a7d4-89c0b11e2f3a",
  "targetPosition": 45.0,
  "timestamp": 1727218900000,
  "timeoutMs": 5000
}
```
- **Quy tắc kiểm định (Validation Rules):**
  - `targetPosition`: Bắt buộc nằm trong đoạn `[0.0, 100.0]` (0% = Đóng hoàn toàn, 100% = Mở hoàn toàn). Số thực độ chính xác tối đa 1 số thập phân.
  - `requestId`: Chuỗi định danh duy nhất (UUID). ESP32 lưu cache 5 `requestId` gần nhất để loại bỏ lệnh trùng (Deduplication).

### 6.3. Cấu trúc Phản hồi (Acknowledgement - Response Body)
```json
{
  "requestId": "c1f7a0c8-4b21-4f12-a7d4-89c0b11e2f3a",
  "status": "accepted",
  "currentPosition": 30.0,
  "targetPosition": 45.0,
  "estimatedTimeMs": 1500,
  "serverTimestamp": 1727218900120
}
```
- Mã trạng thái:
  - `accepted`: Lệnh hợp lệ, van bắt đầu bước.
  - `rejected`: Lệnh bị từ chối do vi phạm an toàn (quá nhiệt, cảm biến offline, vị trí ngoài dải).
  - `busy`: Van đang trong quá trình chuyển động từ lệnh trước chưa hoàn thành.

### 6.4. Các Chốt An toàn Bắt buộc (Fail-Safe Interlocks)
1. **Khóa liên động Cảm biến (Sensor Interlock):** Không cho phép điều khiển tự động nếu `T1` hoặc `T2` hoặc `T3` rơi vào trạng thái `online: false` hoặc giá trị `temperatureC` không hợp lệ.
2. **Khóa Mất kết nối (Communication Timeout Interlock):** Nếu mất kết nối mạng hoặc đứt SSE quá 10 giây trong khi đang điều khiển, hệ thống tự động duy trì vị trí van an toàn hoặc đưa về vị trí mặc định cấu hình trước.
3. **Cấm Retry Tự động (No Blind Retry on Timeout):** Nếu mobile gửi lệnh và bị timeout chờ response, mobile KHÔNG được tự động gửi lại lệnh mà phải chuyển sang tra cứu trạng thái thực tế (`GET /api/valve/status`) để xác minh van đã nhận bước hay chưa.

---

## 7. Tóm tắt Ma trận Endpoint Hiện tại

| Phương thức | Endpoint | Giao thức | Tần suất | Mục đích | Trạng thái Firmware |
|---|---|---|---|---|---|
| `GET` | `/api/stream` | HTTP SSE | 1s / 10s | Truyền nhiệt độ thời gian thực và heartbeat | **Sẵn sàng** (Hoạt động tốt) |
| `GET` | `/api/temperatures` | HTTP REST | On-demand | Đọc nhiệt độ tức thời (Dự phòng Polling) | **Sẵn sàng** (Hoạt động tốt) |
| `GET` | `/api/stats` | HTTP REST | On-demand | Đọc RAM, uptime, RSSI, trạng thái client | **Sẵn sàng** (Hoạt động tốt) |
| `GET` | `/api/health` | HTTP REST | On-demand | Health check nhanh | **Sẵn sàng** (Hoạt động tốt) |
| `POST` | `/api/valve/position` | HTTP REST | Sự kiện | Điều khiển độ mở van TXV | **CHƯA CÓ** (Thiết kế cho Phase 6) |
| `GET` | `/api/valve/status` | HTTP REST | On-demand | Đọc vị trí thực tế của van TXV | **CHƯA CÓ** (Thiết kế cho Phase 6) |
