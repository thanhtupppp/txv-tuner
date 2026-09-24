import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell, SkeuoLed, SkeuoSwitch } from './SkeuoKit';

export function TxvTelemetryBar({
  liveT1 = null,
  liveT2 = null,
  liveT3 = null,
  isAutoSyncSensors = true,
  setIsAutoSyncSensors = () => {},
  isOnline = false,
  isDemoMode = false,
  themeMode = 'light',
  offlineSensors = [],
}) {
  const { theme } = useMaterial();
  const active = isDemoMode || isOnline;
  const readings = [
    { label: 'T1 / VÀO DÀN', value: liveT1, channelColor: theme.cold },
    { label: 'T2 / RA DÀN', value: liveT2, channelColor: theme.warning },
    { label: 'T3 / BẦU TXV', value: liveT3, channelColor: theme.purple },
  ];

  return (
    <SkeuoPanel testID="telemetry-bar" style={styles.shell}>
      <View style={styles.heading}>
        <View style={styles.titleCol}>
          <View style={styles.titleRow}>
            <SkeuoLed testID="status-led" state={!active ? 'error' : isDemoMode ? 'warn' : 'ok'} size={10} />
            <Text style={[styles.label, { color: theme.inkMuted }]}>TRẠM ĐO NHIỆT ĐỘ</Text>
            {isDemoMode && (
              <View testID="demo-tag" style={[styles.demoTag, { backgroundColor: theme.surfaceInset, borderColor: theme.border }]}>
                <Text style={[styles.demoTagText, { color: theme.warning }]}>MÔ PHỎNG</Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: theme.ink }]}>
            {isDemoMode ? 'Tín hiệu cảm biến mô phỏng' : isOnline ? 'Tín hiệu ESP32 trực tiếp' : 'Mất kết nối · hiển thị số đo gần nhất'}
          </Text>
        </View>

        <View style={styles.sync}>
          <Text style={[styles.syncLabel, { color: theme.ink }]}>{isAutoSyncSensors ? 'Tự đồng bộ' : 'Nhập thủ công'}</Text>
          <SkeuoSwitch testID="sync-switch" accessibilityLabel="Tự đồng bộ cảm biến" value={isAutoSyncSensors} onValueChange={setIsAutoSyncSensors} />
        </View>
      </View>

      {offlineSensors.length > 0 && isOnline && (
        <View testID="offline-warning-banner" style={[styles.warningBanner, { backgroundColor: theme.surfaceInset, borderColor: theme.danger }]}>
          <Text style={[styles.warningBannerText, { color: theme.danger }]}>
            ⚠️ CẢNH BÁO: Mất tín hiệu {offlineSensors.map(s => s.name || `T${s.id + 1}`).join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.readings}>
        {readings.map(reading => (
          <SkeuoLcdWell key={reading.label} variant="readout" style={styles.well}>
            <View style={styles.wellHeader}>
              <SkeuoLed testID="channel-led" color={reading.channelColor} size={7} />
              <Text style={[styles.wellLabel, { color: theme.screenMuted }]}>{reading.label}</Text>
            </View>
            <Text testID="value-text" style={[styles.value, { color: active ? theme.screenInk : theme.screenMuted, opacity: active ? 1 : 0.6 }]}>
              {typeof reading.value === 'number' ? reading.value.toFixed(1) : '—'}
              <Text style={styles.unit}> °C</Text>
            </Text>
            <Text style={[styles.caption, { color: active ? (isDemoMode ? theme.warning : theme.optimal) : theme.danger }]}>
              {active ? (isDemoMode ? 'DEMO' : 'LIVE') : 'OFFLINE'}
            </Text>
          </SkeuoLcdWell>
        ))}
      </View>
    </SkeuoPanel>
  );
}

const styles = StyleSheet.create({
  shell: {
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleCol: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  demoTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  demoTagText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  sync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
  },
  syncLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  readings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  well: {
    flex: 1,
    minWidth: 85,
    minHeight: 56,
    padding: 8,
    gap: 4,
    justifyContent: 'space-between',
  },
  wellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wellLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: MONO,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 11,
    fontWeight: '700',
  },
  caption: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  warningBanner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  warningBannerText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default TxvTelemetryBar;
