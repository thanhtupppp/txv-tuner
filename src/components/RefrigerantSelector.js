import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { REFRIGERANTS, tempToPressure } from '../data/danfossData';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoButton, SkeuoInput } from '../components/SkeuoKit';

export function RefrigerantSelector({
  selectedRefId,
  setSelectedRefId,
  currentRef,
  evapTemp,
  setEvapPressure,
  themeMode
}) {
  const { theme } = useMaterial();
  const refId = currentRef?.id || 'R404A';
  const refDesc = currentRef?.desc || 'Môi chất lạnh';
  const tc = currentRef?.Tc ? (currentRef.Tc - 273.15).toFixed(1) : '--';
  const pc = currentRef?.Pc ? currentRef.Pc.toFixed(1) : '--';

  const handleSelect = (id) => {
    setSelectedRefId(id);
    if (typeof setEvapPressure === 'function') {
      try {
        const p = tempToPressure(evapTemp ?? -27.0, id);
        setEvapPressure(p);
      } catch (e) {}
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.inkMuted }]}>
          01 / MÔI CHẤT LẠNH
        </Text>
        <Text style={[styles.selectedInfo, { color: theme.accent }]}>
          {refId} • {refDesc} (Tc: {tc}°C, Pc: {pc} bar)
        </Text>
      </View>

      <View style={styles.chipsWrap} accessibilityRole="radiogroup">
        {REFRIGERANTS.map((ref) => {
          const isSelected = selectedRefId === ref.id;
          return (
            <SkeuoButton
              key={ref.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.accent : theme.surfaceInset,
                  borderColor: isSelected ? theme.accent : theme.border
                }
              ]}
              onPress={() => handleSelect(ref.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? theme.onAccent : theme.ink, fontWeight: isSelected ? '800' : '600' }
                ]}
              >
                {isSelected ? '✓ ' : ''}{ref.id}
              </Text>
            </SkeuoButton>
          );
        })}
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
    gap: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  selectedInfo: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
});
