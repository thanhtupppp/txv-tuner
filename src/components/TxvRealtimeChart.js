import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell } from '../components/SkeuoKit';
import { downsampleHistory } from '../domain/telemetry/downsampleHistory';

export function TxvRealtimeChart({ historyData = [], targetSh = 6.0, themeMode, maxPoints = 60 }) {
  const { theme } = useMaterial();
  const [screenWidth, setScreenWidth] = useState(280);
  const chartHeight = 120;

  // Chuẩn bị và nén dữ liệu nếu vượt quá maxPoints
  const dataPoints = useMemo(() => {
    if (!historyData || historyData.length === 0) {
      return [
        { actualSh: 5.5, targetSh, timestamp: 1000 },
        { actualSh: 6.2, targetSh, timestamp: 2000 },
        { actualSh: 7.1, targetSh, timestamp: 3000 },
        { actualSh: 6.8, targetSh, timestamp: 4000 },
        { actualSh: 6.0, targetSh, timestamp: 5000 },
      ];
    }
    return downsampleHistory(historyData, maxPoints, {
      algorithm: 'minmax',
      valueKey: 'actualSh',
      timeKey: 'timestamp',
    });
  }, [historyData, targetSh, maxPoints]);

  const readings = dataPoints.map(point => point.actualSh).filter(Number.isFinite);
  const minSh = Math.floor(Math.min(0, targetSh, ...readings) / 2) * 2;
  const maxSh = Math.ceil(Math.max(12, targetSh, ...readings) / 2) * 2;
  const ticks = [minSh, (minSh + maxSh) / 2, maxSh];

  const getX = (idx) => (idx / (Math.max(1, dataPoints.length - 1))) * (screenWidth - 40) + 30;
  const getY = (val) => chartHeight - 20 - ((val - minSh) / (maxSh - minSh)) * (chartHeight - 40);

  // Path cho actual SH
  let actualPath = '';
  dataPoints.forEach((pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.actualSh);
    if (idx === 0) {
      actualPath += `M ${x} ${y}`;
    } else {
      actualPath += ` L ${x} ${y}`;
    }
  });

  // Path cho target SH (ngang)
  const targetY = getY(targetSh);
  const targetPath = `M ${getX(0)} ${targetY} L ${getX(dataPoints.length - 1)} ${targetY}`;

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
});