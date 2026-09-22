import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import DefaultMonitorScreen, { MonitorScreen } from '../src/screens/MonitorScreen';
import DefaultTxvTunerScreen, { TxvTunerScreen } from '../src/screens/TxvTunerScreen';
import App from '../App';
import { MaterialProvider } from '../src/components/SkeuoKit';
import { THEME } from '../src/constants/theme';
import * as txvCalcHook from '../src/hooks/useTxvCalculator';

describe('Phase 4: Screen Integration & End-to-End Tests', () => {
  const lightTheme = THEME.light;

  const hexToSvgPayload = (hex) => {
    const cleanHex = hex.replace('#', '');
    return (0xFF000000 | parseInt(cleanHex, 16)) >>> 0;
  };

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
  // A. MonitorScreen Integration Tests
  // ==========================================================================
  describe('MonitorScreen', () => {
    const mockSensors = [
      { id: 0, name: 'T1 Vào dàn', temp: -22.7, online: true },
      { id: 1, name: 'T2 Ra dàn', temp: -30.1, online: true },
      { id: 2, name: 'T3 Bầu TXV', temp: -19.9, online: true },
    ];

    it('renders 3 SensorCards with correct props', async () => {
      const { getAllByTestId } = await renderWithMaterial(
        <MonitorScreen sensors={mockSensors} deltaAir={7.4} history={[]} />
      );

      const cards = getAllByTestId('sensor-card');
      expect(cards).toHaveLength(3);

      // Verify first card displays T1
      expect(cards[0].props.accessibilityLabel).toBe('T1 Vào dàn: -22.7 độ C');
    });

    it('shows empty state message when sensors array is empty', async () => {
      const { getByText } = await renderWithMaterial(
        <MonitorScreen sensors={[]} deltaAir={null} history={[]} />
      );

      expect(getByText('Chưa có cảm biến nào. Vui lòng kết nối ESP32 hoặc bật Demo Mode.')).toBeTruthy();
    });

    it('exports MonitorScreen as default export', () => {
      expect(DefaultMonitorScreen).toBe(MonitorScreen);
    });

    it('displays SkeuoGauge with correct deltaAir value', async () => {
      const { getByRole } = await renderWithMaterial(
        <MonitorScreen sensors={mockSensors} deltaAir={7.4} history={[]} />
      );

      const gauge = getByRole('progressbar');
      expect(gauge.props.accessibilityLabel).toBe('Độ giảm nhiệt khí qua dàn lạnh: 7.4 K');
    });

    it('shows status badge "✓ TỐI ƯU" when deltaAir=7.4K (optimal range 4-12K)', async () => {
      const { getByText } = await renderWithMaterial(
        <MonitorScreen sensors={mockSensors} deltaAir={7.4} history={[]} />
      );

      expect(getByText('✓ TỐI ƯU')).toBeTruthy();
    });

    it('shows status badge "⚠ CẢNH BÁO" when deltaAir=3.0K (below optimal)', async () => {
      const { getByText } = await renderWithMaterial(
        <MonitorScreen sensors={mockSensors} deltaAir={3.0} history={[]} />
      );

      expect(getByText('⚠ CẢNH BÁO')).toBeTruthy();
    });

    it('renders RealtimeChart with 3 paths for T1, T2, T3', async () => {
      const mockHistory = [
        { time: Date.now(), t1: -22.7, t2: -30.1, t3: -19.9 },
        { time: Date.now() + 2000, t1: -22.8, t2: -30.2, t3: -20.0 },
      ];

      const { toJSON } = await renderWithMaterial(
        <MonitorScreen sensors={mockSensors} deltaAir={7.4} history={mockHistory} />
      );

      const tree = toJSON();
      const stringified = JSON.stringify(tree);

      // Verify 3 distinct path strokes (cold, warning, purple)
      const hasCold = stringified.includes(hexToSvgPayload(lightTheme.cold).toString()) || stringified.includes(lightTheme.cold);
      const hasWarning = stringified.includes(hexToSvgPayload(lightTheme.warning).toString()) || stringified.includes(lightTheme.warning);
      const hasPurple = stringified.includes(hexToSvgPayload(lightTheme.purple).toString()) || stringified.includes(lightTheme.purple);

      expect(hasCold).toBe(true);
      expect(hasWarning).toBe(true);
      expect(hasPurple).toBe(true);
    });
  });

  // ==========================================================================
  // B. TxvTunerScreen Integration Tests
  // ==========================================================================
  describe('TxvTunerScreen', () => {
    const mockCalculatorReturn = {
      selectedRefId: 'R404A',
      setSelectedRefId: jest.fn(),
      selectedValveId: 'T2_TE2',
      setSelectedValveId: jest.fn(),
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
      currentRef: {
        id: 'R404A',
        name: 'R404A',
        desc: 'Kho đông lạnh âm sâu, tủ đông công nghiệp',
        Tc: 345.27,
        Pc: 37.348,
      },
      currentValve: {
        id: 'T2_TE2',
        name: 'Danfoss T2 / TE2',
        desc: 'Van góc thông dụng kho lạnh thương mại vừa và nhỏ',
        sensitivity: 1.2,
      },
      actualSh: 6.0,
      deltaSh: 0.0,
    };

    let calcSpy;

    beforeEach(() => {
      calcSpy = jest.spyOn(txvCalcHook, 'useTxvCalculator').mockReturnValue(mockCalculatorReturn);
    });

    afterEach(() => {
      calcSpy?.mockRestore();
    });

    it('exports TxvTunerScreen as default export', () => {
      expect(DefaultTxvTunerScreen).toBe(TxvTunerScreen);
    });

    it('renders all major sections in correct order', async () => {
      const { getByText } = await renderWithMaterial(
        <TxvTunerScreen liveT1={-22.7} liveT2={-30.1} liveT3={-19.9} isOnline={true} isDemoMode={false} />
      );

      // Verify sections exist
      expect(getByText('TRẠM ĐO NHIỆT ĐỘ')).toBeTruthy();
      expect(getByText('01 / MÔI CHẤT LẠNH')).toBeTruthy();
      expect(getByText('02 / DÒNG VAN TXV')).toBeTruthy();
      expect(getByText('KẾT QUẢ ĐỘ QUÁ NHIỆT')).toBeTruthy();
      expect(getByText('📈 Lịch Sử Biến Thiên Superheat')).toBeTruthy();
    });

    it('passes correct props to RefrigerantSelector', async () => {
      const { getByText } = await renderWithMaterial(
        <TxvTunerScreen liveT1={-22.7} liveT2={-30.1} liveT3={-19.9} isOnline={true} isDemoMode={false} />
      );

      // Verify R404A is selected
      expect(getByText('✓ R404A')).toBeTruthy();
    });

    it('passes correct props to TxvResultPanel when SH is optimal', async () => {
      const { getByText } = await renderWithMaterial(
        <TxvTunerScreen liveT1={-22.7} liveT2={-30.1} liveT3={-19.9} isOnline={true} isDemoMode={false} />
      );

      // Verify optimal state
      expect(getByText('ĐẠT CHUẨN DANFOSS')).toBeTruthy();
      expect(getByText('✓ OK')).toBeTruthy();
      expect(getByText(/Độ quá nhiệt tối ưu/)).toBeTruthy();
    });
  });

  // ==========================================================================
  // C. App Tab Switching & State Preservation Tests
  // ==========================================================================
  describe('App Tab Switching & State Preservation', () => {
    it('maintains state when switching tabs (TXV ↔ Monitor)', async () => {
      const { getByLabelText, getByTestId } = await render(<App />);

      // Verify initial tab is TXV
      const tempInput = getByLabelText('Nhiệt độ bay hơi, độ C');
      expect(tempInput).toBeTruthy();

      // Turn off auto-sync so manual evapTemp can be entered
      const syncSwitch = getByTestId('sync-switch');
      await act(async () => {
        fireEvent(syncSwitch, 'valueChange', false);
      });

      // Change evapTemp input value to -25°C
      await act(async () => {
        fireEvent.changeText(tempInput, '-25');
      });

      expect(tempInput.props.value).toBe('-25');

      // Switch to Monitor tab
      const monitorTab = getByTestId('tab-monitor');
      await act(async () => {
        fireEvent.press(monitorTab);
      });

      // Monitor screen elements should now be visible
      expect(getByTestId('delta-status-badge')).toBeTruthy();

      // Switch back to TXV tab
      const txvTab = getByTestId('tab-txv');
      await act(async () => {
        fireEvent.press(txvTab);
      });

      // Txv screen elements remain alive and state is preserved
      const tempInputAfter = getByLabelText('Nhiệt độ bay hơi, độ C');
      expect(tempInputAfter.props.value).toBe('-25');
    });
  });
});
