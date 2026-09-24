#include <WiFi.h>
#include <WebServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

const char* AP_SSID = "TuSmart-TXV-Tuner";
const char* AP_PASS = "12345678";

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
DeviceAddress sensorAddrs[3];
int sensorCount = 0;

WebServer server(80);
WiFiClient sseClient;

unsigned long lastPushTime = 0;
const unsigned long PUSH_INTERVAL_MS = 1000; // Đẩy dữ liệu mỗi 1s

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL_MS = 10000; // Heartbeat mỗi 10s

void handleSSE();
void handleGetTemperatures();
void sendSSEMessage(const String& event, const String& data);
void pushSSEData();

void setup() {
  Serial.begin(115200);
  
  sensors.begin();
  sensorCount = sensors.getDeviceCount();
  for (int i = 0; i < sensorCount && i < 3; i++) {
    sensors.getAddress(sensorAddrs[i], i);
  }
  
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("AP started. IP: ");
  Serial.println(WiFi.softAPIP());
  
  // Endpoint SSE Streaming
  server.on("/api/stream", HTTP_GET, handleSSE);
  
  // Endpoint Polling dự phòng
  server.on("/api/temperatures", HTTP_GET, handleGetTemperatures);
  
  // Endpoint Thống kê trạng thái ESP32
  server.on("/api/stats", HTTP_GET, []() {
    DynamicJsonDocument doc(256);
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["uptime"] = millis() / 1000;
    doc["clientConnected"] = (sseClient && sseClient.connected());
    doc["wifiRSSI"] = WiFi.RSSI();
    
    String json;
    serializeJson(doc, json);
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", json);
  });
  
  // Health check
  server.on("/api/health", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", "OK");
  });
  
  server.begin();
  Serial.println("HTTP Server started");
}

void loop() {
  server.handleClient();
  
  unsigned long now = millis();

  // Đẩy dữ liệu cảm biến định kỳ qua SSE
  if (now - lastPushTime >= PUSH_INTERVAL_MS) {
    lastPushTime = now;
    if (sseClient && sseClient.connected()) {
      pushSSEData();
    }
  }

  // Đẩy heartbeat định kỳ qua SSE mỗi 10s
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    if (sseClient && sseClient.connected()) {
      String hb = "{\"alive\":true,\"freeHeap\":" + String(ESP.getFreeHeap()) + ",\"uptime\":" + String(now / 1000) + "}";
      sendSSEMessage("heartbeat", hb);
    }
  }
}

void handleSSE() {
  sseClient = server.client();
  
  // Header cho Server-Sent Events với CORS
  sseClient.print("HTTP/1.1 200 OK\r\n");
  sseClient.print("Content-Type: text/event-stream\r\n");
  sseClient.print("Cache-Control: no-cache\r\n");
  sseClient.print("Connection: keep-alive\r\n");
  sseClient.print("Access-Control-Allow-Origin: *\r\n\r\n");
  sseClient.flush();
  
  Serial.println("Client connected to SSE stream");
  sendSSEMessage("connected", "{\"status\":\"ok\"}");
}

void sendSSEMessage(const String& event, const String& data) {
  if (!sseClient || !sseClient.connected()) return;
  
  sseClient.print("event: " + event + "\r\n");
  sseClient.print("data: " + data + "\r\n\r\n");
  sseClient.flush();
}

void buildSensorPayload(DynamicJsonDocument& doc) {
  sensors.requestTemperatures();
  
  JsonArray sensors_arr = doc.createNestedArray("sensors");
  const char* sensorNames[3] = {"T1 Vào dàn", "T2 Ra dàn", "T3 Bầu TXV"};
  float temps[3] = {NAN, NAN, NAN};
  bool onlines[3] = {false, false, false};
  
  for (int i = 0; i < 3; i++) {
    JsonObject sensor = sensors_arr.createNestedObject();
    sensor["id"] = i;
    sensor["name"] = sensorNames[i];
    
    if (i < sensorCount) {
      float t = sensors.getTempC(sensorAddrs[i]);
      if (t != DEVICE_DISCONNECTED_C && t > -55.0f && t < 125.0f) {
        sensor["temp"] = round(t * 10.0f) / 10.0f;
        sensor["online"] = true;
        temps[i] = t;
        onlines[i] = true;
        continue;
      }
    }
    sensor["temp"] = nullptr;
    sensor["online"] = false;
  }
  
  if (onlines[0] && onlines[1]) {
    doc["deltaAir"] = round((temps[0] - temps[1]) * 10.0f) / 10.0f;
  } else {
    doc["deltaAir"] = nullptr;
  }
  
  doc["uptime"] = millis() / 1000;
  doc["heartbeat"] = true;
  doc["serverTimestamp"] = millis();
}

void pushSSEData() {
  DynamicJsonDocument doc(512);
  buildSensorPayload(doc);
  
  String json;
  serializeJson(doc, json);
  sendSSEMessage("temperatures", json);
}

void handleGetTemperatures() {
  DynamicJsonDocument doc(512);
  buildSensorPayload(doc);
  
  String json;
  serializeJson(doc, json);
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}
