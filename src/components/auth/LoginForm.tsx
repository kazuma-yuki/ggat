import React, { useState, useRef, useEffect } from 'react';
import { Lock, User, Mail, RefreshCw, CheckCircle, KeyRound } from 'lucide-react';
import { verifyCredentials, generateAndSendOtp, verifyOtp, loginAfterOtp, getUsers, updateUser } from '../../utils/auth';
import type { StoredUser } from '../../types';

interface LoginFormProps {
  onLogin: (success: boolean) => void;
}

type Step = 'credentials' | 'otp' | 'forgot_username' | 'forgot_otp' | 'forgot_newpassword' | 'forgot_success';

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  // Step 1 – Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credError, setCredError] = useState('');
  const [credLoading, setCredLoading] = useState(false);

  // Step 2 – OTP (login)
  const [step, setStep] = useState<Step>('credentials');
  const [pendingUser, setPendingUser] = useState<StoredUser | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Lupa Sandi
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotOtp, setForgotOtp] = useState(['', '', '', '', '', '']);
  const [forgotOtpError, setForgotOtpError] = useState('');
  const [forgotOtpLoading, setForgotOtpLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassError, setNewPassError] = useState('');
  const [newPassLoading, setNewPassLoading] = useState(false);
  const [forgotUser, setForgotUser] = useState<StoredUser | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const forgotOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // ── Step 1: cek username + password ──────────────────────────────────
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredLoading(true);
    setCredError('');

    const user = await verifyCredentials(username, password);
    if (!user) {
      setCredError('Username atau password tidak valid');
      setCredLoading(false);
      return;
    }

    setSendingOtp(true);
    const result = await generateAndSendOtp(user);
    setSendingOtp(false);
    setCredLoading(false);

    if (!result.success) {
      setCredError(result.error ?? 'Gagal mengirim OTP. Coba lagi.');
      return;
    }

    setPendingUser(user);
    setStep('otp');
    setResendCooldown(60);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  // ── Step 2: input OTP (login) ─────────────────────────────────────────
  const handleOtpChange = (idx: number, val: string) => {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...otp];
      digits.forEach((d, i) => { if (idx + i < 6) next[idx + i] = d; });
      setOtp(next);
      const focusIdx = Math.min(idx + digits.length, 5);
      otpRefs.current[focusIdx]?.focus();
      return;
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setOtpError('');
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    const code = otp.join('');
    if (code.length < 6) { setOtpError('Masukkan 6 digit kode OTP'); return; }

    setOtpLoading(true);
    setOtpError('');

    await new Promise(r => setTimeout(r, 400));

    const ok = verifyOtp(pendingUser.username, code);
    if (!ok) {
      setOtpError('Kode OTP salah atau sudah kadaluarsa');
      setOtpLoading(false);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      return;
    }

    loginAfterOtp(pendingUser);
    onLogin(true);
  };

  const handleResend = async () => {
    if (!pendingUser || resendCooldown > 0) return;
    setSendingOtp(true);
    setOtpError('');
    setOtp(['', '', '', '', '', '']);
    await generateAndSendOtp(pendingUser);
    setSendingOtp(false);
    setResendCooldown(60);
    otpRefs.current[0]?.focus();
  };

  // ── LUPA SANDI: Step 1 - Input Username ──────────────────────────────
  const handleForgotUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    const users = await getUsers();
    const found = users.find(u => u.username === forgotUsername.trim());

    if (!found) {
      setForgotError('Username tidak ditemukan');
      setForgotLoading(false);
      return;
    }

    if (!found.email) {
      setForgotError('Akun ini tidak memiliki email terdaftar');
      setForgotLoading(false);
      return;
    }

    setSendingOtp(true);
    const result = await generateAndSendOtp(found);
    setSendingOtp(false);
    setForgotLoading(false);

    if (!result.success) {
      setForgotError(result.error ?? 'Gagal mengirim OTP. Coba lagi.');
      return;
    }

    setForgotUser(found);
    setForgotOtp(['', '', '', '', '', '']);
    setStep('forgot_otp');
    setResendCooldown(60);
    setTimeout(() => forgotOtpRefs.current[0]?.focus(), 100);
  };

  // ── LUPA SANDI: Step 2 - Verifikasi OTP ──────────────────────────────
  const handleForgotOtpChange = (idx: number, val: string) => {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...forgotOtp];
      digits.forEach((d, i) => { if (idx + i < 6) next[idx + i] = d; });
      setForgotOtp(next);
      const focusIdx = Math.min(idx + digits.length, 5);
      forgotOtpRefs.current[focusIdx]?.focus();
      return;
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...forgotOtp];
    next[idx] = val;
    setForgotOtp(next);
    setForgotOtpError('');
    if (val && idx < 5) forgotOtpRefs.current[idx + 1]?.focus();
  };

  const handleForgotOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !forgotOtp[idx] && idx > 0) {
      forgotOtpRefs.current[idx - 1]?.focus();
    }
  };

  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUser) return;
    const code = forgotOtp.join('');
    if (code.length < 6) { setForgotOtpError('Masukkan 6 digit kode OTP'); return; }

    setForgotOtpLoading(true);
    setForgotOtpError('');

    await new Promise(r => setTimeout(r, 400));

    const ok = verifyOtp(forgotUser.username, code);
    if (!ok) {
      setForgotOtpError('Kode OTP salah atau sudah kadaluarsa');
      setForgotOtpLoading(false);
      setForgotOtp(['', '', '', '', '', '']);
      forgotOtpRefs.current[0]?.focus();
      return;
    }

    setForgotOtpLoading(false);
    setNewPassword('');
    setConfirmPassword('');
    setNewPassError('');
    setStep('forgot_newpassword');
  };

  const handleForgotResend = async () => {
    if (!forgotUser || resendCooldown > 0) return;
    setSendingOtp(true);
    setForgotOtpError('');
    setForgotOtp(['', '', '', '', '', '']);
    await generateAndSendOtp(forgotUser);
    setSendingOtp(false);
    setResendCooldown(60);
    forgotOtpRefs.current[0]?.focus();
  };

  // ── LUPA SANDI: Step 3 - Buat Password Baru ──────────────────────────
  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUser) return;

    if (newPassword.length < 6) {
      setNewPassError('Password minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewPassError('Konfirmasi password tidak sama');
      return;
    }

    setNewPassLoading(true);
    setNewPassError('');

    await updateUser(forgotUser.id!, { password: newPassword });

    setNewPassLoading(false);
    setStep('forgot_success');
  };

  // ── Reset ke halaman login ────────────────────────────────────────────
  const resetToLogin = () => {
    setStep('credentials');
    setUsername('');
    setPassword('');
    setCredError('');
    setForgotUsername('');
    setForgotError('');
    setForgotUser(null);
    setForgotOtp(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
  };

  const maskedEmail = (user: StoredUser | null) => {
    if (!user?.email) return '';
    return user.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center pt-[330px]"
      style={{
        backgroundImage: 'url(/bengkel-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 100%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 max-w-md w-full space-y-8 px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">Garage Garage Amat</h2>
          <p className="text-blue-200 drop-shadow">Sistem Manajemen Bengkel Motor</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8">

          {/* ── Step 1: Username + Password ── */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentialSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Masukkan username"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Masukkan password"
                    required
                  />
                </div>
              </div>

              {credError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {credError}
                </div>
              )}

              <button
                type="submit"
                disabled={credLoading || sendingOtp}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(credLoading || sendingOtp) ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {sendingOtp ? 'Mengirim OTP...' : 'Memeriksa...'}
                  </>
                ) : 'Masuk'}
              </button>

              {/* Tombol Lupa Sandi */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep('forgot_username'); setForgotError(''); setForgotUsername(''); }}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  Lupa Sandi?
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2: OTP Login ── */}
          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <Mail className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Verifikasi OTP</h3>
                <p className="mt-1 text-sm text-gray-600">Kode 6 digit telah dikirim ke</p>
                <p className="text-sm font-semibold text-blue-700">{maskedEmail(pendingUser)}</p>
                <p className="mt-1 text-xs text-gray-400">Berlaku selama 5 menit</p>
              </div>

              <div className="flex justify-center gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { otpRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className={`h-12 w-11 rounded-xl border-2 text-center text-lg font-bold outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                      otpError ? 'border-red-400 bg-red-50' : digit ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                    }`}
                  />
                ))}
              </div>

              {otpError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                  {otpError}
                </div>
              )}

              <button
                type="submit"
                disabled={otpLoading || otp.join('').length < 6}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {otpLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Memverifikasi...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Verifikasi & Masuk</>
                )}
              </button>

              <div className="text-center space-y-2">
                <div className="text-sm text-gray-500">
                  Tidak menerima kode?{' '}
                  {resendCooldown > 0 ? (
                    <span className="font-medium text-gray-400">Kirim ulang ({resendCooldown}s)</span>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={sendingOtp}
                      className="font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                      {sendingOtp ? 'Mengirim...' : 'Kirim ulang'}
                    </button>
                  )}
                </div>
                <button type="button"
                  onClick={() => { setStep('credentials'); setOtp(['','','','','','']); setOtpError(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Ganti akun
                </button>
              </div>
            </form>
          )}

          {/* ── LUPA SANDI Step 1: Input Username ── */}
          {step === 'forgot_username' && (
            <form onSubmit={handleForgotUsernameSubmit} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
                  <KeyRound className="h-7 w-7 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Lupa Sandi</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Masukkan username kamu, kami akan kirim kode OTP ke email terdaftar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={e => setForgotUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-colors"
                    placeholder="Masukkan username"
                    required
                  />
                </div>
              </div>

              {forgotError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading || sendingOtp}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(forgotLoading || sendingOtp) ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> {sendingOtp ? 'Mengirim OTP...' : 'Mencari...'}</>
                ) : 'Kirim Kode OTP'}
              </button>

              <div className="text-center">
                <button type="button" onClick={resetToLogin}
                  className="text-sm text-gray-400 hover:text-gray-600 underline">
                  Kembali ke Login
                </button>
              </div>
            </form>
          )}

          {/* ── LUPA SANDI Step 2: Verifikasi OTP ── */}
          {step === 'forgot_otp' && (
            <form onSubmit={handleForgotOtpSubmit} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
                  <Mail className="h-7 w-7 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Masukkan Kode OTP</h3>
                <p className="mt-1 text-sm text-gray-600">Kode 6 digit telah dikirim ke</p>
                <p className="text-sm font-semibold text-orange-600">{maskedEmail(forgotUser)}</p>
                <p className="mt-1 text-xs text-gray-400">Berlaku selama 5 menit</p>
              </div>

              <div className="flex justify-center gap-2">
                {forgotOtp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { forgotOtpRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleForgotOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleForgotOtpKeyDown(idx, e)}
                    className={`h-12 w-11 rounded-xl border-2 text-center text-lg font-bold outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-100 ${
                      forgotOtpError ? 'border-red-400 bg-red-50' : digit ? 'border-orange-400 bg-orange-50' : 'border-gray-300'
                    }`}
                  />
                ))}
              </div>

              {forgotOtpError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                  {forgotOtpError}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotOtpLoading || forgotOtp.join('').length < 6}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {forgotOtpLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Memverifikasi...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Verifikasi Kode</>
                )}
              </button>

              <div className="text-center space-y-2">
                <div className="text-sm text-gray-500">
                  Tidak menerima kode?{' '}
                  {resendCooldown > 0 ? (
                    <span className="font-medium text-gray-400">Kirim ulang ({resendCooldown}s)</span>
                  ) : (
                    <button type="button" onClick={handleForgotResend} disabled={sendingOtp}
                      className="font-semibold text-orange-500 hover:text-orange-600 disabled:opacity-50">
                      {sendingOtp ? 'Mengirim...' : 'Kirim ulang'}
                    </button>
                  )}
                </div>
                <button type="button"
                  onClick={() => { setStep('forgot_username'); setForgotOtp(['','','','','','']); setForgotOtpError(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Kembali
                </button>
              </div>
            </form>
          )}

          {/* ── LUPA SANDI Step 3: Password Baru ── */}
          {step === 'forgot_newpassword' && (
            <form onSubmit={handleNewPasswordSubmit} className="space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <Lock className="h-7 w-7 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Buat Password Baru</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Masukkan password baru untuk akun <span className="font-semibold text-gray-700">{forgotUser?.username}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="Minimal 6 karakter"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Konfirmasi Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
                    placeholder="Ulangi password baru"
                    required
                  />
                </div>
              </div>

              {newPassError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {newPassError}
                </div>
              )}

              <button
                type="submit"
                disabled={newPassLoading}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {newPassLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Simpan Password Baru</>
                )}
              </button>
            </form>
          )}

          {/* ── LUPA SANDI Step 4: Sukses ── */}
          {step === 'forgot_success' && (
            <div className="space-y-6 text-center">
              <div>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-9 w-9 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Password Berhasil Diubah!</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Password akun <span className="font-semibold text-gray-700">{forgotUser?.username}</span> sudah diperbarui.
                  Silakan login dengan password baru kamu.
                </p>
              </div>

              <button
                type="button"
                onClick={resetToLogin}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                Kembali ke Login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginForm;
