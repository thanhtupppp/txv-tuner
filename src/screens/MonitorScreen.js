import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial } from '../components/SkeuoKit';
import { evaluateDeltaAir } from '../utils/temperatureMetrics';

export function MonitorScreen({ sensors = [], deltaAir, history = [], themeMode }) {
  const { theme } = useMaterial();
  const [screenWidth, setScreenWidth] = useState(280);
  const chartHeight = 160;

  const deltaEval = evaluateDeltaAir(deltaAir);

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

  const getSensorColor = (idx) => {
    if (idx === 0) return theme.cold;
    if (idx === 1) return theme.warning;
    return theme.purple;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* 3 Thẻ cảm biến nhiệt độ */}
      <View style={styles.sensorsGrid}>
        {sensors.map((sensor, idx) => {
          const color = getSensorColor(idx);
          return (
            <View
              key={sensor.id ?? idx}
              style={[styles.sensorCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}
            >
              <View style={styles.sensorHeader}>
                <View style={[styles.sensorDot, { backgroundColor: color }]} />
                <Text style={[styles.sensorName, { color: theme.inkMuted }]}>{sensor.name}</Text>
              </View>
              <Text style={[styles.sensorValue, { color }]}>
                {typeof sensor.temp === 'number' ? `${sensor.temp.toFixed(1)}°C` : '--'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Thẻ Delta Air */}
      <View style={[styles.deltaCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
        <View style={styles.deltaHeader}>
          <Text style={[styles.deltaTag, { color: theme.inkMuted }]}>HIỆU SUẤT TRAO ĐỔI NHIỆT</Text>
          <Text style={[styles.deltaTitle, { color: theme.ink }]}>Độ Giảm Nhiệt Khí Qua Dàn (ΔT_air = T1 - T2)</Text>
        </View>

        <View style={styles.deltaContent}>
          <Text style={[styles.deltaValue, { color: theme.optimal }]}>
            {typeof deltaAir === 'number' ? `${deltaAir.toFixed(1)} K` : '--'}
          </Text>
          <Text style={[styles.deltaDesc, { color: theme.inkMuted }]}>
            {deltaEval.text}
          </Text>
        </View>
      </View>

      {/* Đồ thị giám sát thời gian thực */}
      <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: theme.ink }]}>📊 Đồ Thị 3 Cảm Biến Real-Time</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.cold }]} />
              <Text style={[styles.legendText, { color: theme.inkMuted }]}>T1</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
              <Text style={[styles.legendText, { color: theme.inkMuted }]}>T2</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.purple }]} />
              <Text style={[styles.legendText, { color: theme.inkMuted }]}>T3</Text>
            </View>
          </View>
        </View>

        <View onLayout={event => setScreenWidth(event.nativeEvent.layout.width)} style={[styles.svgWrapper, { backgroundColor: theme.surfaceInset }]}>
          <Svg width={screenWidth} height={chartHeight}>
            {/* Lưới ngang */}
            {[-15, -20, -25, -30].map((lvl) => (
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

            {pathT1 ? <Path d={pathT1} fill="none" stroke={theme.cold} strokeWidth="2" /> : null}
            {pathT2 ? <Path d={pathT2} fill="none" stroke={theme.warning} strokeWidth="2" /> : null}
            {pathT3 ? <Path d={pathT3} fill="none" stroke={theme.purple} strokeWidth="2" /> : null}

            <SvgText x="6" y={getY(-15) + 4} fill={theme.inkMuted} fontSize="9" fontWeight="bold">-15°C</SvgText>
            <SvgText x="6" y={getY(-25) + 4} fill={theme.inkMuted} fontSize="9" fontWeight="bold">-25°C</SvgText>
            <SvgText x="6" y={getY(-35) + 4} fill={theme.inkMuted} fontSize="9" fontWeight="bold">-35°C</SvgText>
          </Svg>
        </View>
      </View>
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
  sensorCard: {
    flex: 1,
    minWidth: 135,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 6,
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sensorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sensorName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  sensorValue: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: MONO,
  },
  deltaCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  deltaHeader: {
    gap: 2,
  },
  deltaTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  deltaTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  deltaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deltaValue: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: MONO,
  },
  deltaDesc: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
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
    gap: 10,
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
