import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell, SkeuoLed } from './SkeuoKit';

export function SensorCard({ sensor, channelIndex = 0, style }) {
  const { theme } = useMaterial();

  const getChannelColor = (idx) => {
    if (idx === 0) return theme.cold;
    if (idx === 1) return theme.warning;
    return theme.purple;
  };

  const channelColor = getChannelColor(channelIndex);
  const isOnline = sensor?.online !== false;
  const ledState = isOnline ? 'ok' : 'error';
  const ledColor = isOnline ? channelColor : theme.danger;

  const tempVal = typeof sensor?.temp === 'number' && Number.isFinite(sensor.temp)
    ? sensor.temp.toFixed(1)
    : '--';

  const a11yLabel = `${sensor?.name || 'Cảm biến'}: ${
    tempVal === '--' ? 'chưa có dữ liệu' : `${tempVal} độ C`
  }${!isOnline ? ', mất kết nối' : ''}`;

  return (
    <SkeuoPanel testID="sensor-card" style={[styles.card, style]} accessibilityRole="summary" accessibilityLabel={a11yLabel}>
      <View style={styles.header}>
        <SkeuoLed testID="sensor-led" state={ledState} color={ledColor} size={10} />
        <Text style={[styles.sensorName, { color: isOnline ? theme.inkMuted : theme.danger }]} numberOfLines={1}>
          {sensor?.name || `Kênh ${channelIndex + 1}`}
        </Text>
      </View>

      <SkeuoLcdWell variant="readout" style={styles.lcdWell}>
        <View style={styles.valueRow}>
          <Text testID="sensor-value" style={[styles.sensorValue, { color: isOnline ? theme.screenInk : theme.screenMuted }]}>
            {tempVal}
          </Text>
          <Text style={[styles.unit, { color: theme.screenMuted }]}>°C</Text>
        </View>
        <Text style={[styles.channelTag, { color: channelColor }]}>
          CH {channelIndex + 1}
        </Text>
      </SkeuoLcdWell>
    </SkeuoPanel>
  );
}

export default SensorCard;

const styles = StyleSheet.create({
  card: {
    minWidth: 140,
    flex: 1,
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sensorName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lcdWell: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 48,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sensorValue: {
    fontFamily: MONO,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 12,
    fontWeight: '700',
  },
  channelTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
