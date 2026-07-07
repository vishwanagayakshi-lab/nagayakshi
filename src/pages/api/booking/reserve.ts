import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  event_id:     z.string().uuid(),
  quantity:     z.number().int().min(1).max(5),
  booking_type: z.enum(['online', 'phone']).default('online'),
  items: z.array(z.object({
    name:      z.string().min(1).max(100),
    nakshatra: z.string().min(1),
    obstacles: z.string().min(1).max(500),
  })),
});

export const POST: APIRoute = async (context) => {
  try {
    const supabase = createClient(context);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return Response.json({ success: false, error: 'Unauthorised' }, { status: 401 });
    }

    const body   = await context.request.json();
    const parsed = schema.parse(body);

    if (parsed.items.length !== parsed.quantity) {
      return Response.json({ success: false, error: 'Item count must match quantity' }, { status: 422 });
    }

    const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).single();
    if (profile?.is_banned) {
      return Response.json({ success: false, error: 'Your account has been suspended' }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: bookingId, error: reserveErr } = await admin.rpc('reserve_tokens', {
      p_event_id:   parsed.event_id,
      p_user_id:    user.id,
      p_quantity:   parsed.quantity,
      p_token_type: parsed.booking_type,
    });

    if (reserveErr) {
      const msg = reserveErr.message.includes('Not enough tokens')
        ? 'Sorry, not enough tokens available. Please try a smaller quantity.'
        : reserveErr.message.includes('Exceeds maximum')
        ? reserveErr.message
        : reserveErr.message.includes('not open')
        ? 'Booking for this event is not currently open.'
        : 'Could not reserve your spot. Please try again.';
      return Response.json({ success: false, error: msg }, { status: 409 });
    }

    const items = parsed.items.map((item, idx) => ({
      booking_id:  bookingId as string,
      item_index:  idx + 1,
      name:        item.name,
      nakshatra:   item.nakshatra,
      obstacles:   item.obstacles,
    }));

    const { error: itemsErr } = await admin.from('muttu_items').insert(items);
    if (itemsErr) {
      await admin.rpc('cancel_booking', { p_booking_id: bookingId, p_reason: 'Item insert failed' });
      return Response.json({ success: false, error: 'Failed to save booking details' }, { status: 500 });
    }

    const { data: booking } = await admin.from('bookings').select('*').eq('id', bookingId).single();
    return Response.json({ success: true, data: { booking } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
