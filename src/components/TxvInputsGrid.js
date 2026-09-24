import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MONO } from '../constants/theme';
import { useMaterial, SkeuoPanel, SkeuoLcdWell, SkeuoButton, SkeuoNumberInput, InstrumentIcon } from '../components/SkeuoKit';

export function TxvInputsGrid({
  opMode = 'live',
  evapTemp = -27.0,
  evapPressure,
  evapPressureBarG,
  evapPressureBarA,
  suctionTemp = -21.0,
  setSuctionTemp,
  targetSh = 6.0,
  setTargetSh,
  handleEvapTempChange,
  handleEvapPressureChange,
  liveT1,
  liveT2,
  liveT3,
  tdValue = 7.0,
  evapSource = 't2',
  setEvapSource,
  isAutoSyncSensors = true,
  setIsAutoSyncSensors,
  themeMode,
}) {
  const { theme } = useMaterial();

  const displayPressureG = evapPressureBarG !== undefined ? evapPressureBarG : evapPressure;
  const isEvapTempValid = typeof evapTemp === 'number' && Number.isFinite(evapTemp);
  const isPressureValid = typeof displayPressureG === 'number' && Number.isFinite(displayPressureG);
  const isSuctionTempValid = typeof suctionTemp === 'number' && Number.isFinite(suctionTemp);
  const isTargetShValid = typeof targetSh === 'number' && Number.isFinite(targetSh);

  return (
    <View style={styles.container}>
      {/* Thẻ 1: Điểm bay hơi */}
      <SkeuoPanel style={styles.card}>
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
            <SkeuoLcdWell variant="readout" style={styles.wellInput}>
              <SkeuoNumberInput
                testID="evap-temp-input"
                style={[styles.numericInput, { color: theme.screenInk }]}
                accessibilityLabel="Nhiệt độ bay hơi, độ C"
                value={isEvapTempValid ? String(evapTemp) : ''}
                onChangeText={handleEvapTempChange}
                editable={opMode === 'manual' || !isAutoSyncSensors}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.screenMuted }]}>°C</Text>
            </SkeuoLcdWell>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.inkMuted }]}>Áp suất bay hơi Pe (bar g — áp kế):</Text>
            <SkeuoLcdWell variant="readout" style={styles.wellInput}>
              <SkeuoNumberInput
                testID="evap-pressure-input"
                style={[styles.numericInput, { color: theme.screenInk }]}
                accessibilityLabel="Áp suất bay hơi, bar g"
                value={isPressureValid ? String(displayPressureG) : ''}
                onChangeText={handleEvapPressureChange}
                editable={opMode === 'manual' || !isAutoSyncSensors || evapSource === 'pressure'}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.screenMuted }]}>bar g</Text>
            </SkeuoLcdWell>
            {typeof evapPressureBarA === 'number' && Number.isFinite(evapPressureBarA) && (
              <Text style={[styles.pressureHint, { color: theme.inkMuted }]}>
                (~{evapPressureBarA.toFixed(2)} bar a tuyệt đối)
              </Text>
            )}
          </View>
        </View>
      </SkeuoPanel>

      {/* Thẻ 2: Nhiệt độ hơi hút */}
      <SkeuoPanel style={styles.card}>
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
            <SkeuoLcdWell variant="readout" style={styles.wellInput}>
              <SkeuoNumberInput
                testID="suction-temp-input"
                onFocus={() => setIsAutoSyncSensors(false)}
                style={[styles.numericInput, { color: theme.screenInk }]}
                accessibilityLabel="Nhiệt độ hơi hút, độ C"
                value={isSuctionTempValid ? String(suctionTemp) : ''}
                onChangeText={(val) => {
                  setIsAutoSyncSensors(false);
                  if (typeof setSuctionTemp === 'function') {
                    setSuctionTemp(val);
                  }
                }}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.screenMuted }]}>°C</Text>
            </SkeuoLcdWell>
          </View>

          <View style={styles.presetsRow}>
            <Text style={[styles.presetsLabel, { color: theme.inkMuted }]}>Thử nghiệm:</Text>
            {[-6, 6, 18].map((t) => {
              const isMatch = Math.abs((suctionTemp ?? 0) - t) < 0.05;
              return (
                <SkeuoButton
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isMatch }}
                  style={[
                    styles.presetBtn,
                    {
                      backgroundColor: isMatch ? theme.accent : theme.surfaceInset,
                      borderColor: isMatch ? theme.accent : theme.border
                    }
                  ]}
                  onPress={() => {
                    setIsAutoSyncSensors(false);
                    if (typeof setSuctionTemp === 'function') {
                      setSuctionTemp(t);
                    }
                  }}
                >
                  <Text style={[styles.presetBtnText, { color: isMatch ? theme.onAccent : theme.ink, fontWeight: isMatch ? '800' : '600' }]}>
                    {isMatch ? '✓ ' : ''}{t > 0 ? `+${t}` : t}°C
                  </Text>
                </SkeuoButton>
              );
            })}
          </View>
        </View>
      </SkeuoPanel>

      {/* Thẻ 3: Quá nhiệt mục tiêu */}
      <SkeuoPanel style={styles.card}>
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
            <SkeuoLcdWell variant="readout" style={styles.wellInput}>
              <SkeuoNumberInput
                style={[styles.numericInput, { color: theme.screenInk }]}
                accessibilityLabel="Quá nhiệt mục tiêu, K"
                value={isTargetShValid ? String(targetSh) : ''}
                onChangeText={(val) => {
                  if (typeof setTargetSh === 'function') {
                    setTargetSh(val);
                  }
                }}
                keyboardType="numeric"
              />
              <Text style={[styles.unitText, { color: theme.screenMuted }]}>K</Text>
            </SkeuoLcdWell>
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
                onPress={() => {
                  if (typeof setTargetSh === 'function') {
                    setTargetSh(k);
                  }
                }}
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
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  sourceGroup: {
    gap: 6,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sourceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sourceChipText: {
    fontSize: 11,
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
    minHeight: 52,
    paddingHorizontal: 12,
  },
  numericInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: MONO,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: MONO,
    marginLeft: 6,
  },
  pressureHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 4,
    fontFamily: MONO,
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

export default TxvInputsGrid;
