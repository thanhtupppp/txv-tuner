import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoButton, SkeuoNumberInput, InstrumentIcon } from '../components/SkeuoKit';

export function TxvInputsGrid({
  opMode,
  evapTemp,
  evapPressure,
  suctionTemp,
  setSuctionTemp,
  targetSh,
  setTargetSh,
  handleEvapTempChange,
  handleEvapPressureChange,
  liveT1,
  liveT2,
  liveT3,
  tdValue,
  evapSource,
  setEvapSource,
  isAutoSyncSensors,
  setIsAutoSyncSensors,
  themeMode
}) {
  const { theme } = useMaterial();

  return (
    <View style={styles.container}>
      {/* Thẻ 1: Điểm bay hơi */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
        <View style={styles.cardHeader}>
          <InstrumentIcon name="snow" color={theme.accent} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTag, { color: theme.inkMuted }]}>BAY HƠI BÃO HÒA</Text>
            <Text style={[styles.cardTitle, { color: theme.ink }]}>Điểm Bay Hơi Dàn Lạnh</Text>
          </View>
        </View>

        {opMode === 'live' && (
          <View style={styles.sourceGroup}>
            <Text style={[styles.sourceLabel, { color: theme.inkMuted }]}>NGUỒN TÍNH T_EVAP:</Text>
            <View style={styles.sourceChips}>
              <SkeuoButton
                style={[
                  styles.sourceChip,
                  {
                    backgroundColor: evapSource === 't2' ? theme.cold : theme.surfaceInset,
                    borderColor: evapSource === 't2' ? theme.cold : theme.border
                  }
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: evapSource === 't2' }}
                onPress={() => setEvapSource('t2')}
              >
                <Text style={[styles.sourceChipText, { color: evapSource === 't2' ? theme.onAccent : theme.ink }]}>
                  {evapSource === 't2' ? '✓ ' : ''}T2 ({typeof liveT2 === 'number' ? `${liveT2.toFixed(1)}°C` : '--'})
                </Text>
              </SkeuoButton>

              <SkeuoButton
                style={[
                  styles.sourceChip,
                  {
                    backgroundColor: evapSource === 't1_td' ? theme.cold : theme.surfaceInset,
                    borderColor: evapSource === 't1_td' ? theme.cold : theme.border
                  }
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: evapSource === 't1_td' }}
                onPress={() => setEvapSource('t1_td')}
              >
                <Text style={[styles.sourceChipText, { color: evapSource === 't1_td' ? theme.onAccent : theme.ink }]}>
                  {evapSource === 't1_td' ? '✓ ' : ''}T1-TD ({typeof liveT1 === 'number' ? `${(liveT1 - (tdValue || 7)).toFixed(1)}°C` : '--'})
                </Text>
              </SkeuoButton>

              <SkeuoButton
                style={[
                  styles.sourceChip,
                  {
                    backgroundColor: evapSource === 'pressure' ? theme.cold : theme.surfaceInset,
                    borderColor: evapSource === 'pressure' ? theme.cold : theme.border
                  }
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: evapSource === 'pressure' }}
                onPress={() => setEvapSource('pressure')}
              >
                <Text style={[styles.sourceChipText, { color: evapSource === 'pressure' ? theme.onAccent : theme.ink }]}>
                  {evapSource === 'pressure' ? '✓ ' : ''}Áp suất Pe (Chuẩn)
                </Text>
              </SkeuoButton>
            </View>
          </View>
        )}

        <View style={styles.inputsColumn}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.inkMuted }]}>Nhiệt độ bay hơi T_evap (°C):</Text>
            <View style={[styles.wellInput, { backgroundColor: theme.surfaceInset }]}>
              <SkeuoNumberInput
                style={[styles.numericInput, { color: theme.ink }]}
                accessibilityLabel="Nhiệt độ bay hơi, độ C"
                value={typeof evapTemp === 'number' ? String(evapTemp) : '0'}
                onChangeText={handleEvapTempChange}
                editable={opMode === 'manual' || !isAutoSyncSensors}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.inkMuted }]}>°C</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.inkMuted }]}>Áp suất bay hơi Pe (bar):</Text>
            <View style={[styles.wellInput, { backgroundColor: theme.surfaceInset }]}>
              <SkeuoNumberInput
                style={[styles.numericInput, { color: theme.ink }]}
                accessibilityLabel="Áp suất bay hơi, bar"
                value={typeof evapPressure === 'number' ? String(evapPressure) : '0'}
                onChangeText={handleEvapPressureChange}
                editable={opMode === 'manual' || !isAutoSyncSensors || evapSource === 'pressure'}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.inkMuted }]}>bar</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Thẻ 2: Nhiệt độ hơi hút */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
        <View style={styles.cardHeader}>
          <InstrumentIcon name="chart" color={theme.accent} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTag, { color: theme.inkMuted }]}>HƠI HÚT VỀ / BẦU CẢM NHIỆT</Text>
            <Text style={[styles.cardTitle, { color: theme.ink }]}>Nhiệt Độ Hơi Hút (Ts)</Text>
          </View>
        </View>

        <View style={styles.inputsColumn}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.inkMuted }]}>Nhiệt độ đo tại ngõ ra dàn lạnh (Ts):</Text>
            <View style={[styles.wellInput, { backgroundColor: theme.surfaceInset }]}>
              <SkeuoNumberInput
                onFocus={() => setIsAutoSyncSensors(false)}
                style={[styles.numericInput, { color: theme.ink }]}
                accessibilityLabel="Nhiệt độ hơi hút, độ C"
                value={typeof suctionTemp === 'number' ? String(suctionTemp) : '0'}
                onChangeText={(val) => {
                  setIsAutoSyncSensors(false);
                  setSuctionTemp(parseFloat(val) || 0);
                }}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.inkMuted }]}>°C</Text>
            </View>
          </View>

          <View style={styles.presetsRow}>
            <Text style={[styles.presetsLabel, { color: theme.inkMuted }]}>Thử nghiệm:</Text>
            {[-6, 6, 18].map((t) => (
              <SkeuoButton
                key={t}
                style={[styles.presetBtn, { backgroundColor: theme.surfaceInset, borderColor: theme.border }]}
                onPress={() => {
                  setIsAutoSyncSensors(false);
                  setSuctionTemp(t);
                }}
              >
                <Text style={[styles.presetBtnText, { color: theme.ink }]}>
                  {t > 0 ? `+${t}` : t}°C
                </Text>
              </SkeuoButton>
            ))}
          </View>
        </View>
      </View>

      {/* Thẻ 3: Quá nhiệt mục tiêu */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, theme.cardShadow]}>
        <View style={styles.cardHeader}>
          <InstrumentIcon name="tune" color={theme.accent} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTag, { color: theme.inkMuted }]}>MỤC TIÊU VẬN HÀNH</Text>
            <Text style={[styles.cardTitle, { color: theme.ink }]}>Độ Quá Nhiệt Mục Tiêu</Text>
          </View>
        </View>

        <View style={styles.inputsColumn}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.inkMuted }]}>Quá nhiệt mong muốn SH_target (K):</Text>
            <View style={[styles.wellInput, { backgroundColor: theme.surfaceInset }]}>
              <SkeuoNumberInput
                style={[styles.numericInput, { color: theme.ink }]}
                accessibilityLabel="Quá nhiệt mục tiêu, K"
                value={typeof targetSh === 'number' ? String(targetSh) : '6'}
                onChangeText={(val) => setTargetSh(parseFloat(val) || 6)}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.inkMuted }]}>K</Text>
            </View>
          </View>

          <View style={styles.presetsRow}>
            {[4, 6, 8].map((k) => (
              <SkeuoButton
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: targetSh === k }}
                style={[
                  styles.presetBtn,
                  {
                    backgroundColor: targetSh === k ? theme.accent : theme.surfaceInset,
                    borderColor: targetSh === k ? theme.accent : theme.border
                  }
                ]}
                onPress={() => setTargetSh(k)}
              >
                <Text
                  style={[
                    styles.presetBtnText,
                    { color: targetSh === k ? theme.onAccent : theme.ink, fontWeight: targetSh === k ? '800' : '600' }
                  ]}
                >
                  {targetSh === k ? '✓ ' : ''}{k} K {k === 6 ? '(Chuẩn)' : ''}
                </Text>
              </SkeuoButton>
            ))}
          </View>
        </View>
      </View>
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
    alignItems: 'center',
    gap: 10,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardTag: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sourceGroup: {
    gap: 8,
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  sourceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sourceChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputsColumn: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  wellInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#6b7e72',
    borderTopWidth: 2,
  },
  numericInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: MONO,
    color: '#38bdf8',
  },
  unitText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetsLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetBtnText: {
    fontSize: 12,
  },
});
