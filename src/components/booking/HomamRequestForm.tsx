'use client';
import { useState } from 'react';
import { toast, Toaster } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NAKSHATRAS, nakshatraLabel } from '@/lib/nakshatra';
import { HOMAM_TYPES } from '@/lib/homams';

const formSchema = z.object({
  devotee_name:   z.string().min(2, 'Name is required').max(120),
  nakshatra:      z.string().min(1, 'Select a Nakshatra'),
  phone:          z.string().min(8, 'Enter a valid phone number').max(20),
  email:          z.string().email('Enter a valid email address'),
  city:           z.string().max(120).optional().or(z.literal('')),
  homam_type:     z.string().min(1, 'Select a homam or pooja'),
  preferred_date: z.string().optional().or(z.literal('')),
  message:        z.string().max(1000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  defaultHomam?: string;
}

export default function HomamRequestForm({ defaultHomam = '' }: Props) {
  const [step, setStep]             = useState<'form' | 'done'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [requestRef, setRequestRef] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { homam_type: HOMAM_TYPES.includes(defaultHomam as typeof HOMAM_TYPES[number]) ? defaultHomam : '' },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/homam-requests/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRequestRef(data.data.request_ref);
      setStep('done');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="offering-card offering-receipt">
        <Toaster richColors position="top-center" />
        <div className="offering-receipt-icon">🙏</div>
        <h3 className="offering-receipt-title">Thank you</h3>
        <p className="offering-receipt-lead">Your request has been received. Our team will contact you shortly.</p>
        <div className="offering-receipt-table">
          <div className="offering-receipt-row"><span>Reference</span><span>{requestRef}</span></div>
        </div>
        <p className="offering-receipt-note">
          Please save this reference number for any follow-up. You can also reach us directly at +91 99463 73522.
        </p>
      </div>
    );
  }

  return (
    <div className="offering-card">
      <Toaster richColors position="top-center" />

      <div className="offering-field">
        <label className="offering-label">Homam / Pooja <span className="offering-required">*</span></label>
        <select {...register('homam_type')} className="offering-control offering-select" defaultValue="">
          <option value="">— Select Homam / Pooja —</option>
          {HOMAM_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        {errors.homam_type && <p className="offering-error">{errors.homam_type.message}</p>}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="offering-form-grid">
        <div className="offering-field">
          <label className="offering-label">Full Name <span className="offering-required">*</span></label>
          <input {...register('devotee_name')} placeholder="Full name" className="offering-control" />
          {errors.devotee_name && <p className="offering-error">{errors.devotee_name.message}</p>}
        </div>

        <div className="offering-field">
          <label className="offering-label">Nakshatra (Birth Star) <span className="offering-required">*</span></label>
          <select {...register('nakshatra')} className="offering-control offering-select" defaultValue="">
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
            <input {...register('phone')} placeholder="+91 98765 43210" className="offering-control" />
            {errors.phone && <p className="offering-error">{errors.phone.message}</p>}
          </div>
          <div className="offering-field">
            <label className="offering-label">Email <span className="offering-required">*</span></label>
            <input {...register('email')} type="email" placeholder="you@example.com" className="offering-control" />
            {errors.email && <p className="offering-error">{errors.email.message}</p>}
          </div>
        </div>

        <div className="offering-row">
          <div className="offering-field">
            <label className="offering-label">City / Location</label>
            <input {...register('city')} placeholder="City" className="offering-control" />
          </div>
          <div className="offering-field">
            <label className="offering-label">Preferred Date</label>
            <input {...register('preferred_date')} type="date" className="offering-control" />
          </div>
        </div>

        <div className="offering-field">
          <label className="offering-label">Additional Details</label>
          <textarea
            {...register('message')}
            rows={3}
            placeholder="Any specific requirements, family members to include, etc. (optional)"
            className="offering-control offering-textarea"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-offering-submit">
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  );
}
