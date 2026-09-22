# Skeuomorphism — TXV Tuner

## Decision record

Reference: [Skeuomorphism skill](https://github.com/thanhtupppp/ui-morphism-design-skills/blob/main/skills/skeuomorphism/SKILL.md), including its component recipes, platform mapping and React Native adapter. Primary style: Skeuomorphism, adapted to an instrument for refrigeration technicians. No additional visual style.

Use an opaque painted-metal housing, green recessed LCD readouts, raised mechanical keys and one brass screw illustration. Lighting comes from above. Keep charts and explanatory text on quiet, opaque surfaces. The screw illustrates a recommendation; it does not operate physical hardware.

## Semantic tokens and component recipes

`src/constants/theme.js` is the native adapter for the `--um-skeuomorphism-*` source-design namespace. Its `THEME` fields are app-level semantic roles rather than CSS variables.

| Role | Native token / recipe |
| --- | --- |
| Housing / panel | `bg`, `surface`, `metalTop`, `metalBottom`; 14–16px radius |
| Recessed field | `surfaceInset`, `borderStrong`; opaque field, permanent label |
| Instrument readout | `screenBg`, `screenInk`, `screenMuted`; monospace digits |
| Content | `ink`, `inkMuted`; separate from screen foreground colors |
| Primary / selected control | `accent`, `onAccent`; check mark and semantic checked state |
| Boundary / focus | `border`, `borderStrong`, `focus`; explicit focus border/outline |
| Geometry | `--um-skeuomorphism-target-min` = 48; spacing 16; radii 8/14 |
| Depth | `cardShadow`, `chipShadow`; top highlight, bottom edge, short contact shadow |
| Motion | `--um-skeuomorphism-motion-press` = 1; no continuous animation |

`SkeuoButton` uses Pressable for default, pressed, focus, selected/checked, disabled and busy semantics. Default keys are raised, pressed keys lose shadow and travel 1px. Disabled step buttons at temperature bounds retain their labels and expose disabled state.

`SkeuoInput` preserves native text entry and a separate focus border. `SkeuoNumberInput` permits intermediate minus/decimal characters and commits only valid numeric changes. `SkeuoSwitch` preserves the native switch inside a 48px-high layout region. Navigation exposes tab selection and retains calculator state while switching to the monitor.

The settings dialog includes an accessible input name, initial input focus, close action, empty-address error, saving state and a material-effects switch. It uses the native Modal and KeyboardAvoidingView.

## Platform, responsive and accessibility rules

- Targets: React Native/Expo and React Native Web. No Flutter or separate HTML example is generated.
- Required: opaque surfaces, visible boundaries, readable labels/values, native controls, explicit states, minimum button size and responsive layout.
- Preferred: platform elevation/shadow, pressed travel, bounded SVG gradients.
- Optional: metal sheen and brass shading. No remote image, texture, blur or new animation library.
- Compact: controls and readings wrap; the brand icon disappears below 360 effective pixels. Content remains scrollable and text can grow vertically.
- Tablet/desktop: retain the task order within a centered 960px maximum content width. Chart width is measured with `onLayout` instead of the initial device width.
- Explicit light/dark selection overrides system color preference. Native font scaling remains enabled; iOS uses Menlo for numeric readouts.
- Native accessibility state and web ARIA state are both supplied where needed. Check marks, labels and borders convey state without depending solely on color.
- Web focus is a separate 3px outline; forced-colors rules retain borders, selection, chart strokes and text.

## Deterministic fallback

Settings → **Giảm hiệu ứng vật liệu**, or the platform reduced-motion preference:

`metal + bevel + contact shadow → opaque surfaces + explicit borders + native controls`.

This removes header gradient, button/card shadows, press translation and screw gradient. It keeps content, selection, field labels, values and target sizes. Reduced-motion CSS also removes CSS transitions/animations. Unsupported native shadows degrade to borders. High-contrast CSS is independent of the light/dark preference.

## Verification record — 2026-09-22

- Expo production web and Android/Hermes bundles exported successfully with `npx expo export --platform web --platform android --output-dir dist-skeuo`.
- Browser visual checks: phone 320×740 and 390×844, tablet 768×1024, desktop 1440×1000; light and dark themes inspected at 390px.
- DOM measurement: no horizontal overflow at 320, 768 and 1440px; no button/radio/tab below 48px at 320 and 1440px.
- Verified selection updates, native switch operation, theme toggle and visible 3px keyboard focus.
- Verified empty IP error, dialog close and material fallback. Computed button shadow becomes `none` in fallback mode.
- Typed `-12.5` with the keyboard; changed target to 8K; sensor ticks and switching monitor → tuner preserved these manual values. Fixed the existing live-mode effect that ignored the pause switch.
- Verified condenser decrement stops at 20°C and disables both decrement controls. Increment uses the symmetric 65°C condition.
- Superheat chart bounds now include the actual readings and target, including readings above the previous fixed 16K maximum.
- Calculated 20 foreground/background pairs across both themes. Main text, muted text, input text, LCD text and selected-control text all exceed 4.5:1; lowest checked pair is light muted input text at 5.03:1.
- `git diff --check` passed (Git reports only local LF/CRLF conversion notices).

Not verified on physical Android/iOS devices, VoiceOver/TalkBack, native large-font settings, OS forced colors or a live ESP32. The web forced-colors and native reduced-motion branches are implemented but were not exercised through OS settings. This is not a full accessibility conformance certification. Upstream skill-repository validators are not run against this app: this change adapts the application, not the upstream four-renderer example suite.

## Preview

Run `npm run web` for the browser preview, or `npm start` for Expo. The web adapter dependencies are now included in the project.
