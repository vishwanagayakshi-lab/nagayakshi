import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createRazorpayOrder } from '@/lib/razorpay';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({ booking_id: z.string().uuid() });

export const POST: APIRoute = async (context) => {
  try {
    const supabase = createClient(context);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return Response.json({ success: false, error: 'Unauthorised' }, { status: 401 });
    }

    const { booking_id } = schema.parse(await context.request.json());
    const admin = createAdminClient();

    const { data: booking, error: bErr } = await admin
      .from('bookings').select('*').eq('id', booking_id).eq('user_id', user.id).single();

    if (bErr || !booking) {
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    if (booking.status !== 'pending') {
      return Response.json({ success: false, error: `Booking is already ${booking.status}` }, { status: 409 });
    }
    if (new Date(booking.expires_at) < new Date()) {
      return Response.json({ success: false, error: 'Reservation has expired. Please start again.' }, { status: 410 });
    }

    const order = await createRazorpayOrder({
      amount:   booking.total_amount,
      currency: booking.currency ?? 'INR',
      receipt:  booking.booking_ref,
      notes:    {
        booking_id:  booking.id,
        booking_ref: booking.booking_ref,
        event_id:    booking.event_id,
        phone:       booking.phone,
      },
    });

    await admin.from('bookings').update({
      razorpay_order_id: order.id,
      status: 'payment_init',
    }).eq('id', booking_id);

    return Response.json({
      success: true,
      data: {
        order_id:    order.id,
        amount:      order.amount,
        currency:    order.currency,
        booking_ref: booking.booking_ref,
        key:         import.meta.env.PUBLIC_RAZORPAY_KEY_ID,
        prefill:     { contact: booking.phone },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Payment gateway error' }, { status: 500 });
  }
};
