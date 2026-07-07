import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const admin  = createAdminClient();

  const { data, error } = await admin
    .from('muttu_events')
    .select('*')
    .eq('id', id!)
    .single();

  if (error) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  return Response.json({ success: true, data });
};
