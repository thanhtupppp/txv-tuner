import React, { createContext, useContext, useEffect, useId, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle, Line, G, Text as SvgText } from 'react-native-svg';
import { THEME, SKEUOMORPHISM, MONO } from '../constants/theme';

const MaterialContext = createContext({ theme: THEME.light, reducedEffects: false });

export function MaterialProvider({ themeMode, flat, children }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const reducedEffects = flat || reduceMotion;
  const theme = reducedEffects ? { ...THEME[themeMode], cardShadow: {}, chipShadow: {} } : THEME[themeMode];
  return <MaterialContext.Provider value={{ theme, reducedEffects }}>{children}</MaterialContext.Provider>;
}

export function useMaterial() { return useContext(MaterialContext); }

// Native semantics survive removal of optional bevels, shadows and travel.
export function SkeuoButton({ children, style, disabled = false, accessibilityState, onFocus, onBlur, ...props }) {
  const { theme, reducedEffects } = useMaterial();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable accessibilityRole="button" {...props} disabled={disabled}
      accessibilityState={{ ...accessibilityState, disabled }}
      aria-checked={accessibilityState?.checked}
      aria-selected={accessibilityState?.selected}
      aria-busy={accessibilityState?.busy}
      aria-disabled={disabled}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={({ pressed }) => [
        styles.button, { backgroundColor: theme.surface, borderColor: theme.borderStrong },
        !reducedEffects && { ...theme.chipShadow, borderTopColor: theme.highlight, borderBottomWidth: 3 },
        typeof style === 'function' ? style({ pressed }) : style,
        pressed && { borderColor: theme.inkMuted, elevation: 0, shadowOpacity: 0 },
        pressed && !reducedEffects && { transform: [{ translateY: SKEUOMORPHISM['--um-skeuomorphism-motion-press'] }] },
        disabled && { opacity: 0.55, elevation: 0, shadowOpacity: 0 },
        focused && { borderColor: theme.focus, ...(Platform.OS === 'web' ? { outlineColor: theme.focus, outlineWidth: 3, outlineStyle: 'solid', outlineOffset: 2 } : { borderWidth: 3 }) },
      ]}
    >{children}</Pressable>
  );
}

export function SkeuoInput({ style, editable = true, onFocus, onBlur, ...props }) {
  const { theme } = useMaterial();
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} editable={editable} accessibilityState={{ disabled: !editable }} selectionColor={theme.focus}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[style, { minHeight: 48, minWidth: 48, borderRadius: 5, borderWidth: 2, borderColor: focused ? theme.focus : 'transparent' }, !editable && { color: theme.inkMuted }]}
  />;
}

// Keep transient '-' and decimal separators while typing signed temperatures.
export function SkeuoNumberInput({ value, onChangeText, onFocus, ...props }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  return <SkeuoInput {...props} value={editing ? draft : value}
    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
    onFocus={event => { setDraft(value); setEditing(true); onFocus?.(event); }}
    onBlur={() => { setEditing(false); setDraft(value); }}
    onChangeText={text => {
      if (!/^-?\d*(?:[.,]\d*)?$/.test(text)) return;
      setDraft(text);
      const normalized = text.replace(',', '.');
      if (normalized.trim() !== '' && Number.isFinite(Number(normalized))) onChangeText(normalized);
    }}
  />;
}

export function MetalFace() {
  const { theme, reducedEffects } = useMaterial();
  const id = useId().replace(/:/g, '');
  if (reducedEffects) return null;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={theme.metalTop} /><Stop offset="1" stopColor={theme.metalBottom} /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}

export function InstrumentIcon({ name, color, size = 22 }) {
  const paths = {
    snow: 'M12 2v20M3.34 7l17.32 10M3.34 17L20.66 7M9 4l3 3 3-3M9 20l3-3 3 3',
    tune: 'M5 4v16M12 4v16M19 4v16M2 8h6M9 15h6M16 9h6',
    chart: 'M3 3v18h18M6 15l4-5 4 3 6-8',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z',
    sun: 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <Path d={paths[name] || paths.tune} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    {name === 'sun' && <Circle cx="12" cy="12" r="4" fill="none" stroke={color} strokeWidth={1.8} />}
  </Svg>;
}

export function SkeuoSwitch(props) {
  const { theme } = useMaterial();
  return <View style={{ minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
    <Switch {...props} trackColor={{ false: theme.borderStrong, true: '#32674f' }} thumbColor="#f1f2e8"
      activeThumbColor="#f1f2e8" activeTrackColor="#32674f" />
  </View>;
}

// 1.1 SkeuoLcdWell: Ô lõm màn hình đo / đồ thị
export function SkeuoLcdWell({ variant = 'readout', style, children, ...props }) {
  const { theme, reducedEffects } = useMaterial();
  const isChart = variant === 'chart';
  return (
    <View
      {...props}
      style={[
        styles.lcdWell,
        {
          backgroundColor: theme.screenBg,
          borderColor: theme.borderStrong,
          borderTopColor: reducedEffects ? theme.borderStrong : theme.shadowDark,
        },
        isChart ? styles.lcdWellChart : styles.lcdWellReadout,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// 1.2 SkeuoLed: Chấm LED trạng thái chuẩn 10x10
export function SkeuoLed({ state = 'ok', color, size = 10, style, accessibilityLabel, ...props }) {
  const { theme } = useMaterial();
  const stateColor = color || (
    state === 'ok' ? theme.optimal :
    state === 'warn' ? theme.warning :
    state === 'error' ? theme.danger :
    theme.border
  );
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      aria-hidden={!accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: stateColor,
          borderColor: theme.borderStrong,
          borderWidth: 1,
        },
        style,
      ]}
      {...props}
    />
  );
}

// 1.3 SkeuoGauge: Đồng hồ kim tròn SVG analog cho delta T_air
export function SkeuoGauge({ value, size = 150, min = 0, max = 20, style }) {
  const { theme, reducedEffects } = useMaterial();
  const numVal = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const clamped = numVal !== null ? Math.max(min, Math.min(max, numVal)) : min;
  const angle = -165 + ((clamped - min) / (max - min)) * 150;

  const cx = 75;
  const cy = 75;
  const r = 52;
  const toX = (deg) => (cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(2);
  const toY = (deg) => (cy + r * Math.sin((deg * Math.PI) / 180)).toFixed(2);

  const arcLow = `M ${toX(-165)} ${toY(-165)} A ${r} ${r} 0 0 1 ${toX(-135)} ${toY(-135)}`;
  const arcOpt = `M ${toX(-135)} ${toY(-135)} A ${r} ${r} 0 0 1 ${toX(-75)} ${toY(-75)}`;
  const arcHigh = `M ${toX(-75)} ${toY(-75)} A ${r} ${r} 0 0 1 ${toX(-15)} ${toY(-15)}`;

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const deg = -165 + i * 15;
    const isMajor = i === 0 || i === 2 || i === 6 || i === 10;
    const rad = (deg * Math.PI) / 180;
    const rOut = 49;
    const rIn = isMajor ? 41 : 45;
    ticks.push({
      key: i,
      x1: cx + rIn * Math.cos(rad),
      y1: cy + rIn * Math.sin(rad),
      x2: cx + rOut * Math.cos(rad),
      y2: cy + rOut * Math.sin(rad),
      stroke: isMajor ? theme.screenInk : theme.screenMuted,
      strokeWidth: isMajor ? 1.5 : 1,
    });
  }

  const a11yText = numVal !== null
    ? `Độ giảm nhiệt khí qua dàn lạnh: ${numVal.toFixed(1)} K`
    : 'Độ giảm nhiệt khí qua dàn lạnh: chưa có dữ liệu';

  // Khi reducedEffects: tính tọa độ kim tĩnh trực tiếp, không dùng transform/rotation
  const rad = (angle * Math.PI) / 180;
  const tipX = Number((cx + 46 * Math.cos(rad)).toFixed(2));
  const tipY = Number((cy + 46 * Math.sin(rad)).toFixed(2));
  const base1X = Number((cx + 2.5 * Math.cos(rad + Math.PI / 2)).toFixed(2));
  const base1Y = Number((cy + 2.5 * Math.sin(rad + Math.PI / 2)).toFixed(2));
  const base2X = Number((cx + 2.5 * Math.cos(rad - Math.PI / 2)).toFixed(2));
  const base2Y = Number((cy + 2.5 * Math.sin(rad - Math.PI / 2)).toFixed(2));
  const directNeedlePath = `M ${base1X} ${base1Y} L ${tipX} ${tipY} L ${base2X} ${base2Y} Z`;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={a11yText}
    >
      <Svg width={size} height={size} viewBox="0 0 150 150" aria-hidden>
        <Circle cx={cx} cy={cy} r={70} fill={theme.surfaceRecessed} stroke={reducedEffects ? 'none' : theme.borderStrong} strokeWidth={reducedEffects ? 0 : 3} />
        <Circle cx={cx} cy={cy} r={58} fill={theme.screenBg} stroke={reducedEffects ? theme.border : theme.shadowDark} strokeWidth={reducedEffects ? 1 : 2} />
        <Path d={arcLow} fill="none" stroke={theme.danger} strokeWidth={3} strokeLinecap="round" />
        <Path d={arcOpt} fill="none" stroke={theme.optimal} strokeWidth={3.5} strokeLinecap="round" />
        <Path d={arcHigh} fill="none" stroke={theme.warning} strokeWidth={3} strokeLinecap="round" />

        {ticks.map(t => (
          <Line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.stroke} strokeWidth={t.strokeWidth} />
        ))}

        <SvgText x={cx} y={108} fill={theme.screenMuted} fontSize="9" fontWeight="700" fontFamily={MONO} textAnchor="middle">
          ΔT_air (K)
        </SvgText>

        {reducedEffects ? (
          <Path d={directNeedlePath} fill={theme.danger} />
        ) : (
          <G rotation={angle} origin={`${cx}, ${cy}`}>
            <Path d={`M ${cx} ${cy - 2.5} L ${cx + 46} ${cy} L ${cx} ${cy + 2.5} Z`} fill={theme.danger} />
            <Circle cx={cx} cy={cy} r={5} fill={theme.brass} />
          </G>
        )}

        {reducedEffects ? (
          <Circle cx={cx} cy={cy} r={4} fill={theme.screenInk} />
        ) : (
          <>
            <Circle cx={cx} cy={cy} r={6} fill={theme.brass} stroke={theme.brassLight} strokeWidth={1.5} />
            <Circle cx={cx} cy={cy} r={2} fill={theme.shadowDark} />
          </>
        )}
      </Svg>
    </View>
  );
}

// 1.4 SkeuoPanel: Wrapper card chuẩn thay cho pattern lặp
export function SkeuoPanel({ style, children, ...props }) {
  const { theme, reducedEffects } = useMaterial();
  return (
    <View
      {...props}
      style={[
        styles.panel,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        !reducedEffects && theme.cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: SKEUOMORPHISM['--um-skeuomorphism-target-min'], minWidth: 48, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  panel: { borderRadius: 14, borderWidth: 1, padding: 16 },
  lcdWell: { borderRadius: 8, borderWidth: 1, borderTopWidth: 2 },
  lcdWellReadout: { paddingHorizontal: 10, paddingVertical: 8 },
  lcdWellChart: { padding: 8, overflow: 'hidden' },
});
