import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const prerender = false;

async function requireAdmin(context: Parameters<APIRoute>[0]) {
  const supabase = createClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return p?.is_admin ? user : null;
}

interface DevoteeAgg {
  phone: string;
  name: string;
  email: string | null;
  booking_count: number;
  offering_count: number;
  total_spent: number; // paise, confirmed bookings + paid offerings only
  last_activity: string;
  notes: string;
  tags: string[];
}

export const GET: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const admin = createAdminClient();

  const [{ data: bookings }, { data: offerings }, { data: notes }, { data: profiles }] = await Promise.all([
    admin.from('bookings').select('phone, status, total_amount, created_at, user_id'),
    admin.from('offerings').select('phone, devotee_name, email, status, amount, created_at'),
    admin.from('devotee_notes').select('phone, notes, tags'),
    admin.from('profiles').select('id, full_name'),
  ]);

  const nameByUserId = new Map((profiles ?? []).map(p => [p.id, p.full_name ?? '']));

  const byPhone = new Map<string, DevoteeAgg>();

  function get(phone: string): DevoteeAgg {
    let d = byPhone.get(phone);
    if (!d) {
      d = { phone, name: '', email: null, booking_count: 0, offering_count: 0, total_spent: 0, last_activity: '', notes: '', tags: [] };
      byPhone.set(phone, d);
    }
    return d;
  }

  for (const b of bookings ?? []) {
    const d = get(b.phone);
    d.booking_count++;
    if (b.status === 'confirmed') d.total_spent += b.total_amount;
    if (!d.name) d.name = nameByUserId.get(b.user_id) ?? '';
    if (!d.last_activity || b.created_at > d.last_activity) d.last_activity = b.created_at;
  }

  for (const o of offerings ?? []) {
    const d = get(o.phone);
    d.offering_count++;
    if (o.status === 'paid') d.total_spent += o.amount;
    if (!d.name) d.name = o.devotee_name;
    if (!d.email) d.email = o.email;
    if (!d.last_activity || o.created_at > d.last_activity) d.last_activity = o.created_at;
  }

  for (const n of notes ?? []) {
    const d = byPhone.get(n.phone);
    if (d) { d.notes = n.notes ?? ''; d.tags = n.tags ?? []; }
  }

  const data = Array.from(byPhone.values()).sort((a, b) => (b.last_activity > a.last_activity ? 1 : -1));

  return Response.json({ success: true, data, meta: { total: data.length } });
};
