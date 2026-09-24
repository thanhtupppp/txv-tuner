import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REFRIGERANTS,
  DANFOSS_TXV_MODELS,
  pressureToTemp,
  tempToPressure
} from '../data/danfossData';
import { TXV_CONFIG } from '../constants/txvConfig';
import {
  validateTxvInput,
  isValidTemperature,
  calculateSuperheat,
  calculateEvaporation,
} from '../domain/txv';

/**
 * Custom Hook Adapter quản lý trạng thái giao diện và kết nối domain tính toán TXV.
 */
export function useTxvCalculator(liveT1, liveT2, liveT3, isOnline = true) {
  // Trạng thái cấu hình
  const [selectedRefId, setSelectedRefId] = useState(TXV_CONFIG.defaultRefrigerant);
  const [selectedValveId, setSelectedValveId] = useState(TXV_CONFIG.defaultValve);
  const [opMode, setOpMode] = useState(TXV_CONFIG.defaultOpMode); // 'target_room' | 'live' | 'manual'
  const [isAutoSyncSensors, setIsAutoSyncSensors] = useState(true);
  const [evapSource, setEvapSource] = useState(TXV_CONFIG.defaultEvapSource); // 't2' | 't1_td' | 'pressure'

  // Thông số mục tiêu
  const [targetRoomTemp, setTargetRoomTemp] = useState(TXV_CONFIG.defaultRoomTempC); // Mặc định kho đông -20°C
  const [tdValue, setTdValue] = useState(TXV_CONFIG.defaultTdK); // Chênh nhiệt dàn lạnh TD (K)
  const [targetSh, setTargetSh] = useState(TXV_CONFIG.defaultTargetShK); // Superheat mục tiêu (K)

  // Thông số đo đạc & tính toán
  const [evapTemp, setEvapTemp] = useState(TXV_CONFIG.defaultEvapTempC); // T_bay_hoi (°C)
  const [evapPressure, setEvapPressure] = useState(TXV_CONFIG.defaultEvapPressureBar); // P_bay_hoi (bar)
  const [suctionTemp, setSuctionTemp] = useState(TXV_CONFIG.defaultSuctionTempC); // T_hoi_hut (°C)

  // Memoized objects van và môi chất
  const currentRef = useMemo(
    () => REFRIGERANTS.find((r) => r.id === selectedRefId) || REFRIGERANTS[0],
    [selectedRefId]
  );

  const currentValve = useMemo(
    () => DANFOSS_TXV_MODELS.find((v) => v.id === selectedValveId) || DANFOSS_TXV_MODELS[0],
    [selectedValveId]
  );

  // Xử lý chuyển đổi nguồn tính T_evap
  const handleSetEvapSource = useCallback((source) => {
    setEvapSource(source);
    const result = calculateEvaporation({
      source,
      t1C: liveT1,
      t2C: liveT2,
      tdK: tdValue,
      pressureBarA: evapPressure,
      refrigerantId: selectedRefId,
    });

    if (result.valid) {
      setEvapTemp(result.evapTempC);
      if (result.evapPressureBarA !== null) {
        setEvapPressure(result.evapPressureBarA);
      }
    } else {
      setEvapTemp(null);
    }
  }, [liveT1, liveT2, tdValue, selectedRefId, evapPressure]);

  // Cài đặt theo nhiệt độ kho mong muốn
  const applyRoomTempTarget = useCallback((roomT, td = tdValue) => {
    const rT = parseFloat(roomT) || 0;
    const clampedRoomT = Math.max(TXV_CONFIG.temperatureMinC, Math.min(TXV_CONFIG.temperatureMaxC, rT));
    const calculatedEvapT = Number((clampedRoomT - td).toFixed(1));

    setTargetRoomTemp(clampedRoomT);
    setTdValue(td);
    setEvapTemp(calculatedEvapT);

    try {
      const pBar = tempToPressure(calculatedEvapT, selectedRefId);
      setEvapPressure(pBar);
    } catch (error) {
      setEvapPressure(0);
    }

    if (isAutoSyncSensors) {
      if (isValidTemperature(liveT3)) {
        setSuctionTemp(Number(Number(liveT3).toFixed(1)));
      } else {
        setSuctionTemp(null);
      }
    }
  }, [selectedRefId, tdValue, isAutoSyncSensors, liveT3]);

  // Tự động đồng bộ với cảm biến thời gian thực khi ở Live mode qua calculateEvaporation
  useEffect(() => {
    if (opMode === 'live' && isAutoSyncSensors) {
      const evapResult = calculateEvaporation({
        source: evapSource,
        t1C: liveT1,
        t2C: liveT2,
        tdK: tdValue,
        pressureBarA: evapPressure,
        refrigerantId: selectedRefId,
      });

      if (evapResult.valid) {
        setEvapTemp(evapResult.evapTempC);
        if (evapSource !== 'pressure' && evapResult.evapPressureBarA !== null) {
          setEvapPressure(evapResult.evapPressureBarA);
        }
      } else {
        setEvapTemp(null);
      }

      // Nhiệt độ hơi hút: Chỉ gán khi cảm biến T3 hợp lệ
      setSuctionTemp(isValidTemperature(liveT3) ? Number(liveT3.toFixed(1)) : null);
    } else if (opMode === 'target_room') {
      const calculatedEvapT = Number((targetRoomTemp - tdValue).toFixed(1));
      setEvapTemp(calculatedEvapT);

      try {
        setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
      } catch (error) {
        setEvapPressure(0);
      }

      if (isAutoSyncSensors) {
        setSuctionTemp(isValidTemperature(liveT3) ? Number(liveT3.toFixed(1)) : null);
      }
    }
  }, [
    opMode,
    evapSource,
    selectedRefId,
    targetRoomTemp,
    tdValue,
    liveT1,
    liveT2,
    liveT3,
    isAutoSyncSensors,
    evapPressure,
  ]);

  // Xử lý thay đổi nhiệt độ bay hơi bằng tay
  const handleEvapTempChange = useCallback((val) => {
    const num = parseFloat(val) || 0;
    const clampedTemp = Math.max(TXV_CONFIG.temperatureMinC, Math.min(TXV_CONFIG.temperatureMaxC, num));
    setEvapTemp(clampedTemp);

    try {
      setEvapPressure(tempToPressure(clampedTemp, selectedRefId));
    } catch (error) {
      setEvapPressure(0);
    }
  }, [selectedRefId]);

  // Xử lý thay đổi áp suất bay hơi bằng tay
  const handleEvapPressureChange = useCallback((val) => {
    const num = parseFloat(val) || 0;
    const clampedPressure = Math.max(TXV_CONFIG.pressureMinBar, Math.min(TXV_CONFIG.pressureMaxBar, num));
    setEvapPressure(clampedPressure);

    try {
      setEvapTemp(pressureToTemp(clampedPressure, selectedRefId));
    } catch (error) {
      setEvapTemp(0);
    }
  }, [selectedRefId]);

  // Tính Superheat thông qua pure module calculateSuperheat
  const shCalculation = useMemo(() => {
    return calculateSuperheat({
      suctionTempC: suctionTemp,
      evapTempC: evapTemp,
      targetShK: targetSh,
      lowThresholdK: TXV_CONFIG.lowMaxK ?? 4.0,
      optimalThresholdK: TXV_CONFIG.optimalMaxK ?? 8.0,
      toleranceK: TXV_CONFIG.adjustmentToleranceK ?? 0.4,
    });
  }, [suctionTemp, evapTemp, targetSh]);

  const actualSh = shCalculation.superheatK;
  const deltaSh = shCalculation.deltaShK;

  // Khóa liên động Sensor Interlock
  const interlock = useMemo(() => {
    return validateTxvInput({
      opMode,
      evapSource,
      liveT1,
      liveT2,
      liveT3,
      isOnline,
      isAutoSyncSensors,
      suctionTemp,
      evapTemp,
      evapPressure,
      valve: currentValve,
    });
  }, [
    opMode,
    evapSource,
    liveT1,
    liveT2,
    liveT3,
    isOnline,
    isAutoSyncSensors,
    suctionTemp,
    evapTemp,
    evapPressure,
    currentValve,
  ]);

  return {
    selectedRefId,
    setSelectedRefId,
    selectedValveId,
    setSelectedValveId,
    opMode,
    setOpMode,
    isAutoSyncSensors,
    setIsAutoSyncSensors,
    evapSource,
    setEvapSource: handleSetEvapSource,
    targetRoomTemp,
    targetSh,
    setTargetSh,
    tdValue,
    applyRoomTempTarget,
    evapTemp,
    evapPressure,
    suctionTemp,
    setSuctionTemp,
    handleEvapTempChange,
    handleEvapPressureChange,
    currentRef,
    currentValve,
    actualSh,
    deltaSh,
    interlock,
  };
}
