import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type CookieContext = {
  request: Request;
  cookies: {
    get(name: string): { value: string } | undefined;
    set(name: string, value: string, opts?: Record<string, unknown>): void;
    delete(name: string, opts?: Record<string, unknown>): void;
  };
};

export function createClient(context: CookieContext) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          const cookieHeader = context.request.headers.get('Cookie') ?? '';
          if (!cookieHeader) return [];
          return cookieHeader.split(';').map(c => {
            const idx   = c.indexOf('=');
            const name  = c.slice(0, idx).trim();
            const value = c.slice(idx + 1).trim();
            return { name, value };
          });
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            context.cookies.set(name, value, options as Record<string, unknown>);
          });
        },
      },
    }
  );
}

export function createAdminClient() {
  return createSupabaseClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
