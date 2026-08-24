// Generates the PWA / home-screen icons into public/.
// Hand-rolled PNG encoder so the build needs no image dependency.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const BG = [0x0f, 0x76, 0x6e]
const FG = [0xf8, 0xfa, 0xfc]

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3
      raw[p++] = rgb[i]
      raw[p++] = rgb[i + 1]
      raw[p++] = rgb[i + 2]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Coverage of the basket glyph at normalised point (u, v), scaled about centre.
function inGlyph(u, v, scale) {
  const x = (u - 0.5) / scale
  const y = (v - 0.5) / scale

  // Basket body: trapezoid, wider at the top.
  const top = -0.04
  const bottom = 0.3
  if (y >= top && y <= bottom) {
    const t = (y - top) / (bottom - top)
    const halfWidth = 0.3 - 0.1 * t
    if (Math.abs(x) <= halfWidth) return true
  }

  // Handle: arc rising out of the basket rim.
  if (y <= top) {
    const r = Math.hypot(x, y - top)
    if (r <= 0.2 && r >= 0.145) return true
  }

  return false
}

function render(size, scale) {
  const rgb = Buffer.alloc(size * size * 3)
  const SS = 3 // supersample factor, for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size
          const v = (y + (sy + 0.5) / SS) / size
          if (inGlyph(u, v, scale)) hits++
        }
      }
      const a = hits / (SS * SS)
      const i = (y * size + x) * 3
      for (let c = 0; c < 3; c++) {
        rgb[i + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a)
      }
    }
  }
  return rgb
}

mkdirSync(OUT, { recursive: true })

const targets = [
  ['favicon.png', 64, 1],
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  // Maskable icons get cropped to a safe zone, so shrink the glyph.
  ['icon-512-maskable.png', 512, 0.7],
]

for (const [name, size, scale] of targets) {
  writeFileSync(join(OUT, name), encodePng(size, render(size, scale)))
  console.log(`wrote public/${name} (${size}x${size})`)
}
