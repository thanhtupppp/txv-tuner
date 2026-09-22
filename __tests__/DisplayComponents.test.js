import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SensorCard } from '../src/components/SensorCard';
import { TxvTelemetryBar } from '../src/components/TxvTelemetryBar';
import { MaterialProvider } from '../src/components/SkeuoKit';
import { THEME } from '../src/constants/theme';

describe('Phase 2: Display Layer Components Unit Tests', () => {
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
  // A. SensorCard Tests
  // ==========================================================================
  describe('SensorCard', () => {
    it('displays valid temperature with 1 decimal place', async () => {
      const { getByText } = await renderWithMaterial(
        <SensorCard sensor={{ name: 'T1 Vào dàn', temp: -22.7 }} channelIndex={0} />
      );

      expect(getByText('-22.7')).toBeTruthy();
      expect(getByText('°C')).toBeTruthy();
      expect(getByText('T1 Vào dàn')).toBeTruthy();
      expect(getByText(/CH 1/)).toBeTruthy();
    });

    it('shows "--" placeholder when temp is null or undefined', async () => {
      const { getByText } = await renderWithMaterial(
        <SensorCard sensor={{ name: 'T2 Ra dàn', temp: null }} channelIndex={1} />
      );

      expect(getByText('--')).toBeTruthy();
      expect(getByText('°C')).toBeTruthy();
      expect(getByText('T2 Ra dàn')).toBeTruthy();
    });

    it('applies correct channel colors: T1=cold, T2=warning, T3=purple', async () => {
      const { getAllByTestId, getByText } = await renderWithMaterial(
        <>
          <SensorCard sensor={{ temp: -22 }} channelIndex={0} />
          <SensorCard sensor={{ temp: -30 }} channelIndex={1} />
          <SensorCard sensor={{ temp: -19 }} channelIndex={2} />
        </>
      );

      const leds = getAllByTestId('sensor-led', { includeHiddenElements: true });
      expect(leds).toHaveLength(3);

      expect(StyleSheet.flatten(leds[0].props.style).backgroundColor).toBe(lightTheme.cold);
      expect(StyleSheet.flatten(leds[1].props.style).backgroundColor).toBe(lightTheme.warning);
      expect(StyleSheet.flatten(leds[2].props.style).backgroundColor).toBe(lightTheme.purple);

      // Verify channel tags have matching channel colors
      expect(StyleSheet.flatten(getByText(/CH 1/).props.style).color).toBe(lightTheme.cold);
      expect(StyleSheet.flatten(getByText(/CH 2/).props.style).color).toBe(lightTheme.warning);
      expect(StyleSheet.flatten(getByText(/CH 3/).props.style).color).toBe(lightTheme.purple);
    });

    it('provides accessible label with sensor name and value', async () => {
      const { getByLabelText } = await renderWithMaterial(
        <SensorCard sensor={{ name: 'T3 Bầu TXV', temp: -19.9 }} channelIndex={2} />
      );

      const card = getByLabelText('T3 Bầu TXV: -19.9 độ C');
      expect(card).toBeTruthy();
      expect(card.props.accessibilityRole).toBe('summary');

      const { getByLabelText: getNullCard } = await renderWithMaterial(
        <SensorCard sensor={{ name: 'T2 Ra dàn', temp: null }} channelIndex={1} />
      );
      expect(getNullCard('T2 Ra dàn: chưa có dữ liệu')).toBeTruthy();
    });

    it('shows error LED and offline accessible label when sensor.online is false', async () => {
      const { getByTestId, getByLabelText } = await renderWithMaterial(
        <SensorCard sensor={{ name: 'T1 Vào dàn', temp: -22.7, online: false }} channelIndex={0} />
      );

      const card = getByLabelText('T1 Vào dàn: -22.7 độ C, mất kết nối');
      expect(card).toBeTruthy();

      const led = getByTestId('sensor-led', { includeHiddenElements: true });
      expect(StyleSheet.flatten(led.props.style).backgroundColor).toBe(lightTheme.danger);
    });
  });

  // ==========================================================================
  // B. TxvTelemetryBar Tests
  // ==========================================================================
  describe('TxvTelemetryBar', () => {
    const defaultProps = {
      liveT1: -22.7,
      liveT2: -30.1,
      liveT3: -19.9,
      isAutoSyncSensors: true,
      setIsAutoSyncSensors: jest.fn(),
      isOnline: true,
      isDemoMode: false,
    };

    it('displays all 3 temperature readings correctly', async () => {
      const { getByText } = await renderWithMaterial(
        <TxvTelemetryBar {...defaultProps} />
      );

      expect(getByText(/-22\.7/)).toBeTruthy();
      expect(getByText(/-30\.1/)).toBeTruthy();
      expect(getByText(/-19\.9/)).toBeTruthy();
      expect(getByText('T1 / VÀO DÀN')).toBeTruthy();
      expect(getByText('T2 / RA DÀN')).toBeTruthy();
      expect(getByText('T3 / BẦU TXV')).toBeTruthy();
    });

    it('shows "MÔ PHỎNG" tag and warn LED when isDemoMode=true', async () => {
      const { getByText, getByTestId, getAllByText } = await renderWithMaterial(
        <TxvTelemetryBar {...defaultProps} isDemoMode={true} />
      );

      expect(getByText('MÔ PHỎNG')).toBeTruthy();
      expect(getByText('Tín hiệu cảm biến mô phỏng')).toBeTruthy();

      const statusLed = getByTestId('status-led', { includeHiddenElements: true });
      expect(StyleSheet.flatten(statusLed.props.style).backgroundColor).toBe(lightTheme.warning);

      // In demo mode, all 3 captions should show DEMO
      const demoCaptions = getAllByText('DEMO');
      expect(demoCaptions).toHaveLength(3);
    });

    it('dims values and shows "OFFLINE" when isOnline=false and isDemoMode=false', async () => {
      const { getAllByText, getByTestId, getAllByTestId } = await renderWithMaterial(
        <TxvTelemetryBar {...defaultProps} isOnline={false} isDemoMode={false} />
      );

      const offlineCaptions = getAllByText('OFFLINE');
      expect(offlineCaptions).toHaveLength(3);

      const statusLed = getByTestId('status-led', { includeHiddenElements: true });
      expect(StyleSheet.flatten(statusLed.props.style).backgroundColor).toBe(lightTheme.danger);

      // Dims the 3 reading values with opacity: 0.6 and muted color
      const valueTexts = getAllByTestId('value-text');
      expect(valueTexts).toHaveLength(3);
      valueTexts.forEach((textEl) => {
        const flatStyle = StyleSheet.flatten(textEl.props.style);
        expect(flatStyle.opacity).toBe(0.6);
        expect(flatStyle.color).toBe(lightTheme.screenMuted);
      });
    });

    it('calls setIsAutoSyncSensors when switch is toggled', async () => {
      const mockSetIsAutoSyncSensors = jest.fn();
      const { getByLabelText, getByText } = await renderWithMaterial(
        <TxvTelemetryBar
          {...defaultProps}
          isAutoSyncSensors={true}
          setIsAutoSyncSensors={mockSetIsAutoSyncSensors}
        />
      );

      expect(getByText('Tự đồng bộ')).toBeTruthy();

      const switchEl = getByLabelText('Tự đồng bộ cảm biến');
      expect(switchEl).toBeTruthy();

      fireEvent(switchEl, 'valueChange', false);
      expect(mockSetIsAutoSyncSensors).toHaveBeenCalledWith(false);
    });

    it('shows "Nhập thủ công" label when isAutoSyncSensors=false', async () => {
      const { getByText } = await renderWithMaterial(
        <TxvTelemetryBar {...defaultProps} isAutoSyncSensors={false} />
      );

      expect(getByText('Nhập thủ công')).toBeTruthy();
    });
  });
});
