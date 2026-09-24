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
  parseTxvNumericInput,
  calculateSuperheat,
  calculateEvaporation,
  barGaugeToAbsolute,
  barAbsoluteToGauge,
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

  // Thông số đo đạc & tính toán (Phân biệt rõ barG áp kế và barA tuyệt đối)
  const [evapTemp, setEvapTemp] = useState(TXV_CONFIG.defaultEvapTempC); // T_bay_hoi (°C)
  const [evapPressureBarG, setEvapPressureBarG] = useState(TXV_CONFIG.defaultEvapPressureBarG ?? 1.21); // P_bay_hoi (bar g)
  const [evapPressureBarA, setEvapPressureBarA] = useState(TXV_CONFIG.defaultEvapPressureBarA ?? 2.22); // P_bay_hoi (bar a)
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
      pressureBarG: evapPressureBarG,
      refrigerantId: selectedRefId,
    });

    if (result.valid) {
      setEvapTemp(result.evapTempC);
      if (result.evapPressureBarA !== null) {
        setEvapPressureBarA(result.evapPressureBarA);
      }
      if (result.evapPressureBarG !== null) {
        setEvapPressureBarG(result.evapPressureBarG);
      }
    } else {
      setEvapTemp(null);
    }
  }, [liveT1, liveT2, tdValue, selectedRefId, evapPressureBarG]);

  // Cài đặt theo nhiệt độ kho mong muốn
  const applyRoomTempTarget = useCallback((roomT, td = tdValue) => {
    const parsedRoomT = parseTxvNumericInput(roomT, {
      min: TXV_CONFIG.temperatureMinC,
      max: TXV_CONFIG.temperatureMaxC,
    });
    if (parsedRoomT === null) return;

    const calculatedEvapT = Number((parsedRoomT - td).toFixed(1));
    setTargetRoomTemp(parsedRoomT);
    setTdValue(td);
    setEvapTemp(calculatedEvapT);

    try {
      const pBarA = tempToPressure(calculatedEvapT, selectedRefId);
      setEvapPressureBarA(pBarA);
      setEvapPressureBarG(barAbsoluteToGauge(pBarA));
    } catch (error) {
      setEvapPressureBarA(null);
      setEvapPressureBarG(null);
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
        pressureBarG: evapPressureBarG,
        refrigerantId: selectedRefId,
      });

      if (evapResult.valid) {
        setEvapTemp(evapResult.evapTempC);
        if (evapSource !== 'pressure' && evapResult.evapPressureBarA !== null) {
          setEvapPressureBarA(evapResult.evapPressureBarA);
          setEvapPressureBarG(evapResult.evapPressureBarG);
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
        const pBarA = tempToPressure(calculatedEvapT, selectedRefId);
        setEvapPressureBarA(pBarA);
        setEvapPressureBarG(barAbsoluteToGauge(pBarA));
      } catch (error) {
        setEvapPressureBarA(null);
        setEvapPressureBarG(null);
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
    evapPressureBarG,
  ]);

  // Xử lý thay đổi nhiệt độ bay hơi bằng tay (Harden: parseTxvNumericInput, không fallback về 0)
  const handleEvapTempChange = useCallback((val) => {
    const parsedTemp = parseTxvNumericInput(val, {
      min: TXV_CONFIG.temperatureMinC ?? -100,
      max: TXV_CONFIG.temperatureMaxC ?? 100,
    });
    setEvapTemp(parsedTemp);

    if (parsedTemp !== null) {
      try {
        const pBarA = tempToPressure(parsedTemp, selectedRefId);
        setEvapPressureBarA(pBarA);
        setEvapPressureBarG(barAbsoluteToGauge(pBarA));
      } catch (error) {
        setEvapPressureBarA(null);
        setEvapPressureBarG(null);
      }
    } else {
      setEvapPressureBarA(null);
      setEvapPressureBarG(null);
    }
  }, [selectedRefId]);

  // Xử lý thay đổi áp suất bay hơi áp kế barG bằng tay (Harden: barG -> barA qua barGaugeToAbsolute)
  const handleEvapPressureBarGChange = useCallback((val) => {
    const parsedG = parseTxvNumericInput(val, {
      min: -1.0,
      max: TXV_CONFIG.pressureMaxBar ?? 200,
    });
    setEvapPressureBarG(parsedG);

    if (parsedG !== null) {
      const pBarA = barGaugeToAbsolute(parsedG);
      setEvapPressureBarA(pBarA);
      if (pBarA !== null && pBarA > 0) {
        try {
          const tEvap = pressureToTemp(pBarA, selectedRefId);
          setEvapTemp(tEvap);
        } catch (error) {
          setEvapTemp(null);
        }
      } else {
        setEvapTemp(null);
      }
    } else {
      setEvapPressureBarA(null);
      setEvapTemp(null);
    }
  }, [selectedRefId]);

  // Xử lý thay đổi nhiệt độ hơi hút bằng tay (Harden: parseTxvNumericInput, không fallback về 0)
  const handleSuctionTempChange = useCallback((val) => {
    setIsAutoSyncSensors(false);
    const parsedTemp = parseTxvNumericInput(val, {
      min: TXV_CONFIG.temperatureMinC ?? -100,
      max: TXV_CONFIG.temperatureMaxC ?? 100,
    });
    setSuctionTemp(parsedTemp);
  }, []);

  // Xử lý thay đổi Target SH bằng tay
  const handleTargetShChange = useCallback((val) => {
    const parsedSh = parseTxvNumericInput(val, {
      min: 0.1,
      max: 30.0,
    });
    setTargetSh(parsedSh);
  }, []);

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
      evapPressure: evapPressureBarA,
      evapPressureBarA,
      evapPressureBarG,
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
    evapPressureBarA,
    evapPressureBarG,
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
    setTargetSh: handleTargetShChange,
    tdValue,
    applyRoomTempTarget,
    evapTemp,
    evapPressure: evapPressureBarG, // compatibility alias (barg)
    evapPressureBarG,
    evapPressureBarA,
    suctionTemp,
    setSuctionTemp: handleSuctionTempChange,
    handleEvapTempChange,
    handleEvapPressureChange: handleEvapPressureBarGChange,
    handleEvapPressureBarGChange,
    handleSuctionTempChange,
    handleTargetShChange,
    currentRef,
    currentValve,
    actualSh,
    deltaSh,
    interlock,
  };
}
