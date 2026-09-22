import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Platform } from 'react-native';
import { REFRIGERANTS, tempToPressure } from '../data/danfossData';
import { useMaterial, SkeuoButton, SkeuoPanel } from './SkeuoKit';

export function RefrigerantSelector({
  selectedRefId = 'R404A',
  setSelectedRefId,
  currentRef,
  evapTemp = -27.0,
  setEvapPressure,
  themeMode
}) {
  const { theme } = useMaterial();
  const [modalVisible, setModalVisible] = useState(false);

  const refId = currentRef?.id || selectedRefId || 'R404A';
  const refDesc = currentRef?.desc || 'Môi chất lạnh';
  const tc = currentRef?.Tc ? (currentRef.Tc - 273.15).toFixed(1) : '--';
  const pc = currentRef?.Pc ? currentRef.Pc.toFixed(1) : '--';

  const handleSelect = (id) => {
    if (typeof setSelectedRefId === 'function') {
      setSelectedRefId(id);
    }
    setModalVisible(false);
    if (typeof setEvapPressure === 'function') {
      try {
        const p = tempToPressure(evapTemp ?? -27.0, id);
        setEvapPressure(p);
      } catch (e) {
        console.warn(`[RefrigerantSelector] Lỗi tính áp suất cho ${id}:`, e);
      }
    }
  };

  return (
    <>
      <SkeuoPanel style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, { color: theme.inkMuted }]}>
            01 / MÔI CHẤT LẠNH
          </Text>
          <Text style={[styles.selectedInfo, { color: theme.accent }]}>
            {refId} • {refDesc} (Tc: {tc}°C, Pc: {pc} bar)
          </Text>
        </View>

        <SkeuoButton
          onPress={() => setModalVisible(true)}
          style={styles.dropdownButton}
          accessibilityLabel={`Chọn môi chất lạnh, hiện tại: ${refId}`}
        >
          <Text style={[styles.dropdownText, { color: theme.ink }]}>
            <Text style={{ fontWeight: '800' }}>✓ {refId}</Text> — {refDesc}
          </Text>
          <Text style={[styles.dropdownArrow, { color: theme.inkMuted }]}>▼</Text>
        </SkeuoButton>
      </SkeuoPanel>

      <Modal
        visible={modalVisible}
        transparent
        animationType={Platform.OS === 'ios' ? 'slide' : 'fade'}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SkeuoPanel style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>
              Chọn Môi Chất Lạnh
            </Text>

            <ScrollView style={styles.scrollView}>
              {REFRIGERANTS.map((ref) => {
                const isSelected = (currentRef?.id || selectedRefId) === ref.id;
                return (
                  <SkeuoButton
                    key={ref.id}
                    onPress={() => handleSelect(ref.id)}
                    style={[
                      styles.modalItem,
                      isSelected && { backgroundColor: theme.accent },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        { color: isSelected ? theme.onAccent : theme.ink },
                      ]}
                    >
                      {isSelected ? '✓ ' : ''}{ref.id} — {ref.desc}
                    </Text>
                  </SkeuoButton>
                );
              })}
            </ScrollView>

            <SkeuoButton onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: theme.ink }]}>Đóng</Text>
            </SkeuoButton>
          </SkeuoPanel>
        </View>
      </Modal>
    </>
  );
}

export default RefrigerantSelector;

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
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
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 12,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 15, 10, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    gap: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  scrollView: {
    maxHeight: 300,
    marginBottom: 8,
  },
  modalItem: {
    marginBottom: 8,
    paddingVertical: 10,
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 8,
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
