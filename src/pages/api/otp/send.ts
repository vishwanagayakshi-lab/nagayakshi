import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';
import { phoneNormalize } from '@/lib/utils';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  phone:   z.string().min(10).max(15),
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { phone, channel } = schema.parse(body);
    const normalised = phoneNormalize(phone);

    const supabase = createAdminClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalised,
      options: { channel },
    });

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 400 });
    }

    return Response.json({ success: true, data: { phone: normalised } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
