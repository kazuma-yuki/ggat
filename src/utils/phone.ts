// Validasi nomor handphone Indonesia.
// Nomor seluler Indonesia: diawali "08", panjang total 10-13 digit.
// Contoh sah: 081234567 (X) | 0812345678 (10) s.d. 081234567890 (12) | 0812345678901 (13)

export const PHONE_MIN_LENGTH = 10;
export const PHONE_MAX_LENGTH = 13;

/** Buang semua karakter non-digit dan potong sesuai batas maksimal. */
export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
}

/**
 * Kembalikan pesan kesalahan bila nomor tidak valid, atau null bila sudah benar.
 * Dipakai bersama oleh form Transaksi Baru dan Jasa Service Motor.
 */
export function getPhoneError(value: string): string | null {
  const phone = value.trim();

  if (phone === '') return 'Nomor handphone wajib diisi';
  if (!phone.startsWith('08')) return 'Nomor handphone harus diawali 08';
  if (phone.length < PHONE_MIN_LENGTH)
    return `Nomor handphone minimal ${PHONE_MIN_LENGTH} digit`;
  if (phone.length > PHONE_MAX_LENGTH)
    return `Nomor handphone maksimal ${PHONE_MAX_LENGTH} digit`;

  return null;
}

/** true bila nomor sudah memenuhi seluruh aturan. */
export function isPhoneValid(value: string): boolean {
  return getPhoneError(value) === null;
}
