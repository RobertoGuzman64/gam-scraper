import { deflateRawSync, inflateRawSync } from "node:zlib";

export type ZipFile = { readonly name: string; readonly data: string };
export type ZipContent = { readonly name: string; readonly data: Buffer };

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const checksum = (data: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crcTable[(crc ^ byte) & 255] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

export const createZipArchive = (files: readonly ZipFile[]): Buffer => {
  if (files.length === 0 || files.length > 65535 || new Set(files.map((file) => file.name)).size !== files.length) {
    throw new Error("ZIP: entradas vacías o duplicadas");
  }
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let position = 0;
  for (const file of files) {
    if (!file.name || file.name.includes("\\") || file.name.startsWith("/") ||
      file.name.split("/").some((part) => part === ".." || part === "")) {
      throw new Error(`ZIP: nombre de entrada inválido: ${file.name}`);
    }
    const name = Buffer.from(file.name, "utf8");
    const content = Buffer.from(file.data, "utf8");
    const compressed = deflateRawSync(content);
    if (name.length > 65535 || content.length > 0xffffffff || compressed.length > 0xffffffff ||
      position + 30 + name.length + compressed.length > 0xffffffff) {
      throw new Error("ZIP: archivo demasiado grande");
    }
    const crc = checksum(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(position, 42);
    central.push(entry, name);
    position += header.length + name.length + compressed.length;
  }
  const centralSize = central.reduce((size, buffer) => size + buffer.length, 0);
  if (position + centralSize + 22 > 0xffffffff) throw new Error("ZIP: archivo demasiado grande");
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(position, 16);
  return Buffer.concat([...local, ...central, end]);
};

export const readZipArchive = (archive: Buffer): readonly ZipContent[] => {
  if (archive.length < 22) throw new Error("ZIP: archivo incompleto");
  const end = archive.length - 22;
  if (archive.readUInt32LE(end) !== 0x06054b50 ||
    archive.readUInt16LE(end + 4) !== 0 || archive.readUInt16LE(end + 6) !== 0 ||
    archive.readUInt16LE(end + 8) !== archive.readUInt16LE(end + 10) ||
    archive.readUInt16LE(end + 20) !== 0) throw new Error("ZIP: directorio final inválido");
  const count = archive.readUInt16LE(end + 10);
  const centralSize = archive.readUInt32LE(end + 12);
  const centralOffset = archive.readUInt32LE(end + 16);
  if (count === 0 || centralOffset + centralSize !== end) throw new Error("ZIP: directorio incompleto");
  const files: ZipContent[] = [];
  const spans: { start: number; end: number }[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > end || archive.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("ZIP: entrada del directorio inválida");
    }
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const size = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const offset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || flags !== 0x0800 || method !== 8 || offset + 30 > centralOffset) {
      throw new Error("ZIP: entrada incompatible o truncada");
    }
    const name = archive.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (!name || files.some((file) => file.name === name)) throw new Error("ZIP: entrada duplicada o vacía");
    if (archive.readUInt32LE(offset) !== 0x04034b50 ||
      archive.readUInt16LE(offset + 6) !== flags || archive.readUInt16LE(offset + 8) !== method ||
      archive.readUInt32LE(offset + 14) !== crc ||
      archive.readUInt32LE(offset + 18) !== compressedSize || archive.readUInt32LE(offset + 22) !== size ||
      archive.readUInt16LE(offset + 26) !== nameLength || archive.readUInt16LE(offset + 28) !== 0 ||
      archive.toString("utf8", offset + 30, offset + 30 + nameLength) !== name) {
      throw new Error("ZIP: cabecera local diferente del directorio");
    }
    const start = offset + 30 + nameLength;
    const stop = start + compressedSize;
    if (stop > centralOffset) throw new Error("ZIP: datos truncados");
    let data: Buffer;
    try { data = inflateRawSync(archive.subarray(start, stop)); }
    catch { throw new Error(`ZIP: entrada corrupta: ${name}`); }
    if (data.length !== size || checksum(data) !== crc) throw new Error(`ZIP: CRC o tamaño inválido: ${name}`);
    files.push({ name, data });
    spans.push({ start: offset, end: stop });
    cursor = next;
  }
  spans.sort((a, b) => a.start - b.start);
  if (cursor !== end || spans[0]?.start !== 0 || spans.at(-1)?.end !== centralOffset ||
    spans.some((span, index) => index > 0 && span.start !== spans[index - 1]?.end)) {
    throw new Error("ZIP: estructura incompleta");
  }
  return files;
};
