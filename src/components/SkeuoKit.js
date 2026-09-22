import React, { createContext, useContext, useEffect, useId, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';
import { THEME, SKEUOMORPHISM } from '../constants/theme';

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

const styles = StyleSheet.create({
  button: { minHeight: SKEUOMORPHISM['--um-skeuomorphism-target-min'], minWidth: 48, borderWidth: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
});
