import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DANFOSS_TXV_MODELS } from '../data/danfossData';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoButton, SkeuoInput } from '../components/SkeuoKit';

export function ValveSelector({
  selectedValveId,
  setSelectedValveId,
  currentValve,
  themeMode
}) {
  const { theme } = useMaterial();
  const valveDesc = currentValve?.desc || 'Van tiết lưu Danfoss';
  const sensitivity = typeof currentValve?.sensitivity === 'number'
    ? currentValve.sensitivity.toFixed(1)
    : '1.0';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.inkMuted }]}>
          02 / DÒNG VAN TXV
        </Text>
        <Text style={[styles.selectedInfo, { color: theme.accent }]}>
          {valveDesc} (Độ nhạy: ~{sensitivity} K/vòng)
        </Text>
      </View>

      <View style={styles.chipsWrap} accessibilityRole="radiogroup">
        {DANFOSS_TXV_MODELS.map((valve) => {
          const isSelected = selectedValveId === valve.id;
          return (
            <SkeuoButton
              key={valve.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.accent : theme.surfaceInset,
                  borderColor: isSelected ? theme.accent : theme.border
                }
              ]}
              onPress={() => setSelectedValveId(valve.id)}
            >
              <Text
                style={[
                  styles.valveName,
                  { color: isSelected ? theme.onAccent : theme.ink, fontWeight: isSelected ? '800' : '700' }
                ]}
              >
                {isSelected ? '✓ ' : ''}{valve.name}
              </Text>
              <Text
                style={[
                  styles.valveSub,
                  { color: isSelected ? theme.onAccent : theme.inkMuted }
                ]}
              >
                ~{valve.sensitivity} K/vòng
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
    alignItems: 'center',
    gap: 2,
  },
  valveName: {
    fontSize: 12,
  },
  valveSub: {
    fontSize: 12,
    fontWeight: '600',
  },
});
