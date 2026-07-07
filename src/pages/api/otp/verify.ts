import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';
import { phoneNormalize } from '@/lib/utils';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  phone: z.string().min(10).max(15),
  token: z.string().length(6),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { phone, token } = schema.parse(body);
    const normalised = phoneNormalize(phone);

    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalised,
      token,
      type: 'sms',
    });

    if (error || !data.user) {
      return Response.json({ success: false, error: 'Invalid or expired OTP' }, { status: 400 });
    }

    await supabase.from('profiles').upsert(
      { id: data.user.id, phone: normalised },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    // Set session cookie so server middleware can read it
    if (data.session) {
      cookies.set('sb-access-token',  data.session.access_token,  { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
      cookies.set('sb-refresh-token', data.session.refresh_token!, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    }

    return Response.json({ success: true, data: { user: data.user } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
