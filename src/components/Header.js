import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { InstrumentIcon, MetalFace, SkeuoButton, SkeuoInput, useMaterial, SkeuoSwitch, SkeuoLed } from './SkeuoKit';
import { StatsModal } from './StatsModal';

// Regex kiểm tra IPv4 chuẩn (hỗ trợ kèm port :8080)
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?::\d{1,5})?$/;

// Regex kiểm tra Hostname / URL Wokwi / Local mDNS / localhost
const HOST_OR_URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9][-a-zA-Z0-9]*\.)*([a-zA-Z0-9][-a-zA-Z0-9]*)(\.local)?(:\d{1,5})?(\/.*)?$/;

export const isValidHostOrIp = (input) => {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  
  // Nếu có dạng các cụm số phân tách bởi dấu chấm (như địa chỉ IP)
  const isLikelyIp = /^\d+(\.\d+)*(:\d+)?$/.test(trimmed);
  if (isLikelyIp) {
    return IPV4_REGEX.test(trimmed);
  }

  return HOST_OR_URL_REGEX.test(trimmed);
};

export function Header({
  connectionStatus,
  isDemoMode,
  toggleDemoMode,
  themeMode,
  toggleTheme,
  esp32Ip = '192.168.4.1',
  saveEsp32Ip,
  reconnect,
  esp32Stats = null,
  statsLoading = false,
  refreshStats,
  sensors = [],
  flat,
  setFlat,
}) {
  const { theme } = useMaterial();
  const { width, fontScale } = useWindowDimensions();
  const compact = width / fontScale < 360;
  const [modalVisible, setModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [tempIp, setTempIp] = useState(esp32Ip);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const status = isDemoMode
    ? 'Dữ liệu mô phỏng'
    : connectionStatus === 'connected'
    ? 'ESP32 đã kết nối'
    : connectionStatus === 'reconnecting'
    ? 'Đang kết nối lại…'
    : connectionStatus === 'disconnected'
    ? 'ESP32 mất kết nối'
    : 'ESP32 chưa kết nối';

  const openSettings = () => {
    setTempIp(esp32Ip);
    setError('');
    setModalVisible(true);
  };

  const save = async () => {
    const target = (tempIp || '').trim();
    if (!target) {
      setError('Vui lòng nhập địa chỉ IP hoặc URL của ESP32.');
      return;
    }
    if (!isValidHostOrIp(target)) {
      setError('Địa chỉ không hợp lệ (ví dụ: 192.168.4.1, esp32.local hoặc URL Wokwi).');
      return;
    }
    setSaving(true);
    try {
      if (typeof saveEsp32Ip === 'function') {
        await saveEsp32Ip(target);
      }
      setModalVisible(false);
    } catch {
      setError('Chưa lưu được địa chỉ. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.shell, { backgroundColor: theme.surface, borderColor: theme.borderStrong }]}>
      <MetalFace />
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            {!compact && (
              <View style={[styles.badge, { backgroundColor: theme.screenBg, borderColor: theme.borderStrong }]}>
                <InstrumentIcon name="snow" color={theme.screenInk} size={26} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.inkMuted }]}>DANFOSS / REF TOOLS</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>TXV Tuner</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <SkeuoButton
              onPress={toggleTheme}
              accessibilityLabel={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              <InstrumentIcon name={themeMode === 'dark' ? 'sun' : 'moon'} color={theme.ink} />
            </SkeuoButton>
            <SkeuoButton
              testID="header-stats-btn"
              onPress={() => setStatsModalVisible(true)}
              accessibilityLabel="Xem thống kê phần cứng ESP32"
            >
              <InstrumentIcon name="chart" color={theme.ink} />
            </SkeuoButton>
            <SkeuoButton onPress={openSettings} accessibilityLabel="Cài đặt kết nối và giao diện">
              <InstrumentIcon name="settings" color={theme.ink} />
            </SkeuoButton>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.connection}>
            <SkeuoLed state={isDemoMode ? 'warn' : connectionStatus === 'connected' ? 'ok' : 'error'} size={10} />
            <Text style={[styles.status, { color: theme.ink }]}>{status}</Text>
            {!isDemoMode && connectionStatus !== 'connected' && typeof reconnect === 'function' && (
              <SkeuoButton
                testID="header-reconnect-btn"
                onPress={reconnect}
                style={styles.reconnectBtn}
                accessibilityLabel="Thử kết nối lại ESP32"
              >
                <Text style={[styles.reconnectBtnText, { color: theme.accent }]}>Thử lại</Text>
              </SkeuoButton>
            )}
          </View>
          <View style={styles.demo}>
            <Text style={[styles.status, { color: theme.ink }]}>Demo {isDemoMode ? 'bật' : 'tắt'}</Text>
            <SkeuoSwitch accessibilityLabel="Chế độ dữ liệu mô phỏng" value={isDemoMode} onValueChange={toggleDemoMode} />
          </View>
        </View>
      </View>
      <Modal animationType="none" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            accessibilityViewIsModal
            {...(Platform.OS === 'web' ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Cài đặt thiết bị' } : {})}
            style={[styles.modal, { backgroundColor: theme.surface, borderColor: theme.borderStrong }, theme.cardShadow]}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text accessibilityRole="header" style={[styles.modalTitle, { color: theme.ink }]}>Cài đặt thiết bị</Text>
              <Text style={[styles.description, { color: theme.inkMuted }]}>Kết nối ESP32 trong cùng mạng WiFi hoặc nhập URL mô phỏng Wokwi.</Text>
              <Text style={[styles.label, { color: theme.ink }]}>Địa chỉ IP / URL ESP32</Text>
              <SkeuoInput
                accessibilityLabel="Địa chỉ IP hoặc URL ESP32"
                autoFocus
                style={[styles.input, { backgroundColor: theme.surfaceInset, color: theme.ink }]}
                value={tempIp}
                onChangeText={(value) => { setTempIp(value); setError(''); }}
                placeholder="192.168.4.1"
                placeholderTextColor={theme.inkMuted}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={save}
              />
              {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger, marginTop: 8 }}>{error}</Text>}
              {esp32Stats && (
                <View testID="esp32-stats-card" style={[styles.statsBox, { backgroundColor: theme.surfaceInset, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.statsTitle, { color: theme.ink, marginBottom: 0 }]}>📊 Trạng thái ESP32</Text>
                    <SkeuoButton
                      testID="header-open-stats-detail-btn"
                      onPress={() => {
                        setModalVisible(false);
                        setStatsModalVisible(true);
                      }}
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                      accessibilityLabel="Xem chi tiết thông số ESP32"
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accent }}>Chi tiết ➔</Text>
                    </SkeuoButton>
                  </View>
                  <View style={styles.statsGrid}>
                    <Text style={[styles.statsItem, { color: theme.inkMuted }]}>
                      RAM: <Text style={{ color: esp32Stats.freeHeap < 10000 ? theme.danger : theme.optimal, fontWeight: '700' }}>
                        {(esp32Stats.freeHeap / 1024).toFixed(1)} KB {esp32Stats.freeHeap < 10000 ? '⚠️' : '✅'}
                      </Text>
                    </Text>
                    <Text style={[styles.statsItem, { color: theme.inkMuted }]}>
                      Uptime: <Text style={{ color: theme.ink, fontWeight: '700' }}>
                        {Math.floor((esp32Stats.uptime || 0) / 60)}m {(esp32Stats.uptime || 0) % 60}s
                      </Text>
                    </Text>
                    {typeof esp32Stats.wifiRSSI === 'number' && (
                      <Text style={[styles.statsItem, { color: theme.inkMuted }]}>
                        RSSI: <Text style={{ color: theme.ink, fontWeight: '700' }}>{esp32Stats.wifiRSSI} dBm</Text>
                      </Text>
                    )}
                  </View>
                </View>
              )}
              <View style={[styles.effectRow, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.ink }]}>Giảm hiệu ứng vật liệu</Text>
                  <Text style={[styles.description, { color: theme.inkMuted }]}>Bề mặt phẳng, giữ rõ nhãn và trạng thái.</Text>
                </View>
                <SkeuoSwitch accessibilityLabel="Giảm hiệu ứng vật liệu" value={flat} onValueChange={setFlat} />
              </View>
              <View style={styles.modalActions}>
                <SkeuoButton style={styles.modalButton} onPress={() => setModalVisible(false)}>
                  <Text style={{ color: theme.ink, fontWeight: '700' }}>Đóng</Text>
                </SkeuoButton>
                <SkeuoButton
                  style={[styles.modalButton, { backgroundColor: theme.accent }]}
                  onPress={save}
                  disabled={saving}
                  accessibilityState={{ busy: saving }}
                >
                  <Text style={{ color: theme.onAccent, fontWeight: '700' }}>{saving ? 'Đang lưu…' : 'Lưu kết nối'}</Text>
                </SkeuoButton>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <StatsModal
        visible={statsModalVisible}
        onClose={() => setStatsModalVisible(false)}
        stats={esp32Stats}
        sensors={sensors}
        loading={statsLoading}
        onRefresh={refreshStats}
      />
    </View>
  );
}

export default Header;

const styles = StyleSheet.create({
  shell: { borderBottomWidth: 2, overflow: 'hidden' },
  header: { padding: 16, gap: 14, width: '100%', maxWidth: 960, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 46, height: 48, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
  actions: { flexDirection: 'row', gap: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  led: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  status: { fontSize: 12, fontWeight: '600' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switch: { minWidth: 48, minHeight: 48 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(5,15,10,0.65)' },
  modal: { width: '100%', maxWidth: 480, maxHeight: '90%', padding: 22, borderWidth: 1, borderRadius: 16 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 52, paddingHorizontal: 12, fontSize: 16 },
  effectRow: { borderTopWidth: 1, paddingTop: 18, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  reconnectBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minHeight: 28, marginLeft: 4 },
  reconnectBtnText: { fontSize: 11, fontWeight: '700' },
  statsBox: { padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  statsTitle: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  statsGrid: { gap: 4 },
  statsItem: { fontSize: 12, fontWeight: '600' },
});
