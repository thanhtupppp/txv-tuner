import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { InstrumentIcon, MetalFace, SkeuoButton, SkeuoInput, useMaterial, SkeuoSwitch } from './SkeuoKit';

export function Header({ connectionStatus, isDemoMode, toggleDemoMode, themeMode, toggleTheme, esp32Ip, saveEsp32Ip, flat, setFlat }) {
  const { theme } = useMaterial();
  const [modalVisible, setModalVisible] = useState(false);
  const [tempIp, setTempIp] = useState(esp32Ip);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const status = isDemoMode ? 'Dữ liệu mô phỏng' : connectionStatus === 'connected' ? 'ESP32 đã kết nối' : 'ESP32 mất kết nối';
  const openSettings = () => { setTempIp(esp32Ip); setError(''); setModalVisible(true); };
  const save = async () => {
    if (!tempIp.trim()) { setError('Vui lòng nhập địa chỉ IP hoặc URL của ESP32.'); return; }
    setSaving(true);
    try { await saveEsp32Ip(tempIp.trim()); setModalVisible(false); }
    catch { setError('Chưa lưu được địa chỉ. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };
  return (
    <View style={[styles.shell, { backgroundColor: theme.surface, borderColor: theme.borderStrong }]}>
      <MetalFace />
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <View style={[styles.badge, { backgroundColor: theme.screenBg, borderColor: theme.borderStrong }]}>
              <InstrumentIcon name="snow" color={theme.screenInk} size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.inkMuted }]}>DANFOSS / REF TOOLS</Text>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>TXV Tuner</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <SkeuoButton onPress={toggleTheme} accessibilityLabel={themeMode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
              <InstrumentIcon name={themeMode === 'dark' ? 'sun' : 'moon'} color={theme.ink} />
            </SkeuoButton>
            <SkeuoButton onPress={openSettings} accessibilityLabel="Cài đặt kết nối và giao diện">
              <InstrumentIcon name="settings" color={theme.ink} />
            </SkeuoButton>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.connection}>
            <View style={[styles.led, { backgroundColor: isDemoMode ? theme.warning : connectionStatus === 'connected' ? theme.optimal : theme.danger, borderColor: theme.borderStrong }]} />
            <Text style={[styles.status, { color: theme.ink }]}>{status}</Text>
          </View>
          <View style={styles.demo}>
            <Text style={[styles.status, { color: theme.ink }]}>Demo {isDemoMode ? 'bật' : 'tắt'}</Text>
            <SkeuoSwitch accessibilityLabel="Chế độ dữ liệu mô phỏng" value={isDemoMode} onValueChange={toggleDemoMode} />
          </View>
        </View>
      </View>
      <Modal animationType="none" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View accessibilityViewIsModal style={[styles.modal, { backgroundColor: theme.surface, borderColor: theme.borderStrong }, theme.cardShadow]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text accessibilityRole="header" style={[styles.modalTitle, { color: theme.ink }]}>Cài đặt thiết bị</Text>
              <Text style={[styles.description, { color: theme.inkMuted }]}>Kết nối ESP32 trong cùng mạng WiFi hoặc nhập URL mô phỏng Wokwi.</Text>
              <Text style={[styles.label, { color: theme.ink }]}>Địa chỉ IP / URL ESP32</Text>
              <SkeuoInput accessibilityLabel="Địa chỉ IP hoặc URL ESP32" autoFocus
                style={[styles.input, { backgroundColor: theme.surfaceInset, color: theme.ink }]}
                value={tempIp} onChangeText={value => { setTempIp(value); setError(''); }}
                placeholder="192.168.1.100" placeholderTextColor={theme.inkMuted} autoCapitalize="none" autoCorrect={false} onSubmitEditing={save} />
              {!!error && <Text accessibilityRole="alert" style={{ color: theme.danger, marginTop: 8 }}>{error}</Text>}
              <View style={[styles.effectRow, { borderColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.ink }]}>Giảm hiệu ứng vật liệu</Text>
                  <Text style={[styles.description, { color: theme.inkMuted }]}>Bề mặt phẳng, giữ rõ nhãn và trạng thái.</Text>
                </View>
                <SkeuoSwitch accessibilityLabel="Giảm hiệu ứng vật liệu" value={flat} onValueChange={setFlat} />
              </View>
              <View style={styles.modalActions}>
                <SkeuoButton style={styles.modalButton} onPress={() => setModalVisible(false)}><Text style={{ color: theme.ink, fontWeight: '700' }}>Đóng</Text></SkeuoButton>
                <SkeuoButton style={[styles.modalButton, { backgroundColor: theme.accent }]} onPress={save} disabled={saving} accessibilityState={{ busy: saving }}>
                  <Text style={{ color: theme.onAccent, fontWeight: '700' }}>{saving ? 'Đang lưu…' : 'Lưu kết nối'}</Text>
                </SkeuoButton>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
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
});
