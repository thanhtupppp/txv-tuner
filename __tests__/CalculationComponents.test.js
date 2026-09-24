import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { TxvInputsGrid } from '../src/components/TxvInputsGrid';
import { SimCondPanel } from '../src/components/SimCondPanel';
import { TxvResultPanel } from '../src/components/TxvResultPanel';
import { MaterialProvider } from '../src/components/SkeuoKit';
import { THEME } from '../src/constants/theme';
import { tempToPressure, pressureToTemp } from '../src/data/danfossData';
import { calculateTxvRecommendation } from '../src/utils/txvRecommendation';

describe('Phase 3: Calculation & Business Logic Layer Tests', () => {
  const lightTheme = THEME.light;

  beforeAll(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const renderWithMaterial = async (ui, { themeMode = 'light', flat = false } = {}) => {
    return await render(
      <MaterialProvider themeMode={themeMode} flat={flat}>
        {ui}
      </MaterialProvider>
    );
  };

  // ==========================================================================
  // A. TxvInputsGrid Tests
  // ==========================================================================
  describe('TxvInputsGrid', () => {
    const defaultGridProps = {
      opMode: 'live',
      evapTemp: -27.0,
      evapPressure: 2.29,
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

    it('renders input values and converts evapTemp via CoolProp formula', async () => {
      // Direct CoolProp conversion verification for R404A:
      const pCalc = tempToPressure(-27.0, 'R404A');
      expect(pCalc).toBe(2.29);

      const tCalc = pressureToTemp(2.29, 'R404A');
      expect(tCalc).toBe(-26.9); // Converges to within 0.1°C of -27.0°C due to 2-decimal pressure rounding

      const { getByLabelText } = await renderWithMaterial(
        <TxvInputsGrid {...defaultGridProps} evapTemp={-27.0} evapPressure={pCalc} />
      );

      const tempInput = getByLabelText('Nhiệt độ bay hơi, độ C');
      const pressureInput = getByLabelText('Áp suất bay hơi, bar g');

      expect(tempInput.props.value).toBe('-27');
      expect(pressureInput.props.value).toBe('2.29');
    });

    it('locks evapTemp when in live mode with autoSync enabled', async () => {
      const { getByLabelText } = await renderWithMaterial(
        <TxvInputsGrid {...defaultGridProps} opMode="live" isAutoSyncSensors={true} />
      );

      const tempInput = getByLabelText('Nhiệt độ bay hơi, độ C');
      expect(tempInput.props.editable).toBe(false);
    });

    it('unlocks evapTemp when in manual mode or when autoSync is disabled', async () => {
      const { getByLabelText: getManual } = await renderWithMaterial(
        <TxvInputsGrid {...defaultGridProps} opMode="manual" isAutoSyncSensors={true} />
      );
      expect(getManual('Nhiệt độ bay hơi, độ C').props.editable).toBe(true);

      const { getByLabelText: getNoSync } = await renderWithMaterial(
        <TxvInputsGrid {...defaultGridProps} opMode="live" isAutoSyncSensors={false} />
      );
      expect(getNoSync('Nhiệt độ bay hơi, độ C').props.editable).toBe(true);
    });

    it('marks active evapSource chip with checkmark and responds to press', async () => {
      const mockSetSource = jest.fn();
      const { getByText } = await renderWithMaterial(
        <TxvInputsGrid {...defaultGridProps} evapSource="t2" setEvapSource={mockSetSource} />
      );

      // Active T2 chip has checkmark prefix
      expect(getByText(/✓ T2 \(-30\.1°C\)/)).toBeTruthy();

      // Pressing T1-TD chip calls setEvapSource
      const t1TdChip = getByText(/T1-TD/);
      fireEvent.press(t1TdChip);
      expect(mockSetSource).toHaveBeenCalledWith('t1_td');
    });

    it('shows checkmark ✓ on matching suctionTemp preset and updates on click', async () => {
      const mockSetSuction = jest.fn();
      const mockSetAutoSync = jest.fn();

      const { getByText } = await renderWithMaterial(
        <TxvInputsGrid
          {...defaultGridProps}
          suctionTemp={6.0}
          setSuctionTemp={mockSetSuction}
          setIsAutoSyncSensors={mockSetAutoSync}
        />
      );

      // Preset +6°C should have checkmark
      expect(getByText('✓ +6°C')).toBeTruthy();
      expect(getByText('-6°C')).toBeTruthy();
      expect(getByText('+18°C')).toBeTruthy();

      // Clicking -6°C preset
      fireEvent.press(getByText('-6°C'));
      expect(mockSetAutoSync).toHaveBeenCalledWith(false);
      expect(mockSetSuction).toHaveBeenCalledWith(-6);
    });

    it('safely handles boundary edge cases without NaN or crash', async () => {
      // Severe negative temperature (-100°C)
      const pMin = tempToPressure(-100, 'R404A');
      expect(pMin).toBeGreaterThan(0);
      expect(isFinite(pMin)).toBe(true);

      // High pressure boundary (40 bar)
      const tHigh = pressureToTemp(40, 'R404A');
      expect(isFinite(tHigh)).toBe(true);

      const { getByLabelText } = await renderWithMaterial(
        <TxvInputsGrid {...defaultGridProps} evapTemp={-100} evapPressure={pMin} />
      );
      expect(getByLabelText('Nhiệt độ bay hơi, độ C').props.value).toBe('-100');
    });
  });

  // ==========================================================================
  // B. SimCondPanel Tests
  // ==========================================================================
  describe('SimCondPanel', () => {
    it('disables decrement buttons and displays MIN limit tag at 20°C', async () => {
      const mockSetCond = jest.fn();
      const { getByLabelText, getByText, getByTestId } = await renderWithMaterial(
        <SimCondPanel condTemp={20} setCondTemp={mockSetCond} currentRef={{ id: 'R404A' }} />
      );

      const btnMinus5 = getByLabelText('Giảm 5 độ C');
      const btnMinus1 = getByLabelText('Giảm 1 độ C');
      const btnPlus1 = getByLabelText('Tăng 1 độ C');

      expect(btnMinus5.props.accessibilityState?.disabled).toBe(true);
      expect(btnMinus1.props.accessibilityState?.disabled).toBe(true);
      expect(btnPlus1.props.accessibilityState?.disabled).toBe(false);

      expect(getByText('MIN')).toBeTruthy();
      const limitLed = getByTestId('cond-limit-led', { includeHiddenElements: true });
      expect(StyleSheet.flatten(limitLed.props.style).backgroundColor).toBe(lightTheme.danger);
    });

    it('disables increment buttons and displays MAX limit tag at 65°C', async () => {
      const mockSetCond = jest.fn();
      const { getByLabelText, getByText, getByTestId } = await renderWithMaterial(
        <SimCondPanel condTemp={65} setCondTemp={mockSetCond} currentRef={{ id: 'R404A' }} />
      );

      const btnPlus5 = getByLabelText('Tăng 5 độ C');
      const btnPlus1 = getByLabelText('Tăng 1 độ C');
      const btnMinus1 = getByLabelText('Giảm 1 độ C');

      expect(btnPlus5.props.accessibilityState?.disabled).toBe(true);
      expect(btnPlus1.props.accessibilityState?.disabled).toBe(true);
      expect(btnMinus1.props.accessibilityState?.disabled).toBe(false);

      expect(getByText('MAX')).toBeTruthy();
      const limitLed = getByTestId('cond-limit-led', { includeHiddenElements: true });
      expect(StyleSheet.flatten(limitLed.props.style).backgroundColor).toBe(lightTheme.danger);
    });

    it('enables all buttons and hides limit tags at normal temperature 35°C', async () => {
      const { getByLabelText, queryByText, queryByTestId } = await renderWithMaterial(
        <SimCondPanel condTemp={35} setCondTemp={jest.fn()} currentRef={{ id: 'R404A' }} />
      );

      expect(getByLabelText('Giảm 5 độ C').props.accessibilityState?.disabled).toBe(false);
      expect(getByLabelText('Tăng 5 độ C').props.accessibilityState?.disabled).toBe(false);
      expect(queryByText('MIN')).toBeNull();
      expect(queryByText('MAX')).toBeNull();
      expect(queryByTestId('cond-limit-led')).toBeNull();
    });

    it('triggers temperature adjustment callback on button press', async () => {
      const mockSetCond = jest.fn();
      const { getByLabelText } = await renderWithMaterial(
        <SimCondPanel condTemp={35} setCondTemp={mockSetCond} currentRef={{ id: 'R404A' }} />
      );

      fireEvent.press(getByLabelText('Tăng 5 độ C'));
      expect(mockSetCond).toHaveBeenCalledTimes(1);

      // Verify the updater function clamps within [20, 65]
      const updater = mockSetCond.mock.calls[0][0];
      expect(updater(35)).toBe(40);
      expect(updater(64)).toBe(65); // clamped to 65
    });
  });

  // ==========================================================================
  // C. TxvResultPanel Tests
  // ==========================================================================
  describe('TxvResultPanel', () => {
    const valveTE5 = { id: 'TE5', name: 'Danfoss TE5', sensitivity: 0.5, maxTurns: 8 };

    it('shows "TỐI ƯU", OK dial, and no arrow when actualSh=5.8, targetSh=6.0 (delta=-0.2K)', async () => {
      const rec = calculateTxvRecommendation(5.8, 6.0, valveTE5);
      expect(rec.status).toBe('optimal');
      expect(rec.direction).toBe('NONE');
      expect(rec.turns).toBe(0);

      const { getByTestId, getByText, queryByText } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={5.8}
          deltaSh={-0.2}
          recommendation={rec}
          currentValve={valveTE5}
        />
      );

      expect(getByTestId('status-badge')).toBeTruthy();
      expect(getByText(rec.statusText)).toBeTruthy();
      expect(getByTestId('actual-sh-value').props.children).toBe('5.8');
      expect(getByTestId('delta-sh-value').props.children).toBe('-0.2');

      expect(getByTestId('dial-label').props.children).toBe('✓ OK');
      expect(getByText('Độ quá nhiệt đã chuẩn tối ưu!')).toBeTruthy();
      expect(queryByText('↻ CW')).toBeNull();
      expect(queryByText('↺ CCW')).toBeNull();
    });

    it('shows "QUÁ NHIỆT THẤP" and CW arrow when actualSh=4.0, targetSh=6.0', async () => {
      const rec = calculateTxvRecommendation(4.0, 6.0, valveTE5);
      expect(rec.status).toBe('low');
      expect(rec.direction).toBe('CW');
      expect(rec.turns).toBe(4);
      expect(rec.turnsFraction).toBe('4.00 vòng');

      const { getByTestId, getByText } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={4.0}
          deltaSh={-2.0}
          recommendation={rec}
          currentValve={valveTE5}
        />
      );

      expect(getByText(rec.statusText)).toBeTruthy();
      expect(getByTestId('dial-label').props.children).toBe('↻ CW');
      expect(getByText(/👉 Xoay 4\.00 vòng CÙNG chiều kim đồng hồ \(CW\)/)).toBeTruthy();
    });

    it('shows "QUÁ NHIỆT CAO" and CCW arrow when actualSh=8.0, targetSh=6.0', async () => {
      const rec = calculateTxvRecommendation(8.0, 6.0, valveTE5);
      expect(rec.status).toBe('high');
      expect(rec.direction).toBe('CCW');
      expect(rec.turns).toBe(4);
      expect(rec.turnsFraction).toBe('4.00 vòng');

      const { getByTestId, getByText } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={8.0}
          deltaSh={2.0}
          recommendation={rec}
          currentValve={valveTE5}
        />
      );

      expect(getByText(rec.statusText)).toBeTruthy();
      expect(getByTestId('dial-label').props.children).toBe('↺ CCW');
      expect(getByText(/👉 Xoay 4\.00 vòng NGƯỢC chiều kim đồng hồ \(CCW\)/)).toBeTruthy();
    });

    it('correctly calculates turns for sensitivity=1.2 (Danfoss T2/TE2)', async () => {
      const valveT2 = { id: 'T2_TE2', name: 'Danfoss T2 / TE2', sensitivity: 1.2, maxTurns: 6 };
      // delta = 2.4K -> turns = 2.4 / 1.2 = 2.00 vòng
      const rec = calculateTxvRecommendation(8.4, 6.0, valveT2);
      expect(rec.turns).toBe(2);
      expect(rec.turnsFraction).toBe('2.00 vòng');
      expect(rec.direction).toBe('CCW');

      const { getByText } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={8.4}
          deltaSh={2.4}
          recommendation={rec}
          currentValve={valveT2}
        />
      );

      expect(getByText(/👉 Xoay 2\.00 vòng NGƯỢC chiều kim đồng hồ \(CCW\)/)).toBeTruthy();
    });

    it('renders animated screw dial container and respects reducedEffects', async () => {
      const rec = calculateTxvRecommendation(4.0, 6.0, valveTE5);
      const { getByTestId } = await renderWithMaterial(
        <TxvResultPanel
          actualSh={4.0}
          deltaSh={-2.0}
          recommendation={rec}
          currentValve={valveTE5}
        />,
        { flat: true }
      );

      const animatedDial = getByTestId('screw-dial-animated');
      expect(animatedDial).toBeTruthy();
      expect(animatedDial.props.style).toEqual(
        expect.objectContaining({
          transform: expect.any(Array),
        })
      );
    });
  });
});
