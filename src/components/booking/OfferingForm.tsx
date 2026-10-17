'use client';
import { useState } from 'react';
import { toast, Toaster } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NAKSHATRAS, nakshatraLabel } from '@/lib/nakshatra';

const formSchema = z.object({
  devotee_name: z.string().min(2, 'Name is required').max(120),
  nakshatra:    z.string().min(1, 'Select a Nakshatra'),
  phone:        z.string().min(8, 'Enter a valid phone number').max(20),
  email:        z.string().email('Enter a valid email address'),
  city:         z.string().min(2, 'City is required').max(120),
  address:      z.string().min(5, 'Full address is required (for your receipt)').max(500),
});

type FormValues = z.infer<typeof formSchema>;

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

interface PoojaOption {
  name: string;
  amount: number; // rupees
}

interface Props {
  mode: 'utsav' | 'donation';
  poojaOptions?: PoojaOption[];
}

const DONATION_PRESETS = [500, 1000, 2500, 5000];

export default function OfferingForm({ mode, poojaOptions = [] }: Props) {
  const [step, setStep] = useState<'form' | 'paying' | 'done'>('form');
  const [selectedPooja, setSelectedPooja] = useState<PoojaOption | null>(poojaOptions[0] ?? null);
  const [customAmount, setCustomAmount] = useState<number | ''>(mode === 'donation' ? 500 : '');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ ref: string; purpose: string; amount: number; name: string; emailSent: boolean } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const purpose = mode === 'utsav' ? (selectedPooja?.name ?? '') : 'General Donation / Kavu Preservation';
  const amountRupees = mode === 'utsav' ? (selectedPooja?.amount ?? 0) : (customAmount || 0);

  async function onSubmit(values: FormValues) {
    if (!purpose || amountRupees < 1) {
      toast.error(mode === 'utsav' ? 'Please select a pooja' : 'Please enter an amount');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/offerings/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...values, purpose, amount: amountRupees }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setStep('paying');

      const rzp = new window.Razorpay({
        key:         data.data.key,
        amount:      data.data.amount,
        currency:    data.data.currency,
        order_id:    data.data.order_id,
        name:        'Sree Pulikkal Vishwanagayakshi Temple',
        description: purpose,
        prefill:     data.data.prefill,
        theme:       { color: '#7a1912' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          await verifyPayment(data.data.offering_id, response);
        },
        modal: {
          ondismiss: () => {
            toast.warning('Payment cancelled.');
            setStep('form');
          },
        },
      });
      rzp.open();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not start payment. Please try again.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyPayment(
    offeringId: string,
    response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  ) {
    try {
      const res = await fetch('/api/offerings/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          offering_id:         offeringId,
          razorpay_order_id:   response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature:  response.razorpay_signature,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setReceipt({
        ref:       data.data.offering_ref,
        purpose:   data.data.purpose,
        amount:    data.data.amount,
        name:      data.data.devotee_name,
        emailSent: data.data.email_sent,
      });
      setStep('done');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Payment verification failed. Please contact the temple with your payment details.');
      setStep('form');
    }
  }

  if (step === 'done' && receipt) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-200 text-center">
        <Toaster richColors position="top-center" />
        <div className="text-4xl mb-3">🙏</div>
        <h3 className="font-cormorant text-2xl font-bold text-red-800 mb-2">Thank you, {receipt.name}</h3>
        <p className="text-stone-600 mb-6">Your offering has been received.</p>
        <div className="bg-stone-50 rounded-xl p-5 text-left text-sm space-y-2 mb-6">
          <div className="flex justify-between"><span className="text-stone-500">Reference</span><span className="font-semibold">{receipt.ref}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Purpose</span><span className="font-semibold">{receipt.purpose}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Amount</span><span className="font-semibold">₹{(receipt.amount / 100).toLocaleString('en-IN')}</span></div>
        </div>
        <p className="text-xs text-stone-500">
          {receipt.emailSent
            ? 'A confirmation email with your receipt has been sent to you.'
            : "We couldn't send a confirmation email right now — please save this reference number."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-stone-200">
      <Toaster richColors position="top-center" />

      {mode === 'utsav' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-stone-700 mb-2">Select Pooja <span className="text-red-500">*</span></label>
          <select
            value={selectedPooja?.name ?? ''}
            onChange={(e) => setSelectedPooja(poojaOptions.find(p => p.name === e.target.value) ?? null)}
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 bg-white"
          >
            {poojaOptions.map(p => (
              <option key={p.name} value={p.name}>{p.name} — ₹{p.amount.toLocaleString('en-IN')}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'donation' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-stone-700 mb-2">Amount (₹) <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {DONATION_PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setCustomAmount(p)}
                className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                  customAmount === p ? 'border-red-800 bg-red-50 text-red-800' : 'border-stone-200 text-stone-600 hover:border-red-300'
                }`}
              >
                ₹{p.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value ? Number(e.target.value) : '')}
            placeholder="Or enter a custom amount"
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Full Name <span className="text-red-500">*</span></label>
          <input
            {...register('devotee_name')}
            placeholder="Full name for sankalpa"
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
          />
          {errors.devotee_name && <p className="text-red-500 text-xs mt-1">{errors.devotee_name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nakshatra (Birth Star) <span className="text-red-500">*</span></label>
          <select
            {...register('nakshatra')}
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 bg-white"
          >
            <option value="">— Select Nakshatra —</option>
            {NAKSHATRAS.map(n => (
              <option key={n.key} value={n.key}>{nakshatraLabel(n)}</option>
            ))}
          </select>
          {errors.nakshatra && <p className="text-red-500 text-xs mt-1">{errors.nakshatra.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Phone <span className="text-red-500">*</span></label>
            <input
              {...register('phone')}
              placeholder="+91 98765 43210"
              className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">City / Location <span className="text-red-500">*</span></label>
          <input
            {...register('city')}
            placeholder="City"
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800"
          />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Full Address <span className="text-red-500">*</span></label>
          <textarea
            {...register('address')}
            rows={2}
            placeholder="For your payment receipt"
            className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-800 resize-none"
          />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting || step === 'paying' || amountRupees < 1}
          className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-60 text-white py-4 rounded-xl font-semibold text-lg transition-colors"
        >
          {submitting || step === 'paying' ? 'Opening Payment…' : `Pay ₹${amountRupees.toLocaleString('en-IN')}`}
        </button>
      </form>
    </div>
  );
}
