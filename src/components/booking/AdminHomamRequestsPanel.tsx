'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { fmtDate, fmtDateTime } from '@/lib/utils';
import { NAKSHATRAS, getNakshatraByKey, nakshatraLabel } from '@/lib/nakshatra';
import { HOMAM_TYPES } from '@/lib/homams';
import AdminTable, { type ColConfig } from '@/components/admin/AdminTable';

interface HomamRequest {
  id: string;
  request_ref: string;
  devotee_name: string;
  nakshatra: string;
  phone: string;
  email: string;
  city: string | null;
  address: string | null;
  homam_type: string;
  preferred_date: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'scheduled' | 'converted' | 'completed' | 'cancelled';
  admin_notes: string | null;
  linked_offering_id: string | null;
  created_at: string;
}

const STATUS_OPTS: HomamRequest['status'][] = ['new', 'contacted', 'scheduled', 'converted', 'completed', 'cancelled'];

export default function AdminHomamRequestsPanel() {
  const [requests, setRequests] = useState<HomamRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [viewing,  setViewing]  = useState<HomamRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/homam-requests?limit=1000');
    const data = await res.json();
    if (data.success) setRequests(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = requests.map(r => ({
    ...r,
    nakshatra_label: getNakshatraByKey(r.nakshatra)?.sanskrit ?? r.nakshatra,
    preferred_date_display: r.preferred_date ? fmtDate(r.preferred_date) : '',
  }));

  const columns: ColConfig[] = [
    { key: 'request_ref',             label: 'Ref',       type: 'mono', filterable: true },
    { key: 'devotee_name',            label: 'Name',      filterable: true },
    { key: 'phone',                   label: 'Phone',     filterable: true },
    { key: 'homam_type',              label: 'Homam',     filterable: true },
    { key: 'preferred_date_display',  label: 'Preferred Date' },
    { key: 'status',                  label: 'Status',    type: 'badge', filterable: true },
    { key: 'created_at',              label: 'Created',   type: 'date' },
    {
      key: 'view', label: '',
      render: row => (
        <button
          onClick={() => setViewing(row as unknown as HomamRequest)}
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
        {requests.length} total request{requests.length !== 1 ? 's' : ''} · {requests.filter(r => r.status === 'new').length} new
      </p>

      <AdminTable data={rows} columns={columns} filename="homam-requests" idKey="id" />

      {viewing && (
        <RequestDetailModal
          request={viewing}
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

const STATUS_TEXT: Record<string, string> = {
  new: '#2563eb', contacted: '#f59e0b', scheduled: '#8b5cf6', converted: '#059669', completed: '#34d399', cancelled: '#f87171',
};

function RequestDetailModal({ request, onClose, onChanged }: { request: HomamRequest; onClose: () => void; onChanged: (r: HomamRequest) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [notes,   setNotes]   = useState(request.admin_notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [form, setForm] = useState({
    devotee_name:   request.devotee_name,
    nakshatra:      request.nakshatra,
    phone:          request.phone,
    email:          request.email,
    city:           request.city ?? '',
    address:        request.address ?? '',
    homam_type:     request.homam_type,
    preferred_date: request.preferred_date ?? '',
    message:        request.message ?? '',
  });

  const nakshatra = getNakshatraByKey(request.nakshatra)?.sanskrit ?? request.nakshatra;

  async function patch(body: Record<string, unknown>) {
    const res  = await fetch(`/api/admin/homam-requests/${request.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async function saveDetails() {
    setSaving(true);
    try {
      const updated = await patch({ action: 'update_details', ...form });
      toast.success('Details updated');
      setEditing(false);
      onChanged(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: HomamRequest['status']) {
    if (status === request.status) return;
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

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const updated = await patch({ action: 'update_notes', admin_notes: notes });
      toast.success('Notes saved');
      onChanged(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function convertToOffering() {
    const amountStr = prompt('Amount to charge (₹)?');
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount < 1) { toast.error('Enter a valid amount'); return; }
    setBusy(true);
    try {
      const updated = await patch({ action: 'convert_to_offering', amount });
      toast.success(`Created offering ${updated.offering.offering_ref} — manage it from Offerings & Donations`);
      onChanged(updated);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to convert');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: React.ReactNode, span2 = false) => (
    <div style={{ gridColumn: span2 ? 'span 2' : undefined }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#0f172a', margin: '2px 0 0' }}>{value || '—'}</p>
    </div>
  );

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Inter',system-ui,sans-serif" }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{request.request_ref}</h2>
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
                <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Preferred Date</label>
                <input style={inputStyle} type="date" value={form.preferred_date} onChange={e => setForm(f => ({ ...f, preferred_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Address</label>
              <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Homam / Pooja</label>
              <select style={{ ...inputStyle, background: '#fff' }} value={form.homam_type} onChange={e => setForm(f => ({ ...f, homam_type: e.target.value }))}>
                {HOMAM_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4 }}>Message</label>
              <textarea style={{ ...inputStyle, resize: 'none' }} rows={2} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
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
            {field('Name', request.devotee_name)}
            {field('Nakshatra', nakshatra)}
            {field('Phone', request.phone)}
            {field('Email', request.email)}
            {field('City', request.city)}
            {field('Preferred Date', request.preferred_date ? fmtDate(request.preferred_date) : null)}
            {field('Homam / Pooja', request.homam_type, true)}
            {field('Address', request.address, true)}
            {field('Message', request.message, true)}

            <div>
              <span style={{ fontSize: 12, color: '#64748b' }}>Status</span>
              <select
                value={request.status}
                disabled={busy}
                onChange={e => changeStatus(e.target.value as HomamRequest['status'])}
                style={{
                  display: 'block', marginTop: 4, fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 99,
                  border: `1px solid ${STATUS_TEXT[request.status]}55`, color: STATUS_TEXT[request.status],
                  background: 'rgba(107,114,128,0.08)', cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {field('Created', fmtDateTime(request.created_at))}

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4 }}>Internal Notes</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Call log, scheduling notes, etc." />
              <div style={{ textAlign: 'right', marginTop: 6 }}>
                <button onClick={saveNotes} disabled={savingNotes} style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 600, border: 'none', cursor: savingNotes ? 'not-allowed' : 'pointer', opacity: savingNotes ? 0.7 : 1 }}>
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </button>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
              {request.linked_offering_id ? (
                <p style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>
                  ✓ Converted — manage payment from Offerings &amp; Donations.
                </p>
              ) : (
                <button
                  onClick={convertToOffering} disabled={busy}
                  style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #2563eb', color: '#2563eb', background: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                >
                  {busy ? 'Working…' : 'Convert to Payment Request'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
