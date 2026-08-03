// Batasan nilai masukan sistem Garage Garage Amat.
// Dikumpulkan di satu berkas agar mudah disesuaikan bila skala usaha berubah.

/**
 * Batas stok per produk.
 * Garage Garage Amat merupakan bengkel skala kecil, sehingga persediaan
 * tiap jenis spare part tidak melebihi 100 unit.
 */
export const MAX_STOCK = 100;

/**
 * Batas nominal uang tunai yang dibayarkan pelanggan.
 * Nilai transaksi terbesar di bengkel berkisar beberapa juta rupiah,
 * sehingga Rp10.000.000 memberi ruang aman sekaligus menangkal salah ketik
 * (misalnya 33000000 yang seharusnya 3300000).
 */
export const MAX_CASH_PAYMENT = 10_000_000;

/**
 * Batas atas uang bayar yang berlaku untuk suatu transaksi.
 * Bila total belanja melampaui MAX_CASH_PAYMENT, batas mengikuti total
 * agar transaksi yang sah tidak pernah terhalang.
 */
export const cashLimitFor = (total: number): number =>
  Math.max(MAX_CASH_PAYMENT, Math.ceil(total));

/** Potong masukan tunai agar tidak melebihi batas transaksi berjalan. */
export const clampCash = (digits: string, total: number): string => {
  const onlyDigits = digits.replace(/\D/g, '');
  if (onlyDigits === '') return '';
  return String(Math.min(Number(onlyDigits), cashLimitFor(total)));
};

/** Pesan kesalahan bila nominal tunai tidak valid, atau null bila sudah benar. */
export const getCashError = (paid: number, total: number): string | null => {
  if (paid < total) return 'Uang pembayaran kurang dari total belanja';
  const limit = cashLimitFor(total);
  if (paid > limit)
    return `Uang dibayar maksimal Rp${limit.toLocaleString('id-ID')}`;
  return null;
};
