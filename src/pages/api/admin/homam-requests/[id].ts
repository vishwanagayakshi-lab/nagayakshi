import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const prerender = false;

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action:         z.literal('update_details'),
    devotee_name:   z.string().trim().min(2).max(120),
    nakshatra:      z.string().trim().min(1),
    phone:          z.string().trim().min(8).max(20),
    email:          z.string().trim().email(),
    city:           z.string().trim().max(120).optional().nullable(),
    address:        z.string().trim().max(500).optional().nullable(),
    homam_type:     z.string().trim().min(2).max(200),
    preferred_date: z.string().trim().max(20).optional().nullable(),
    message:        z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({
    action: z.literal('set_status'),
    status: z.enum(['new', 'contacted', 'scheduled', 'converted', 'completed', 'cancelled']),
  }),
  z.object({ action: z.literal('update_notes'), admin_notes: z.string().max(5000) }),
  z.object({
    action:  z.literal('convert_to_offering'),
    amount:  z.number().int().min(1), // rupees
    purpose: z.string().trim().min(2).max(200).optional(),
  }),
]);

function generateOfferingRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `OFR-${date}-${rand}`;
}

async function requireAdmin(context: Parameters<APIRoute>[0]) {
  const supabase = createClient(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return p?.is_admin ? user : null;
}

export const PATCH: APIRoute = async (context) => {
  const user = await requireAdmin(context);
  if (!user) return Response.json({ success: false, error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = context.params;
    const body   = await context.request.json();
    const parsed = actionSchema.parse(body);
    const admin  = createAdminClient();

    const { data: req } = await admin.from('homam_requests').select('*').eq('id', id!).single();
    if (!req) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

    let result: unknown;

    switch (parsed.action) {
      case 'update_details': {
        const { data, error } = await admin.from('homam_requests').update({
          devotee_name:   parsed.devotee_name,
          nakshatra:      parsed.nakshatra,
          phone:          parsed.phone,
          email:          parsed.email,
          city:           parsed.city ?? null,
          address:        parsed.address ?? null,
          homam_type:     parsed.homam_type,
          preferred_date: parsed.preferred_date ?? null,
          message:        parsed.message ?? null,
        }).eq('id', id!).select().single();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = data;
        break;
      }
      case 'set_status': {
        const { data, error } = await admin.from('homam_requests').update({ status: parsed.status }).eq('id', id!).select().single();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = data;
        break;
      }
      case 'update_notes': {
        const { data, error } = await admin.from('homam_requests').update({ admin_notes: parsed.admin_notes }).eq('id', id!).select().single();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = data;
        break;
      }
      case 'convert_to_offering': {
        if (req.linked_offering_id) {
          return Response.json({ success: false, error: 'Already converted to an offering' }, { status: 409 });
        }
        const offeringRef = generateOfferingRef();
        const { data: offering, error: offeringErr } = await admin.from('offerings').insert({
          offering_ref: offeringRef,
          devotee_name: req.devotee_name,
          nakshatra:    req.nakshatra,
          phone:        req.phone,
          email:        req.email,
          city:         req.city ?? '',
          address:      req.address ?? '',
          purpose:      parsed.purpose ?? req.homam_type,
          amount:       parsed.amount * 100,
          status:       'pending',
        }).select().single();
        if (offeringErr || !offering) {
          return Response.json({ success: false, error: offeringErr?.message ?? 'Failed to create offering' }, { status: 500 });
        }
        const { data, error } = await admin.from('homam_requests')
          .update({ status: 'converted', linked_offering_id: offering.id })
          .eq('id', id!).select().single();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = { ...data, offering };
        break;
      }
    }

    await admin.from('audit_log').insert({
      table_name: 'homam_requests', record_id: id,
      action: parsed.action, old_data: req, actor_id: user.id,
    });

    return Response.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    console.error('admin homam-requests PATCH error', err);
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
