import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Header, isValidHostOrIp } from '../src/components/Header';
import { MaterialProvider } from '../src/components/SkeuoKit';

describe('Header Component Unit Tests', () => {
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

  describe('isValidHostOrIp validator', () => {
    it('validates standard IPv4 addresses', () => {
      expect(isValidHostOrIp('192.168.1.100')).toBe(true);
      expect(isValidHostOrIp('10.0.0.1')).toBe(true);
      expect(isValidHostOrIp('127.0.0.1:8080')).toBe(true);
    });

    it('validates URLs, localhost and mDNS domains', () => {
      expect(isValidHostOrIp('esp32.local')).toBe(true);
      expect(isValidHostOrIp('localhost')).toBe(true);
      expect(isValidHostOrIp('http://192.168.1.100')).toBe(true);
      expect(isValidHostOrIp('https://wokwi.com/projects/123')).toBe(true);
    });

    it('rejects invalid IPs and malformed strings', () => {
      expect(isValidHostOrIp('')).toBe(false);
      expect(isValidHostOrIp('   ')).toBe(false);
      expect(isValidHostOrIp('999.999.999.999')).toBe(false);
      expect(isValidHostOrIp('dia chi khong hop le')).toBe(false);
    });
  });

  describe('Header UI & Interactions', () => {
    const defaultProps = {
      connectionStatus: 'connected',
      isDemoMode: false,
      toggleDemoMode: jest.fn(),
      themeMode: 'light',
      toggleTheme: jest.fn(),
      esp32Ip: '192.168.1.100',
      saveEsp32Ip: jest.fn(),
      flat: false,
      setFlat: jest.fn(),
    };

    it('renders header branding, title, and connected status', async () => {
      const { getByText } = await renderWithMaterial(<Header {...defaultProps} />);

      expect(getByText('DANFOSS / REF TOOLS')).toBeTruthy();
      expect(getByText('TXV Tuner')).toBeTruthy();
      expect(getByText('ESP32 đã kết nối')).toBeTruthy();
      expect(getByText('Demo tắt')).toBeTruthy();
    });

    it('displays demo mode label when isDemoMode is true', async () => {
      const { getByText } = await renderWithMaterial(
        <Header {...defaultProps} isDemoMode={true} />
      );

      expect(getByText('Dữ liệu mô phỏng')).toBeTruthy();
      expect(getByText('Demo bật')).toBeTruthy();
    });

    it('displays disconnected status when connectionStatus is disconnected', async () => {
      const { getByText } = await renderWithMaterial(
        <Header {...defaultProps} connectionStatus="disconnected" />
      );

      expect(getByText('ESP32 mất kết nối')).toBeTruthy();
    });

    it('triggers toggleTheme when theme button is pressed', async () => {
      const mockToggleTheme = jest.fn();
      const { getByLabelText } = await renderWithMaterial(
        <Header {...defaultProps} toggleTheme={mockToggleTheme} />
      );

      const themeBtn = getByLabelText('Chuyển sang giao diện tối');
      await act(async () => {
        fireEvent.press(themeBtn);
      });

      expect(mockToggleTheme).toHaveBeenCalledTimes(1);
    });

    it('triggers toggleDemoMode when demo switch is toggled', async () => {
      const mockToggleDemo = jest.fn();
      const { getByLabelText } = await renderWithMaterial(
        <Header {...defaultProps} toggleDemoMode={mockToggleDemo} />
      );

      const demoSwitch = getByLabelText('Chế độ dữ liệu mô phỏng');
      await act(async () => {
        fireEvent(demoSwitch, 'valueChange', true);
      });

      expect(mockToggleDemo).toHaveBeenCalledTimes(1);
    });

    it('opens settings modal and shows initial esp32Ip', async () => {
      const { getByLabelText, getByText, getByDisplayValue } = await renderWithMaterial(
        <Header {...defaultProps} esp32Ip="192.168.1.150" />
      );

      const settingsBtn = getByLabelText('Cài đặt kết nối và giao diện');
      await act(async () => {
        fireEvent.press(settingsBtn);
      });

      expect(getByText('Cài đặt thiết bị')).toBeTruthy();
      expect(getByDisplayValue('192.168.1.150')).toBeTruthy();
    });

    it('shows error message when saving empty address', async () => {
      const { getByLabelText, getByText } = await renderWithMaterial(
        <Header {...defaultProps} />
      );

      // Open settings
      const settingsBtn = getByLabelText('Cài đặt kết nối và giao diện');
      await act(async () => {
        fireEvent.press(settingsBtn);
      });

      // Clear input
      const input = getByLabelText('Địa chỉ IP hoặc URL ESP32');
      await act(async () => {
        fireEvent.changeText(input, '   ');
      });

      // Press Save
      const saveBtn = getByText('Lưu kết nối');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(getByText('Vui lòng nhập địa chỉ IP hoặc URL của ESP32.')).toBeTruthy();
      expect(defaultProps.saveEsp32Ip).not.toHaveBeenCalled();
    });

    it('shows error message when saving invalid IP format', async () => {
      const { getByLabelText, getByText } = await renderWithMaterial(
        <Header {...defaultProps} />
      );

      // Open settings
      const settingsBtn = getByLabelText('Cài đặt kết nối và giao diện');
      await act(async () => {
        fireEvent.press(settingsBtn);
      });

      // Enter invalid text
      const input = getByLabelText('Địa chỉ IP hoặc URL ESP32');
      await act(async () => {
        fireEvent.changeText(input, 'dia chi sai format!!!');
      });

      // Press Save
      const saveBtn = getByText('Lưu kết nối');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(getByText(/Địa chỉ không hợp lệ/)).toBeTruthy();
      expect(defaultProps.saveEsp32Ip).not.toHaveBeenCalled();
    });

    it('saves valid IP address and closes modal', async () => {
      const mockSave = jest.fn().mockResolvedValue(true);
      const { getByLabelText, getByText, queryByText } = await renderWithMaterial(
        <Header {...defaultProps} saveEsp32Ip={mockSave} />
      );

      // Open settings
      const settingsBtn = getByLabelText('Cài đặt kết nối và giao diện');
      await act(async () => {
        fireEvent.press(settingsBtn);
      });

      // Enter valid IP
      const input = getByLabelText('Địa chỉ IP hoặc URL ESP32');
      await act(async () => {
        fireEvent.changeText(input, '192.168.1.200');
      });

      // Press Save
      const saveBtn = getByText('Lưu kết nối');
      await act(async () => {
        fireEvent.press(saveBtn);
      });

      expect(mockSave).toHaveBeenCalledWith('192.168.1.200');
      expect(queryByText('Cài đặt thiết bị')).toBeNull();
    });
  });
});
