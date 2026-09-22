import { Platform } from 'react-native';

// Source-design namespace: --um-skeuomorphism-*. Native semantic adapter below.
export const SKEUOMORPHISM = {
  '--um-skeuomorphism-target-min': 48,
  '--um-skeuomorphism-radius-sm': 8,
  '--um-skeuomorphism-radius-md': 14,
  '--um-skeuomorphism-space': 16,
  '--um-skeuomorphism-motion-press': 1,
};
export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const palettes = {
  light: {
    bg: '#cbd0ce', surface: '#f0f1eb', surfaceInset: '#dfe3dd',
    surfaceRecessed: '#d3d9d3', ink: '#202e2b', inkMuted: '#52615a',
    border: '#9aa79e', borderStrong: '#6b7e72', cardBorder: '#ffffff',
    highlight: '#ffffff', shadowLight: '#ffffff', shadowDark: '#56635b',
    screenBg: '#182e29', screenInk: '#c6edc0', screenMuted: '#a7c6b5',
    brass: '#b38742', brassLight: '#f0d99d', cold: '#175c79',
    warning: '#8c4b16', purple: '#70488a', optimal: '#25633f',
    danger: '#a6332b', accent: '#225b48', onAccent: '#ffffff',
    focus: '#006cba', metalTop: '#fafbf6', metalBottom: '#c2cbc1',
  },
  dark: {
    bg: '#111b19', surface: '#293631', surfaceInset: '#1c2924',
    surfaceRecessed: '#18231f', ink: '#edf3e9', inkMuted: '#b1bfb4',
    border: '#596c5f', borderStrong: '#869c89', cardBorder: '#66796a',
    highlight: '#65796a', shadowLight: '#435748', shadowDark: '#050b08',
    screenBg: '#0b1a13', screenInk: '#c6edc0', screenMuted: '#a7c6b5',
    brass: '#b38742', brassLight: '#f0d99d', cold: '#86cfe6',
    warning: '#f2ba7b', purple: '#d5b2ea', optimal: '#a8dcb2',
    danger: '#ffa59a', accent: '#b1dcba', onAccent: '#142e20',
    focus: '#85ceff', metalTop: '#44574a', metalBottom: '#1b2920',
  },
};
export const THEME = Object.fromEntries(Object.entries(palettes).map(([mode, colors]) => [mode, {
  ...colors,
  cardShadow: {
    borderTopColor: colors.highlight, borderBottomWidth: 3, borderBottomColor: colors.borderStrong,
    shadowColor: '#09170e', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: mode === 'dark' ? 0.3 : 0.16, shadowRadius: 4, elevation: 3,
  },
  chipShadow: {
    shadowColor: '#09170e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 2, elevation: 2,
  },
}]));
