import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial } from '../components/SkeuoKit';

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

  const minSh = 0;
  const maxSh = 16;

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
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
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

      <View onLayout={event => setScreenWidth(event.nativeEvent.layout.width)} style={[styles.svgWrapper, { backgroundColor: theme.surfaceInset }]}>
        <Svg width={screenWidth} height={chartHeight}>
          {/* Lưới ngang */}
          {[4, 8, 12].map((lvl) => (
            <Line
              key={lvl}
              x1="30"
              y1={getY(lvl)}
              x2={screenWidth - 10}
              y2={getY(lvl)}
              stroke={theme.border}
              strokeWidth="1"
            />
          ))}

          {/* Đường mục tiêu */}
          <Line
            x1="30"
            y1={targetY}
            x2={screenWidth - 10}
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

          {/* Nhãn trục Y */}
          <SvgText x="6" y={getY(12) + 4} fill={theme.inkMuted} fontSize="9" fontWeight="bold">12K</SvgText>
          <SvgText x="6" y={getY(6) + 4} fill={theme.inkMuted} fontSize="9" fontWeight="bold">6K</SvgText>
          <SvgText x="6" y={getY(0) + 4} fill={theme.inkMuted} fontSize="9" fontWeight="bold">0K</SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
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
  svgWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 8,
  },
});
