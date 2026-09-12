import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'resources', 'icon.png')
const outDir = join(root, 'server', 'public')
const linuxIconDir = join(root, 'resources', 'linux-icons')
const ICON_FILL = { r: 91, g: 95, b: 238, alpha: 1 }

mkdirSync(outDir, { recursive: true })
mkdirSync(linuxIconDir, { recursive: true })
copyFileSync(source, join(outDir, 'icon.png'))

async function pngBuffer(size, { flatten = false } = {}) {
  let image = sharp(source).resize(size, size, {
    fit: 'contain',
    background: flatten ? ICON_FILL : { r: 0, g: 0, b: 0, alpha: 0 },
  })
  if (flatten) image = image.flatten({ background: ICON_FILL })
  const data = await image.png().toBuffer()
  return { width: size, height: size, data }
}

async function png(size, name, { flatten = false } = {}) {
  const buffer = await pngBuffer(size, { flatten })
  writeFileSync(join(outDir, name), buffer.data)
  return buffer
}

async function linuxPng(size) {
  const buffer = await pngBuffer(size, { flatten: true })
  writeFileSync(join(linuxIconDir, `${size}x${size}.png`), buffer.data)
}

function encodeIco(images) {
  const headerSize = 6 + 16 * images.length
  let offset = headerSize
  const entries = images.map((image) => {
    const entry = { ...image, offset }
    offset += image.data.length
    return entry
  })
  const buf = Buffer.alloc(offset)
  buf.writeUInt16LE(0, 0)
  buf.writeUInt16LE(1, 2)
  buf.writeUInt16LE(images.length, 4)
  let cursor = 6
  for (const entry of entries) {
    buf.writeUInt8(entry.width >= 256 ? 0 : entry.width, cursor)
    buf.writeUInt8(entry.height >= 256 ? 0 : entry.height, cursor + 1)
    buf.writeUInt8(0, cursor + 2)
    buf.writeUInt8(0, cursor + 3)
    buf.writeUInt16LE(1, cursor + 4)
    buf.writeUInt16LE(32, cursor + 6)
    buf.writeUInt32LE(entry.data.length, cursor + 8)
    buf.writeUInt32LE(entry.offset, cursor + 12)
    cursor += 16
  }
  for (const entry of entries) entry.data.copy(buf, entry.offset)
  return buf
}

function encodeIcns(images) {
  const payloadSize = images.reduce((total, image) => total + 8 + image.data.length, 0)
  const buffer = Buffer.alloc(8 + payloadSize)
  buffer.write('icns', 0, 4, 'ascii')
  buffer.writeUInt32BE(buffer.length, 4)
  let offset = 8
  for (const image of images) {
    buffer.write(image.type, offset, 4, 'ascii')
    buffer.writeUInt32BE(8 + image.data.length, offset + 4)
    image.data.copy(buffer, offset + 8)
    offset += 8 + image.data.length
  }
  return buffer
}

const favicon16 = await png(16, 'favicon-16.png')
const favicon32 = await png(32, 'favicon-32.png')
const favicon48 = await png(48, 'favicon-48.png')
await png(180, 'apple-touch-icon.png', { flatten: true })
copyFileSync(join(outDir, 'apple-touch-icon.png'), join(outDir, 'apple-touch-icon-precomposed.png'))
await png(192, 'icon-192.png')
await png(512, 'icon-512.png')
writeFileSync(join(outDir, 'favicon.ico'), encodeIco([favicon16, favicon32, favicon48]))

const appIco = encodeIco(
  await Promise.all([16, 24, 32, 48, 64, 128, 256].map((size) => pngBuffer(size, { flatten: true }))),
)
writeFileSync(join(root, 'public', 'icon.ico'), appIco)

const macIconSizes = [16, 32, 128, 256, 512, 1024]
const macIconTypes = ['icp4', 'icp5', 'ic07', 'ic08', 'ic09', 'ic10']
const macIconImages = await Promise.all(macIconSizes.map(async (size, index) => ({
  type: macIconTypes[index],
  data: (await pngBuffer(size)).data,
})))
writeFileSync(join(root, 'resources', 'icon.icns'), encodeIcns(macIconImages))

for (const size of [16, 32, 48, 64, 128, 256, 512]) await linuxPng(size)

writeFileSync(
  join(outDir, 'site.webmanifest'),
  `${JSON.stringify(
    {
      name: 'Tudso',
      short_name: 'Tudso',
      icons: [
        { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#1c1c1f',
      background_color: '#1c1c1f',
      display: 'browser',
    },
    null,
    2,
  )}\n`,
)

console.log(`Wrote brand icons to ${outDir}`)
console.log(`Wrote app icon to ${join(root, 'public', 'icon.ico')}`)
console.log(`Wrote macOS icon to ${join(root, 'resources', 'icon.icns')}`)
console.log(`Wrote Linux icons to ${linuxIconDir}`)
