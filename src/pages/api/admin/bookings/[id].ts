import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const prerender = false;

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm_phone'), admin_notes: z.string().optional() }),
  z.object({ action: z.literal('cancel'),        cancel_reason: z.string().optional() }),
  z.object({ action: z.literal('refund'),        refund_note: z.string() }),
  z.object({ action: z.literal('update_notes'),  admin_notes: z.string() }),
]);

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

  const { data, error } = await admin
    .from('bookings')
    .select('*, muttu_items(*), event:muttu_events(*), profile:profiles(*)')
    .eq('id', id!).single();

  if (error) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  return Response.json({ success: true, data });
};

export const PATCH: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const { id }   = context.params;
    const body     = await context.request.json();
    const parsed   = actionSchema.parse(body);
    const admin    = createAdminClient();

    const { data: booking } = await admin.from('bookings').select('*').eq('id', id!).single();
    if (!booking) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

    let result: unknown;

    switch (parsed.action) {
      case 'confirm_phone': {
        if (booking.booking_type !== 'phone') {
          return Response.json({ success: false, error: 'Not a phone booking' }, { status: 409 });
        }
        if (!['pending', 'payment_init'].includes(booking.status)) {
          return Response.json({ success: false, error: `Already ${booking.status}` }, { status: 409 });
        }
        const { error } = await admin.rpc('confirm_booking', { p_booking_id: id });
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        await admin.from('bookings').update({
          admin_verified_by: user.id,
          admin_verified_at: new Date().toISOString(),
          admin_notes: parsed.admin_notes ?? null,
        }).eq('id', id!);
        result = { status: 'confirmed' };
        break;
      }
      case 'cancel': {
        const { error } = await admin.rpc('cancel_booking', {
          p_booking_id: id,
          p_reason: parsed.cancel_reason ?? 'Cancelled by admin',
        });
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = { status: 'cancelled' };
        break;
      }
      case 'refund': {
        if (booking.status !== 'confirmed') {
          return Response.json({ success: false, error: 'Can only refund confirmed bookings' }, { status: 409 });
        }
        await admin.from('bookings').update({
          status: 'refunded',
          admin_notes: parsed.refund_note,
          admin_verified_by: user.id,
        }).eq('id', id!);
        result = { status: 'refunded' };
        break;
      }
      case 'update_notes': {
        await admin.from('bookings').update({ admin_notes: parsed.admin_notes }).eq('id', id!);
        result = { updated: true };
        break;
      }
    }

    await admin.from('audit_log').insert({
      table_name: 'bookings', record_id: id,
      action: parsed.action, old_data: booking, actor_id: user.id,
    });

    return Response.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
