import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ success: false, error: 'Unauthorised' }, { status: 401 });

  const form       = await context.request.formData();
  const file       = form.get('file') as File | null;
  const booking_id = form.get('booking_id') as string | null;

  if (!file || !booking_id) {
    return Response.json({ success: false, error: 'Missing file or booking_id' }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: booking } = await admin
    .from('bookings').select('user_id, booking_type, status')
    .eq('id', booking_id).single();

  if (!booking || booking.user_id !== user.id) {
    return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }
  if (booking.booking_type !== 'phone') {
    return Response.json({ success: false, error: 'Not a phone booking' }, { status: 409 });
  }

  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${user.id}/${booking_id}.${ext}`;

  const { error: upErr } = await admin.storage
    .from('payment-screenshots')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) return Response.json({ success: false, error: upErr.message }, { status: 500 });

  await admin.from('bookings').update({
    payment_screenshot_url: path,
    status: 'payment_init',
  }).eq('id', booking_id);

  return Response.json({ success: true, data: { path } });
};
