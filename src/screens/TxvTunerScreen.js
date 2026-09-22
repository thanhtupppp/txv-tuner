import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { TxvTelemetryBar } from '../components/TxvTelemetryBar';
import { RefrigerantSelector } from '../components/RefrigerantSelector';
import { ValveSelector } from '../components/ValveSelector';
import { TxvInputsGrid } from '../components/TxvInputsGrid';
import { TxvResultPanel } from '../components/TxvResultPanel';
import { TxvHistoryChart } from '../components/TxvHistoryChart';
import { SimCondPanel } from '../components/SimCondPanel';
import { useTxvCalculator } from '../hooks/useTxvCalculator';
import { calculateTxvRecommendation } from '../utils/txvRecommendation';
import { MONO } from '../constants/theme';
import { useMaterial } from '../components/SkeuoKit';

export function TxvTunerScreen({ liveT1, liveT2, liveT3, isOnline, isDemoMode, themeMode }) {
  const { theme } = useMaterial();

  const {
    selectedRefId,
    setSelectedRefId,
    selectedValveId,
    setSelectedValveId,
    opMode,
    isAutoSyncSensors,
    setIsAutoSyncSensors,
    evapSource,
    setEvapSource,
    targetRoomTemp,
    targetSh,
    setTargetSh,
    tdValue,
    evapTemp,
    evapPressure,
    suctionTemp,
    setSuctionTemp,
    handleEvapTempChange,
    handleEvapPressureChange,
    currentRef,
    currentValve,
    actualSh,
    deltaSh
  } = useTxvCalculator(liveT1, liveT2, liveT3, isOnline);

  const [condTemp, setCondTemp] = useState(40.0);
  const [shHistory, setShHistory] = useState([]);

  const recommendation = calculateTxvRecommendation(actualSh, targetSh, currentValve);

  useEffect(() => {
    if (typeof actualSh === 'number' && !isNaN(actualSh)) {
      setShHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.abs(last.actualSh - actualSh) < 0.05 && last.targetSh === targetSh) {
          return prev;
        }
        return [
          ...prev.slice(-19),
          {
            timestamp: Date.now(),
            actualSh,
            targetSh,
            action: recommendation.direction
          }
        ];
      });
    }
  }, [actualSh, targetSh, recommendation.direction]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Thanh tín hiệu cảm biến thời gian thực */}
      <TxvTelemetryBar
        isOnline={isOnline}
        isDemoMode={isDemoMode}
        liveT1={liveT1}
        liveT2={liveT2}
        liveT3={liveT3}
        isAutoSyncSensors={isAutoSyncSensors}
        setIsAutoSyncSensors={setIsAutoSyncSensors}
        themeMode={themeMode}
      />

      {/* 2. Chọn Môi chất lạnh CoolProp */}
      <RefrigerantSelector
        selectedRefId={selectedRefId}
        setSelectedRefId={setSelectedRefId}
        currentRef={currentRef}
        evapTemp={evapTemp}
        setEvapPressure={handleEvapPressureChange}
        themeMode={themeMode}
      />

      {/* 3. Chọn dòng van Danfoss TXV */}
      <ValveSelector
        selectedValveId={selectedValveId}
        setSelectedValveId={setSelectedValveId}
        currentValve={currentValve}
        themeMode={themeMode}
      />

      {/* 4. Lưới nhập liệu thông số vận hành */}
      <TxvInputsGrid
        opMode={opMode}
        evapTemp={evapTemp}
        evapPressure={evapPressure}
        suctionTemp={suctionTemp}
        setSuctionTemp={setSuctionTemp}
        targetSh={targetSh}
        setTargetSh={setTargetSh}
        handleEvapTempChange={handleEvapTempChange}
        handleEvapPressureChange={handleEvapPressureChange}
        liveT1={liveT1}
        liveT2={liveT2}
        liveT3={liveT3}
        tdValue={tdValue}
        evapSource={evapSource}
        setEvapSource={setEvapSource}
        setIsAutoSyncSensors={setIsAutoSyncSensors}
        themeMode={themeMode}
      />

      {/* 5. Khối kết quả quá nhiệt & hướng dẫn vặn vít */}
      <TxvResultPanel
        actualSh={actualSh}
        deltaSh={deltaSh}
        recommendation={recommendation}
        currentValve={currentValve}
        themeMode={themeMode}
      />

      {/* 6. Biểu đồ lịch sử Superheat */}
      <TxvHistoryChart
        historyData={shHistory}
        targetSh={targetSh}
        themeMode={themeMode}
      />

      {/* 7. Điều khiển nhiệt độ ngưng tụ T_cond */}
      <SimCondPanel
        condTemp={condTemp}
        setCondTemp={setCondTemp}
        currentRef={currentRef}
        themeMode={themeMode}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingBottom: 40,
  },
});
