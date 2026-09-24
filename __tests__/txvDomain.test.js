import {
  calculateSuperheat,
  SUPERHEAT_STATUS,
  calculateEvaporation,
  barGaugeToAbsolute,
  barAbsoluteToGauge,
  calculateTxvRecommendation,
  calculateSubcooling,
  SUBCOOLING_STATUS,
  validateTxvInput,
  TXV_VALIDATION_CODES,
} from '../src/domain/txv';
import { DANFOSS_TXV_MODELS } from '../src/data/danfossData';

describe('Phase 4B: TXV Pure Domain Logic Tests', () => {
  const valveT2 = DANFOSS_TXV_MODELS.find((v) => v.id === 'T2_TE2') || {
    id: 'T2_TE2',
    name: 'Danfoss T2 / TE2',
    sensitivity: 1.2,
    maxTurns: 5,
  };

  const valveTE5 = DANFOSS_TXV_MODELS.find((v) => v.id === 'TE5') || {
    id: 'TE5',
    name: 'Danfoss TE5',
    sensitivity: 0.5,
    maxTurns: 8,
  };

  // =========================================================================
  // 1. calculateSuperheat Tests
  // =========================================================================
  describe('calculateSuperheat', () => {
    it('calculates optimal superheat when within tolerance', () => {
      // SH = -21.0 - (-27.0) = 6.0K, target = 6.0K
      const res = calculateSuperheat({
        suctionTempC: -21.0,
        evapTempC: -27.0,
        targetShK: 6.0,
        toleranceK: 0.4,
      });

      expect(res.valid).toBe(true);
      expect(res.superheatK).toBe(6.0);
      expect(res.deltaShK).toBe(0.0);
      expect(res.isWithinTolerance).toBe(true);
      expect(res.status).toBe(SUPERHEAT_STATUS.OPTIMAL);
      expect(res.statusText).toBe('ĐẠT CHUẨN DANFOSS');
    });

    it('calculates low superheat (< 4.0K)', () => {
      // SH = -24.0 - (-27.0) = 3.0K
      const res = calculateSuperheat({
        suctionTempC: -24.0,
        evapTempC: -27.0,
        targetShK: 6.0,
      });

      expect(res.valid).toBe(true);
      expect(res.superheatK).toBe(3.0);
      expect(res.deltaShK).toBe(-3.0);
      expect(res.isWithinTolerance).toBe(false);
      expect(res.status).toBe(SUPERHEAT_STATUS.LOW);
      expect(res.statusText).toContain('QUÁ NHIỆT THẤP');
    });

    it('calculates high superheat (> 8.0K)', () => {
      // SH = -15.0 - (-27.0) = 12.0K
      const res = calculateSuperheat({
        suctionTempC: -15.0,
        evapTempC: -27.0,
        targetShK: 6.0,
      });

      expect(res.valid).toBe(true);
      expect(res.superheatK).toBe(12.0);
      expect(res.deltaShK).toBe(6.0);
      expect(res.status).toBe(SUPERHEAT_STATUS.HIGH);
      expect(res.statusText).toContain('QUÁ NHIỆT CAO');
    });

    it('returns missing_data when either temperature is null or invalid', () => {
      expect(calculateSuperheat({ suctionTempC: null, evapTempC: -27.0 }).valid).toBe(false);
      expect(calculateSuperheat({ suctionTempC: -21.0, evapTempC: null }).valid).toBe(false);
      expect(calculateSuperheat({ suctionTempC: NaN, evapTempC: -27.0 }).valid).toBe(false);
      expect(calculateSuperheat({ suctionTempC: -21.0, evapTempC: Infinity }).status).toBe(
        SUPERHEAT_STATUS.MISSING_DATA,
      );
    });

    it('flags physical anomaly when SH < -5.0K (safety heuristic)', () => {
      // SH = -33.0 - (-27.0) = -6.0K
      const res = calculateSuperheat({
        suctionTempC: -33.0,
        evapTempC: -27.0,
        targetShK: 6.0,
      });

      expect(res.valid).toBe(false);
      expect(res.superheatK).toBe(-6.0);
      expect(res.status).toBe(SUPERHEAT_STATUS.PHYSICAL_ANOMALY);
      expect(res.statusText).toContain('BẤT THƯỜNG NHIỆT ĐỘ');
    });
  });

  // =========================================================================
  // 2. calculateEvaporation Tests
  // =========================================================================
  describe('calculateEvaporation', () => {
    it('converts bar gauge to bar absolute and vice versa', () => {
      const barG = 2.0;
      const barA = barGaugeToAbsolute(barG);
      expect(barA).toBe(3.01); // 2.0 + 1.01325 rounded to 2 decimals

      const backToG = barAbsoluteToGauge(barA);
      expect(backToG).toBe(2.0);
    });

    it('calculates evap from T2 source', () => {
      const res = calculateEvaporation({
        source: 't2',
        t2C: -27.0,
        refrigerantId: 'R404A',
      });

      expect(res.valid).toBe(true);
      expect(res.evapTempC).toBe(-27.0);
      expect(res.evapPressureBarA).toBeGreaterThan(2.0);
      expect(res.evapPressureBarG).toBeGreaterThan(1.0);
    });

    it('returns error when T2 source has invalid T2', () => {
      const res = calculateEvaporation({
        source: 't2',
        t2C: null,
      });

      expect(res.valid).toBe(false);
      expect(res.error).toBe('T2_INVALID');
      expect(res.evapTempC).toBeNull();
    });

    it('calculates evap from T1 - TD source', () => {
      const res = calculateEvaporation({
        source: 't1_td',
        t1C: -20.0,
        tdK: 7.0,
        refrigerantId: 'R404A',
      });

      expect(res.valid).toBe(true);
      expect(res.evapTempC).toBe(-27.0); // -20 - 7 = -27
      expect(res.evapPressureBarA).toBeGreaterThan(2.0);
    });

    it('calculates evap from pressureBarA source', () => {
      const res = calculateEvaporation({
        source: 'pressure',
        pressureBarA: 2.29,
        refrigerantId: 'R404A',
      });

      expect(res.valid).toBe(true);
      expect(res.evapTempC).toBeCloseTo(-26.9, 1);
      expect(res.evapPressureBarA).toBe(2.29);
    });

    it('calculates evap from pressureBarG source with explicit gauge conversion', () => {
      // 1.28 barg = ~2.29 bara
      const res = calculateEvaporation({
        source: 'pressure',
        pressureBarG: 1.28,
        refrigerantId: 'R404A',
      });

      expect(res.valid).toBe(true);
      expect(res.evapPressureBarA).toBe(2.29);
      expect(res.evapTempC).toBeCloseTo(-26.9, 1);
    });

    it('returns error when pressure <= 0 or invalid', () => {
      expect(calculateEvaporation({ source: 'pressure', pressureBarA: 0 }).valid).toBe(false);
      expect(calculateEvaporation({ source: 'pressure', pressureBarA: -1.0 }).valid).toBe(false);
      expect(calculateEvaporation({ source: 'pressure', pressureBarA: null }).valid).toBe(false);
    });
  });

  // =========================================================================
  // 3. calculateTxvRecommendation Tests
  // =========================================================================
  describe('calculateTxvRecommendation', () => {
    it('returns allowed: false and turns: null when interlock is blocked', () => {
      const interlock = {
        allowed: false,
        status: 'sensor_offline',
        statusText: 'CẢM BIẾN T3 MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
        reason: TXV_VALIDATION_CODES.T3_OFFLINE,
      };

      const res = calculateTxvRecommendation(15.0, 6.0, valveTE5, interlock);
      expect(res.allowed).toBe(false);
      expect(res.turns).toBeNull();
      expect(res.turnsFraction).toBeNull();
      expect(res.direction).toBe('NONE');
      expect(res.status).toBe('sensor_offline');
      expect(res.reason).toBe(TXV_VALIDATION_CODES.T3_OFFLINE);
    });

    it('blocks recommendation when targetSh is invalid (<= 0 or not finite)', () => {
      expect(calculateTxvRecommendation(6.0, 0, valveTE5).allowed).toBe(false);
      expect(calculateTxvRecommendation(6.0, -2, valveTE5).allowed).toBe(false);
      expect(calculateTxvRecommendation(6.0, NaN, valveTE5).allowed).toBe(false);
    });

    it('blocks recommendation when valve is missing or has invalid sensitivity', () => {
      expect(calculateTxvRecommendation(6.0, 6.0, null).allowed).toBe(false);
      expect(calculateTxvRecommendation(6.0, 6.0, { sensitivity: 0 }).allowed).toBe(false);
    });

    it('calculates CW turns for low superheat clamped to maxTurns with 0.25 increment', () => {
      // diff = 4.0 - 6.0 = -2.0K, sensitivity = 0.5 -> rawTurns = 4.00
      const res = calculateTxvRecommendation(4.0, 6.0, valveTE5);
      expect(res.allowed).toBe(true);
      expect(res.direction).toBe('CW');
      expect(res.turns).toBe(4);
      expect(res.turnsFraction).toBe('4.00 vòng');
      expect(res.status).toBe('low');
    });

    it('calculates CCW turns for high superheat clamped to valve maxTurns', () => {
      // Valve T2 has maxTurns = 5, sensitivity = 1.2
      // diff = 18.0 - 6.0 = 12.0K -> raw = 10 turns -> clamped to 5
      const res = calculateTxvRecommendation(18.0, 6.0, valveT2);
      expect(res.allowed).toBe(true);
      expect(res.direction).toBe('CCW');
      expect(res.turns).toBe(5);
      expect(res.status).toBe('high');
    });
  });

  // =========================================================================
  // 4. calculateSubcooling Tests
  // =========================================================================
  describe('calculateSubcooling', () => {
    it('calculates optimal subcooling (SC = T_cond - T_liquid)', () => {
      // T_cond = 40.0°C, T_liquid = 35.0°C -> SC = 5.0K
      const res = calculateSubcooling({
        condTempC: 40.0,
        liquidTempC: 35.0,
      });

      expect(res.valid).toBe(true);
      expect(res.subcoolingK).toBe(5.0);
      expect(res.deltaScK).toBe(1.0); // 5.0 - 4.0 target
      expect(res.isWithinTolerance).toBe(true);
      expect(res.status).toBe(SUBCOOLING_STATUS.OPTIMAL);
      expect(res.statusText).toBe('QUÁ LẠNH TỐI ƯU');
    });

    it('detects flash gas risk when subcooling is negative (T_liquid > T_cond)', () => {
      // T_cond = 35.0°C, T_liquid = 38.0°C -> SC = -3.0K
      const res = calculateSubcooling({
        condTempC: 35.0,
        liquidTempC: 38.0,
      });

      expect(res.valid).toBe(true);
      expect(res.subcoolingK).toBe(-3.0);
      expect(res.status).toBe(SUBCOOLING_STATUS.FLASH_GAS_RISK);
      expect(res.statusText).toContain('FLASH GAS');
    });

    it('detects low subcooling (< 2.0K)', () => {
      const res = calculateSubcooling({
        condTempC: 40.0,
        liquidTempC: 39.0, // SC = 1.0K
      });

      expect(res.valid).toBe(true);
      expect(res.subcoolingK).toBe(1.0);
      expect(res.status).toBe(SUBCOOLING_STATUS.LOW);
    });

    it('detects high subcooling (> 7.0K)', () => {
      const res = calculateSubcooling({
        condTempC: 45.0,
        liquidTempC: 35.0, // SC = 10.0K
      });

      expect(res.valid).toBe(true);
      expect(res.subcoolingK).toBe(10.0);
      expect(res.status).toBe(SUBCOOLING_STATUS.HIGH);
    });

    it('returns missing_data when liquidTempC or condTempC is missing', () => {
      expect(calculateSubcooling({ condTempC: 40.0, liquidTempC: null }).valid).toBe(false);
      expect(calculateSubcooling({ condTempC: null, liquidTempC: 35.0 }).valid).toBe(false);
    });

    it('derives condTempC from condPressureBarA if condTempC is not provided', () => {
      // R404A at 18.2 bar absolute corresponds to ~40°C
      const res = calculateSubcooling({
        condPressureBarA: 18.2,
        liquidTempC: 35.0,
        refrigerantId: 'R404A',
      });

      expect(res.valid).toBe(true);
      expect(res.subcoolingK).toBeCloseTo(4.7, 0);
    });
  });
});
