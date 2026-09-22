import React from 'react';
import { View, Text, StyleSheet, Vibration, Platform } from 'react-native';
import { tempToPressure } from '../data/danfossData';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell, SkeuoLed, SkeuoButton } from '../components/SkeuoKit';

export function SimCondPanel({ condTemp, setCondTemp, currentRef, themeMode }) {
  const { theme } = useMaterial();
  const refId = currentRef?.id || 'R404A';
  const pCond = typeof tempToPressure === 'function' ? tempToPressure(condTemp, refId) : '--';
  const isMin = condTemp <= 20;
  const isMax = condTemp >= 65;

  const adjustTemp = (delta) => {
    setCondTemp((prev) => {
      const next = Math.max(20, Math.min(65, Number((prev + delta).toFixed(1))));
      if ((next <= 20 || next >= 65) && Platform.OS !== 'web') {
        try {
          Vibration.vibrate(25);
        } catch {}
      }
      return next;
    });
  };

  return (
    <SkeuoPanel style={styles.card}>
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
          disabled={isMin}
          accessibilityLabel="Giảm 5 độ C"
          accessibilityHint={isMin ? 'Đã đạt giới hạn tối thiểu 20°C' : undefined}
          onPress={() => adjustTemp(-5)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>-5°C</Text>
        </SkeuoButton>

        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={isMin}
          accessibilityLabel="Giảm 1 độ C"
          accessibilityHint={isMin ? 'Đã đạt giới hạn tối thiểu 20°C' : undefined}
          onPress={() => adjustTemp(-1)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>-1°C</Text>
        </SkeuoButton>

        {/* Ô hiển thị T_cond dạng LCD mini 48px */}
        <SkeuoLcdWell testID="cond-display" variant="readout" style={styles.tempDisplay}>
          <Text style={[styles.tempVal, { color: theme.screenInk }]}>{condTemp.toFixed(1)}°C</Text>
          {(isMin || isMax) && (
            <View testID="cond-limit-tag" style={styles.limitTag}>
              <SkeuoLed testID="cond-limit-led" state="error" size={6} />
              <Text style={[styles.limitText, { color: theme.danger }]}>
                {isMin ? 'MIN' : 'MAX'}
              </Text>
            </View>
          )}
        </SkeuoLcdWell>

        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={isMax}
          accessibilityLabel="Tăng 1 độ C"
          accessibilityHint={isMax ? 'Đã đạt giới hạn tối đa 65°C' : undefined}
          onPress={() => adjustTemp(1)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>+1°C</Text>
        </SkeuoButton>

        <SkeuoButton
          style={[styles.stepBtn, { backgroundColor: theme.surfaceInset }]}
          disabled={isMax}
          accessibilityLabel="Tăng 5 độ C"
          accessibilityHint={isMax ? 'Đã đạt giới hạn tối đa 65°C' : undefined}
          onPress={() => adjustTemp(5)}
        >
          <Text style={[styles.stepBtnText, { color: theme.ink }]}>+5°C</Text>
        </SkeuoButton>
      </View>
    </SkeuoPanel>
  );
}

export default SimCondPanel;

const styles = StyleSheet.create({
  card: {
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
    borderRadius: 8,
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tempDisplay: {
    paddingHorizontal: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tempVal: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: MONO,
  },
  limitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  limitText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: MONO,
  },
});
