import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { toPaise } from '@/lib/utils';
import { z } from 'zod';

export const prerender = false;

const eventSchema = z.object({
  name:              z.string().min(1).max(200),
  description:       z.string().optional(),
  event_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  event_time:        z.string().optional(),
  total_tokens:      z.number().int().min(1).default(150),
  online_tokens:     z.number().int().min(0).default(100),
  phone_tokens:      z.number().int().min(0).default(50),
  max_per_person:    z.number().int().min(1).max(10).default(5),
  price_per_muttu:   z.number().min(0),
  booking_opens_at:  z.string().datetime().optional().nullable(),
  booking_closes_at: z.string().datetime().optional().nullable(),
  status:            z.enum(['draft','scheduled','open','paused','closed','completed','archived','cancelled']).default('draft'),
  location:          z.string().optional().nullable(),
  notes:             z.string().optional().nullable(),
  display_notes:     z.string().optional().nullable(),
}).refine(d => d.online_tokens + d.phone_tokens === d.total_tokens, {
  message: 'online_tokens + phone_tokens must equal total_tokens',
});

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
  const page    = parseInt(sp.get('page')  ?? '1');
  const perPage = parseInt(sp.get('limit') ?? '20');

  const admin = createAdminClient();
  let query = admin
    .from('muttu_events')
    .select('*', { count: 'exact' })
    .order('event_date', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

  return Response.json({ success: true, data, meta: { total: count, page, perPage } });
};

export const POST: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const body   = await context.request.json();
    const parsed = eventSchema.parse(body);
    const admin  = createAdminClient();

    const { data: event, error } = await admin
      .from('muttu_events')
      .insert({ ...parsed, price_per_muttu: toPaise(parsed.price_per_muttu), created_by: user.id })
      .select().single();

    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

    await admin.rpc('seed_token_pool', { p_event_id: event.id });
    await admin.from('audit_log').insert({
      table_name: 'muttu_events', record_id: event.id,
      action: 'create', new_data: event, actor_id: user.id,
    });

    return Response.json({ success: true, data: event }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
