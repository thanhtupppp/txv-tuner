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
  const tempVal = typeof sensor?.temp === 'number' && Number.isFinite(sensor.temp)
    ? sensor.temp.toFixed(1)
    : '--';
  const a11yLabel = `${sensor?.name || 'Cảm biến'}: ${tempVal === '--' ? 'chưa có dữ liệu' : `${tempVal} độ C`}`;

  return (
    <SkeuoPanel style={[styles.card, style]} accessibilityRole="summary" accessibilityLabel={a11yLabel}>
      <View style={styles.header}>
        <SkeuoLed color={channelColor} size={10} />
        <Text style={[styles.sensorName, { color: theme.inkMuted }]} numberOfLines={1}>
          {sensor?.name || `Kênh ${channelIndex + 1}`}
        </Text>
      </View>

      <SkeuoLcdWell variant="readout" style={styles.lcdWell}>
        <View style={styles.valueRow}>
          <Text style={[styles.sensorValue, { color: theme.screenInk }]}>
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
