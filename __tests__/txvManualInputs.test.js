import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  parseTxvNumericInput,
  barGaugeToAbsolute,
  barAbsoluteToGauge,
  calculateEvaporation,
  calculateSuperheat,
  calculateTxvRecommendation,
  calculateSubcooling,
  validateTxvInput,
  SUPERHEAT_STATUS,
  TXV_VALIDATION_CODES,
} from '../src/domain/txv';
import { pressureToTemp, tempToPressure, DANFOSS_TXV_MODELS } from '../src/data/danfossData';
import { TxvInputsGrid } from '../src/components/TxvInputsGrid';
import { TxvResultPanel } from '../src/components/TxvResultPanel';
import { SimCondPanel } from '../src/components/SimCondPanel';
import { MaterialProvider } from '../src/components/SkeuoKit';

describe('Phase 4C: Manual Inputs, Pressure Units (barG/barA), and Interlock Hardening', () => {
  const valve = DANFOSS_TXV_MODELS.find((v) => v.id === 'T2_TE2') || {
    id: 'T2_TE2',
    name: 'Danfoss T2 / TE2',
    sensitivity: 1.2,
    maxTurns: 5,
  };

  beforeAll(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const renderWithMaterial = async (ui) => {
    return await render(
      <MaterialProvider themeMode="light">
        {ui}
      </MaterialProvider>
    );
  };

  // =========================================================================
  // 1. parseTxvNumericInput: Input rỗng, whitespace, 'abc', '0'
  // =========================================================================
  describe('parseTxvNumericInput', () => {
    it('returns null for empty string', () => {
      expect(parseTxvNumericInput('')).toBeNull();
    });

    it('returns null for whitespace-only strings', () => {
      expect(parseTxvNumericInput('   ')).toBeNull();
      expect(parseTxvNumericInput('\t\n')).toBeNull();
    });

    it('returns null for non-numeric strings (e.g., "abc")', () => {
      expect(parseTxvNumericInput('abc')).toBeNull();
      expect(parseTxvNumericInput('test123')).toBeNull();
    });

    it('returns null for incomplete typing states like "-", ".", "-."', () => {
      expect(parseTxvNumericInput('-')).toBeNull();
      expect(parseTxvNumericInput('.')).toBeNull();
      expect(parseTxvNumericInput('-.')).toBeNull();
      expect(parseTxvNumericInput('+')).toBeNull();
    });

    it('returns valid numeric 0 for string "0", "0.0", or number 0 (not treated as falsy/empty)', () => {
      expect(parseTxvNumericInput('0')).toBe(0);
      expect(parseTxvNumericInput('0.0')).toBe(0);
      expect(parseTxvNumericInput(0)).toBe(0);
    });

    it('parses valid negative and positive decimal numbers correctly', () => {
      expect(parseTxvNumericInput('-27.0')).toBe(-27);
      expect(parseTxvNumericInput('1.21')).toBe(1.21);
      expect(parseTxvNumericInput('6.0')).toBe(6);
    });

    it('clamps parsed values to specified min/max boundaries', () => {
      expect(parseTxvNumericInput('-150', { min: -100, max: 100 })).toBe(-100);
      expect(parseTxvNumericInput('150', { min: -100, max: 100 })).toBe(100);
    });

    it('handles null, undefined, NaN and Infinity safely', () => {
      expect(parseTxvNumericInput(null)).toBeNull();
      expect(parseTxvNumericInput(undefined)).toBeNull();
      expect(parseTxvNumericInput(NaN)).toBeNull();
      expect(parseTxvNumericInput(Infinity)).toBeNull();
    });
  });

  // =========================================================================
  // 2. barG <-> barA Pressure Conversions & CoolProp Verification
  // =========================================================================
  describe('Pressure units: barG (gauge) <-> barA (absolute)', () => {
    it('converts barG = 1.21 to approximately barA = 2.22 (+ 1.01325)', () => {
      const barG = 1.21;
      const barA = barGaugeToAbsolute(barG);
      // 1.21 + 1.01325 = 2.22325 -> rounded to 2 decimals is 2.22
      expect(barA).toBe(2.22);
    });

    it('converts barA = 2.22 back to barG = 1.21 (- 1.01325)', () => {
      const barA = 2.22;
      const barG = barAbsoluteToGauge(barA);
      // 2.22 - 1.01325 = 1.20675 -> rounded to 2 decimals is 1.21
      expect(barG).toBe(1.21);
    });

    it('calculates R404A saturation temperature from gauge pressure 1.21 barG to yield ~ -27°C to -28°C', () => {
      // 1. Convert gauge to absolute
      const barG = 1.21;
      const barA = barGaugeToAbsolute(barG);
      expect(barA).toBe(2.22);

      // 2. Query CoolProp saturation curve: 2.22 barA yields -27.8°C
      const tEvap = pressureToTemp(barA, 'R404A');
      expect(tEvap).toBe(-27.8);
      expect(tEvap).toBeGreaterThan(-29.0);
      expect(tEvap).toBeLessThan(-26.0);
    });

    it('calculateEvaporation handles source=pressure with pressureBarG', () => {
      const res = calculateEvaporation({
        source: 'pressure',
        pressureBarG: 1.21,
        refrigerantId: 'R404A',
      });

      expect(res.valid).toBe(true);
      expect(res.evapPressureBarA).toBe(2.22);
      expect(res.evapPressureBarG).toBe(1.21);
      expect(res.evapTempC).toBe(-27.8);
    });
  });

  // =========================================================================
  // 3. Null Inputs trigger missing_data and block recommendation
  // =========================================================================
  describe('Null input guarding in domain', () => {
    it('triggers MISSING_DATA when suctionTempC is null', () => {
      const sh = calculateSuperheat({
        suctionTempC: null,
        evapTempC: -27.0,
      });

      expect(sh.valid).toBe(false);
      expect(sh.superheatK).toBeNull();
      expect(sh.status).toBe(SUPERHEAT_STATUS.MISSING_DATA);

      const rec = calculateTxvRecommendation(sh.superheatK, 6.0, valve);
      expect(rec.allowed).toBe(false);
      expect(rec.turns).toBeNull();
      expect(rec.direction).toBe('NONE');
    });

    it('triggers MISSING_DATA when evapTempC is null', () => {
      const sh = calculateSuperheat({
        suctionTempC: -21.0,
        evapTempC: null,
      });

      expect(sh.valid).toBe(false);
      expect(sh.superheatK).toBeNull();
      expect(sh.status).toBe(SUPERHEAT_STATUS.MISSING_DATA);

      const rec = calculateTxvRecommendation(sh.superheatK, 6.0, valve);
      expect(rec.allowed).toBe(false);
      expect(rec.turns).toBeNull();
      expect(rec.direction).toBe('NONE');
    });

    it('blocks recommendation when targetSh is null or invalid', () => {
      const rec1 = calculateTxvRecommendation(6.0, null, valve);
      expect(rec1.allowed).toBe(false);
      expect(rec1.turns).toBeNull();

      const rec2 = calculateTxvRecommendation(6.0, 0, valve);
      expect(rec2.allowed).toBe(false);
      expect(rec2.turns).toBeNull();
    });
  });

  // =========================================================================
  // 4. Interlock UI & TxvResultPanel
  // =========================================================================
  describe('Interlock UI in TxvResultPanel', () => {
    it('displays ⚠️ KHÓA and no turns/direction when recommendation is blocked', async () => {
      const blockedRecommendation = {
        allowed: false,
        turns: null,
        turnsFraction: null,
        direction: 'NONE',
        status: 'sensor_offline',
        statusText: 'CẢM BIẾN T3 MẤT KẾT NỐI • KHÔNG THỂ ĐỀ XUẤT',
        reason: TXV_VALIDATION_CODES.T3_OFFLINE,
        heading: 'Không thể đề xuất điều chỉnh',
        text: 'Cảm biến T3 mất kết nối. Đề xuất điều chỉnh vít van bị khóa an toàn.',
      };

      const { getByTestId, queryByText } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={null}
          deltaSh={null}
          recommendation={blockedRecommendation}
          currentValve={valve}
        />
      );

      // Dial label shows ⚠️ KHÓA
      const dialLabel = getByTestId('dial-label');
      expect(dialLabel.props.children).toBe('⚠️ KHÓA');

      // Heading explains the block reason
      const heading = getByTestId('action-heading');
      expect(heading.props.children).toBe('Không thể đề xuất điều chỉnh');

      // Does not show rotation commands
      expect(queryByText(/CW/)).toBeNull();
      expect(queryByText(/CCW/)).toBeNull();
      expect(queryByText(/vòng/)).toBeNull();

      // Readouts show '--'
      const actualShEl = getByTestId('actual-sh-value');
      const deltaShEl = getByTestId('delta-sh-value');
      expect(actualShEl.props.children).toBe('--');
      expect(deltaShEl.props.children).toBe('--');
    });

    it('blocks dial and does not show turns when physical anomaly SH < -5K occurs', async () => {
      const anomalyRecommendation = calculateTxvRecommendation(-6.0, 6.0, valve);
      expect(anomalyRecommendation.allowed).toBe(false);
      expect(anomalyRecommendation.turns).toBeNull();

      const { getByTestId } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={-6.0}
          deltaSh={-12.0}
          recommendation={anomalyRecommendation}
          currentValve={valve}
        />
      );

      const dialLabel = getByTestId('dial-label');
      expect(dialLabel.props.children).toBe('⚠️ KHÓA');

      const heading = getByTestId('action-heading');
      expect(heading.props.children).toContain('SH < -5K');
    });
  });

  // =========================================================================
  // 5. TxvInputsGrid: Label "bar g" and empty input rendering
  // =========================================================================
  describe('TxvInputsGrid UI labels and empty inputs', () => {
    const baseProps = {
      opMode: 'live',
      evapTemp: -27.0,
      evapPressure: 1.21,
      evapPressureBarG: 1.21,
      evapPressureBarA: 2.22,
      suctionTemp: -21.0,
      setSuctionTemp: jest.fn(),
      targetSh: 6.0,
      setTargetSh: jest.fn(),
      handleEvapTempChange: jest.fn(),
      handleEvapPressureChange: jest.fn(),
      liveT1: -22.7,
      liveT2: -30.1,
      liveT3: -19.9,
      tdValue: 7.0,
      evapSource: 't2',
      setEvapSource: jest.fn(),
      isAutoSyncSensors: true,
      setIsAutoSyncSensors: jest.fn(),
      themeMode: 'light',
    };

    it('displays unit label "bar g" and "bar g — áp kế" for pressure input', async () => {
      const { getByText, getByLabelText } = await renderWithMaterial(
        <TxvInputsGrid {...baseProps} />
      );

      expect(getByText('Áp suất bay hơi Pe (bar g — áp kế):')).toBeTruthy();
      expect(getByText('bar g')).toBeTruthy();
      expect(getByLabelText('Áp suất bay hơi, bar g')).toBeTruthy();
      expect(getByText('(~2.22 bar a tuyệt đối)')).toBeTruthy();
    });

    it('renders empty string in input when temperature is null (does NOT fall back to "0")', async () => {
      const { getByLabelText } = await renderWithMaterial(
        <TxvInputsGrid {...baseProps} suctionTemp={null} evapTemp={null} />
      );

      const suctionInput = getByLabelText('Nhiệt độ hơi hút, độ C');
      const evapInput = getByLabelText('Nhiệt độ bay hơi, độ C');

      expect(suctionInput.props.value).toBe('');
      expect(evapInput.props.value).toBe('');
    });

    it('renders "0" when temperature is explicitly 0 (0°C is valid)', async () => {
      const { getByLabelText } = await renderWithMaterial(
        <TxvInputsGrid {...baseProps} suctionTemp={0} evapTemp={0} />
      );

      const suctionInput = getByLabelText('Nhiệt độ hơi hút, độ C');
      const evapInput = getByLabelText('Nhiệt độ bay hơi, độ C');

      expect(suctionInput.props.value).toBe('0');
      expect(evapInput.props.value).toBe('0');
    });
  });

  // =========================================================================
  // 6. Subcooling isolation and SimCondPanel disclaimer
  // =========================================================================
  describe('Subcooling isolation & SimCondPanel simulation disclaimer', () => {
    it('verifies calculateSubcooling has ZERO influence on calculateTxvRecommendation', () => {
      // 1. Calculate standard recommendation with SH
      const recStandard = calculateTxvRecommendation(10.0, 6.0, valve);
      expect(recStandard.allowed).toBe(true);
      expect(recStandard.direction).toBe('CCW');
      expect(recStandard.turns).toBeGreaterThan(0);

      // 2. Calculate subcooling in low, high, flash gas regimes
      const scOptimal = calculateSubcooling({ condTempC: 40.0, liquidTempC: 35.0 });
      const scFlash = calculateSubcooling({ condTempC: 35.0, liquidTempC: 38.0 });
      const scHigh = calculateSubcooling({ condTempC: 50.0, liquidTempC: 30.0 });

      expect(scOptimal.status).toBe('optimal');
      expect(scFlash.status).toBe('flash_gas_risk');
      expect(scHigh.status).toBe('high');

      // 3. Re-calculate TXV recommendation - must be completely identical regardless of subcooling
      const recAfter = calculateTxvRecommendation(10.0, 6.0, valve);
      expect(recAfter.turns).toBe(recStandard.turns);
      expect(recAfter.direction).toBe(recStandard.direction);
    });

    it('SimCondPanel displays the simulation disclaimer text', async () => {
      const { getByText } = await renderWithMaterial(
        <SimCondPanel
          condTemp={40.0}
          setCondTemp={jest.fn()}
          currentRef={{ id: 'R404A' }}
          themeMode="light"
        />
      );

      expect(getByText('Mô phỏng ngưng tụ — chưa phải phép đo thực tế.')).toBeTruthy();
      expect(getByText('Cần cảm biến đường lỏng T_liquid và cảm biến áp suất cao P_cond.')).toBeTruthy();
    });
  });
});
