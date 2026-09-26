// Deterministic, dependency-free raster version of the local vector brand mark.
import { deflateSync } from 'node:zlib'
import { writeFile } from 'node:fs/promises'
function crc32(data) {
  let crc = 0xffffffff
  for (const b of data) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type)
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([size, t, data, crc])
}
for (const size of [192, 512]) {
  const pixels = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x / size) * 128 - 64,
        dy = (y / size) * 128 - 64
      const rx = dx * Math.cos(0.61) - dy * Math.sin(0.61) + 64,
        ry = dx * Math.sin(0.61) + dy * Math.cos(0.61) + 64
      const shapes = [
        [38, 59, 52, 10],
        [29, 41, 12, 46],
        [17, 49, 10, 30],
        [87, 41, 12, 46],
        [101, 49, 10, 30],
      ]
      const inside = shapes.some(
        ([sx, sy, w, h]) => rx >= sx && rx <= sx + w && ry >= sy && ry <= sy + h,
      )
      const at = y * (size * 4 + 1) + 1 + x * 4
      const color = inside ? [224, 170, 134] : [20, 18, 16]
      pixels.set([...color, 255], at)
    }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  await writeFile(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}
