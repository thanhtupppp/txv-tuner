import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REFRIGERANTS,
  DANFOSS_TXV_MODELS,
  pressureToTemp,
  tempToPressure
} from '../data/danfossData';
import { TXV_CONFIG } from '../constants/txvConfig';
import { validateTxvInput, isValidTemperature } from '../domain/txv/validateTxvInput';

/**
 * Custom Hook quản lý toàn bộ logic tính toán nhiệt động lực học và quá nhiệt van Danfoss TXV.
 * Tích hợp Sensor Interlock: Cấm dùng fallback nhiệt độ để tạo ra dữ liệu quá nhiệt giả khi cảm biến offline.
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
    if (source === 't2') {
      if (isValidTemperature(liveT2)) {
        const calculatedEvapT = Number(liveT2.toFixed(1));
        setEvapTemp(calculatedEvapT);
        try {
          setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
        } catch (err) {}
      } else {
        setEvapTemp(null);
      }
    } else if (source === 't1_td') {
      if (isValidTemperature(liveT1)) {
        const calculatedEvapT = Number((liveT1 - tdValue).toFixed(1));
        setEvapTemp(calculatedEvapT);
        try {
          setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
        } catch (err) {}
      } else {
        setEvapTemp(null);
      }
    } else if (source === 'pressure') {
      try {
        if (typeof evapPressure === 'number' && Number.isFinite(evapPressure) && evapPressure > 0) {
          const calculatedEvapT = Number(pressureToTemp(evapPressure, selectedRefId).toFixed(1));
          setEvapTemp(calculatedEvapT);
        } else {
          setEvapTemp(null);
        }
      } catch (err) {
        setEvapTemp(null);
      }
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
      console.error('Lỗi tính áp suất:', error);
      setEvapPressure(0);
    }

    if (isAutoSyncSensors) {
      if (isValidTemperature(liveT3)) {
        setSuctionTemp(Number(Number(liveT3).toFixed(1)));
      } else {
        setSuctionTemp(null);
      }
    } else {
      // Giữ nguyên giá trị người dùng nhập
    }
  }, [selectedRefId, tdValue, isAutoSyncSensors, liveT3]);

  // Tự động đồng bộ với cảm biến thời gian thực khi ở Live mode
  // TUYỆT ĐỐI KHÔNG dùng fallback tĩnh (-12°C) làm giá trị thật khi sensor offline
  useEffect(() => {
    if (opMode === 'live' && isAutoSyncSensors) {
      const isT1Valid = isValidTemperature(liveT1);
      const isT2Valid = isValidTemperature(liveT2);
      const isT3Valid = isValidTemperature(liveT3);

      let calculatedEvapT = null;
      if (evapSource === 't2') {
        calculatedEvapT = isT2Valid ? Number(liveT2.toFixed(1)) : null;
      } else if (evapSource === 't1_td') {
        calculatedEvapT = isT1Valid ? Number((liveT1 - tdValue).toFixed(1)) : null;
      } else if (evapSource === 'pressure') {
        if (typeof evapPressure === 'number' && Number.isFinite(evapPressure) && evapPressure > 0) {
          try {
            calculatedEvapT = Number(pressureToTemp(evapPressure, selectedRefId).toFixed(1));
          } catch {
            calculatedEvapT = null;
          }
        }
      }

      setEvapTemp(calculatedEvapT);

      if (calculatedEvapT !== null && evapSource !== 'pressure') {
        try {
          setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
        } catch (error) {
          setEvapPressure(0);
        }
      }

      // Nhiệt độ hơi hút: Chỉ gán khi cảm biến T3 hợp lệ, không dùng fallback -12°C
      setSuctionTemp(isT3Valid ? Number(liveT3.toFixed(1)) : null);
    } else if (opMode === 'target_room') {
      const calculatedEvapT = Number((targetRoomTemp - tdValue).toFixed(1));
      setEvapTemp(calculatedEvapT);

      try {
        setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
      } catch (error) {
        setEvapPressure(0);
      }

      if (isAutoSyncSensors) {
        const isT3Valid = isValidTemperature(liveT3);
        setSuctionTemp(isT3Valid ? Number(liveT3.toFixed(1)) : null);
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

  // Độ quá nhiệt thực tế (SH)
  // Nếu mất cảm biến (suctionTemp hoặc evapTemp là null), SH là null (không suy diễn giả lập)
  const actualSh = useMemo(() => {
    if (suctionTemp === null || evapTemp === null) return null;
    if (!Number.isFinite(suctionTemp) || !Number.isFinite(evapTemp)) return null;
    const sh = suctionTemp - evapTemp;
    return Number(sh.toFixed(1));
  }, [suctionTemp, evapTemp]);

  const deltaSh = useMemo(() => {
    if (actualSh === null) return null;
    return Number((actualSh - targetSh).toFixed(1));
  }, [actualSh, targetSh]);

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
