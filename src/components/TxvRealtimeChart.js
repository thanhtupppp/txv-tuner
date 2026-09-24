import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell } from '../components/SkeuoKit';

export function TxvRealtimeChart({ historyData = [], targetSh = 6.0, themeMode }) {
  const { theme } = useMaterial();
  const [screenWidth, setScreenWidth] = useState(280);
  const chartHeight = 120;

  const hasData = Array.isArray(historyData) && historyData.length > 0;
  const dataPoints = hasData ? historyData : [];

  const readings = dataPoints.map(point => point.actualSh).filter(Number.isFinite);
  const minSh = Math.floor(Math.min(0, targetSh, ...(readings.length > 0 ? readings : [targetSh])) / 2) * 2;
  const maxSh = Math.ceil(Math.max(12, targetSh, ...(readings.length > 0 ? readings : [targetSh])) / 2) * 2;
  const ticks = [minSh, (minSh + maxSh) / 2, maxSh];

  const getX = (idx) => (idx / (Math.max(1, dataPoints.length - 1))) * (screenWidth - 40) + 30;
  const getY = (val) => chartHeight - 20 - ((val - minSh) / (maxSh - minSh)) * (chartHeight - 40);

  // Path cho actual SH
  let actualPath = '';
  if (hasData) {
    dataPoints.forEach((pt, idx) => {
      const x = getX(idx);
      const y = getY(pt.actualSh);
      if (idx === 0) {
        actualPath += `M ${x} ${y}`;
      } else {
        actualPath += ` L ${x} ${y}`;
      }
    });
  }

  // Path cho target SH (ngang)
  const targetY = getY(targetSh);

  return (
    <SkeuoPanel style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>📈 Biểu Đồ Superheat Real-Time</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.legendText, { color: theme.inkMuted }]}>Actual SH</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.optimal }]} />
            <Text style={[styles.legendText, { color: theme.inkMuted }]}>Target SH ({typeof targetSh === 'number' ? targetSh.toFixed(1) : targetSh}K)</Text>
          </View>
        </View>
      </View>

      <SkeuoLcdWell
        variant="chart"
        onLayout={event => setScreenWidth(event.nativeEvent.layout.width)}
        style={styles.chartLcdWell}
      >
        {!hasData ? (
          <View testID="realtime-chart-empty" style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.screenInk }]}>CHƯA CÓ DỮ LIỆU REAL-TIME</Text>
            <Text style={[styles.emptySubtitle, { color: theme.screenMuted }]}>
              Chờ dữ liệu từ ESP32 hoặc bật chế độ Demo
            </Text>
          </View>
        ) : (
          <Svg width={screenWidth} height={chartHeight}>
            {/* Lưới ngang tham chiếu */}
            {ticks.map((lvl) => (
              <Line
                key={lvl}
                x1="32"
                y1={getY(lvl)}
                x2={screenWidth - 8}
                y2={getY(lvl)}
                stroke={theme.borderStrong}
                strokeWidth="1"
                strokeDasharray="2 3"
              />
            ))}

            {/* Đường target SH (ngang, nét đứt) */}
            <Line
              x1="32"
              y1={targetY}
              x2={screenWidth - 8}
              y2={targetY}
              stroke={theme.optimal}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* Đường actual SH */}
            {actualPath ? (
              <Path
                d={actualPath}
                fill="none"
                stroke={theme.accent}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Nhãn trục Y: Font MONO 10px màu screenMuted */}
            {ticks.map(tick => (
              <SvgText
                key={tick}
                x="4"
                y={getY(tick) + 4}
                fill={theme.screenMuted}
                fontSize="10"
                fontFamily={MONO}
                fontWeight="bold"
              >
                {`${tick}K`}
              </SvgText>
            ))}
          </Svg>
        )}
      </SkeuoLcdWell>
    </SkeuoPanel>
  );
}

export default TxvRealtimeChart;

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
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
    minHeight: 120,
  },
  emptyContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
});