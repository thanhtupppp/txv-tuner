import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  StatsModal,
  getSignalQuality,
  getHeapStatus,
  formatUptime
} from '../src/components/StatsModal';

describe('StatsModal helper functions', () => {
  describe('getSignalQuality', () => {
    it('returns Excellent for RSSI >= -50', () => {
      const result = getSignalQuality(-45);
      expect(result.label).toMatch(/Rất mạnh|Excellent/i);
      expect(result.color).toBe('#4CAF50');
    });

    it('returns Good for RSSI between -51 and -60', () => {
      const result = getSignalQuality(-55);
      expect(result.label).toMatch(/Tốt|Good/i);
      expect(result.color).toBe('#8BC34A');
    });

    it('returns Fair for RSSI between -61 and -70', () => {
      const result = getSignalQuality(-65);
      expect(result.label).toMatch(/Khá|Fair/i);
      expect(result.color).toBe('#FFC107');
    });

    it('returns Weak for RSSI between -71 and -80', () => {
      const result = getSignalQuality(-75);
      expect(result.label).toMatch(/Yếu|Weak/i);
      expect(result.color).toBe('#FF9800');
    });

    it('returns Very Weak for RSSI < -80', () => {
      const result = getSignalQuality(-85);
      expect(result.label).toMatch(/Rất yếu|Very Weak/i);
      expect(result.color).toBe('#f44336');
    });

    it('handles undefined or null RSSI safely', () => {
      const result = getSignalQuality(null);
      expect(result).toBeDefined();
    });
  });

  describe('getHeapStatus', () => {
    it('returns Healthy when free heap > 50000', () => {
      const result = getHeapStatus(60000);
      expect(result.label).toMatch(/Tốt|Healthy/i);
      expect(result.color).toBe('#4CAF50');
    });

    it('returns Normal when free heap between 20001 and 50000', () => {
      const result = getHeapStatus(30000);
      expect(result.label).toMatch(/Bình thường|Normal/i);
      expect(result.color).toBe('#2196F3');
    });

    it('returns Low when free heap between 10001 and 20000', () => {
      const result = getHeapStatus(15000);
      expect(result.label).toMatch(/Thấp|Low/i);
      expect(result.color).toBe('#FF9800');
    });

    it('returns Critical when free heap <= 10000', () => {
      const result = getHeapStatus(8000);
      expect(result.label).toMatch(/Nguy cấp|Critical/i);
      expect(result.color).toBe('#f44336');
    });
  });

  describe('formatUptime', () => {
    it('formats seconds into hours, minutes, and seconds', () => {
      // 1h 23m 45s = 3600 + 23*60 + 45 = 5025s
      expect(formatUptime(5025)).toBe('1h 23m 45s');
    });

    it('formats times under 1 hour properly', () => {
      // 15m 30s = 15*60 + 30 = 930s
      expect(formatUptime(930)).toBe('15m 30s');
    });

    it('formats times under 1 minute properly', () => {
      expect(formatUptime(42)).toBe('42s');
    });

    it('handles 0 or falsy inputs', () => {
      expect(formatUptime(0)).toBe('0s');
      expect(formatUptime(null)).toBe('0s');
    });
  });
});

import { MaterialProvider } from '../src/components/SkeuoKit';

describe('StatsModal Component Rendering', () => {
  const mockStats = {
    freeHeap: 45000,
    uptime: 5025,
    wifiRSSI: -55,
    sensorCount: 3,
    wifiSSID: 'TuSmart-TXV-Tuner',
    wifiIP: '192.168.4.1',
    wifiGateway: '192.168.4.1'
  };

  const mockSensors = [
    { id: 0, name: 'T1 Vào dàn', temp: -15.5, online: true },
    { id: 1, name: 'T2 Ra dàn', temp: -25.0, online: true },
    { id: 2, name: 'T3 Bầu TXV', temp: null, online: false }
  ];

  const renderModal = async (props) => {
    return await render(
      <MaterialProvider themeMode="light" flat={false}>
        <StatsModal {...props} />
      </MaterialProvider>
    );
  };

  it('renders modal content when visible', async () => {
    const { getByText, getAllByText, getByTestId } = await renderModal({
      visible: true,
      onClose: jest.fn(),
      stats: mockStats,
      sensors: mockSensors
    });

    expect(getByText(/ESP32 System Stats|Trạng thái ESP32/i)).toBeTruthy();
    expect(getByText(/TuSmart-TXV-Tuner/)).toBeTruthy();
    expect(getAllByText(/192.168.4.1/).length).toBeGreaterThanOrEqual(1);
    expect(getByTestId('stats-modal-close')).toBeTruthy();
  });

  it('triggers onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByTestId } = await renderModal({
      visible: true,
      onClose,
      stats: mockStats,
      sensors: mockSensors
    });

    fireEvent.press(getByTestId('stats-modal-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onRefresh when refresh button is pressed', async () => {
    const onRefresh = jest.fn();
    const { getByTestId } = await renderModal({
      visible: true,
      onClose: jest.fn(),
      onRefresh,
      stats: mockStats,
      sensors: mockSensors,
      loading: false
    });

    fireEvent.press(getByTestId('stats-modal-refresh'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('displays loading spinner when loading is true', async () => {
    const { getByTestId } = await renderModal({
      visible: true,
      onClose: jest.fn(),
      stats: mockStats,
      onRefresh: jest.fn(),
      loading: true
    });

    expect(getByTestId('stats-modal-spinner')).toBeTruthy();
  });

  it('displays sensor status correctly (both online and offline)', async () => {
    const { getByText } = await renderModal({
      visible: true,
      onClose: jest.fn(),
      stats: mockStats,
      sensors: mockSensors
    });

    expect(getByText('T1 Vào dàn')).toBeTruthy();
    expect(getByText(/-15.5/)).toBeTruthy();
    expect(getByText('T3 Bầu TXV')).toBeTruthy();
    expect(getByText(/Mất kết nối|Offline/i)).toBeTruthy();
  });

  it('handles null stats gracefully without crashing', async () => {
    const { getByText } = await renderModal({
      visible: true,
      onClose: jest.fn(),
      stats: null,
      sensors: []
    });

    expect(getByText(/Chưa có dữ liệu|Đang chờ dữ liệu/i)).toBeTruthy();
  });
});
