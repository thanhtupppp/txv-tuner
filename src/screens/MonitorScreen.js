import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoGauge, SkeuoLcdWell } from '../components/SkeuoKit';
import { SensorCard } from '../components/SensorCard';
import { evaluateDeltaAir } from '../utils/temperatureMetrics';

export function MonitorScreen({ sensors = [], deltaAir, history = [], themeMode }) {
  const { theme } = useMaterial();
  const { width, fontScale } = useWindowDimensions();
  const compact = (width / fontScale) < 360;
  const [screenWidth, setScreenWidth] = useState(280);
  const chartHeight = 160;

  const deltaEval = evaluateDeltaAir(deltaAir);
  const deltaColor = deltaEval.status === 'optimal'
    ? theme.optimal
    : deltaEval.status === 'danger'
      ? theme.danger
      : deltaEval.status === 'warning'
        ? theme.warning
        : theme.inkMuted;

  // Chuẩn bị dữ liệu vẽ đồ thị 3 đường
  const minTemp = -35;
  const maxTemp = -10;

  const getX = (idx) => (idx / (Math.max(1, history.length - 1))) * (screenWidth - 40) + 30;
  const getY = (val) => chartHeight - 20 - ((val - minTemp) / (maxTemp - minTemp)) * (chartHeight - 40);

  let pathT1 = '';
  let pathT2 = '';
  let pathT3 = '';

  if (history.length > 1) {
    history.forEach((pt, idx) => {
      const x = getX(idx);
      if (typeof pt.t1 === 'number') {
        const y1 = getY(pt.t1);
        pathT1 += idx === 0 ? `M ${x} ${y1}` : ` L ${x} ${y1}`;
      }
      if (typeof pt.t2 === 'number') {
        const y2 = getY(pt.t2);
        pathT2 += idx === 0 ? `M ${x} ${y2}` : ` L ${x} ${y2}`;
      }
      if (typeof pt.t3 === 'number') {
        const y3 = getY(pt.t3);
        pathT3 += idx === 0 ? `M ${x} ${y3}` : ` L ${x} ${y3}`;
      }
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. 3 Thẻ cảm biến nhiệt độ chuẩn Skeuomorphic */}
      {sensors.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.inkMuted }]}>
            Chưa có cảm biến nào. Vui lòng kết nối ESP32 hoặc bật Demo Mode.
          </Text>
        </View>
      ) : (
        <View style={styles.sensorsGrid}>
          {sensors.map((sensor, idx) => (
            <SensorCard key={sensor.id ?? idx} sensor={sensor} channelIndex={idx} />
          ))}
        </View>
      )}

      {/* 2. Thẻ GaugePanel: Đồng hồ kim SVG analog kết hợp thông tin chi tiết */}
      <SkeuoPanel style={styles.gaugePanel}>
        <View style={styles.gaugePanelRow}>
          <View style={styles.gaugeCenter}>
            <SkeuoGauge value={deltaAir} size={compact ? 130 : 150} min={0} max={20} />
          </View>

          <View style={styles.gaugeInfoCol}>
            <Text style={[styles.deltaTag, { color: theme.inkMuted }]}>HIỆU SUẤT TRAO ĐỔI NHIỆT</Text>
            <Text style={[styles.deltaTitle, { color: theme.ink }]}>Độ Giảm Nhiệt Khí Qua Dàn (ΔT_air = T1 - T2)</Text>

            <SkeuoLcdWell variant="readout" style={styles.deltaLcdWell}>
              <View style={styles.deltaValueWrap}>
                <Text style={[styles.deltaValue, { color: theme.screenInk }]}>
                  {typeof deltaAir === 'number' ? deltaAir.toFixed(1) : '--'}
                </Text>
                <Text style={[styles.deltaUnit, { color: theme.screenMuted }]}>K</Text>
              </View>

              <View testID="delta-status-badge" style={[styles.statusBadge, { backgroundColor: deltaColor }]}>
                <Text style={[styles.statusBadgeText, { color: theme.onAccent }]}>
                  {deltaEval.status === 'optimal' ? '✓ TỐI ƯU' : deltaEval.status === 'danger' ? '⛔ NGUY HIỂM' : '⚠ CẢNH BÁO'}
                </Text>
              </View>
            </SkeuoLcdWell>

            <Text style={[styles.deltaDesc, { color: theme.inkMuted }]}>
              {deltaEval.text}
            </Text>
          </View>
        </View>
      </SkeuoPanel>

      {/* 3. Đồ thị giám sát thời gian thực bọc trong SkeuoLcdWell */}
      <SkeuoPanel style={styles.chartPanel}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: theme.ink }]}>📊 Đồ Thị 3 Cảm Biến Real-Time</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.cold }]} />
              <Text style={[styles.legendText, { color: theme.inkMuted }]}>T1 Vào</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
              <Text style={[styles.legendText, { color: theme.inkMuted }]}>T2 Ra</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.purple }]} />
              <Text style={[styles.legendText, { color: theme.inkMuted }]}>T3 TXV</Text>
            </View>
          </View>
        </View>

        <SkeuoLcdWell
          variant="chart"
          onLayout={event => setScreenWidth(event.nativeEvent.layout.width)}
          style={styles.chartLcdWell}
        >
          <Svg width={screenWidth} height={chartHeight}>
            {/* Lưới ngang tham chiếu */}
            {[-15, -20, -25, -30].map((lvl) => (
              <Line
                key={lvl}
                x1="38"
                y1={getY(lvl)}
                x2={screenWidth - 8}
                y2={getY(lvl)}
                stroke={theme.borderStrong}
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            ))}

            {pathT1 ? <Path d={pathT1} fill="none" stroke={theme.cold} strokeWidth="2.5" /> : null}
            {pathT2 ? <Path d={pathT2} fill="none" stroke={theme.warning} strokeWidth="2.5" /> : null}
            {pathT3 ? <Path d={pathT3} fill="none" stroke={theme.purple} strokeWidth="2.5" /> : null}

            {/* Trục Y: Font MONO 10px màu screenMuted */}
            <SvgText x="6" y={getY(-15) + 4} fill={theme.screenMuted} fontSize="10" fontFamily={MONO} fontWeight="bold">-15°C</SvgText>
            <SvgText x="6" y={getY(-25) + 4} fill={theme.screenMuted} fontSize="10" fontFamily={MONO} fontWeight="bold">-25°C</SvgText>
            <SvgText x="6" y={getY(-35) + 4} fill={theme.screenMuted} fontSize="10" fontFamily={MONO} fontWeight="bold">-35°C</SvgText>
          </Svg>
        </SkeuoLcdWell>
      </SkeuoPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    gap: 16,
  },
  sensorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gaugePanel: {
    gap: 12,
  },
  gaugePanelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  gaugeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeInfoCol: {
    flex: 1,
    minWidth: 200,
    gap: 8,
  },
  deltaTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  deltaTitle: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  deltaLcdWell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  deltaValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  deltaValue: {
    fontFamily: MONO,
    fontSize: 26,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  deltaUnit: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deltaDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  chartPanel: {
    gap: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartLcdWell: {
    minHeight: 160,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default MonitorScreen;
