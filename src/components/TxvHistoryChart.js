import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell } from '../components/SkeuoKit';

export function TxvHistoryChart({ historyData = [], targetSh = 6.0, themeMode }) {
  const { theme } = useMaterial();
  const [screenWidth, setScreenWidth] = useState(280);
  const chartHeight = 140;

  const dataPoints = historyData.length > 0 ? historyData : [
    { actualSh: 5.5 },
    { actualSh: 6.2 },
    { actualSh: 7.1 },
    { actualSh: 8.5 },
    { actualSh: 10.2 }
  ];

  const readings = dataPoints.map(point => point.actualSh).filter(Number.isFinite);
  const minSh = Math.floor(Math.min(0, targetSh, ...readings) / 4) * 4;
  const maxSh = Math.ceil(Math.max(16, targetSh, ...readings) / 4) * 4;
  const ticks = [minSh, (minSh + maxSh) / 2, maxSh];

  const getX = (idx) => (idx / (Math.max(1, dataPoints.length - 1))) * (screenWidth - 40) + 30;
  const getY = (val) => chartHeight - 20 - ((val - minSh) / (maxSh - minSh)) * (chartHeight - 40);

  let pathD = '';
  dataPoints.forEach((pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.actualSh);
    if (idx === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  const targetY = getY(targetSh);

  return (
    <SkeuoPanel style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>📈 Lịch Sử Biến Thiên Superheat</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.optimal }]} />
            <Text style={[styles.legendText, { color: theme.inkMuted }]}>Mục tiêu ({targetSh}K)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.legendText, { color: theme.inkMuted }]}>Thực tế</Text>
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

          {/* Đường mục tiêu */}
          <Line
            x1="32"
            y1={targetY}
            x2={screenWidth - 8}
            y2={targetY}
            stroke={theme.optimal}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Đường thực tế */}
          {pathD ? (
            <Path
              d={pathD}
              fill="none"
              stroke={theme.accent}
              strokeWidth="2.5"
            />
          ) : null}

          {/* Nhãn trục Y: Font MONO màu screenMuted */}
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
              {tick}K
            </SvgText>
          ))}
        </Svg>
      </SkeuoLcdWell>
    </SkeuoPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
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
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartLcdWell: {
    minHeight: 140,
  },
});
