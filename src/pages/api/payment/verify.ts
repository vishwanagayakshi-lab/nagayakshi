import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  booking_id:          z.string().uuid(),
  razorpay_order_id:   z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature:  z.string(),
});

export const POST: APIRoute = async (context) => {
  try {
    const supabase = createClient(context);
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return Response.json({ success: false, error: 'Unauthorised' }, { status: 401 });
    }

    const parsed = schema.parse(await context.request.json());

    const valid = verifyRazorpaySignature({
      order_id:   parsed.razorpay_order_id,
      payment_id: parsed.razorpay_payment_id,
      signature:  parsed.razorpay_signature,
    });
    if (!valid) {
      return Response.json({ success: false, error: 'Payment signature invalid' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: booking } = await admin
      .from('bookings').select('user_id').eq('id', parsed.booking_id).single();
    if (!booking || booking.user_id !== user.id) {
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const { error: confirmErr } = await admin.rpc('confirm_booking', {
      p_booking_id:          parsed.booking_id,
      p_razorpay_order_id:   parsed.razorpay_order_id,
      p_razorpay_payment_id: parsed.razorpay_payment_id,
      p_razorpay_signature:  parsed.razorpay_signature,
    });

    if (confirmErr) {
      return Response.json({ success: false, error: confirmErr.message }, { status: 500 });
    }

    const { data: updatedBooking } = await admin
      .from('bookings').select('token_numbers').eq('id', parsed.booking_id).single();

    if (updatedBooking?.token_numbers) {
      for (let i = 0; i < updatedBooking.token_numbers.length; i++) {
        await admin.from('muttu_items')
          .update({ token_number: updatedBooking.token_numbers[i] })
          .eq('booking_id', parsed.booking_id)
          .eq('item_index', i + 1);
      }
    }

    return Response.json({ success: true, data: { booking_id: parsed.booking_id } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
