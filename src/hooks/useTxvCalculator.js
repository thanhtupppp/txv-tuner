import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  REFRIGERANTS,
  DANFOSS_TXV_MODELS,
  pressureToTemp,
  tempToPressure
} from '../data/danfossData';
import { TXV_CONFIG } from '../constants/txvConfig';

/**
 * Custom Hook quản lý toàn bộ logic tính toán nhiệt động lực học và quá nhiệt van Danfoss TXV
 */
export function useTxvCalculator(liveT1, liveT2, liveT3, isOnline) {
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

  // Giới hạn giá trị nhiệt độ an toàn (-100°C đến 100°C)
  const clampTemp = useCallback((temp, defaultVal = 0) => {
    if (temp === null || temp === undefined || isNaN(temp)) return defaultVal;
    const num = Number(temp);
    if (!isFinite(num)) return defaultVal;
    return Math.max(TXV_CONFIG.temperatureMinC, Math.min(TXV_CONFIG.temperatureMaxC, num));
  }, []);

  // Xử lý chuyển đổi nguồn tính T_evap
  const handleSetEvapSource = useCallback((source) => {
    setEvapSource(source);
    if (source === 't2') {
      const t2 = clampTemp(liveT2, TXV_CONFIG.defaultEvapTempC);
      const calculatedEvapT = Number(t2.toFixed(1));
      setEvapTemp(calculatedEvapT);
      try {
        setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
      } catch (err) {
        // ignore
      }
    } else if (source === 't1_td') {
      const t1 = clampTemp(liveT1, TXV_CONFIG.defaultRoomTempC);
      const calculatedEvapT = Number((t1 - tdValue).toFixed(1));
      setEvapTemp(calculatedEvapT);
      try {
        setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
      } catch (err) {
        // ignore
      }
    } else if (source === 'pressure') {
      try {
        const calculatedEvapT = Number(pressureToTemp(evapPressure, selectedRefId).toFixed(1));
        setEvapTemp(calculatedEvapT);
      } catch (err) {
        // ignore
      }
    }
  }, [liveT1, liveT2, tdValue, selectedRefId, evapPressure, clampTemp]);

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

    if (isAutoSyncSensors && liveT3 !== null && liveT3 !== undefined) {
      setSuctionTemp(Number(Number(liveT3).toFixed(1)));
    } else if (!isAutoSyncSensors) {
      // Giữ nguyên giá trị người dùng nhập
    } else {
      setSuctionTemp(Number((calculatedEvapT + targetSh).toFixed(1)));
    }
  }, [selectedRefId, tdValue, targetSh, isAutoSyncSensors, liveT3]);

  // Tự động đồng bộ với cảm biến thời gian thực
  useEffect(() => {
    if (opMode === 'live' && isAutoSyncSensors) {
      const t1 = clampTemp(liveT1, TXV_CONFIG.liveFallbackT1C);
      const t2 = clampTemp(liveT2, t1 - tdValue);
      const t3 = clampTemp(liveT3, TXV_CONFIG.liveFallbackT3C);

      let calculatedEvapT;
      if (evapSource === 't2') {
        calculatedEvapT = Number(t2.toFixed(1));
      } else if (evapSource === 't1_td') {
        calculatedEvapT = Number((t1 - tdValue).toFixed(1));
      } else if (evapSource === 'pressure') {
        try {
          calculatedEvapT = Number(pressureToTemp(evapPressure, selectedRefId).toFixed(1));
        } catch {
          calculatedEvapT = Number((t1 - tdValue).toFixed(1));
        }
      }

      setEvapTemp(calculatedEvapT);

      if (evapSource !== 'pressure') {
        try {
          setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
        } catch (error) {
          setEvapPressure(0);
        }
      }

      setSuctionTemp(Number(t3.toFixed(1)));
    } else if (opMode === 'target_room') {
      const calculatedEvapT = Number((targetRoomTemp - tdValue).toFixed(1));
      setEvapTemp(calculatedEvapT);

      try {
        setEvapPressure(tempToPressure(calculatedEvapT, selectedRefId));
      } catch (error) {
        setEvapPressure(0);
      }

      if (isAutoSyncSensors && liveT3 !== null && liveT3 !== undefined) {
        setSuctionTemp(Number(Number(liveT3).toFixed(1)));
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
    clampTemp
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

  // Memoized objects
  const currentRef = useMemo(
    () => REFRIGERANTS.find((r) => r.id === selectedRefId) || REFRIGERANTS[0],
    [selectedRefId]
  );

  const currentValve = useMemo(
    () => DANFOSS_TXV_MODELS.find((v) => v.id === selectedValveId) || DANFOSS_TXV_MODELS[0],
    [selectedValveId]
  );

  const actualSh = useMemo(() => {
    const sh = suctionTemp - evapTemp;
    return Number(sh.toFixed(1));
  }, [suctionTemp, evapTemp]);

  const deltaSh = useMemo(() => {
    return Number((actualSh - targetSh).toFixed(1));
  }, [actualSh, targetSh]);

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
    deltaSh
  };
}
