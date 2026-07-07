import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@/lib/supabase/server';

const ADMIN_PATHS   = ['/admin'];
const AUTH_PATHS    = ['/book', '/my-bookings', '/confirmation', '/print'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const needsAdmin = ADMIN_PATHS.some(p => pathname.startsWith(p));
  const needsAuth  = AUTH_PATHS.some(p => pathname.startsWith(p));

  if (!needsAdmin && !needsAuth) return next();

  const supabase = createClient(context);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return context.redirect(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  if (needsAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, is_banned')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return context.redirect('/');
    }
  }

  return next();
});
