import { defineMiddleware } from 'astro:middleware';
import { createClient } from './lib/supabase/server';

const ADMIN_PATHS = ['/muttu-booking/admin'];
const AUTH_PATHS  = [
  '/muttu-booking/book',
  '/muttu-booking/my-bookings',
  '/muttu-booking/confirmation',
  '/muttu-booking/print',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const needsAdmin = ADMIN_PATHS.some(p => pathname.startsWith(p));
  const needsAuth  = AUTH_PATHS.some(p => pathname.startsWith(p));

  if (!needsAdmin && !needsAuth) return next();

  try {
    const supabase = createClient(context);
    const { data: { user } } = await supabase.auth.getUser();
    const loginPath = needsAdmin ? '/admin/login' : '/muttu-booking/login';

    if (!user) {
      return context.redirect(`${loginPath}?redirect=${encodeURIComponent(pathname)}`);
    }

    if (needsAdmin) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return context.redirect('/');
      }
    }
  } catch {
    const loginPath = needsAdmin ? '/admin/login' : '/muttu-booking/login';
    return context.redirect(`${loginPath}?redirect=${encodeURIComponent(pathname)}`);
  }

  return next();
});
