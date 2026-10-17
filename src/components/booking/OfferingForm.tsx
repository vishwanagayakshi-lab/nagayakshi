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
      <div className="offering-card offering-receipt">
        <Toaster richColors position="top-center" />
        <div className="offering-receipt-icon">🙏</div>
        <h3 className="offering-receipt-title">Thank you, {receipt.name}</h3>
        <p className="offering-receipt-lead">Your offering has been received.</p>
        <div className="offering-receipt-table">
          <div className="offering-receipt-row"><span>Reference</span><span>{receipt.ref}</span></div>
          <div className="offering-receipt-row"><span>Purpose</span><span>{receipt.purpose}</span></div>
          <div className="offering-receipt-row"><span>Amount</span><span>₹{(receipt.amount / 100).toLocaleString('en-IN')}</span></div>
        </div>
        <p className="offering-receipt-note">
          {receipt.emailSent
            ? 'A confirmation email with your receipt has been sent to you.'
            : "We couldn't send a confirmation email right now — please save this reference number."}
        </p>
      </div>
    );
  }

  return (
    <div className="offering-card">
      <Toaster richColors position="top-center" />

      {mode === 'utsav' && (
        <div className="offering-field">
          <label className="offering-label">Select Pooja <span className="offering-required">*</span></label>
          <select
            value={selectedPooja?.name ?? ''}
            onChange={(e) => setSelectedPooja(poojaOptions.find(p => p.name === e.target.value) ?? null)}
            className="offering-control offering-select"
          >
            {poojaOptions.map(p => (
              <option key={p.name} value={p.name}>{p.name} — ₹{p.amount.toLocaleString('en-IN')}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'donation' && (
        <div className="offering-field">
          <label className="offering-label">Amount (₹) <span className="offering-required">*</span></label>
          <div className="offering-presets">
            {DONATION_PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setCustomAmount(p)}
                className={`offering-preset${customAmount === p ? ' offering-preset-active' : ''}`}
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
            className="offering-control"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="offering-form-grid">
        <div className="offering-field">
          <label className="offering-label">Full Name <span className="offering-required">*</span></label>
          <input
            {...register('devotee_name')}
            placeholder="Full name for sankalpa"
            className="offering-control"
          />
          {errors.devotee_name && <p className="offering-error">{errors.devotee_name.message}</p>}
        </div>

        <div className="offering-field">
          <label className="offering-label">Nakshatra (Birth Star) <span className="offering-required">*</span></label>
          <select
            {...register('nakshatra')}
            className="offering-control offering-select"
            defaultValue=""
          >
            <option value="">— Select Nakshatra —</option>
            {NAKSHATRAS.map(n => (
              <option key={n.key} value={n.key}>{nakshatraLabel(n)}</option>
            ))}
          </select>
          {errors.nakshatra && <p className="offering-error">{errors.nakshatra.message}</p>}
        </div>

        <div className="offering-row">
          <div className="offering-field">
            <label className="offering-label">Phone <span className="offering-required">*</span></label>
            <input
              {...register('phone')}
              placeholder="+91 98765 43210"
              className="offering-control"
            />
            {errors.phone && <p className="offering-error">{errors.phone.message}</p>}
          </div>
          <div className="offering-field">
            <label className="offering-label">Email <span className="offering-required">*</span></label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="offering-control"
            />
            {errors.email && <p className="offering-error">{errors.email.message}</p>}
          </div>
        </div>

        <div className="offering-field">
          <label className="offering-label">City / Location <span className="offering-required">*</span></label>
          <input
            {...register('city')}
            placeholder="City"
            className="offering-control"
          />
          {errors.city && <p className="offering-error">{errors.city.message}</p>}
        </div>

        <div className="offering-field">
          <label className="offering-label">Full Address <span className="offering-required">*</span></label>
          <textarea
            {...register('address')}
            rows={2}
            placeholder="For your payment receipt"
            className="offering-control offering-textarea"
          />
          {errors.address && <p className="offering-error">{errors.address.message}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting || step === 'paying' || amountRupees < 1}
          className="btn-offering-submit"
        >
          {submitting || step === 'paying' ? 'Opening Payment…' : `Pay ₹${amountRupees.toLocaleString('en-IN')}`}
        </button>
      </form>
    </div>
  );
}
