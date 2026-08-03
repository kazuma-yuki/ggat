// Validasi Nomor Polisi (TNKB) Indonesia.
// Susunan: kode wilayah (1-2 huruf) + nomor urut (1-4 angka) + seri (0-3 huruf).
// Contoh sah: B 1234 XY, D 123 AB, BK 1234 ABC, B 1 A

export const PLATE_MIN_LENGTH = 3;   // tanpa spasi, mis. "B1A"
export const PLATE_MAX_LENGTH = 9;   // tanpa spasi, mis. "BK1234ABC"
export const PLATE_MAX_INPUT = 11;   // termasuk dua spasi pemisah

const PLATE_PATTERN = /^[A-Z]{1,2}[0-9]{1,4}[A-Z]{0,3}$/;

/** Seragamkan masukan: huruf besar, hanya huruf/angka/spasi, dipotong sesuai batas. */
export function sanitizePlate(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, PLATE_MAX_INPUT);
}

/** Buang spasi untuk keperluan pemeriksaan panjang dan pola. */
const compact = (value: string): string => value.replace(/\s/g, '');

/**
 * Kembalikan pesan kesalahan bila nomor polisi tidak valid, atau null bila benar.
 * Kolom ini opsional, sehingga nilai kosong dianggap sah.
 */
export function getPlateError(value: string): string | null {
  const plate = compact(value.trim());

  if (plate === '') return null; // opsional

  if (plate.length < PLATE_MIN_LENGTH)
    return `Nomor polisi minimal ${PLATE_MIN_LENGTH} karakter`;
  if (plate.length > PLATE_MAX_LENGTH)
    return `Nomor polisi maksimal ${PLATE_MAX_LENGTH} karakter`;
  if (!PLATE_PATTERN.test(plate))
    return 'Format nomor polisi tidak sesuai (contoh: B 1234 XY)';

  return null;
}

/** true bila nomor polisi kosong atau sudah memenuhi aturan. */
export function isPlateValid(value: string): boolean {
  return getPlateError(value) === null;
}
