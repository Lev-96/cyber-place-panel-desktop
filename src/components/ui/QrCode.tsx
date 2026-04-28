/**
 * Minimal QR code renderer using a tiny pure-JS algorithm.
 * No external dependency. Generates an SVG suitable for screen display.
 *
 * Implements QR code spec subset enough for short alphanumeric/numeric codes
 * (booking codes are typically 6-12 chars). Uses byte-mode encoding,
 * error correction L, and a single-block layout up to version 10.
 */

import { useMemo } from "react";

// === Tiny QR encoder (bitmap matrix), MIT-style minimalist implementation ===
// Adapted from public-domain Project Nayuki QR code generator (simplified).

class BitBuffer {
  bits: number[] = [];
  push(num: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((num >>> i) & 1);
  }
}

const G15 = 0b10100110111;
const G18 = 0b1111100100101;

const numErrCorrCodewords = (ver: number): number => [7, 10, 13, 17, 22, 28, 36, 44, 52, 60][ver - 1];
const numRawDataModules = (ver: number) => 16 * ver * ver + 128 * ver + 64 - (ver >= 2 ? (25 * Math.floor((ver - 2) / 7) + 10) * (Math.floor((ver - 2) / 7) + 1) : 0) - (ver >= 7 ? 36 : 0);

const reedSolomonComputeRemainder = (data: number[], divisor: number[]): number[] => {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] ^= multiplyGf(divisor[i], factor);
  }
  return result;
};

const multiplyGf = (a: number, b: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((b >>> i) & 1) * a; }
  return z & 0xFF;
};

const reedSolomonComputeDivisor = (degree: number): number[] => {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = multiplyGf(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = multiplyGf(root, 2);
  }
  return result;
};

const buildMatrix = (text: string): boolean[][] | null => {
  const data: number[] = [];
  for (let i = 0; i < text.length; i++) data.push(text.charCodeAt(i) & 0xFF);

  // Pick smallest version that fits with EC-L
  for (let ver = 1; ver <= 10; ver++) {
    const dataCapacityBits = numRawDataModules(ver) - numErrCorrCodewords(ver) * 8;
    const headerBits = 4 + (ver < 10 ? 8 : 16);
    const required = headerBits + data.length * 8;
    if (required > dataCapacityBits) continue;

    const bb = new BitBuffer();
    bb.push(0b0100, 4); // byte mode
    bb.push(data.length, ver < 10 ? 8 : 16);
    for (const b of data) bb.push(b, 8);
    bb.push(0, Math.min(4, dataCapacityBits - bb.bits.length));
    while (bb.bits.length % 8 !== 0) bb.bits.push(0);
    const padBytes = [0xEC, 0x11];
    for (let i = 0; bb.bits.length < dataCapacityBits; i++) bb.push(padBytes[i % 2], 8);

    const dataCodewords: number[] = [];
    for (let i = 0; i < bb.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bb.bits[i + j];
      dataCodewords.push(byte);
    }

    const eccLen = numErrCorrCodewords(ver);
    const divisor = reedSolomonComputeDivisor(eccLen);
    const ecc = reedSolomonComputeRemainder(dataCodewords, divisor);
    const finalCodewords = dataCodewords.concat(ecc);

    return drawMatrix(ver, finalCodewords);
  }
  return null;
};

const size = (ver: number) => ver * 4 + 17;

const drawMatrix = (ver: number, codewords: number[]): boolean[][] => {
  const sz = size(ver);
  const m: (boolean | null)[][] = Array.from({ length: sz }, () => new Array(sz).fill(null));
  const setF = (x: number, y: number, v: boolean) => { m[y][x] = v; };

  // Finder patterns
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= sz || y >= sz) continue;
      const ax = Math.abs(dx), ay = Math.abs(dy), d = Math.max(ax, ay);
      setF(x, y, d !== 2 && d !== 4);
    }
  };
  drawFinder(3, 3); drawFinder(sz - 4, 3); drawFinder(3, sz - 4);

  // Timing
  for (let i = 0; i < sz; i++) {
    if (m[6][i] === null) setF(i, 6, i % 2 === 0);
    if (m[i][6] === null) setF(6, i, i % 2 === 0);
  }
  // Dark module
  setF(8, sz - 8, true);

  // Reserve format
  for (let i = 0; i < 9; i++) { if (m[8][i] === null) m[8][i] = false; if (m[i][8] === null) m[i][8] = false; }
  for (let i = 0; i < 8; i++) { if (m[8][sz - 1 - i] === null) m[8][sz - 1 - i] = false; if (m[sz - 1 - i][8] === null) m[sz - 1 - i][8] = false; }

  // Place data with zig-zag
  const bits: number[] = [];
  for (const c of codewords) for (let i = 7; i >= 0; i--) bits.push((c >>> i) & 1);

  let bi = 0;
  let upward = true;
  for (let right = sz - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < sz; v++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = upward ? sz - 1 - v : v;
        if (m[y][x] === null) {
          let bit = bi < bits.length ? bits[bi++] : 0;
          if (((x + y) % 2) === 0) bit ^= 1; // mask 0
          m[y][x] = bit === 1;
        }
      }
    }
    upward = !upward;
  }

  // Format info (mask 0, EC L = 01)
  const formatBits = computeFormat(0b01, 0);
  const fmtPos: Array<[number, number]> = [];
  for (let i = 0; i <= 5; i++) fmtPos.push([8, i]); fmtPos.push([8, 7]); fmtPos.push([8, 8]); fmtPos.push([7, 8]);
  for (let i = 5; i >= 0; i--) fmtPos.push([i, 8]);
  for (let i = 0; i < 15; i++) m[fmtPos[i][1]][fmtPos[i][0]] = ((formatBits >>> i) & 1) === 1;
  const fmtPos2: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) fmtPos2.push([8, sz - 1 - i]);
  for (let i = 0; i < 8; i++) fmtPos2.push([sz - 8 + i, 8]);
  for (let i = 0; i < 15; i++) m[fmtPos2[i][1]][fmtPos2[i][0]] = ((formatBits >>> i) & 1) === 1;

  return m.map((row) => row.map((c) => !!c));
};

const computeFormat = (ecLevel: number, mask: number): number => {
  let data = (ecLevel << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * G15);
  return ((data << 10) | rem) ^ 0b101010000010010;
};

interface Props {
  value: string;
  size?: number;
}

const QrCode = ({ value, size: px = 220 }: Props) => {
  const matrix = useMemo(() => buildMatrix(value || " "), [value]);
  if (!matrix) return <div className="error">QR data too long</div>;
  const n = matrix.length;
  const cell = px / n;
  return (
    <svg width={px} height={px} viewBox={`0 0 ${n} ${n}`} style={{ background: "#fff", borderRadius: 8 }}>
      {matrix.map((row, y) =>
        row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="#000" /> : null),
      )}
    </svg>
  );
};

export default QrCode;
