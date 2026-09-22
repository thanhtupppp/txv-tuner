import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tempToPressure } from '../data/danfossData';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoButton } from '../components/SkeuoKit';

export function SimCondPanel({ condTemp, setCondTemp, currentRef, themeMode }) {
  const { theme } = useMaterial();
  const refId = currentRef?.id || 'R404A';
  const pCond = typeof tempToPressure === 'function' ? tempToPressure(condTemp, refId) : '--';

  const adjustTemp = (delta) => {
    setCondTemp((prev) => {
      const next = Math.max(20, Math.min(65, Number((prev + delta).toFixed(1))));
      return next;
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.ink }]}>
          🔥 Nhiệt độ ngưng tụ dàn nóng (T_cond): <Text style={{ color: theme.warning }}>{condTemp.toFixed(1)}°C</Text>
        </Text>
        <Text style={[styles.pressureText, { color: theme.inkMuted }]}>
          (~{pCond} bar với {refId})
        </Text>
      </View>

      <Text style={[styles.subText, { color: theme.inkMuted }]}>
        💡 T_cond độc lập với cảm biến dàn lạnh. Chuẩn giải nhiệt gió mùa hè: 35°C - 45°C.
      </Text>

      <View style={styles.controlsRow}>
        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={condTemp <= 20}
          accessibilityLabel="Giảm 5 độ C"
          onPress={() => adjustTemp(-5)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>-5°C</Text>
        </SkeuoButton>

        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={condTemp <= 20}
          accessibilityLabel="Giảm 1 độ C"
          onPress={() => adjustTemp(-1)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>-1°C</Text>
        </SkeuoButton>

        <View style={[styles.tempDisplay, { backgroundColor: theme.surfaceInset }]}>
          <Text style={[styles.tempVal, { color: theme.warning }]}>{condTemp.toFixed(1)}°C</Text>
        </View>

        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={condTemp >= 65}
          accessibilityLabel="Tăng 1 độ C"
          onPress={() => adjustTemp(1)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>+1°C</Text>
        </SkeuoButton>

        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={condTemp >= 65}
          accessibilityLabel="Tăng 5 độ C"
          onPress={() => adjustTemp(5)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>+5°C</Text>
        </SkeuoButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  pressureText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: MONO,
  },
  subText: {
    fontSize: 12,
    lineHeight: 15,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 6,
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tempDisplay: {
    paddingHorizontal: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  tempVal: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: MONO,
  },
});
