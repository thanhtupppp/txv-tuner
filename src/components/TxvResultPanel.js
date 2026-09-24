import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell } from '../components/SkeuoKit';

export function TxvResultPanel({
  actualSh = 6.0,
  deltaSh = 0.0,
  recommendation = { status: 'optimal', direction: 'NONE', text: 'Độ quá nhiệt đã chuẩn tối ưu!', statusText: 'ĐẠT CHUẨN DANFOSS' },
  currentValve = { name: 'Danfoss T2 / TE2' },
  themeMode = 'light'
}) {
  const { theme, reducedEffects } = useMaterial();
  const isHigh = recommendation?.status === 'high';
  const isLow = recommendation?.status === 'low';
  const isOptimal = recommendation?.status === 'optimal';
  const isBlocked = recommendation?.allowed === false;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedEffects) {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
      return;
    }

    const direction = recommendation?.direction;
    if (direction === 'CW' || direction === 'CCW') {
      // 1. Hiệu ứng xoay tròn mượt mà (3000ms / vòng) theo chiều kim đồng hồ hoặc ngược chiều
      rotateAnim.setValue(0);
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: direction === 'CW' ? 1 : -1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      // 2. Hiệu ứng nhịp đập (pulse) co giãn nhẹ nhàng (scale 1.0 -> 1.08 -> 1.0)
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

      rotateAnimation.start();
      pulseAnimation.start();

      return () => {
        rotateAnimation.stop();
        pulseAnimation.stop();
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);
      };
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [recommendation?.direction, reducedEffects]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  const getStatusColor = () => {
    if (isBlocked) return theme.inkMuted || '#94a3b8';
    if (isOptimal) return theme.optimal;
    if (isLow) return theme.cold;
    return theme.danger;
  };

  return (
    <View style={styles.container}>
      {/* Khối 1: Kết quả Superheat */}
      <SkeuoPanel style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTag, { color: theme.inkMuted }]}>KẾT QUẢ ĐỘ QUÁ NHIỆT</Text>
          <View testID="status-badge" style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={[styles.statusBadgeText, { color: theme.onAccent }]}>
              {recommendation?.statusText || 'BÌNH THƯỜNG'}
            </Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <SkeuoLcdWell variant="readout" style={styles.metricWell}>
            <Text style={[styles.wellLabel, { color: theme.screenMuted }]}>Quá Nhiệt Thực Tế (SH)</Text>
            <View style={styles.valueRow}>
              <Text testID="actual-sh-value" style={[styles.numberLarge, { color: theme.screenInk }]}>
                {typeof actualSh === 'number' && Number.isFinite(actualSh) ? actualSh.toFixed(1) : '--'}
              </Text>
              <Text style={[styles.unitLarge, { color: theme.screenMuted }]}>K (°C)</Text>
            </View>
          </SkeuoLcdWell>

          <SkeuoLcdWell variant="readout" style={styles.metricWell}>
            <Text style={[styles.wellLabel, { color: theme.screenMuted }]}>Độ Lệch Mục Tiêu (ΔSH)</Text>
            <View style={styles.valueRow}>
              <Text testID="delta-sh-value" style={[styles.numberLarge, { color: theme.screenInk }]}>
                {typeof deltaSh === 'number' && Number.isFinite(deltaSh) ? (deltaSh > 0 ? `+${deltaSh.toFixed(1)}` : deltaSh.toFixed(1)) : '--'}
              </Text>
              <Text style={[styles.unitLarge, { color: theme.screenMuted }]}>K</Text>
            </View>
          </SkeuoLcdWell>
        </View>
      </SkeuoPanel>

      {/* Khối 2: Hướng dẫn vặn vít Danfoss */}
      <SkeuoPanel style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTag, { color: theme.inkMuted }]}>HƯỚNG DẪN ĐIỀU CHỈNH VÍT TXV</Text>
          <Text style={[styles.valveBadge, { color: theme.accent }]}>{currentValve?.name || 'Danfoss TXV'}</Text>
        </View>

        <View style={styles.screwSection}>
          {/* Vít xoay SVG mô phỏng 3D Brass Danfoss kết hợp hiệu ứng động */}
          <SkeuoLcdWell variant="readout" style={styles.dialBox}>
            <Animated.View
              testID="screw-dial-animated"
              style={{
                transform: [
                  { scale: pulseAnim },
                  { rotate: rotateInterpolate },
                ],
              }}
            >
              <Svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
                <Defs><LinearGradient id="brassFace" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#f6e4b4" /><Stop offset="0.5" stopColor="#bb934c" /><Stop offset="1" stopColor="#735424" /></LinearGradient></Defs>
                <Circle cx="40" cy="40" r="35" fill={theme.surfaceRecessed} stroke={theme.borderStrong} strokeWidth={reducedEffects ? 1.5 : 3} />
                <Circle cx="40" cy="40" r="27" fill={reducedEffects ? theme.brass : "url(#brassFace)"} stroke={theme.brassLight} strokeWidth={2.5} />
                {/* Rãnh vít khía kim loại */}
                <Line x1="40" y1="21" x2="40" y2="59" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
                <Line x1="21" y1="40" x2="59" y2="40" stroke="#451a03" strokeWidth="4.5" strokeLinecap="round" />
                {/* Mũi tên chỉ hướng kèm đầu tam giác */}
                {recommendation?.direction === 'CCW' && (
                  <>
                    <Path
                      d="M 58 26 A 22 22 0 0 0 22 26"
                      fill="none"
                      stroke={theme.screenInk}
                      strokeWidth="3"
                      strokeDasharray="4 2"
                    />
                    <Path d="M 22 20 L 22 32 L 15 26 Z" fill={theme.screenInk} />
                  </>
                )}
                {recommendation?.direction === 'CW' && (
                  <>
                    <Path
                      d="M 22 26 A 22 22 0 0 1 58 26"
                      fill="none"
                      stroke={theme.screenInk}
                      strokeWidth="3"
                      strokeDasharray="4 2"
                    />
                    <Path d="M 58 20 L 58 32 L 65 26 Z" fill={theme.screenInk} />
                  </>
                )}
              </Svg>
            </Animated.View>
            <Text testID="dial-label" style={[styles.dialLabel, { color: isBlocked ? (theme.screenMuted || '#94a3b8') : theme.screenInk }]}>
              {isBlocked
                ? '⚠️ KHÓA'
                : (recommendation?.direction === 'CW' ? '↻ CW' : recommendation?.direction === 'CCW' ? '↺ CCW' : '✓ OK')}
            </Text>
          </SkeuoLcdWell>

          <View style={styles.actionDetails}>
            <Text testID="action-heading" style={[styles.actionHeading, { color: theme.ink }]}>
              {isBlocked
                ? (recommendation?.heading || 'Không thể đề xuất điều chỉnh')
                : (recommendation?.direction === 'NONE'
                  ? 'Độ quá nhiệt đã chuẩn tối ưu!'
                  : `👉 Xoay ${recommendation?.turnsFraction || ''} ${recommendation?.direction === 'CW' ? 'CÙNG' : 'NGƯỢC'} chiều kim đồng hồ (${recommendation?.direction})`)}
            </Text>
            <Text style={[styles.actionDesc, { color: theme.inkMuted }]}>
              {recommendation?.text}
            </Text>
          </View>
        </View>

        <View style={[styles.danfossRuleBox, { backgroundColor: theme.surfaceInset }]}>
          <Text style={styles.ruleIcon}>⏱️</Text>
          <Text style={[styles.ruleText, { color: theme.inkMuted }]}>
            Quy tắc kỹ thuật Danfoss: Sau khi vặn vít, luôn đợi ít nhất 15 - 20 phút để toàn bộ dàn lạnh và bầu cảm nhiệt ổn định trạng thái rồi mới đo lại.
          </Text>
        </View>
      </SkeuoPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  valveBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricWell: {
    flex: 1,
    minWidth: 130,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  wellLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
  numberLarge: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: MONO,
  },
  unitLarge: {
    fontSize: 12,
    fontWeight: '700',
  },
  screwSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dialBox: {
    width: 90,
    minHeight: 120,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dialLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: MONO,
  },
  actionDetails: {
    flex: 1,
    gap: 4,
  },
  actionHeading: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  danfossRuleBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  ruleIcon: {
    fontSize: 16,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});

export default TxvResultPanel;
