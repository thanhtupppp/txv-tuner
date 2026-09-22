import React from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  SkeuoLcdWell,
  SkeuoLed,
  SkeuoGauge,
  SkeuoPanel,
  MaterialProvider,
} from '../src/components/SkeuoKit';
import { THEME } from '../src/constants/theme';

describe('SkeuoKit Primitives Unit Tests', () => {
  const lightTheme = THEME.light;

  beforeAll(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // Helper async render with MaterialProvider
  const renderWithMaterial = async (ui, { themeMode = 'light', flat = false } = {}) => {
    return await render(
      <MaterialProvider themeMode={themeMode} flat={flat}>
        {ui}
      </MaterialProvider>
    );
  };

  // Helper to convert #RRGGBB to react-native-svg 32-bit ARGB payload
  const hexToSvgPayload = (hex) => {
    const clean = hex.replace('#', '');
    return (0xff000000 | parseInt(clean, 16)) >>> 0;
  };

  // --------------------------------------------------------------------------
  // 1. SkeuoLcdWell Tests
  // --------------------------------------------------------------------------
  describe('SkeuoLcdWell', () => {
    it('applies readout padding for variant="readout" by default', async () => {
      const { getByTestId } = await renderWithMaterial(
        <SkeuoLcdWell testID="lcd-well">
          <Text>Content</Text>
        </SkeuoLcdWell>
      );
      const element = getByTestId('lcd-well');
      const flatStyle = StyleSheet.flatten(element.props.style);

      expect(flatStyle.paddingHorizontal).toBe(10);
      expect(flatStyle.paddingVertical).toBe(8);
      expect(flatStyle.backgroundColor).toBe(lightTheme.screenBg);
      expect(flatStyle.borderColor).toBe(lightTheme.borderStrong);
    });

    it('applies chart padding and overflow hidden for variant="chart"', async () => {
      const { getByTestId } = await renderWithMaterial(
        <SkeuoLcdWell variant="chart" testID="lcd-well-chart">
          <Text>Chart</Text>
        </SkeuoLcdWell>
      );
      const element = getByTestId('lcd-well-chart');
      const flatStyle = StyleSheet.flatten(element.props.style);

      expect(flatStyle.padding).toBe(8);
      expect(flatStyle.overflow).toBe('hidden');
    });

    it('always preserves borderTopWidth of 2px (beveled recess cut)', async () => {
      const { getByTestId: getReadout } = await renderWithMaterial(
        <SkeuoLcdWell variant="readout" testID="w1" />
      );
      const { getByTestId: getChart } = await renderWithMaterial(
        <SkeuoLcdWell variant="chart" testID="w2" />
      );
      const { getByTestId: getFlat } = await renderWithMaterial(
        <SkeuoLcdWell testID="w3" />,
        { flat: true }
      );

      expect(StyleSheet.flatten(getReadout('w1').props.style).borderTopWidth).toBe(2);
      expect(StyleSheet.flatten(getChart('w2').props.style).borderTopWidth).toBe(2);
      expect(StyleSheet.flatten(getFlat('w3').props.style).borderTopWidth).toBe(2);
    });

    it('uses shadowDark for borderTopColor in normal mode, and switches to borderStrong when reducedEffects=true', async () => {
      const { getByTestId: getNormal } = await renderWithMaterial(
        <SkeuoLcdWell testID="w-normal" />,
        { flat: false }
      );
      const normalStyle = StyleSheet.flatten(getNormal('w-normal').props.style);
      expect(normalStyle.borderTopColor).toBe(lightTheme.shadowDark);

      const { getByTestId: getReduced } = await renderWithMaterial(
        <SkeuoLcdWell testID="w-reduced" />,
        { flat: true }
      );
      const reducedStyle = StyleSheet.flatten(getReduced('w-reduced').props.style);
      expect(reducedStyle.borderTopColor).toBe(lightTheme.borderStrong);
    });
  });

  // --------------------------------------------------------------------------
  // 2. SkeuoLed Tests
  // --------------------------------------------------------------------------
  describe('SkeuoLed', () => {
    it('correctly maps 4 state colors: ok, warn, error, off', async () => {
      const { getByTestId: getOk } = await renderWithMaterial(
        <SkeuoLed state="ok" testID="led-ok" />
      );
      expect(
        StyleSheet.flatten(getOk('led-ok', { includeHiddenElements: true }).props.style).backgroundColor
      ).toBe(lightTheme.optimal);

      const { getByTestId: getWarn } = await renderWithMaterial(
        <SkeuoLed state="warn" testID="led-warn" />
      );
      expect(
        StyleSheet.flatten(getWarn('led-warn', { includeHiddenElements: true }).props.style).backgroundColor
      ).toBe(lightTheme.warning);

      const { getByTestId: getError } = await renderWithMaterial(
        <SkeuoLed state="error" testID="led-error" />
      );
      expect(
        StyleSheet.flatten(getError('led-error', { includeHiddenElements: true }).props.style).backgroundColor
      ).toBe(lightTheme.danger);

      const { getByTestId: getOff } = await renderWithMaterial(
        <SkeuoLed state="off" testID="led-off" />
      );
      expect(
        StyleSheet.flatten(getOff('led-off', { includeHiddenElements: true }).props.style).backgroundColor
      ).toBe(lightTheme.border);
    });

    it('allows custom color prop to override the computed state color', async () => {
      const customCold = lightTheme.cold; // #175c79
      const { getByTestId } = await renderWithMaterial(
        <SkeuoLed state="ok" color={customCold} testID="led-custom" />
      );
      const style = StyleSheet.flatten(
        getByTestId('led-custom', { includeHiddenElements: true }).props.style
      );
      expect(style.backgroundColor).toBe(customCold);
    });

    it('renders with standard 10x10 dimensions and a11y image role', async () => {
      const { getByTestId } = await renderWithMaterial(
        <SkeuoLed accessibilityLabel="Sensor 1 Online" testID="led-a11y" />
      );
      const el = getByTestId('led-a11y');
      const style = StyleSheet.flatten(el.props.style);

      expect(style.width).toBe(10);
      expect(style.height).toBe(10);
      expect(style.borderRadius).toBe(5);
      expect(el.props.accessibilityRole).toBe('image');
      expect(el.props.accessibilityLabel).toBe('Sensor 1 Online');
      expect(el.props['aria-hidden']).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. SkeuoGauge Tests
  // --------------------------------------------------------------------------
  describe('SkeuoGauge', () => {
    // In react-native-svg, <G rotation={deg} origin="75, 75"> generates a 2D affine matrix
    // where matrix[0] = cos(rad) and matrix[1] = sin(rad)
    const findRotationMatrixAngle = (tree) => {
      let foundAngle = null;
      const walk = (node) => {
        if (!node) return;
        if (node.props && node.props.matrix && Array.isArray(node.props.matrix)) {
          const [cos, sin] = node.props.matrix;
          foundAngle = (Math.atan2(sin, cos) * 180) / Math.PI;
          return;
        }
        if (node.children) {
          node.children.forEach(walk);
        }
      };
      walk(tree);
      return foundAngle;
    };

    it('calculates correct needle angles for boundary and demo values', async () => {
      // value = 0 (min) -> -165°
      const { toJSON: jsonMin } = await renderWithMaterial(<SkeuoGauge value={0} min={0} max={20} />);
      const angle0 = findRotationMatrixAngle(jsonMin());
      expect(angle0).toBeCloseTo(-165, 1);

      // value = 20 (max) -> -15°
      const { toJSON: jsonMax } = await renderWithMaterial(<SkeuoGauge value={20} min={0} max={20} />);
      const angle20 = findRotationMatrixAngle(jsonMax());
      expect(angle20).toBeCloseTo(-15, 1);

      // value = 7.4 (Demo Mode) -> -109.5° (-165 + (7.4/20)*150 = -109.5°)
      const { toJSON: jsonDemo } = await renderWithMaterial(<SkeuoGauge value={7.4} min={0} max={20} />);
      const angleDemo = findRotationMatrixAngle(jsonDemo());
      expect(angleDemo).toBeCloseTo(-109.5, 1);
    });

    it('clamps out-of-range values and handles null/NaN gracefully', async () => {
      // Clamped below min (-5 -> 0 -> -165°)
      const { toJSON: jsonLow } = await renderWithMaterial(<SkeuoGauge value={-5} min={0} max={20} />);
      expect(findRotationMatrixAngle(jsonLow())).toBeCloseTo(-165, 1);

      // Clamped above max (30 -> 20 -> -15°)
      const { toJSON: jsonHigh } = await renderWithMaterial(<SkeuoGauge value={30} min={0} max={20} />);
      expect(findRotationMatrixAngle(jsonHigh())).toBeCloseTo(-15, 1);

      // null -> fallback to min 0 -> -165°
      const { toJSON: jsonNull } = await renderWithMaterial(<SkeuoGauge value={null} min={0} max={20} />);
      expect(findRotationMatrixAngle(jsonNull())).toBeCloseTo(-165, 1);

      // NaN -> fallback to min 0 -> -165°
      const { toJSON: jsonNaN } = await renderWithMaterial(<SkeuoGauge value={NaN} min={0} max={20} />);
      expect(findRotationMatrixAngle(jsonNaN())).toBeCloseTo(-165, 1);
    });

    it('provides accessible progressbar role and descriptive label', async () => {
      const { getByRole } = await renderWithMaterial(<SkeuoGauge value={7.4} />);
      const gauge = getByRole('progressbar');
      expect(gauge.props.accessibilityLabel).toBe('Độ giảm nhiệt khí qua dàn lạnh: 7.4 K');

      const { getByRole: getNullGauge } = await renderWithMaterial(<SkeuoGauge value={null} />);
      const nullGauge = getNullGauge('progressbar');
      expect(nullGauge.props.accessibilityLabel).toBe(
        'Độ giảm nhiệt khí qua dàn lạnh: chưa có dữ liệu'
      );
    });

    it('handles negative values in accessibility label semantically (temperature rise)', async () => {
      const { getByRole } = await renderWithMaterial(<SkeuoGauge value={-8} />);
      const gauge = getByRole('progressbar');
      expect(gauge.props.accessibilityLabel).toBe('Độ tăng nhiệt khí qua dàn lạnh: 8.0 K');
    });

    it('in normal mode: renders bezel with strokeWidth=3 and brass center screw', async () => {
      const renderRes = await renderWithMaterial(<SkeuoGauge value={7.4} />, { flat: false });
      const tree = renderRes.toJSON();
      const stringified = JSON.stringify(tree);

      // Check bezel stroke payload (theme.borderStrong) and brass screw payload (theme.brass)
      const borderStrongPayload = hexToSvgPayload(lightTheme.borderStrong);
      const brassPayload = hexToSvgPayload(lightTheme.brass);

      expect(stringified).toContain(String(borderStrongPayload));
      expect(stringified).toContain(String(brassPayload));
      expect(findRotationMatrixAngle(tree)).not.toBeNull();
    });

    it('in reducedEffects mode: strips matrix rotation, disables bezel stroke, and uses directNeedlePath with flat pin', async () => {
      const renderRes = await renderWithMaterial(<SkeuoGauge value={7.4} />, { flat: true });
      const tree = renderRes.toJSON();
      const stringified = JSON.stringify(tree);

      // Must NOT contain any rotation matrix
      expect(findRotationMatrixAngle(tree)).toBeNull();

      // Must use screenInk flat pin payload instead of brass screw
      const screenInkPayload = hexToSvgPayload(lightTheme.screenInk);
      expect(stringified).toContain(String(screenInkPayload));

      // Calculates exact direct triangle path for 7.4 (-109.5°):
      // rad = -109.5 * PI / 180 = -1.9111
      // tipX = (75 + 46 * cos(rad)) = 59.64
      // tipY = (75 + 46 * sin(rad)) = 31.64
      expect(stringified).toMatch(/L 59\.64 31\.64/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. SkeuoPanel Tests
  // --------------------------------------------------------------------------
  describe('SkeuoPanel', () => {
    it('includes theme.cardShadow in normal mode', async () => {
      const { getByTestId } = await renderWithMaterial(
        <SkeuoPanel testID="panel-normal">
          <Text>Content</Text>
        </SkeuoPanel>,
        { flat: false }
      );
      const flatStyle = StyleSheet.flatten(getByTestId('panel-normal').props.style);

      expect(flatStyle.elevation).toBe(3);
      expect(flatStyle.borderBottomWidth).toBe(3);
      expect(flatStyle.borderBottomColor).toBe(lightTheme.borderStrong);
      expect(flatStyle.borderTopColor).toBe(lightTheme.highlight);
      expect(flatStyle.borderRadius).toBe(14);
    });

    it('strips cardShadow when reducedEffects=true but keeps border structure', async () => {
      const { getByTestId } = await renderWithMaterial(
        <SkeuoPanel testID="panel-flat">
          <Text>Content</Text>
        </SkeuoPanel>,
        { flat: true }
      );
      const flatStyle = StyleSheet.flatten(getByTestId('panel-flat').props.style);

      expect(flatStyle.elevation).toBeUndefined();
      expect(flatStyle.shadowOffset).toBeUndefined();
      expect(flatStyle.borderBottomWidth).toBe(3);
      expect(flatStyle.borderBottomColor).toBe(lightTheme.borderStrong);
      expect(flatStyle.borderRadius).toBe(14);
      expect(flatStyle.backgroundColor).toBe(lightTheme.surface);
    });
  });
});
