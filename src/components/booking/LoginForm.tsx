'use client';
import { useState, useRef, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import { phoneNormalize } from '@/lib/utils';

type Step = 'phone' | 'otp';
type Channel = 'sms' | 'whatsapp';

interface Props {
  redirect?: string;
}

export default function LoginForm({ redirect = '/muttu-booking/events' }: Props) {
  const [step, setStep]         = useState<Step>('phone');
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [channel, setChannel]   = useState<Channel>('sms');
  const [loading, setLoading]   = useState(false);
  const [resendTimer, setTimer] = useState(0);
  const otpRefs                 = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setTimer(r => r - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  async function sendOtp(ch: Channel = channel) {
    if (!phone || phone.replace(/\D/g,'').length < 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNormalize(phone), channel: ch }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStep('otp');
      setTimer(60);
      toast.success(`OTP sent via ${ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  async function verifyOtp() {
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNormalize(phone), token: code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success('Logged in successfully');
      window.location.href = redirect;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-950 via-stone-900 to-amber-950 p-4">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐍</div>
          <h1 className="font-cormorant text-3xl font-bold text-amber-200">Nagayakshi Temple</h1>
          <p className="text-amber-300/70 mt-1 text-sm tracking-widest uppercase">Muttu Booking</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === 'phone' ? (
            <>
              <h2 className="text-xl font-semibold text-stone-800 mb-1">Sign In</h2>
              <p className="text-stone-500 text-sm mb-6">Enter your mobile number to receive an OTP</p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-700 mb-1">Mobile Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-stone-100 border border-r-0 border-stone-300 rounded-l-lg text-stone-600 text-sm">+91</span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    maxLength={10}
                    className="flex-1 border border-stone-300 rounded-r-lg px-4 py-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-800 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                {(['sms', 'whatsapp'] as Channel[]).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      channel === ch ? 'bg-red-800 text-white border-red-800' : 'bg-white text-stone-600 border-stone-300 hover:border-red-800'
                    }`}
                  >
                    {ch === 'sms' ? '📱 SMS' : '💬 WhatsApp'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => sendOtp()}
                disabled={loading}
                className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('phone'); setOtp(['','','','','','']); }}
                className="text-sm text-red-800 hover:underline mb-4 flex items-center gap-1"
              >
                ← Change number
              </button>
              <h2 className="text-xl font-semibold text-stone-800 mb-1">Enter OTP</h2>
              <p className="text-stone-500 text-sm mb-6">
                Sent to +91 {phone} via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </p>

              <div className="flex gap-2 justify-center mb-6">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { otpRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-stone-300 rounded-xl focus:border-red-800 focus:outline-none transition-colors"
                  />
                ))}
              </div>

              <button
                onClick={verifyOtp}
                disabled={loading || otp.join('').length !== 6}
                className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors mb-3"
              >
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </button>

              <div className="text-center text-sm text-stone-500">
                {resendTimer > 0 ? (
                  <span>Resend in {resendTimer}s</span>
                ) : (
                  <button onClick={() => sendOtp()} className="text-red-800 hover:underline font-medium">
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
