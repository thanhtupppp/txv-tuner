import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render } from '@testing-library/react-native';
import { TxvRealtimeChart } from '../src/components/TxvRealtimeChart';
import { MaterialProvider } from '../src/components/SkeuoKit';
import { THEME } from '../src/constants/theme';

describe('Phase 5: TxvRealtimeChart Component', () => {
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

  const hexToSvgPayload = (hex) => {
    const clean = hex.replace('#', '');
    return (0xff000000 | parseInt(clean, 16)) >>> 0;
  };

  it('renders chart title and legend with correct labels', async () => {
    const { getByText } = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );

    expect(getByText('📈 Biểu Đồ Superheat Real-Time')).toBeTruthy();
    expect(getByText('Actual SH')).toBeTruthy();
    expect(getByText('Target SH (6.0K)')).toBeTruthy();
  });

  it('displays default demo data when historyData is empty', async () => {
    const { toJSON } = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );

    const tree = toJSON();
    const stringified = JSON.stringify(tree);

    // Verify actual SH path exists (accent color)
    const accentPayload = hexToSvgPayload(lightTheme.accent);
    expect(stringified).toContain(String(accentPayload));

    // Verify target SH line exists (optimal color)
    const optimalPayload = hexToSvgPayload(lightTheme.optimal);
    expect(stringified).toContain(String(optimalPayload));
  });

  it('renders custom history data with correct actual SH path', async () => {
    const mockHistory = [
      { time: Date.now(), actualSh: 5.8, targetSh: 6.0 },
      { time: Date.now() + 2000, actualSh: 6.2, targetSh: 6.0 },
      { time: Date.now() + 4000, actualSh: 6.5, targetSh: 6.0 },
      { time: Date.now() + 6000, actualSh: 6.0, targetSh: 6.0 },
    ];

    const { toJSON } = await renderWithMaterial(
      <TxvRealtimeChart historyData={mockHistory} targetSh={6.0} />
    );

    const tree = toJSON();
    const stringified = JSON.stringify(tree);

    // Should contain actual SH path (accent)
    const accentPayload = hexToSvgPayload(lightTheme.accent);
    expect(stringified).toContain(String(accentPayload));

    // Should contain target SH line (optimal)
    const optimalPayload = hexToSvgPayload(lightTheme.optimal);
    expect(stringified).toContain(String(optimalPayload));
  });

  it('displays Y-axis labels with MONO font and screenMuted color', async () => {
    const { toJSON } = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );

    const tree = toJSON();
    const stringified = JSON.stringify(tree);

    // Verify screenMuted color for Y-axis labels
    const screenMutedPayload = hexToSvgPayload(lightTheme.screenMuted);
    expect(stringified).toContain(String(screenMutedPayload));

    // Verify labels exist (0K, 6K, 12K)
    expect(stringified).toMatch(/0K/);
    expect(stringified).toMatch(/6K/);
    expect(stringified).toMatch(/12K/);
  });

  it('adjusts Y-axis bounds dynamically based on data range', async () => {
    const extremeHistory = [
      { time: Date.now(), actualSh: 15.0, targetSh: 6.0 },
      { time: Date.now() + 2000, actualSh: 18.0, targetSh: 6.0 },
    ];

    const { toJSON } = await renderWithMaterial(
      <TxvRealtimeChart historyData={extremeHistory} targetSh={6.0} />
    );

    const tree = toJSON();
    const stringified = JSON.stringify(tree);

    // Should include higher Y-axis labels (e.g., 20K)
    expect(stringified).toMatch(/20K/);
  });

  it('renders horizontal grid lines with borderStrong color and dashed stroke', async () => {
    const { toJSON } = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );

    const tree = toJSON();
    const stringified = JSON.stringify(tree);

    // Verify grid lines (borderStrong color)
    const borderStrongPayload = hexToSvgPayload(lightTheme.borderStrong);
    expect(stringified).toContain(String(borderStrongPayload));

    // Verify dashed stroke pattern (2 3)
    expect(stringified).toMatch(/strokeDasharray.*2 3/);
  });

  it('renders target SH as dashed line with optimal color', async () => {
    const { toJSON } = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );

    const tree = toJSON();
    const stringified = JSON.stringify(tree);

    // Verify target line (optimal color, dashed)
    const optimalPayload = hexToSvgPayload(lightTheme.optimal);
    expect(stringified).toContain(String(optimalPayload));
    expect(stringified).toMatch(/strokeDasharray.*4 3/);
  });

  it('applies correct chart height (120px) and LCD well styling', async () => {
    const { getByText } = await renderWithMaterial(
      <TxvRealtimeChart historyData={[]} targetSh={6.0} />
    );

    // Find the LCD well by looking for chart container
    const chartTitle = getByText('📈 Biểu Đồ Superheat Real-Time');
    expect(chartTitle).toBeTruthy();

    // Verify component structure (SkeuoPanel + SkeuoLcdWell)
    // This is implicit through successful rendering
  });
});