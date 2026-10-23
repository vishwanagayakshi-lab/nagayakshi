import type { APIRoute } from 'astro';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  email:    z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const POST: APIRoute = async (context) => {
  try {
    const body = schema.parse(await context.request.json());
    const supabase = createClient(context);

    const { data, error } = await supabase.auth.signInWithPassword(body);
    if (error || !data.user) {
      return Response.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', data.user.id)
      .single();

    if (!profile?.is_admin) {
      await supabase.auth.signOut();
      return Response.json({ success: false, error: 'This account does not have admin access' }, { status: 403 });
    }

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
