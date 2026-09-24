import { renderHook, act } from '@testing-library/react-native';
import {
  validateTxvInput,
  isValidTemperature,
  TXV_VALIDATION_CODES,
} from '../src/domain/txv/validateTxvInput';
import { calculateTxvRecommendation } from '../src/utils/txvRecommendation';
import { useTxvCalculator } from '../src/hooks/useTxvCalculator';
import { DANFOSS_TXV_MODELS } from '../src/data/danfossData';

describe('Phase 4A: TXV Sensor Interlock & Recommendation Safety Tests', () => {
  const valveTE5 = DANFOSS_TXV_MODELS.find((v) => v.id === 'TE5') || {
    id: 'TE5',
    name: 'Danfoss TE5',
    sensitivity: 0.5,
    maxTurns: 8,
  };

  describe('validateTxvInput - Pure Validator', () => {
    it('blocks recommendation when valve is missing', () => {
      const result = validateTxvInput({ valve: null });
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('error');
      expect(result.reason).toBe(TXV_VALIDATION_CODES.VALVE_MISSING);
    });

    it('blocks recommendation when ESP32 is offline', () => {
      const result = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: false,
        liveT1: 25.0,
        liveT2: -25.0,
        liveT3: -19.0,
        valve: valveTE5,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe('sensor_offline');
      expect(result.reason).toBe(TXV_VALIDATION_CODES.ESP32_OFFLINE);
    });

    it('blocks recommendation when T3 (bầu TXV) is null / offline', () => {
      const result = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 't2',
        liveT1: 25.0,
        liveT2: -25.0,
        liveT3: null, // Cảm biến T3 đứt dây
        valve: valveTE5,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe('sensor_offline');
      expect(result.reason).toBe(TXV_VALIDATION_CODES.T3_OFFLINE);
      expect(result.message).toContain('T3');
    });

    it('blocks recommendation when T3 is NaN or Infinity', () => {
      expect(
        validateTxvInput({
          opMode: 'live',
          isAutoSyncSensors: true,
          liveT3: NaN,
          liveT2: -25.0,
          valve: valveTE5,
        }).reason,
      ).toBe(TXV_VALIDATION_CODES.T3_OFFLINE);

      expect(
        validateTxvInput({
          opMode: 'live',
          isAutoSyncSensors: true,
          liveT3: Infinity,
          liveT2: -25.0,
          valve: valveTE5,
        }).reason,
      ).toBe(TXV_VALIDATION_CODES.T3_OFFLINE);
    });

    it('blocks recommendation when evapSource=t2 and T2 is offline', () => {
      const result = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 't2',
        liveT1: 25.0,
        liveT2: null, // T2 offline
        liveT3: -19.0,
        valve: valveTE5,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe('sensor_offline');
      expect(result.reason).toBe(TXV_VALIDATION_CODES.T2_OFFLINE);
    });

    it('blocks recommendation when evapSource=t1_td and T1 is offline', () => {
      const result = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 't1_td',
        liveT1: null, // T1 offline
        liveT2: -25.0,
        liveT3: -19.0,
        valve: valveTE5,
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe('sensor_offline');
      expect(result.reason).toBe(TXV_VALIDATION_CODES.T1_OFFLINE);
    });

    it('blocks recommendation when evapSource=pressure and pressure <= 0 or invalid', () => {
      const resultZero = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 'pressure',
        evapPressure: 0,
        liveT3: -19.0,
        valve: valveTE5,
      });

      expect(resultZero.allowed).toBe(false);
      expect(resultZero.status).toBe('invalid_input');
      expect(resultZero.reason).toBe(TXV_VALIDATION_CODES.INVALID_PRESSURE);

      const resultNegative = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 'pressure',
        evapPressure: -1.5,
        liveT3: -19.0,
        valve: valveTE5,
      });
      expect(resultNegative.allowed).toBe(false);
      expect(resultNegative.reason).toBe(TXV_VALIDATION_CODES.INVALID_PRESSURE);
    });

    it('allows recommendation when all required sensors are online and valid', () => {
      const resultT2 = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 't2',
        liveT2: -27.0,
        liveT3: -21.0,
        valve: valveTE5,
      });

      expect(resultT2.allowed).toBe(true);
      expect(resultT2.status).toBe('ok');
      expect(resultT2.reason).toBe(TXV_VALIDATION_CODES.OK);

      const resultT1Td = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 't1_td',
        liveT1: -20.0,
        liveT3: -21.0,
        valve: valveTE5,
      });

      expect(resultT1Td.allowed).toBe(true);

      const resultPressure = validateTxvInput({
        opMode: 'live',
        isAutoSyncSensors: true,
        isOnline: true,
        evapSource: 'pressure',
        evapPressure: 2.29,
        liveT3: -21.0,
        valve: valveTE5,
      });

      expect(resultPressure.allowed).toBe(true);
    });

    it('validates manual mode inputs properly', () => {
      const invalidSuction = validateTxvInput({
        opMode: 'manual',
        isAutoSyncSensors: false,
        suctionTemp: null,
        evapTemp: -27.0,
        valve: valveTE5,
      });
      expect(invalidSuction.allowed).toBe(false);
      expect(invalidSuction.reason).toBe(TXV_VALIDATION_CODES.INVALID_SUCTION_TEMP);

      const invalidEvap = validateTxvInput({
        opMode: 'manual',
        isAutoSyncSensors: false,
        suctionTemp: -21.0,
        evapTemp: null,
        valve: valveTE5,
      });
      expect(invalidEvap.allowed).toBe(false);
      expect(invalidEvap.reason).toBe(TXV_VALIDATION_CODES.INVALID_EVAP_TEMP);

      const validManual = validateTxvInput({
        opMode: 'manual',
        isAutoSyncSensors: false,
        suctionTemp: -21.0,
        evapTemp: -27.0,
        valve: valveTE5,
      });
      expect(validManual.allowed).toBe(true);
    });
  });

  describe('calculateTxvRecommendation - Interlock Integration', () => {
    it('returns allowed: false and turns: null (never 0) when interlock is blocked', () => {
      const blockedInterlock = {
        allowed: false,
        status: 'sensor_offline',
        statusText: 'CẢM BIẾN T3 MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
        reason: TXV_VALIDATION_CODES.T3_OFFLINE,
        message: 'T3 offline',
      };

      const result = calculateTxvRecommendation(15.0, 6.0, valveTE5, blockedInterlock);

      expect(result.allowed).toBe(false);
      expect(result.turns).toBeNull();
      expect(result.turnsFraction).toBeNull();
      expect(result.direction).toBe('NONE');
      expect(result.status).toBe('sensor_offline');
      expect(result.reason).toBe(TXV_VALIDATION_CODES.T3_OFFLINE);
      expect(result.statusText).toContain('CẢM BIẾN T3 MẤT KẾT NỐI');
    });

    it('returns allowed: false and turns: null when actualSh is null or NaN', () => {
      const resultNull = calculateTxvRecommendation(null, 6.0, valveTE5);
      expect(resultNull.allowed).toBe(false);
      expect(resultNull.turns).toBeNull();
      expect(resultNull.status).toBe('invalid_input');

      const resultNaN = calculateTxvRecommendation(NaN, 6.0, valveTE5);
      expect(resultNaN.allowed).toBe(false);
      expect(resultNaN.turns).toBeNull();
    });

    it('blocks recommendation when actualSh < -5.0K (severe physical anomaly)', () => {
      const anomalyResult = calculateTxvRecommendation(-7.0, 6.0, valveTE5);

      expect(anomalyResult.allowed).toBe(false);
      expect(anomalyResult.turns).toBeNull();
      expect(anomalyResult.status).toBe('physical_anomaly');
      expect(anomalyResult.reason).toBe(TXV_VALIDATION_CODES.PHYSICAL_ANOMALY_NEGATIVE_SH);
      expect(anomalyResult.statusText).toContain('BẤT THƯỜNG NHIỆT ĐỘ');
    });

    it('preserves backward-compatible normal calculation when inputs are valid', () => {
      // Optimal: 5.8K vs 6.0K
      const optimal = calculateTxvRecommendation(5.8, 6.0, valveTE5);
      expect(optimal.allowed).toBe(true);
      expect(optimal.turns).toBe(0);
      expect(optimal.direction).toBe('NONE');
      expect(optimal.status).toBe('optimal');

      // Low: 4.0K vs 6.0K -> CW
      const low = calculateTxvRecommendation(4.0, 6.0, valveTE5);
      expect(low.allowed).toBe(true);
      expect(low.turns).toBe(4);
      expect(low.direction).toBe('CW');
      expect(low.status).toBe('low');

      // High: 8.0K vs 6.0K -> CCW
      const high = calculateTxvRecommendation(8.0, 6.0, valveTE5);
      expect(high.allowed).toBe(true);
      expect(high.turns).toBe(4);
      expect(high.direction).toBe('CCW');
      expect(high.status).toBe('high');
    });
  });

  describe('useTxvCalculator Hook - No Static Fallback in Recommendation Path', () => {
    it('sets suctionTemp, actualSh and deltaSh to null when liveT3 is offline', async () => {
      const { result } = await renderHook(() =>
        useTxvCalculator(-20.0, -27.0, null, true),
      );

      // KHÔNG ĐƯỢC dùng fallback tĩnh -12.0°C!
      expect(result.current.suctionTemp).toBeNull();
      expect(result.current.actualSh).toBeNull();
      expect(result.current.deltaSh).toBeNull();
      expect(result.current.interlock.allowed).toBe(false);
      expect(result.current.interlock.reason).toBe(TXV_VALIDATION_CODES.T3_OFFLINE);
    });

    it('sets evapTemp, actualSh and deltaSh to null when evapSource=t2 and liveT2 is offline', async () => {
      const { result } = await renderHook(() =>
        useTxvCalculator(-20.0, null, -21.0, true),
      );

      expect(result.current.evapTemp).toBeNull();
      expect(result.current.actualSh).toBeNull();
      expect(result.current.deltaSh).toBeNull();
      expect(result.current.interlock.allowed).toBe(false);
      expect(result.current.interlock.reason).toBe(TXV_VALIDATION_CODES.T2_OFFLINE);
    });

    it('computes valid actualSh and provides allowed interlock when all sensors are live and valid', async () => {
      const { result } = await renderHook(() =>
        useTxvCalculator(-20.0, -27.0, -21.0, true),
      );

      expect(result.current.evapTemp).toBe(-27.0);
      expect(result.current.suctionTemp).toBe(-21.0);
      expect(result.current.actualSh).toBe(6.0); // -21 - (-27) = 6.0K
      expect(result.current.deltaSh).toBe(0.0);
      expect(result.current.interlock.allowed).toBe(true);
      expect(result.current.interlock.status).toBe('ok');
    });
  });
});
