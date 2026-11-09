let csrf = '';
export class ApiError extends Error {
  constructor(
    public code: string,
    public details?: any,
  ) {
    super(messages[code] || 'Ada kendala. Silakan coba lagi.');
  }
}
const messages: Record<string, string> = {
  LOGIN_REQUIRED: 'Silakan masuk untuk melanjutkan.',
  INVALID_CREDENTIALS: 'Email atau kata sandi belum sesuai.',
  MFA_REQUIRED: 'Masukkan kode autentikator admin yang berlaku.',
  INVALID_INPUT: 'Periksa kembali kolom yang Anda isi.',
  ALREADY_EXISTS: 'Data tersebut sudah terdaftar.',
  OUT_OF_STOCK: 'Stok berubah. Periksa kembali keranjang Anda.',
  SHIPPING_UNAVAILABLE: 'Alamat ini belum masuk area pengiriman.',
  QUOTE_CHANGED: 'Harga atau ongkir berubah. Cek dan konfirmasi total terbaru.',
  PAYMENTS_NOT_CONFIGURED: 'Pembayaran belum diaktifkan pada toko demo ini.',
  CHECKOUT_PAUSED: 'Checkout sedang dihentikan sementara.',
  IDEMPOTENCY_CONFLICT: 'Permintaan checkout berubah. Periksa pesanan Anda sebelum mengulang.',
  FORBIDDEN: 'Anda tidak memiliki akses ke halaman ini.',
  CSRF_INVALID: 'Sesi berubah. Muat ulang halaman dan coba lagi.',
  RESET_EXPIRED: 'Tautan sudah dipakai atau kedaluwarsa.',
  RATE_LIMITED: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
  STOCK_BELOW_RESERVED: 'Stok fisik tidak boleh kurang dari stok yang ditahan dan dialokasikan.',
  VARIANT_REQUIRED: 'Tambahkan varian sebelum menerbitkan produk.',
  ORDER_ON_HOLD: 'Pesanan belum dapat dikirim.',
  INVALID_TRANSITION: 'Urutan status pengiriman tidak sesuai.',
};
export async function api<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const r = await fetch('/api/v1' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { 'x-csrf-token': csrf } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new ApiError(data.error, data.details);
  if (path === '/auth/session') csrf = data.csrf;
  return data;
}
export const money = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
export const paymentLabel: Record<string, string> = {
  pending: 'Menunggu pembayaran',
  checking: 'Sedang memeriksa pembayaran',
  paid: 'Pembayaran diterima',
  review: 'Pembayaran sedang ditinjau',
  cancel: 'Pembayaran dibatalkan',
  expire: 'Pembayaran kedaluwarsa',
  deny: 'Pembayaran ditolak',
  failure: 'Pembayaran gagal',
};
export const shippingLabel: Record<string, string> = {
  unprocessed: 'Belum diproses',
  ready: 'Siap dikirim',
  shipped: 'Dalam pengiriman',
  delivered: 'Diterima',
};
