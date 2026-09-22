import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoSwitch } from './SkeuoKit';

export function TxvTelemetryBar({ liveT1, liveT2, liveT3, isAutoSyncSensors, setIsAutoSyncSensors, isOnline, isDemoMode }) {
  const { theme } = useMaterial();
  const active = isDemoMode || isOnline;
  const readings = [
    { label: 'T1 / VÀO DÀN', value: liveT1 },
    { label: 'T2 / RA DÀN', value: liveT2 },
    { label: 'T3 / BẦU TXV', value: liveT3 },
  ];
  return (
    <View style={[styles.shell, { backgroundColor: theme.surface, borderColor: theme.borderStrong }, theme.cardShadow]}>
      <View style={styles.heading}>
        <View>
          <Text style={[styles.label, { color: theme.inkMuted }]}>TRẠM ĐO NHIỆT ĐỘ</Text>
          <Text style={[styles.subtitle, { color: theme.ink }]}>{isDemoMode ? 'Tín hiệu mô phỏng' : isOnline ? 'Tín hiệu ESP32 trực tiếp' : 'Mất kết nối · số đo gần nhất'}</Text>
        </View>
        <View style={styles.sync}>
          <Text style={[styles.syncLabel, { color: theme.ink }]}>{isAutoSyncSensors ? 'Tự đồng bộ' : 'Nhập thủ công'}</Text>
          <SkeuoSwitch accessibilityLabel="Tự đồng bộ cảm biến" value={isAutoSyncSensors} onValueChange={setIsAutoSyncSensors} />
        </View>
      </View>
      <View style={styles.readings}>
        {readings.map(reading => <View key={reading.label} style={[styles.well, { backgroundColor: theme.screenBg, borderColor: theme.borderStrong }]}>
          <Text style={[styles.label, { color: theme.screenMuted }]}>{reading.label}</Text>
          <Text style={[styles.value, { color: theme.screenInk }]}>{typeof reading.value === 'number' ? reading.value.toFixed(1) : '—'}<Text style={styles.unit}> °C</Text></Text>
          <Text style={[styles.caption, { color: theme.screenMuted }]}>{active ? isDemoMode ? 'DEMO' : 'TRỰC TIẾP' : 'ĐÃ NGẮT'}</Text>
        </View>)}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { padding: 14, borderWidth: 1, borderRadius: 14, marginBottom: 20, gap: 12 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncLabel: { fontSize: 12, fontWeight: '600' },
  readings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  well: { flex: 1, minWidth: 82, padding: 10, borderRadius: 8, borderWidth: 2, borderTopWidth: 3, gap: 8 },
  value: { fontFamily: MONO, fontSize: 23, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11 },
  caption: { fontSize: 9, letterSpacing: 1 },
});
