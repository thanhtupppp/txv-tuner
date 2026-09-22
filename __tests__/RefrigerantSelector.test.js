import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { RefrigerantSelector } from '../src/components/RefrigerantSelector';
import { MaterialProvider } from '../src/components/SkeuoKit';
import { tempToPressure } from '../src/data/danfossData';

describe('RefrigerantSelector Modal Dropdown Unit Tests', () => {
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

  const defaultCurrentRef = {
    id: 'R404A',
    desc: 'Kho đông lạnh âm sâu',
    Tc: 345.27,
    Pc: 37.348,
  };

  it('displays selected refrigerant info (R404A by default) and checkmark on dropdown button', async () => {
    const mockSetSelectedRefId = jest.fn();
    const mockSetEvapPressure = jest.fn();

    const { getByText } = await renderWithMaterial(
      <RefrigerantSelector
        selectedRefId="R404A"
        setSelectedRefId={mockSetSelectedRefId}
        currentRef={defaultCurrentRef}
        evapTemp={-27.0}
        setEvapPressure={mockSetEvapPressure}
      />
    );

    expect(getByText('01 / MÔI CHẤT LẠNH')).toBeTruthy();
    expect(getByText('R404A • Kho đông lạnh âm sâu (Tc: 72.1°C, Pc: 37.3 bar)')).toBeTruthy();
    expect(getByText('✓ R404A')).toBeTruthy();
  });

  it('opens modal when dropdown button is clicked', async () => {
    const { getByLabelText, getByText } = await renderWithMaterial(
      <RefrigerantSelector
        selectedRefId="R404A"
        setSelectedRefId={jest.fn()}
        currentRef={defaultCurrentRef}
        evapTemp={-27.0}
        setEvapPressure={jest.fn()}
      />
    );

    const dropdownBtn = getByLabelText('Chọn môi chất lạnh, hiện tại: R404A');
    await act(async () => {
      fireEvent.press(dropdownBtn);
    });

    expect(getByText('Chọn Môi Chất Lạnh')).toBeTruthy();
    expect(getByText('Đóng')).toBeTruthy();
  });

  it('calls setSelectedRefId, recalculates setEvapPressure and closes modal on selection', async () => {
    const mockSetSelectedRefId = jest.fn();
    const mockSetEvapPressure = jest.fn();

    const { getByLabelText, getByText, queryByText } = await renderWithMaterial(
      <RefrigerantSelector
        selectedRefId="R404A"
        setSelectedRefId={mockSetSelectedRefId}
        currentRef={defaultCurrentRef}
        evapTemp={-27.0}
        setEvapPressure={mockSetEvapPressure}
      />
    );

    // Open modal
    const dropdownBtn = getByLabelText('Chọn môi chất lạnh, hiện tại: R404A');
    await act(async () => {
      fireEvent.press(dropdownBtn);
    });

    // Find and select R134a in modal list
    const r134aOption = getByText(/R134a —/);
    await act(async () => {
      fireEvent.press(r134aOption);
    });

    expect(mockSetSelectedRefId).toHaveBeenCalledWith('R134a');
    expect(mockSetEvapPressure).toHaveBeenCalledWith(expect.any(Number));

    // Verify calculated value matches CoolProp pS formula for R134a at -27°C
    const expectedPressure = tempToPressure(-27.0, 'R134a');
    expect(mockSetEvapPressure).toHaveBeenCalledWith(expectedPressure);

    // Modal should be closed
    expect(queryByText('Chọn Môi Chất Lạnh')).toBeNull();
  });

  it('closes modal without changing value when "Đóng" button is clicked', async () => {
    const mockSetSelectedRefId = jest.fn();

    const { getByLabelText, getByText, queryByText } = await renderWithMaterial(
      <RefrigerantSelector
        selectedRefId="R404A"
        setSelectedRefId={mockSetSelectedRefId}
        currentRef={defaultCurrentRef}
        evapTemp={-27.0}
        setEvapPressure={jest.fn()}
      />
    );

    // Open modal
    const dropdownBtn = getByLabelText('Chọn môi chất lạnh, hiện tại: R404A');
    await act(async () => {
      fireEvent.press(dropdownBtn);
    });

    expect(getByText('Chọn Môi Chất Lạnh')).toBeTruthy();

    // Click Close button
    const closeBtn = getByText('Đóng');
    await act(async () => {
      fireEvent.press(closeBtn);
    });

    expect(mockSetSelectedRefId).not.toHaveBeenCalled();
    expect(queryByText('Chọn Môi Chất Lạnh')).toBeNull();
  });
});
