import sharp from 'sharp';
import toIco from 'to-ico';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '..');

const sourceLogoPath = resolve(workspaceRoot, 'assets', 'logo.svg');
const frontendBrandDir = resolve(workspaceRoot, 'webapp', 'frontend', 'assets', 'brand');
const ghBrandDir = resolve(workspaceRoot, 'packages', 'gh-extension', 'assets', 'brand');
const vscodeIconPath = resolve(workspaceRoot, 'packages', 'vscode-extension', 'media', 'icon.png');
const previewHtmlPath = resolve(workspaceRoot, 'artifacts', 'vscode-extension-icon-preview.html');

const brand = {
  background: '#0D1117',
  stroke: '#4B5563',
  accent: '#00FF41',
  accentSoft: 'rgba(0, 255, 65, 0.18)',
  text: '#F5F7FA',
  muted: '#9FB0C0',
  iconBackground: '#0B1017',
};

function createSquareLogoSvg(sourceSvg, { size = 512, inset = 36, radius = 120 } = {}) {
  const workingSize = size - inset * 2;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(sourceSvg, 'utf8').toString('base64')}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `  <rect width="${size}" height="${size}" rx="${radius}" fill="${brand.iconBackground}" />`,
    `  <image x="${inset}" y="${inset}" width="${workingSize}" height="${workingSize}" href="${dataUrl}" preserveAspectRatio="xMidYMid meet" />`,
    '</svg>',
  ].join('\n');
}

function createSocialCardSvg(sourceSvg) {
  const icon = createSquareLogoSvg(sourceSvg, { size: 256, inset: 22, radius: 34 }).replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">', '<svg x="822" y="96" width="256" height="256" viewBox="0 0 256 256">');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">',
    '  <defs>',
    '    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">',
    '      <stop offset="0%" stop-color="#081017" />',
    '      <stop offset="52%" stop-color="#0D1117" />',
    '      <stop offset="100%" stop-color="#132129" />',
    '    </linearGradient>',
    '    <linearGradient id="gridGlow" x1="0" x2="1" y1="0" y2="0">',
    '      <stop offset="0%" stop-color="rgba(0,255,65,0)" />',
    '      <stop offset="45%" stop-color="rgba(0,255,65,0.25)" />',
    '      <stop offset="100%" stop-color="rgba(0,255,65,0)" />',
    '    </linearGradient>',
    '  </defs>',
    '  <rect width="1200" height="630" fill="url(#bg)" />',
    '  <circle cx="1080" cy="122" r="168" fill="#00FF41" opacity="0.08" />',
    '  <circle cx="986" cy="566" r="238" fill="#00FF41" opacity="0.05" />',
    '  <rect x="40" y="40" width="1120" height="550" rx="36" fill="#0A141C" stroke="#22303D" stroke-width="2" />',
    '  <g opacity="0.5">',
    '    <path d="M 74 170 H 1126" stroke="url(#gridGlow)" stroke-width="2" />',
    '    <path d="M 74 234 H 1126" stroke="url(#gridGlow)" stroke-width="2" />',
    '    <path d="M 74 298 H 1126" stroke="url(#gridGlow)" stroke-width="2" />',
    '    <path d="M 74 362 H 1126" stroke="url(#gridGlow)" stroke-width="2" />',
    '    <path d="M 74 426 H 1126" stroke="url(#gridGlow)" stroke-width="2" />',
    '  </g>',
    '  <text x="92" y="120" fill="#00FF41" font-size="28" font-family="Segoe UI, Arial, sans-serif" letter-spacing="1.4">Audit code repositories for AI readiness</text>',
    '  <text x="92" y="244" fill="#F5F7FA" font-size="84" font-weight="700" font-family="Segoe UI, Arial, sans-serif">Is AI-Native?</text>',
    '  <text x="92" y="314" fill="#D7E0E7" font-size="40" font-family="Segoe UI, Arial, sans-serif">Scan &gt; Review &gt; Improve</text>',
    '  <text x="92" y="392" fill="#9FB0C0" font-size="27" font-family="Segoe UI, Arial, sans-serif">Instructions, skills, custom agents, agent hooks, MCP, and more</text>',
    '  <rect x="92" y="450" width="552" height="58" rx="29" fill="#0F1A20" stroke="#2B3640" />',
    '  <text x="122" y="488" font-size="24" font-family="Consolas, monospace">',
    '    <tspan fill="#00FF41">isainative.dev</tspan><tspan fill="#7C8E9E">/&lt;repo owner&gt;/&lt;repo name&gt;</tspan>',
    '  </text>',
    `  ${icon}`,
    '</svg>',
  ].join('\n');
}

function createPinnedTabSvg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '  <path d="M 208.944 78.231 C 130.517 78.231 104.374 130.516 104.374 182.802 C 104.374 235.086 52.089 256 52.089 256 C 52.089 256 104.374 276.913 104.374 329.199 C 104.374 381.483 130.517 433.768 208.944 433.768 M 303.057 78.231 C 381.483 78.231 407.627 130.516 407.627 182.802 C 407.627 235.086 459.911 256 459.911 256 C 459.911 256 407.627 276.913 407.627 329.199 C 407.627 381.483 381.483 433.768 303.057 433.768" fill="none" stroke="currentColor" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>',
    '  <path d="M 164.502 110.909 C 208.944 110.909 229.858 143.587 256 143.587 C 282.144 143.587 303.057 110.909 347.499 110.909 C 387.203 110.909 419.391 143.096 419.391 182.802 C 419.391 222.506 387.203 254.693 347.499 254.693 C 303.057 254.693 282.144 222.015 256 222.015 C 229.858 222.015 208.944 254.693 164.502 254.693 C 124.796 254.693 92.61 222.506 92.61 182.802 C 92.61 143.096 124.796 110.909 164.502 110.909 Z" fill="currentColor"/>',
    '  <circle cx="164.502" cy="182.802" r="41.828" fill="#fff"/>',
    '  <circle cx="347.498" cy="182.802" r="41.828" fill="#fff"/>',
    '</svg>',
  ].join('\n');
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function writeTextFile(filePath, content) {
  await writeFile(filePath, content, 'utf8');
}

async function writePng(filePath, svg, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(filePath);
}

async function main() {
  const sourceSvg = await readFile(sourceLogoPath, 'utf8');
  const logoSquareSvg = createSquareLogoSvg(sourceSvg, { size: 512, inset: 42, radius: 120 });
  const faviconSvg = createSquareLogoSvg(sourceSvg, { size: 512, inset: 52, radius: 120 });
  const maskableSvg = createSquareLogoSvg(sourceSvg, { size: 512, inset: 76, radius: 120 });
  const pinnedTabSvg = createPinnedTabSvg();
  const socialCardSvg = createSocialCardSvg(sourceSvg);

  await Promise.all([ensureDir(frontendBrandDir), ensureDir(ghBrandDir)]);

  await Promise.all([
    writeTextFile(resolve(frontendBrandDir, 'logo-square.svg'), logoSquareSvg),
    writeTextFile(resolve(frontendBrandDir, 'favicon.svg'), faviconSvg),
    writeTextFile(resolve(frontendBrandDir, 'icon-maskable.svg'), maskableSvg),
    writeTextFile(resolve(frontendBrandDir, 'pinned-tab.svg'), pinnedTabSvg),
    writeTextFile(resolve(frontendBrandDir, 'social-card.svg'), socialCardSvg),
    writeTextFile(resolve(ghBrandDir, 'logo-square.svg'), logoSquareSvg),
    writeTextFile(resolve(ghBrandDir, 'social-card.svg'), socialCardSvg),
  ]);

  const icon1024 = await sharp(Buffer.from(createSquareLogoSvg(sourceSvg, { size: 1024, inset: 84, radius: 240 }))).png().toBuffer();
  const icon512 = await sharp(Buffer.from(logoSquareSvg)).png().toBuffer();
  const icon192 = await sharp(Buffer.from(createSquareLogoSvg(sourceSvg, { size: 192, inset: 18, radius: 46 }))).png().toBuffer();
  const icon180 = await sharp(Buffer.from(createSquareLogoSvg(sourceSvg, { size: 180, inset: 16, radius: 44 }))).png().toBuffer();
  const mstile150 = await sharp(Buffer.from(createSquareLogoSvg(sourceSvg, { size: 150, inset: 14, radius: 36 }))).png().toBuffer();
  const favicon32 = await sharp(Buffer.from(faviconSvg)).resize(32, 32).png().toBuffer();
  const favicon16 = await sharp(Buffer.from(faviconSvg)).resize(16, 16).png().toBuffer();
  const maskable512 = await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toBuffer();
  const socialCardPng = await sharp(Buffer.from(socialCardSvg)).resize(1200, 630).png().toBuffer();
  const faviconIco = await toIco([favicon16, favicon32, icon180]);

  await Promise.all([
    writeFile(resolve(frontendBrandDir, 'icon-1024.png'), icon1024),
    writeFile(resolve(frontendBrandDir, 'icon-512.png'), icon512),
    writeFile(resolve(frontendBrandDir, 'icon-192.png'), icon192),
    writeFile(resolve(frontendBrandDir, 'apple-touch-icon.png'), icon180),
    writeFile(resolve(frontendBrandDir, 'mstile-150.png'), mstile150),
    writeFile(resolve(frontendBrandDir, 'favicon-32.png'), favicon32),
    writeFile(resolve(frontendBrandDir, 'favicon-16.png'), favicon16),
    writeFile(resolve(frontendBrandDir, 'favicon.ico'), faviconIco),
    writeFile(resolve(frontendBrandDir, 'icon-maskable-512.png'), maskable512),
    writeFile(resolve(frontendBrandDir, 'social-card.png'), socialCardPng),
    writeFile(resolve(ghBrandDir, 'icon.png'), icon512),
    writeFile(resolve(ghBrandDir, 'social-card.png'), socialCardPng),
    writeFile(vscodeIconPath, icon512),
  ]);

  await writeTextFile(
    previewHtmlPath,
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '  <meta charset="utf-8">',
      '  <style>',
      '    body { margin: 0; display: grid; place-items: center; height: 100vh; background: linear-gradient(135deg, #f4eddc, #dce7ef); font-family: Segoe UI, sans-serif; }',
      '    .frame { display: grid; gap: 18px; justify-items: center; padding: 32px 36px; border-radius: 28px; background: rgba(255,255,255,.72); box-shadow: 0 24px 60px rgba(15,23,42,.14); }',
      '    img { width: 192px; height: 192px; border-radius: 24px; }',
      '    p { margin: 0; color: #0b2336; font-size: 24px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }',
      '  </style>',
      '</head>',
      '<body>',
      '  <div class="frame">',
      '    <img src="../packages/vscode-extension/media/icon.png" alt="Is AI-Native extension icon">',
      '    <p>Marketplace icon preview</p>',
      '  </div>',
      '</body>',
      '</html>',
    ].join('\n')
  );

  process.stdout.write('Brand assets generated successfully.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});