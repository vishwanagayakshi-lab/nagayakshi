import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { toPaise } from '@/lib/utils';
import { z } from 'zod';

export const prerender = false;

const updateSchema = z.object({
  name:              z.string().min(1).max(200).optional(),
  description:       z.string().optional().nullable(),
  event_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  event_time:        z.string().optional().nullable(),
  total_tokens:      z.number().int().min(1).optional(),
  online_tokens:     z.number().int().min(0).optional(),
  phone_tokens:      z.number().int().min(0).optional(),
  max_per_person:    z.number().int().min(1).max(10).optional(),
  price_per_muttu:   z.number().min(0).optional(),
  booking_opens_at:  z.string().datetime().optional().nullable(),
  booking_closes_at: z.string().datetime().optional().nullable(),
  status:            z.enum(['draft','scheduled','open','paused','closed','completed','archived','cancelled']).optional(),
  location:          z.string().optional().nullable(),
  notes:             z.string().optional().nullable(),
  display_notes:     z.string().optional().nullable(),
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

  const { id } = context.params;
  const admin  = createAdminClient();

  const { data: event, error } = await admin.from('muttu_events').select('*').eq('id', id!).single();
  if (error) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

  const { data: tokens } = await admin.from('token_pool').select('token_type, status').eq('event_id', id!);
  const availability = tokens?.reduce((acc: Record<string, Record<string, number>>, t) => {
    if (!acc[t.token_type]) acc[t.token_type] = {};
    acc[t.token_type][t.status] = (acc[t.token_type][t.status] ?? 0) + 1;
    return acc;
  }, {});

  return Response.json({ success: true, data: { event, availability } });
};

export const PATCH: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const { id }  = context.params;
    const body    = await context.request.json();
    const parsed  = updateSchema.parse(body);
    const admin   = createAdminClient();

    const { data: before } = await admin.from('muttu_events').select('*').eq('id', id!).single();
    if (!before) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

    if (parsed.status === 'open' && ['completed','archived','cancelled'].includes(before.status)) {
      return Response.json({ success: false, error: `Cannot reopen a ${before.status} event` }, { status: 409 });
    }

    const updates: Record<string, unknown> = { ...parsed };
    if (parsed.price_per_muttu !== undefined) {
      updates.price_per_muttu = toPaise(parsed.price_per_muttu);
    }

    const { data: updated, error } = await admin
      .from('muttu_events').update(updates).eq('id', id!).select().single();
    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });

    const tokenCountChanged =
      (parsed.online_tokens !== undefined && parsed.online_tokens !== before.online_tokens) ||
      (parsed.phone_tokens  !== undefined && parsed.phone_tokens  !== before.phone_tokens);

    if (tokenCountChanged) {
      if (before.confirmed_online > 0 || before.confirmed_phone > 0) {
        return Response.json({ success: false, error: 'Cannot change token counts after confirmed bookings.' }, { status: 409 });
      }
      await admin.rpc('seed_token_pool', { p_event_id: id });
    }

    await admin.from('audit_log').insert({
      table_name: 'muttu_events', record_id: id,
      action: 'update', old_data: before, new_data: updated, actor_id: user.id,
    });

    return Response.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const { id } = context.params;
  const admin  = createAdminClient();

  const { data: event } = await admin.from('muttu_events').select('*').eq('id', id!).single();
  if (!event) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

  const { count: confirmedCount } = await admin
    .from('bookings').select('*', { count: 'exact', head: true })
    .eq('event_id', id!).eq('status', 'confirmed');

  if ((confirmedCount ?? 0) > 0) {
    await admin.from('muttu_events').update({ status: 'archived' }).eq('id', id!);
    await admin.from('audit_log').insert({
      table_name: 'muttu_events', record_id: id,
      action: 'archive', old_data: event, actor_id: user.id,
    });
    return Response.json({ success: true, data: { action: 'archived', reason: 'Has confirmed bookings' } });
  }

  await admin.from('muttu_events').delete().eq('id', id!);
  await admin.from('audit_log').insert({
    table_name: 'muttu_events', record_id: id,
    action: 'delete', old_data: event, actor_id: user.id,
  });

  return Response.json({ success: true, data: { action: 'deleted' } });
};
