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

export const GET: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const sp      = context.url.searchParams;
  const status  = sp.get('status');
  const search  = sp.get('search');
  const page    = parseInt(sp.get('page')  ?? '1');
  const perPage = parseInt(sp.get('limit') ?? '25');

  const admin = createAdminClient();
  let query = admin
    .from('offerings')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(
      `offering_ref.ilike.%${search}%,devotee_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

  return Response.json({ success: true, data, meta: { total: count ?? 0, page, perPage } });
};
