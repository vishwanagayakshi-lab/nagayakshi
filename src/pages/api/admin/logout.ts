import type { APIRoute } from 'astro';
import { createClient } from '@/lib/supabase/server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context);
  await supabase.auth.signOut();
  return context.redirect('/admin/login');
};
