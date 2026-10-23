'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { paise, fmtDateTime } from '@/lib/utils';
import { NAKSHATRAS, getNakshatraByKey, nakshatraLabel } from '@/lib/nakshatra';
import AdminTable, { type ColConfig } from '@/components/admin/AdminTable';

interface Offering {
  id: string;
  offering_ref: string;
  devotee_name: string;
  nakshatra: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  purpose: string;
  amount: number; // paise
  status: 'pending' | 'payment_init' | 'paid' | 'failed';
  razorpay_payment_id: string | null;
  email_sent_at: string | null;
  created_at: string;
}

const STATUS_OPTS: Offering['status'][] = ['pending', 'payment_init', 'paid', 'failed'];

export default function AdminOfferingsPanel() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [viewing,   setViewing]   = useState<Offering | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/offerings?limit=1000');
    const data = await res.json();
    if (data.success) setOfferings(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paidTotal = offerings.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0);

  const rows = offerings.map(o => ({
    ...o,
    nakshatra_label: getNakshatraByKey(o.nakshatra)?.sanskrit ?? o.nakshatra,
    email_status: o.email_sent_at ? 'Sent' : '',
  }));

  const columns: ColConfig[] = [
    { key: 'offering_ref',    label: 'Ref',       type: 'mono', filterable: true },
    { key: 'devotee_name',    label: 'Name',      filterable: true },
    { key: 'phone',           label: 'Phone',     filterable: true },
    { key: 'nakshatra_label', label: 'Nakshatra', filterable: true },
    { key: 'purpose',         label: 'Purpose',   filterable: true },
    { key: 'amount',          label: 'Amount',    type: 'currency', align: 'right' },
    { key: 'status',          label: 'Status',    type: 'badge', filterable: true },
    { key: 'email_status',    label: 'Email' },
    { key: 'created_at',      label: 'Created',   type: 'date' },
    {
      key: 'view', label: '',
      render: row => (
        <button
          onClick={() => setViewing(row as unknown as Offering)}
          style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}
        >
          View
        </button>
      ),
    },
  ];

  if (loading) {
    return <p style={{ textAlign: 'center', padding: '64px 24px', fontSize: 13, color: '#94a3b8' }}>Loading…</p>;
  }

  return (
    <div>
      <Toaster richColors position="top-right" />

      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        {offerings.length} total registration{offerings.length !== 1 ? 's' : ''} · {paise(paidTotal)} paid
      </p>

      <AdminTable data={rows} columns={columns} filename="offerings" idKey="id" />

      {viewing && (
        <OfferingDetailModal
          offering={viewing}
          onClose={() => setViewing(null)}
          onChanged={updated => { setViewing(updated); load(); }}
        />
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 7,
  fontSize: 13, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', fontFamily: 'inherit',
};

function OfferingDetailModal({ offering, onClose, onChanged }: { offering: Offering; onClose: () => void; onChanged: (o: Offering) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [form, setForm] = useState({
    devotee_name: offering.devotee_name,
    nakshatra:    offering.nakshatra,
    phone:        offering.phone,
    email:        offering.email,
    city:         offering.city,
    address:      offering.address,
    purpose:      offering.purpose,
    amount:       offering.amount / 100,
  });

  const nakshatra = getNakshatraByKey(offering.nakshatra)?.sanskrit ?? offering.nakshatra;
  const STATUS_TEXT: Record<string, string> = { pending: '#9ca3af', payment_init: '#f59e0b', paid: '#34d399', failed: '#f87171' };

  async function patch(body: Record<string, unknown>) {
    const res  = await fetch(`/api/admin/offerings/${offering.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data as Offering;
  }

  async function saveDetails() {
    setSaving(true);
    try {
      const updated = await patch({ action: 'update_details', ...form, amount: Number(form.amount) });
      toast.success('Details updated');
      setEditing(false);
      onChanged(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: Offering['status']) {
    if (status === offering.status) return;
    if (!confirm(`Manually set status to "${status}"? This does not verify any payment.`)) return;
    setBusy(true);
    try {
      const updated = await patch({ action: 'set_status', status });
      toast.success(`Status set to ${status}`);
      onChanged(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  async function resendEmail() {
    setBusy(true);
    try {
      const updated = await patch({ action: 'resend_email' });
      toast.success('Confirmation email resent');
      onChanged(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to resend email');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: React.ReactNode, span2 = false) => (
    <div style={{ gridColumn: span2 ? 'span 2' : undefined }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', margin: '2px 0 0' }}>{value}</p>
    </div>
  );

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{offering.offering_ref}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, border: '1.5px solid #2563eb', color: '#2563eb', background: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                Edit
              </button>
            )}
            <button onClick={onClose} style={{ color: '#94a3b8', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {editing ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Name</label>
              <input style={inputStyle} value={form.devotee_name} onChange={e => setForm(f => ({ ...f, devotee_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Nakshatra</label>
                <select style={{ ...inputStyle, background: '#fff' }} value={form.nakshatra} onChange={e => setForm(f => ({ ...f, nakshatra: e.target.value }))}>
                  {NAKSHATRAS.map(n => <option key={n.key} value={n.key}>{nakshatraLabel(n)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Phone</label>
                <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>City</label>
                <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Amount (₹)</label>
                <input style={inputStyle} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Address</label>
              <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Purpose</label>
              <input style={inputStyle} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: 8, color: '#64748b', fontSize: 13, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetails} disabled={saving} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {field('Name', offering.devotee_name)}
            {field('Nakshatra', nakshatra)}
            {field('Phone', offering.phone)}
            {field('Email', offering.email)}
            {field('City', offering.city)}
            {field('Amount', <span style={{ color: '#059669', fontWeight: 600 }}>{paise(offering.amount)}</span>)}
            {field('Address', offering.address, true)}
            {field('Purpose', offering.purpose, true)}

            <div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Status</span>
              <select
                value={offering.status}
                disabled={busy}
                onChange={e => changeStatus(e.target.value as Offering['status'])}
                style={{
                  display: 'block', marginTop: 4, fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
                  border: `1px solid ${STATUS_TEXT[offering.status]}55`, color: STATUS_TEXT[offering.status],
                  background: 'rgba(107,114,128,0.08)', cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {field('Email Sent', offering.email_sent_at ? fmtDateTime(offering.email_sent_at) : '—')}
            {offering.razorpay_payment_id && field('Payment ID', <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{offering.razorpay_payment_id}</span>, true)}

            <div style={{ gridColumn: 'span 2', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {offering.status === 'paid' && (
                <>
                  <a
                    href={`/api/offerings/${offering.id}/receipt.pdf`}
                    target="_blank" rel="noopener"
                    style={{ display: 'inline-block', fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #2563eb', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    Download Receipt (PDF)
                  </a>
                  <button
                    onClick={resendEmail} disabled={busy}
                    style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', color: '#64748b', background: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                  >
                    {busy ? 'Sending…' : 'Resend Confirmation Email'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
