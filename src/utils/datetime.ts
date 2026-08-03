// Pembantu tanggal & waktu berbasis waktu lokal perangkat (WIB bagi pengguna).
//
// Catatan penting: Date.toISOString() selalu mengubah waktu ke UTC. Pada rentang
// pukul 00.00-06.59 WIB, tanggal UTC masih tertinggal satu hari, sehingga
// transaksi dini hari akan tercatat pada tanggal kemarin. Karena itu tanggal
// dan stempel waktu dibentuk manual dari komponen waktu lokal.

const pad = (n: number): string => String(n).padStart(2, '0');

/** Tanggal lokal dalam format YYYY-MM-DD, mis. 2026-08-04. */
export const localYMD = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Stempel waktu lokal tanpa konversi UTC, mis. 2026-08-04T00:40:12. */
export const localISO = (d: Date = new Date()): string =>
  `${localYMD(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** Tanggal lokal n hari yang lalu dalam format YYYY-MM-DD. */
export const localYMDDaysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localYMD(d);
};
