// src/utils/emailService.ts
// Kirim OTP via backend FastAPI (/send-otp) menggunakan smtplib Python.
// Tidak perlu daftar layanan luar, tidak ada limit.

// Sesuaikan URL backend jika beda host/port
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export const sendOtpEmail = async (
  toEmail: string,
  toName: string,
  otpCode: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const res = await fetch(`${BACKEND_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: toEmail,
        to_name: toName,
        otp_code: otpCode,
      }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(detail.detail ?? `HTTP ${res.status}`);
    }

    return { success: true };
  } catch (err) {
    console.error('[sendOtpEmail]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mengirim OTP.',
    };
  }
};
