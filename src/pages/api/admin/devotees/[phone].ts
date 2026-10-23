import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const prerender = false;

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

  const phone = decodeURIComponent(context.params.phone!);
  const admin = createAdminClient();

  const [{ data: bookings }, { data: offerings }, { data: note }] = await Promise.all([
    admin.from('bookings').select('*, event:muttu_events(name)').eq('phone', phone).order('created_at', { ascending: false }),
    admin.from('offerings').select('*').eq('phone', phone).order('created_at', { ascending: false }),
    admin.from('devotee_notes').select('*').eq('phone', phone).maybeSingle(),
  ]);

  return Response.json({ success: true, data: { bookings: bookings ?? [], offerings: offerings ?? [], note } });
};

const noteSchema = z.object({
  notes: z.string().max(5000).optional(),
  tags:  z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const PATCH: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const phone  = decodeURIComponent(context.params.phone!);
    const body   = noteSchema.parse(await context.request.json());
    const admin  = createAdminClient();

    const { data, error } = await admin.from('devotee_notes').upsert({
      phone,
      notes: body.notes ?? '',
      tags:  body.tags ?? [],
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' }).select().single();

    if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
    return Response.json({ success: true, data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
