#!/usr/bin/env node
/*
 * Avatar preview sheets (openspec/specs/character-appearance.md): renders the code-drawn sprite to a
 * PNG without the app, so the art can be reviewed at an integer pixel scale next to the references.
 *
 *   node scripts/avatar-sheet.mjs --set gallery --scale 3 --out /path/gallery.png  (default: OS temp dir)
 *
 * Sets: gallery (mixed looks), hair (every style), outfit (every outfit), sizes (S/D/M/L × body A/B),
 * races (one per visual family), props (one per class prop), bust (head crops of mixed races), base (the
 * human base: both bodies, bald, skin and hair colours, a staff and a sword), ears (human, elves,
 * half-elf, gnome and furry races, and a caped fighter).
 * Options: --scale n (default 3), --bg #rrggbb (default #a3c98f, the reference green), --cols n,
 * --aura (draw the class aura), --gap n (sprite pixels between cells, default 4).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { set: 'gallery', scale: 3, bg: '#a3c98f', cols: 0, aura: false, gap: 4, out: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === '--set') { out.set = v; i++; }
    else if (k === '--scale') { out.scale = Math.max(1, Number.parseInt(v, 10) || 3); i++; }
    else if (k === '--bg') { out.bg = v; i++; }
    else if (k === '--cols') { out.cols = Number.parseInt(v, 10) || 0; i++; }
    else if (k === '--gap') { out.gap = Math.max(0, Number.parseInt(v, 10) || 0); i++; }
    else if (k === '--out') { out.out = v; i++; }
    else if (k === '--aura') out.aura = true;
  }
  if (!out.out) out.out = resolve(tmpdir(), `avatar-${out.set}.png`);
  return out;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** RGBA → PNG (8-bit, no interlace). */
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
      : raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function cellsFor(set, m) {
  const { resolveRaceVisual, defaultAppearance, HAIR_STYLES, OUTFITS, HAIR, CLOTH, EYES, SKIN, ALL_FAMILY_KEYS, visualByKey } = m;
  const human = resolveRaceVisual('Human');
  const base = defaultAppearance(human);
  const looks = [
    { race: 'Human', klass: 'Fighter', a: { hair: 1, hairColor: HAIR[2], outfit: 8, outfitColors: [CLOTH[6], CLOTH[15]], skin: SKIN.human[2] } },
    { race: 'Elf', klass: 'Wizard', a: { body: 1, hair: 5, hairColor: HAIR[5], outfit: 9, outfitColors: [CLOTH[8], CLOTH[2]], skin: SKIN.elf[1] } },
    { race: 'Dwarf', klass: 'Cleric', a: { hair: 7, hairColor: HAIR[8], outfit: 1, outfitColors: [CLOTH[0], CLOTH[2]] } },
    { race: 'Halfling', klass: 'Rogue', a: { body: 1, hair: 9, hairColor: HAIR[3], outfit: 7, outfitColors: [CLOTH[4], CLOTH[10]] } },
    { race: 'Tiefling', klass: 'Warlock', a: { body: 1, hair: 11, hairColor: HAIR[0], outfit: 5, outfitColors: [CLOTH[12], CLOTH[9]] } },
    { race: 'Dragonborn', klass: 'Paladin', a: { outfit: 8, outfitColors: [CLOTH[14], CLOTH[15]] } },
    { race: 'Half-Orc', klass: 'Barbarian', a: { hair: 4, hairColor: HAIR[0], outfit: 6, outfitColors: [CLOTH[11], CLOTH[1]] } },
    { race: 'Gnome', klass: 'Artificer', a: { hair: 2, hairColor: HAIR[7], outfit: 2, outfitColors: [CLOTH[13], CLOTH[1]] } },
    { race: 'Human', klass: 'Bard', a: { body: 1, hair: 10, hairColor: HAIR[4], outfit: 4, outfitColors: [CLOTH[7], CLOTH[3]], skin: SKIN.human[5] } },
    { race: 'Aasimar', klass: 'Sorcerer', a: { body: 1, hair: 3, hairColor: HAIR[6], outfit: 3, outfitColors: [CLOTH[3], CLOTH[15]] } },
    { race: 'Human', klass: 'Ranger', a: { hair: 8, hairColor: HAIR[1], outfit: 0, outfitColors: [CLOTH[5], CLOTH[11]], skin: SKIN.human[4] } },
    { race: 'Goliath', klass: 'Monk', a: { hair: 0, outfit: 6, outfitColors: [CLOTH[1], CLOTH[2]] } },
  ];
  const cell = (race, klass, patch) => {
    const v = resolveRaceVisual(race);
    return { v, klass, a: { ...defaultAppearance(v), ...patch } };
  };
  switch (set) {
    case 'hair': return HAIR_STYLES.flatMap((_, i) => [
      { v: human, klass: null, a: { ...base, hair: i, body: 0 } },
      { v: human, klass: null, a: { ...base, hair: i, body: 1, hairColor: HAIR[4] } },
    ]);
    case 'outfit': return OUTFITS.flatMap((_, i) => [
      { v: human, klass: null, a: { ...base, outfit: i, body: 0, outfitColors: [CLOTH[6], CLOTH[2]] } },
      { v: human, klass: null, a: { ...base, outfit: i, body: 1, outfitColors: [CLOTH[0], CLOTH[3]] } },
    ]);
    case 'base': return [
      { v: human, klass: null, a: { ...base, hair: 1, body: 0, outfitColors: [CLOTH[6], CLOTH[2]] } },
      { v: human, klass: null, a: { ...base, hair: 1, body: 1, outfitColors: [CLOTH[6], CLOTH[2]] } },
      { v: human, klass: null, a: { ...base, hair: 0, body: 0 } },
      { v: human, klass: 'Wizard', a: { ...base, hair: 1, skin: SKIN.human[0], hairColor: HAIR[5], eyes: EYES[1], outfitColors: [CLOTH[4], CLOTH[2]] } },
      { v: human, klass: 'Fighter', a: { ...base, hair: 1, body: 1, skin: SKIN.human[5], hairColor: HAIR[0], eyes: EYES[2], outfitColors: [CLOTH[12], CLOTH[15]] } },
      { v: human, klass: null, a: { ...base, hair: 1, skin: SKIN.human[3], hairColor: HAIR[8], outfitColors: [CLOTH[11], CLOTH[3]] } },
    ];
    case 'ears': return [
      cell('Human', null, { hair: 1 }),
      cell('Elf', null, { hair: 1, feature: 0 }),
      cell('Elf', null, { hair: 1, feature: 1 }),
      cell('Half-Elf', null, { hair: 1, feature: 0 }),
      cell('Gnome', null, { hair: 1 }),
      cell('Tabaxi', null, {}),
      cell('Harengon', null, {}),
      cell('Human', 'Fighter', { hair: 1, outfit: 8, outfitColors: [CLOTH[6], CLOTH[15]] }),
    ];
    case 'sizes': return ['Human', 'Halfling', 'Dwarf', 'Goliath'].flatMap((r) => [cell(r, null, { body: 0 }), cell(r, null, { body: 1 })]);
    case 'races': return ALL_FAMILY_KEYS.map((k) => { const v = visualByKey(k); return { v, klass: null, a: defaultAppearance(v) }; });
    case 'props': return ['Wizard', 'Fighter', 'Barbarian', 'Ranger', 'Rogue', 'Cleric', 'Bard', 'Artificer', 'Monk', null]
      .map((k, i) => ({ v: human, klass: k, a: { ...base, hair: (i % 11) + 1, eyes: EYES[i % EYES.length] } }));
    case 'bust': return ['Human', 'Elf', 'Dwarf', 'Halfling', 'Tiefling', 'Half-Orc', 'Gnome', 'Tabaxi', 'Goliath', 'Aasimar']
      .map((race) => cell(race, null, {}));
    case 'gallery':
    default: return looks.map((l) => cell(l.race, l.klass, l.a));
  }
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
  try {
    const m = await server.ssrLoadModule('/src/lib/avatar/index.ts');
    const r = await server.ssrLoadModule('/src/lib/avatar/render.ts');
    const auraFor = m.auraForClass;
    const W = r.AVATAR_W;
    const H = r.AVATAR_H;
    const bust = opt.set === 'bust';
    const cells = cellsFor(opt.set, m);
    const cw = bust ? 24 : W;
    const ch = bust ? 24 : H;
    const cols = opt.cols || Math.min(cells.length, opt.set === 'races' ? 10 : 6);
    const rows = Math.ceil(cells.length / cols);
    const g = opt.gap;
    const sw = cols * (cw + g) + g;
    const sh = rows * (ch + g) + g;
    const s = opt.scale;
    const out = Buffer.alloc(sw * s * sh * s * 4);
    const bg = [1, 3, 5].map((i) => Number.parseInt(opt.bg.slice(i, i + 2), 16));
    for (let i = 0; i < out.length; i += 4) { out[i] = bg[0]; out[i + 1] = bg[1]; out[i + 2] = bg[2]; out[i + 3] = 255; }
    cells.forEach((c, idx) => {
      const prop = bust ? null : r.propForClass(c.klass);
      const aura = opt.aura ? auraFor(c.klass) : null;
      const px = r.renderPixels(c.a, c.v, aura, prop);
      const crop = bust ? r.cropRect(c.v, c.a, 'bust') : { x: 0, y: 0, w: W, h: H };
      const ox = g + (idx % cols) * (cw + g);
      const oy = g + Math.floor(idx / cols) * (ch + g);
      for (let y = 0; y < crop.h; y++) {
        for (let x = 0; x < crop.w; x++) {
          const si = ((crop.y + y) * W + crop.x + x) * 4;
          const al = px[si + 3] / 255;
          if (!al) continue;
          for (let dy = 0; dy < s; dy++) {
            for (let dx = 0; dx < s; dx++) {
              const di = (((oy + y) * s + dy) * sw * s + (ox + x) * s + dx) * 4;
              for (let k = 0; k < 3; k++) out[di + k] = Math.round(px[si + k] * al + out[di + k] * (1 - al));
            }
          }
        }
      }
    });
    mkdirSync(dirname(resolve(opt.out)), { recursive: true });
    writeFileSync(opt.out, encodePng(sw * s, sh * s, out));
    console.log(`${opt.set}: ${cells.length} sprites → ${resolve(opt.out)} (${sw * s}×${sh * s})`);
  } finally {
    await server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
