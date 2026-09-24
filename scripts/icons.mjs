// Gera os ícones do PWA a partir de um SVG desenhado aqui: uma bola sobre o quadrado verde
// do logo do cabeçalho. Rode `node scripts/icons.mjs` depois de mudar o desenho; os PNGs
// saem pelo navegador do Playwright (Edge no Windows, como nos testes).
//
// - public/favicon.svg e public/icons/icon.svg: o desenho, com cantos arredondados;
// - icon-192.png e icon-512.png: "any" do manifesto;
// - icon-maskable-512.png: fundo até a borda e bola dentro da zona segura (80% central),
//   porque o Android recorta o ícone em círculo ou gota;
// - apple-touch-icon.png (180): quadrado opaco; o iOS arredonda sozinho;
// - favicon.ico: PNG de 32 px, como o arquivo que substitui.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ROOT } from './lib/migrations.mjs';

const PUBLIC = join(ROOT, 'public');
const ICONS = join(PUBLIC, 'icons');

const round = (n) => Math.round(n * 100) / 100;
const point = (cx, cy, r, degrees) => {
  const a = (degrees * Math.PI) / 180;
  return [round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))];
};
const polygon = (points) => points.map((p) => p.join(',')).join(' ');

/** Bola de futebol (icosaedro truncado visto de frente para um pentágono), raio `R`. */
function ball(cx, cy, R) {
  const dark = '#0b1220';
  const rc = 0.3 * R; // pentágono central
  const d = 0.86 * R; // distância dos pentágonos da borda
  const ro = 0.3 * R;
  const angles = [0, 1, 2, 3, 4].map((k) => -90 + 72 * k);
  const central = angles.map((t) => point(cx, cy, rc, t));
  const outer = angles.map((t) => {
    const [ox, oy] = point(cx, cy, d, t);
    // Um vértice aponta para o centro da bola.
    return {
      inner: point(ox, oy, ro, t + 180),
      left: point(ox, oy, ro, t + 108),
      right: point(ox, oy, ro, t - 108),
      shape: [180, 108, 36, -36, -108].map((o) => point(ox, oy, ro, t + o)),
    };
  });
  const seams = [];
  angles.forEach((_, k) => {
    const next = outer[(k + 1) % 5];
    seams.push([central[k], outer[k].inner]);
    seams.push([outer[k].left, next.right]);
  });
  const width = round(0.055 * R);
  return `
  <defs>
    <radialGradient id="shade" cx="38%" cy="32%" r="75%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#d7dde5"/>
    </radialGradient>
    <clipPath id="ball"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#shade)"/>
  <g clip-path="url(#ball)" fill="${dark}" stroke="${dark}" stroke-width="${width}" stroke-linejoin="round">
    <polygon points="${polygon(central)}"/>
    ${outer.map((o) => `<polygon points="${polygon(o.shape)}"/>`).join('\n    ')}
    ${seams.map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`).join('\n    ')}
  </g>
  <circle cx="${cx}" cy="${cy}" r="${round(R - width / 2)}" fill="none" stroke="${dark}" stroke-width="${width}"/>`;
}

/** `corner` em unidades do viewBox 100; 0 deixa o fundo até a borda. */
function icon({ corner, radius }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#34d399"/>
      <stop offset="1" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="${corner}" fill="url(#bg)"/>${ball(50, 50, radius)}
</svg>
`;
}

const rounded = icon({ corner: 22, radius: 31 });
// Zona segura do maskable: círculo de raio 40. A bola fica em 30, com folga.
const fullBleed = icon({ corner: 0, radius: 30 });

mkdirSync(ICONS, { recursive: true });
writeFileSync(join(PUBLIC, 'favicon.svg'), rounded);
writeFileSync(join(ICONS, 'icon.svg'), rounded);

const outputs = [
  { file: join(ICONS, 'icon-192.png'), svg: rounded, size: 192 },
  { file: join(ICONS, 'icon-512.png'), svg: rounded, size: 512 },
  { file: join(ICONS, 'icon-maskable-512.png'), svg: fullBleed, size: 512 },
  { file: join(ICONS, 'apple-touch-icon.png'), svg: fullBleed, size: 180 },
  { file: join(PUBLIC, 'favicon.ico'), svg: rounded, size: 32 },
];

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
});
try {
  const page = await browser.newPage();
  for (const { file, svg, size } of outputs) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${sized}</body></html>`
    );
    await page.screenshot({ path: file, omitBackground: true, type: 'png' });
    console.log(`${file.slice(ROOT.length + 1)} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
