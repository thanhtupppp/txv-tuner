const fs = require('fs');
const path = require('path');

// 1. Đọc trực tiếp src/constants/theme.js để trích xuất bảng palettes
const themePath = path.resolve(__dirname, '..', 'src', 'constants', 'theme.js');
const themeContent = fs.readFileSync(themePath, 'utf8');

// Trích xuất đoạn mã định nghĩa palettes
const palettesMatch = themeContent.match(/const palettes = ({[\s\S]*?\n};)/);
if (!palettesMatch) {
  console.error('Không tìm thấy object palettes trong theme.js');
  process.exit(1);
}

// Chuyển const palettes = {...}; thành JSON / JS object
const cleanPalettesStr = palettesMatch[1].replace(/;$/, '');
const palettes = new Function(`return ${cleanPalettesStr}`)();

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function sRgbToLinear(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(sRgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

console.log('========================================================================================');
console.log(' BÁO CÁO ĐO TƯƠNG PHẢN WCAG 2.1 - TRÍCH XUẤT NGUỒN TRỰC TIẾP TỪ src/constants/theme.js');
console.log('========================================================================================\n');

for (const mode of ['light', 'dark']) {
  const p = palettes[mode];
  console.log(`>>> [CHẾ ĐỘ ${mode.toUpperCase()}] <<<`);
  console.log(`Nguồn: theme.onAccent = "${p.onAccent}", screenBg = "${p.screenBg}", screenInk = "${p.screenInk}"\n`);
  
  console.log('1. KIỂM THỬ STATUS BADGE (Chữ theme.onAccent trên nền trạng thái):');
  console.log('----------------------------------------------------------------------------------------');
  const badgePairs = [
    { label: 'Trạng thái OPTIMAL (Tối ưu)', bgKey: 'optimal', bgHex: p.optimal },
    { label: 'Trạng thái COLD (Quá lạnh / Thấp)', bgKey: 'cold', bgHex: p.cold },
    { label: 'Trạng thái DANGER (Quá nhiệt cao)', bgKey: 'danger', bgHex: p.danger },
    { label: 'Trạng thái WARNING (Cảnh báo)', bgKey: 'warning', bgHex: p.warning },
  ];

  for (const item of badgePairs) {
    const cr = contrastRatio(p.onAccent, item.bgHex);
    const lumFg = relativeLuminance(p.onAccent).toFixed(4);
    const lumBg = relativeLuminance(item.bgHex).toFixed(4);
    const pass = cr >= 7.0 ? 'ĐẠT AAA (>= 7:1)' : (cr >= 4.5 ? 'ĐẠT AA (>= 4.5:1)' : 'KHÔNG ĐẠT (< 4.5:1)');
    console.log(`- ${item.label.padEnd(36)}: Nền [theme.${item.bgKey} = ${item.bgHex}] vs Chữ [theme.onAccent = ${p.onAccent}]`);
    console.log(`  Luminance: L(nền)=${lumBg}, L(chữ)=${lumFg} => Contrast Ratio: ${cr.toFixed(2)}:1 | ${pass}\n`);
  }

  console.log('2. ĐỐI CHỨNG VỚI MÀN HÌNH LCD (Số trên nền theme.screenBg):');
  console.log('----------------------------------------------------------------------------------------');
  const lcdPairs = [
    { label: 'Chữ số chuẩn screenInk (HIỆN TẠI)', fgKey: 'screenInk', fgHex: p.screenInk },
    { label: 'Chữ nhãn mờ screenMuted (HIỆN TẠI)', fgKey: 'screenMuted', fgHex: p.screenMuted },
    { label: 'Chữ số theo màu optimal (CŨ - ĐÃ BỎ)', fgKey: 'optimal', fgHex: p.optimal },
    { label: 'Chữ số theo màu cold (CŨ - ĐÃ BỎ)', fgKey: 'cold', fgHex: p.cold },
    { label: 'Chữ số theo màu danger (CŨ - ĐÃ BỎ)', fgKey: 'danger', fgHex: p.danger },
  ];

  for (const item of lcdPairs) {
    const cr = contrastRatio(item.fgHex, p.screenBg);
    const lumFg = relativeLuminance(item.fgHex).toFixed(4);
    const lumBg = relativeLuminance(p.screenBg).toFixed(4);
    const pass = cr >= 7.0 ? 'ĐẠT AAA (>= 7:1)' : (cr >= 4.5 ? 'ĐẠT AA (>= 4.5:1)' : 'KHÔNG ĐẠT (< 4.5:1)');
    console.log(`- ${item.label.padEnd(38)}: Chữ [theme.${item.fgKey} = ${item.fgHex}] trên Nền [${p.screenBg}]`);
    console.log(`  Luminance: L(chữ)=${lumFg}, L(nền)=${lumBg} => Contrast Ratio: ${cr.toFixed(2)}:1 | ${pass}\n`);
  }
  console.log('----------------------------------------------------------------------------------------\n');
}
