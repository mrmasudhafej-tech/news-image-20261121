// THE WORLD TODAY — Saturday 21 November 2026
// A newspaper front page drawn from scratch in Node 22 (standard library
// only): a hand-written 5x7 bitmap font, a tiny raster canvas, and a
// from-scratch PNG encoder. Writes /output/entry.png (or
// $MAKEFUN_OUTPUT_DIR/entry.png). No network, fully deterministic — every
// run writes the same bytes.
//
// The day's stories (all happened, or first reported, on 21 November 2026):
//   - ICJ rules Myanmar committed genocide against the Rohingya — the first
//     time the court has held a state guilty of genocide (Reuters, NHK, Dawn)
//   - Russian missiles hit Poland as Kyiv's bridges burn: ~110 missiles and
//     400 drones, at least eight killed, three Kyiv bridges destroyed
//     (Moneycontrol, Dawn, 360LiveNews)
//   - Trump, Xi and Putin meet in Shenzhen on the APEC sidelines: a peace
//     promise with no breakthrough; Trump calls Putin "a friend of mine"
//     (News18, Dawn, The Hindu)
//   - Britain and the EU clinch a deal to reset post-Brexit ties (Dawn)
//   - Young protesters rally across Europe against inflation and arms
//     spending (Dawn, 21 Nov)
//   - Fresh arson attacks rock Bangladesh amid political unrest (Dawn)
//   - Houthis claim new strikes on Saudi Arabia; Riyadh's tallest
//     skyscraper hit (Dawn)
//   - Voyager 1 becomes the first human-made object one light-day from
//     Earth, 49 years after launch
//   - Tech shares slide as Anthropic shares fall; Mamdani plans to close
//     Rikers Island jail by 2032; an Anthropic researcher claims Claude
//     proved the Riemann Hypothesis

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG out
// CRC-32 (IEEE) table, built once at startup.
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// One PNG chunk: length, type, data, CRC.
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Encode an RGB pixel buffer as a 1024x1024 (or any size) PNG.
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter type 0 (none) on every scanline
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ canvas
type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 228]; // newsprint cream
const INK: RGB = [24, 20, 15];
const RED: RGB = [168, 28, 28];
const BLUE: RGB = [28, 74, 116];
const GREY: RGB = [110, 106, 94];
const PALE: RGB = [233, 227, 209];
const NAVY: RGB = [20, 38, 60];
const NIGHT: RGB = [12, 20, 32];
const GOLD: RGB = [238, 194, 78];
const EMBER: RGB = [216, 84, 32];
const SMOKE: RGB = [118, 122, 126];
const TEAL: RGB = [16, 92, 110];
const SKY: RGB = [158, 186, 202];
const WHITE: RGB = [249, 247, 241];

// A tiny raster canvas: a flat RGB buffer with rect, disc, line and polygon
// fills, plus an optional clip rectangle so pictograms stay in their panel.
class Canvas {
  readonly w: number;
  readonly h: number;
  private px: Uint8Array;
  private clip: [number, number, number, number] | null = null;

  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    this.fill(0, 0, w, h, bg);
  }

  setClip(x: number, y: number, w: number, h: number): void {
    this.clip = [Math.round(x), Math.round(y), Math.round(w), Math.round(h)];
  }

  clearClip(): void {
    this.clip = null;
  }

  put(x: number, y: number, c: RGB): void {
    if (this.clip) {
      const [cx, cy, cw, ch] = this.clip;
      if (x < cx || y < cy || x >= cx + cw || y >= cy + ch) return;
    }
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }

  fill(x: number, y: number, w: number, h: number, c: RGB): void {
    let x0 = Math.max(0, Math.round(x));
    let y0 = Math.max(0, Math.round(y));
    let x1 = Math.min(this.w, Math.round(x + w));
    let y1 = Math.min(this.h, Math.round(y + h));
    if (this.clip) {
      const [cx, cy, cw, ch] = this.clip;
      x0 = Math.max(x0, cx);
      y0 = Math.max(y0, cy);
      x1 = Math.min(x1, cx + cw);
      y1 = Math.min(y1, cy + ch);
    }
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.w + xx) * 3;
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
      }
    }
  }

  // Hollow rectangle, 1px border.
  frame(x: number, y: number, w: number, h: number, c: RGB): void {
    this.fill(x, y, w, 1, c);
    this.fill(x, y + h - 1, w, 1, c);
    this.fill(x, y, 1, h, c);
    this.fill(x + w - 1, y, 1, h, c);
  }

  // Filled disc.
  disc(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.round(r);
    for (let dy = -rr; dy <= rr; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
      for (let xx = -dx; xx <= dx; xx++) this.put(cx + xx, cy + dy, c);
    }
  }

  // 1px circle outline.
  ring(cx: number, cy: number, r: number, c: RGB): void {
    const rr = Math.round(r);
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      this.put(Math.round(cx + rr * Math.cos(t)), Math.round(cy + rr * Math.sin(t)), c);
    }
  }

  // Bresenham line; thickness > 1 stamps discs along it.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, thick = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      if (thick <= 1) this.put(x, y, c);
      else this.disc(x, y, Math.floor(thick / 2), c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Even-odd scanline polygon fill; pts is a flat [x, y, x, y, ...] list.
  poly(pts: number[], c: RGB): void {
    const n = pts.length / 2;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minY = Math.min(minY, pts[i * 2 + 1]);
      maxY = Math.max(maxY, pts[i * 2 + 1]);
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const x0 = pts[i * 2];
        const y0 = pts[i * 2 + 1];
        const x1 = pts[j * 2];
        const y1 = pts[j * 2 + 1];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) {
          this.put(x, y, c);
        }
      }
    }
  }

  // Starburst: a filled centre with radiating spikes.
  burst(cx: number, cy: number, r: number, spikes: number, c: RGB): void {
    this.disc(cx, cy, Math.round(r * 0.45), c);
    for (let i = 0; i < spikes; i++) {
      const a = (i * Math.PI * 2) / spikes;
      this.line(cx, cy, Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), c, 3);
    }
    this.disc(cx, cy, Math.round(r * 0.45), c);
  }

  toPNG(): Buffer {
    return encodePNG(this.w, this.h, this.px);
  }
}

// -------------------------------------------------------------------- font
// Hand-drawn 5x7 bitmap font, '#' is ink and '.' is empty. Glyphs with
// descenders (g, j, p, q, y) use 8 rows; the rest are padded to 8 rows so
// every cell is 5x8.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.####', '#....', '#....', '#....', '.####'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.', '.##..'],
  k: ['#....', '#....', '#.#..', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '•': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
};

for (const k of Object.keys(FONT)) {
  while (FONT[k].length < 8) FONT[k].push('.....');
}

function textWidth(s: string, scale: number): number {
  let w = 0;
  for (const _ch of s) w += 6 * scale;
  return w > 0 ? w - scale : 0; // no trailing gap after the last glyph
}

function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of s) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 8; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '#') cv.fill(cx + col * scale, cy + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

// Word-wrap plain text to a pixel width; returns lines without trailing spaces.
function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      let rest = w;
      while (textWidth(rest, scale) > maxW) {
        const take = Math.max(1, Math.floor(maxW / (6 * scale)));
        lines.push(rest.slice(0, take));
        rest = rest.slice(take);
      }
      cur = rest;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw wrapped text; returns the y just below the last line.
function drawPara(cv: Canvas, s: string, x: number, y: number, maxW: number, scale: number, c: RGB, lh?: number): number {
  const lines = wrapText(s, maxW, scale);
  const step = lh ?? Math.round(9 * scale);
  lines.forEach((ln, i) => drawText(cv, ln, x, y + i * step, scale, c));
  return y + lines.length * step;
}

// Centre a line of text on cx.
function drawCentred(cv: Canvas, s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(cv, s, cx - textWidth(s, scale) / 2, y, scale, c);
}

// ------------------------------------------------------------- pictograms
// Each pictogram draws inside (x, y, w, h) and clips to that rectangle.

// Lead picture: the court — a courthouse front with the scales of justice.
function drawCourt(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, NAVY);
  // Sky glow behind the roof.
  cv.disc(x + Math.round(w * 0.5), y + Math.round(h * 0.42), Math.round(h * 0.55), [30, 56, 84]);
  // Courthouse: plinth, columns, pediment.
  const bx = x + Math.round(w * 0.08);
  const bw = Math.round(w * 0.84);
  const by = y + Math.round(h * 0.34);
  const bh = Math.round(h * 0.5);
  cv.fill(bx, by + bh, bw, Math.round(h * 0.1), PALE); // steps
  cv.fill(bx, by, bw, bh, PALE); // hall
  cv.poly([bx - 8, by, bx + bw / 2, by - Math.round(h * 0.22), bx + bw + 8, by], [214, 205, 180]); // pediment
  cv.disc(bx + bw / 2, by - Math.round(h * 0.1), Math.round(h * 0.05), GOLD); // roundel
  const cols = 5;
  for (let i = 0; i < cols; i++) {
    const cx0 = bx + Math.round(((i + 0.5) * bw) / cols) - 7;
    cv.fill(cx0, by + 6, 14, bh - 6, [196, 186, 160]); // column
    cv.fill(cx0 - 3, by + 2, 20, 6, [226, 218, 196]); // capital
  }
  cv.fill(bx + Math.round(bw * 0.42), by + Math.round(bh * 0.55), Math.round(bw * 0.16), Math.round(bh * 0.45), NAVY); // door
  // Scales of justice, gold, in front of the hall.
  const sx = x + Math.round(w * 0.5);
  const sy = y + Math.round(h * 0.62);
  cv.fill(sx - 2, sy - 44, 4, 62, GOLD); // post
  cv.fill(sx - 52, sy - 44, 104, 4, GOLD); // beam
  cv.disc(sx, sy - 50, 6, GOLD); // finial
  for (const sgn of [-1, 1]) {
    const px = sx + sgn * 48;
    cv.line(sx + sgn * 48, sy - 40, px - 16, sy - 8, GOLD, 2);
    cv.line(sx + sgn * 48, sy - 40, px + 16, sy - 8, GOLD, 2);
    cv.poly([px - 20, sy - 8, px + 20, sy - 8, px, sy + 12], GOLD); // pan
  }
  cv.clearClip();
}

// Missile arcs over a night skyline, with a bridge burning below.
function drawStrike(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, NIGHT);
  const stars: [number, number][] = [
    [14, 18], [52, 10], [96, 24], [150, 12], [205, 20], [260, 10], [315, 22],
    [370, 14], [34, 44], [128, 40], [230, 44], [340, 42], [180, 56],
  ];
  for (const [sx, sy] of stars) cv.disc(x + sx, y + sy, 2, WHITE);
  cv.disc(x + Math.round(w * 0.86), y + 34, 16, [238, 232, 200]); // moon
  cv.disc(x + Math.round(w * 0.86) - 6, y + 28, 13, NIGHT);
  // Missile trails arcing down onto the city.
  const trails: [number, number, number, number][] = [
    [30, 8, 120, 96],
    [180, 4, 240, 110],
    [330, 10, 300, 118],
  ];
  for (const [x0, y0, x1, y1] of trails) {
    cv.line(x + x0, y + y0, x + x1, y + y1, GOLD, 2);
    cv.disc(x + x1, y + y1, 4, GOLD);
  }
  // Skyline.
  const towers: [number, number, number][] = [
    [0, 54, 74], [58, 40, 52], [100, 66, 92], [170, 48, 64],
    [222, 76, 104], [302, 44, 58], [350, 60, 80],
  ];
  for (const [bx, bw, bh] of towers) {
    cv.fill(x + bx, y + h - bh - 26, bw, bh, [34, 52, 76]);
  }
  // Lit windows.
  for (let i = 0; i < 26; i++) {
    const wx = x + 8 + ((i * 37) % 360);
    const wy = y + h - 40 - ((i * 53) % 76);
    cv.fill(wx, wy, 4, 5, GOLD);
  }
  // Explosions over two rooftops.
  cv.burst(x + 133, y + h - 96, 26, 9, EMBER);
  cv.burst(x + 260, y + h - 110, 20, 8, GOLD);
  cv.disc(x + 133, y + h - 96, 8, [250, 220, 120]);
  cv.disc(x + 260, y + h - 110, 6, [250, 220, 120]);
  // River bridge at the bottom, one span broken.
  const by = y + h - 26;
  cv.fill(x, by, w, 4, [90, 92, 96]); // deck
  cv.fill(x + 60, by + 4, 8, 22, [90, 92, 96]);
  cv.fill(x + 190, by + 4, 8, 22, [90, 92, 96]);
  cv.fill(x + 320, by + 4, 8, 22, [90, 92, 96]);
  cv.line(x + 130, by, x + 150, by - 18, [120, 124, 128], 2); // broken span
  cv.line(x + 190, by, x + 170, by - 18, [120, 124, 128], 2);
  cv.fill(x, by + 4, w, h - 26 - 4, [16, 52, 74]); // river
  cv.clearClip();
}

// Three flags on poles above a round table: the Shenzhen summit.
function drawSummit(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, PALE);
  const fw = Math.round(w * 0.28);
  const fh = Math.round(h * 0.52);
  const fy = y + Math.round(h * 0.1);
  const gap = Math.round((w - 3 * fw) / 4);
  // United States: stripes and canton.
  let fx = x + gap;
  for (let s = 0; s < 7; s++) {
    cv.fill(fx, fy + Math.round((s * fh) / 7), fw, Math.round(fh / 7) + 1, s % 2 ? WHITE : [178, 34, 52]);
  }
  cv.fill(fx, fy, Math.round(fw * 0.45), Math.round(fh * 0.5), NAVY);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      cv.disc(fx + 6 + c * 9, fy + 6 + r * 9, 1, WHITE);
    }
  }
  // China: red field, gold stars.
  fx = x + 2 * gap + fw;
  cv.fill(fx, fy, fw, fh, [222, 44, 32]);
  cv.burst(fx + 16, fy + 14, 9, 5, GOLD);
  cv.disc(fx + 34, fy + 10, 2, GOLD);
  cv.disc(fx + 40, fy + 18, 2, GOLD);
  cv.disc(fx + 38, fy + 28, 2, GOLD);
  // Russia: white, blue, red bands.
  fx = x + 3 * gap + 2 * fw;
  cv.fill(fx, fy, fw, Math.round(fh / 3), WHITE);
  cv.fill(fx, fy + Math.round(fh / 3), fw, Math.round(fh / 3), [0, 62, 150]);
  cv.fill(fx, fy + Math.round((2 * fh) / 3), fw, fh - Math.round((2 * fh) / 3), [206, 32, 40]);
  // Poles.
  for (let i = 0; i < 3; i++) {
    const px = x + gap + i * (fw + gap) - 2;
    cv.fill(px, fy, 3, Math.round(h * 0.78), INK);
    cv.disc(px + 1, fy - 2, 3, GOLD);
  }
  // Round table with three seats.
  const ty = y + Math.round(h * 0.82);
  cv.fill(x + Math.round(w * 0.14), ty, Math.round(w * 0.72), 6, [120, 84, 52]);
  cv.fill(x + Math.round(w * 0.2), ty + 6, 8, Math.round(h * 0.12), [120, 84, 52]);
  cv.fill(x + Math.round(w * 0.78), ty + 6, 8, Math.round(h * 0.12), [120, 84, 52]);
  for (const cx of [0.28, 0.5, 0.72]) {
    cv.disc(x + Math.round(w * cx), ty - 8, 7, NAVY);
  }
  cv.clearClip();
}

// Small icons for the bottom grid (each draws in a w x h box).
function drawProtest(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, [214, 226, 232]);
  // Placards on sticks.
  const boards: [number, number, RGB][] = [
    [18, 8, RED],
    [86, 2, BLUE],
    [156, 10, TEAL],
  ];
  for (const [bx, by, c] of boards) {
    cv.fill(x + bx, y + by, 52, 26, c);
    cv.fill(x + bx + 24, y + by + 26, 4, 26, INK);
  }
  // Crowd heads.
  for (let i = 0; i < 8; i++) {
    const hx = x + 14 + i * 26;
    const hy = y + h - 18 - (i % 2) * 6;
    cv.disc(hx, hy, 9, [58, 44, 36]);
    cv.fill(hx - 10, hy + 8, 20, 12, [90, 84, 74]);
  }
  cv.clearClip();
}

function drawFlame(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, [26, 22, 20]);
  const cx = x + Math.round(w / 2);
  const cy = y + h - 8;
  cv.poly([cx - 34, cy, cx - 26, cy - 26, cx - 10, cy - 44, cx, cy - 58, cx + 12, cy - 40, cx + 28, cy - 22, cx + 34, cy], EMBER);
  cv.poly([cx - 18, cy, cx - 12, cy - 18, cx, cy - 32, cx + 12, cy - 16, cx + 18, cy], GOLD);
  cv.disc(cx - 44, y + 12, 5, SMOKE);
  cv.disc(cx - 30, y + 6, 7, SMOKE);
  cv.disc(cx + 40, y + 10, 6, SMOKE);
  cv.clearClip();
}

function drawTower(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, [226, 214, 188]);
  const tx = x + Math.round(w * 0.42);
  cv.fill(tx, y + 18, 34, h - 18, [52, 58, 66]); // skyscraper
  cv.fill(tx + 8, y + 8, 18, 10, [52, 58, 66]); // crown
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      cv.fill(tx + 5 + c * 10, y + 26 + r * 8, 5, 4, GOLD);
    }
  }
  cv.burst(tx + 17, y + 14, 18, 8, EMBER); // impact burst
  cv.fill(x + 12, y + h - 14, 60, 14, [52, 58, 66]); // neighbour block
  cv.fill(x + w - 76, y + h - 22, 64, 22, [52, 58, 66]);
  cv.clearClip();
}

function drawVoyager(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.setClip(x, y, w, h);
  cv.fill(x, y, w, h, NIGHT);
  for (let i = 0; i < 22; i++) {
    cv.disc(x + 6 + ((i * 53) % (w - 12)), y + 6 + ((i * 29) % (h - 12)), 1, WHITE);
  }
  // The Sun, far behind.
  cv.disc(x + 20, y + h - 16, 12, GOLD);
  cv.ring(x + 20, y + h - 16, 17, GOLD);
  // Dashed trajectory.
  for (let d = 0; d < 9; d++) {
    cv.disc(x + 34 + d * 18, y + h - 22 - d * 5, 2, SKY);
  }
  // The probe: bus, dish and boom.
  const px = x + Math.round(w * 0.68);
  const py = y + Math.round(h * 0.42);
  cv.line(px - 26, py + 10, px + 26, py - 6, [180, 184, 188], 3); // boom
  cv.disc(px + 28, py - 7, 4, GOLD); // tip
  cv.poly([px - 6, py - 12, px + 14, py - 6, px + 6, py + 10, px - 12, py + 4], [200, 204, 208]); // bus
  cv.line(px - 2, py - 12, px - 16, py - 26, [180, 184, 188], 2); // dish arm
  cv.poly([px - 26, py - 30, px - 6, py - 30, px - 16, py - 18], [220, 224, 228]); // dish
  cv.clearClip();
}

// ------------------------------------------------------------- front page
const W = 1024;
const H = 1024;
const M = 24; // page margin

function drawFrontPage(): Canvas {
  const cv = new Canvas(W, H, PAPER);

  // ---- masthead
  cv.fill(M, 16, W - 2 * M, 3, INK);
  drawCentred(cv, 'THE WORLD TODAY', W / 2, 28, 8, INK);
  drawText(cv, 'SATURDAY 21 NOVEMBER 2026', M, 100, 2, INK);
  const tag = 'ONE DAY, ONE PAGE';
  drawText(cv, tag, W - M - textWidth(tag, 2), 100, 2, GREY);
  cv.fill(M, 124, W - 2 * M, 2, INK);

  // ---- lead story: the world court ruling (left, wide)
  drawCourt(cv, M, 140, 592, 130);
  drawPara(cv, 'WORLD COURT: MYANMAR GUILTY OF GENOCIDE', M, 282, 592, 4, RED);
  drawPara(
    cv,
    'The International Court of Justice has ruled that Myanmar committed genocide against the Rohingya in 2017 - the first time the court has held a state guilty of the crime. Myanmar calls the verdict unfair; Rohingya refugees welcome it.',
    M,
    364,
    592,
    2,
    INK,
  );

  // ---- right column: the Shenzhen summit, then the UK-EU deal
  drawSummit(cv, 632, 140, 368, 96);
  drawPara(cv, 'TRUMP, XI AND PUTIN: PEACE TALK, NO DEAL', 632, 246, 368, 3, INK);
  drawPara(
    cv,
    'The three leaders met in Shenzhen on the APEC sidelines. Trump called Putin "a friend of mine". No breakthrough was announced.',
    632,
    310,
    368,
    2,
    INK,
  );
  cv.fill(632, 410, 368, 2, INK);
  drawPara(cv, 'BRITAIN AND EU CLINCH RESET DEAL', 632, 420, 368, 2, BLUE);

  // ---- middle band: missiles over Kyiv and Poland
  cv.fill(M, 466, W - 2 * M, 2, INK);
  drawText(cv, 'UKRAINE WAR', 440, 478, 2, RED);
  drawStrike(cv, M, 500, 400, 190);
  drawPara(cv, 'RUSSIAN MISSILES HIT POLAND, KYIV BURN', 440, 500, 560, 4, INK);
  drawPara(
    cv,
    'Moscow fired about 110 missiles and 400 drones overnight; at least eight people were killed and three bridges in Kyiv were destroyed. Two missiles and a drone came down in Poland. Warsaw calls it a deliberate provocation; NATO calls it a grave violation.',
    440,
    584,
    560,
    2,
    INK,
  );

  // ---- bottom grid: four more stories of the day
  cv.fill(M, 708, W - 2 * M, 2, INK);
  const cols: { x: number; icon: (cv: Canvas, x: number, y: number, w: number, h: number) => void; head: string; body: string }[] = [
    {
      x: 24,
      icon: drawProtest,
      head: 'PROTESTS SWEEP EUROPE',
      body: 'Young crowds rally across Europe against inflation and arms spending.',
    },
    {
      x: 272,
      icon: drawFlame,
      head: 'FRESH ARSON IN BANGLADESH',
      body: 'Arson attacks erupt as unrest grows before Sheikh Hasina returns.',
    },
    {
      x: 520,
      icon: drawTower,
      head: 'HOUTHIS CLAIM NEW SAUDI STRIKES',
      body: "Rebels say they hit targets in the kingdom; Riyadh's tallest tower was hit.",
    },
    {
      x: 768,
      icon: drawVoyager,
      head: 'VOYAGER 1: ONE LIGHT-DAY',
      body: '49 years after launch, the probe is the first human-made object a light-day from Earth.',
    },
  ];
  for (const col of cols) {
    col.icon(cv, col.x, 716, 232, 64);
    drawPara(cv, col.head, col.x, 790, 232, 2, RED);
    drawPara(cv, col.body, col.x, 834, 232, 2, INK);
  }

  // ---- footer ticker: the rest of the day
  cv.fill(M, 952, W - 2 * M, 2, INK);
  drawCentred(cv, 'ALSO TODAY: TECH SHARES SLIDE - MAMDANI TO CLOSE RIKERS BY 2032', W / 2, 962, 2, INK);
  drawCentred(cv, 'ANTHROPIC RESEARCHER CLAIMS CLAUDE PROVED THE RIEMANN HYPOTHESIS - UNVERIFIED', W / 2, 984, 2, GREY);
  drawCentred(
    cv,
    'Sources: Reuters, NHK, Dawn, The Hindu, News18, Moneycontrol - all stories reported 21 November 2026',
    W / 2,
    1008,
    1,
    GREY,
  );

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), drawFrontPage().toPNG());
}

main();
