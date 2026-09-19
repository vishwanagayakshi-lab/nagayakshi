'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NAKSHATRAS, nakshatraLabel } from '@/lib/nakshatra';
import { paise, fmtDate, secondsLeft } from '@/lib/utils';
import type { MuttuEvent, Booking, BookingType } from '@/lib/types';

const itemSchema = z.object({
  name:      z.string().min(1, 'Name is required').max(100),
  nakshatra: z.string().min(1, 'Select a Nakshatra'),
  obstacles: z.string().min(5, 'Describe the obstacles (min 5 chars)').max(500),
});

const formSchema = z.object({
  quantity:     z.number().int().min(1).max(5),
  booking_type: z.enum(['online', 'phone'] as const),
  items:        z.array(itemSchema),
});

type FormValues = z.infer<typeof formSchema>;

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

interface Props {
  event: MuttuEvent;
}

export default function BookingForm({ event }: Props) {
  const [step,         setStep]         = useState<'form' | 'paying' | 'uploading'>('form');
  const [booking,      setBooking]      = useState<Booking | null>(null);
  const [countdown,    setCountdown]    = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [phoneFile,    setPhoneFile]    = useState<File | null>(null);
  const [uploadingSST, setUploadingSST] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity:     1,
      booking_type: 'online',
      items:        [{ name: '', nakshatra: '', obstacles: '' }],
    },
  });

  const { fields, replace } = useFieldArray({ control, name: 'items' });
  const quantity    = watch('quantity');
  const bookingType = watch('booking_type');

  useEffect(() => {
    const current = fields.length;
    const empty   = { name: '', nakshatra: '', obstacles: '' };
    if (quantity > current) {
      replace([...fields.map(f => ({ name: f.name, nakshatra: f.nakshatra, obstacles: f.obstacles })),
        ...Array(quantity - current).fill(empty)]);
    } else if (quantity < current) {
      replace(fields.slice(0, quantity).map(f => ({ name: f.name, nakshatra: f.nakshatra, obstacles: f.obstacles })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  const updateCountdown = useCallback(() => {
    if (booking?.expires_at) setCountdown(secondsLeft(booking.expires_at));
  }, [booking]);

  useEffect(() => {
    if (!booking) return;
    updateCountdown();
    const t = setInterval(updateCountdown, 1000);
    return () => clearInterval(t);
  }, [booking, updateCountdown]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res  = await fetch('/api/booking/reserve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ event_id: event.id, ...values }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setBooking(data.data.booking);
      if (values.booking_type === 'online') {
        setStep('paying');
        await initiatePayment(data.data.booking);
      } else {
        setStep('uploading');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reserve. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function initiatePayment(bkg: Booking) {
    try {
      const res  = await fetch('/api/payment/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bkg.id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const rzp = new window.Razorpay({
        key:         data.data.key,
        amount:      data.data.amount,
        currency:    data.data.currency,
        order_id:    data.data.order_id,
        name:        'Nagayakshi Temple',
        description: `Muttu Booking — ${data.data.booking_ref}`,
        prefill:     data.data.prefill,
        theme:       { color: '#7f1d1d' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          await handlePaymentSuccess(bkg.id, response);
        },
        modal: {
          ondismiss: () => toast.warning('Payment cancelled. Your reservation is still active for 10 minutes.'),
        },
      });
      rzp.open();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Payment gateway error');
    }
  }

  async function handlePaymentSuccess(bookingId: string, response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    try {
      const res  = await fetch('/api/payment/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id:          bookingId,
          razorpay_order_id:   response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature:  response.razorpay_signature,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      window.location.href = `/muttu-booking/confirmation/${bookingId}`;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Payment verification failed. Contact temple.');
    }
  }

  async function uploadScreenshot() {
    if (!phoneFile || !booking) return;
    setUploadingSST(true);
    try {
      const formData = new FormData();
      formData.append('file', phoneFile);
      formData.append('booking_id', booking.id);
      const res  = await fetch('/api/booking/upload-screenshot', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      window.location.href = `/muttu-booking/confirmation/${booking.id}`;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingSST(false);
    }
  }

  const totalAmount = paise(event.price_per_muttu * quantity);

  return (
    <div className="pb-20">
      <Toaster richColors position="top-center" />

      {/* Reservation countdown */}
      {booking && step !== 'form' && countdown > 0 && (
        <div className={`fixed top-0 left-0 right-0 z-50 text-center py-2.5 text-sm font-semibold ${
          countdown < 120 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          ⏳ Reservation expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
        </div>
      )}

      {/* Booking Type */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 mb-6">
        <h2 className="font-semibold text-stone-700 mb-4">Booking Type</h2>
        <div className="grid grid-cols-2 gap-3">
          {([['online', '💳 Online Payment'], ['phone', '📞 Phone Booking']] as [BookingType, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setValue('booking_type', val)}
              className={`py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                bookingType === val
                  ? 'border-red-800 bg-red-50 text-red-800'
                  : 'border-stone-200 text-stone-600 hover:border-red-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {bookingType === 'phone' && (
          <p className="mt-3 text-xs text-stone-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
            📋 Fill the form, submit, then upload your payment screenshot on the next screen.
          </p>
        )}
      </div>

      {/* Quantity */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 mb-6">
        <h2 className="font-semibold text-stone-700 mb-4">How many Muttus? (max {event.max_per_person})</h2>
        <div className="flex gap-2">
          {Array.from({ length: event.max_per_person }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setValue('quantity', n)}
              className={`w-12 h-12 rounded-xl border-2 font-bold text-sm transition-all ${
                quantity === n
                  ? 'border-red-800 bg-red-800 text-white'
                  : 'border-stone-200 text-stone-600 hover:border-red-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Muttu Forms */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {fields.map((field, idx) => (
          <div key={field.id} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 mb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-full bg-red-800 text-white flex items-center justify-center text-sm font-bold">{idx + 1}</div>
              <h3 className="font-semibold text-stone-700">Muttu {idx + 1}</h3>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input
                {...register(`items.${idx}.name`)}
                placeholder="Full name for sankalpa"
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
              />
              {errors.items?.[idx]?.name && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.name?.message}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-stone-700 mb-1">Birth Star (Nakshatra) <span className="text-red-500">*</span></label>
              <select
                {...register(`items.${idx}.nakshatra`)}
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 bg-white"
              >
                <option value="">— Select Nakshatra —</option>
                {NAKSHATRAS.map(n => (
                  <option key={n.key} value={n.key}>{nakshatraLabel(n)}</option>
                ))}
              </select>
              {errors.items?.[idx]?.nakshatra && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.nakshatra?.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Obstacles / Purpose <span className="text-red-500">*</span></label>
              <textarea
                {...register(`items.${idx}.obstacles`)}
                placeholder="Describe your obstacles or the purpose of this Muttu (e.g. career block, health issue, marriage, child blessing…)"
                rows={3}
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 resize-none"
              />
              {errors.items?.[idx]?.obstacles && <p className="text-red-500 text-xs mt-1">{errors.items[idx]?.obstacles?.message}</p>}
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
          <div className="flex justify-between items-center mb-4">
            <span className="text-stone-600">{quantity} × {paise(event.price_per_muttu)}</span>
            <span className="font-cormorant text-2xl font-bold text-red-800">{totalAmount}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-60 text-white py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            {submitting ? 'Reserving…' : bookingType === 'online' ? `Pay ${totalAmount}` : 'Reserve & Continue'}
          </button>
        </div>
      </form>

      {/* Phone: Screenshot Upload */}
      {step === 'uploading' && booking && (
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-amber-200">
          <h3 className="font-semibold text-stone-700 mb-3">Upload Payment Screenshot</h3>
          <p className="text-sm text-stone-500 mb-4">
            Booking ref: <strong>{booking.booking_ref}</strong><br />
            Amount: <strong>{paise(booking.total_amount)}</strong><br />
            Pay via UPI/Bank and upload the screenshot below.
          </p>
          <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center mb-4">
            <input
              type="file" accept="image/*"
              onChange={e => setPhoneFile(e.target.files?.[0] ?? null)}
              className="text-sm text-stone-600"
            />
          </div>
          <button
            onClick={uploadScreenshot}
            disabled={!phoneFile || uploadingSST}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {uploadingSST ? 'Uploading…' : 'Submit for Verification'}
          </button>
        </div>
      )}
    </div>
  );
}
