import type { APIRoute } from 'astro';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateReceiptPDF } from '@/lib/receipt';
import { sendOfferingConfirmationEmail } from '@/lib/resend';
import { z } from 'zod';

export const prerender = false;

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action:       z.literal('update_details'),
    devotee_name: z.string().trim().min(2).max(120),
    nakshatra:    z.string().trim().min(1),
    phone:        z.string().trim().min(8).max(20),
    email:        z.string().trim().email(),
    city:         z.string().trim().min(2).max(120),
    address:      z.string().trim().min(5).max(500),
    purpose:      z.string().trim().min(2).max(200),
    amount:       z.number().int().min(1), // rupees
  }),
  z.object({
    action: z.literal('set_status'),
    status: z.enum(['pending', 'payment_init', 'paid', 'failed']),
  }),
  z.object({ action: z.literal('resend_email') }),
]);

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

    const { data: offering } = await admin.from('offerings').select('*').eq('id', id!).single();
    if (!offering) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

    let result: unknown;

    switch (parsed.action) {
      case 'update_details': {
        const { data, error } = await admin.from('offerings').update({
          devotee_name: parsed.devotee_name,
          nakshatra:    parsed.nakshatra,
          phone:        parsed.phone,
          email:        parsed.email,
          city:         parsed.city,
          address:      parsed.address,
          purpose:      parsed.purpose,
          amount:       parsed.amount * 100,
        }).eq('id', id!).select().single();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = data;
        break;
      }
      case 'set_status': {
        const update: Record<string, unknown> = { status: parsed.status };
        if (parsed.status === 'paid' && !offering.payment_captured_at) {
          update.payment_captured_at = new Date().toISOString();
        }
        const { data, error } = await admin.from('offerings').update(update).eq('id', id!).select().single();
        if (error) return Response.json({ success: false, error: error.message }, { status: 500 });
        result = data;
        break;
      }
      case 'resend_email': {
        if (offering.status !== 'paid') {
          return Response.json({ success: false, error: 'Offering is not marked paid yet' }, { status: 409 });
        }
        const pdf = await generateReceiptPDF({
          offeringRef:  offering.offering_ref,
          devoteeName:  offering.devotee_name,
          nakshatraKey: offering.nakshatra,
          purpose:      offering.purpose,
          amountPaise:  offering.amount,
          createdAt:    offering.created_at,
          paymentId:    offering.razorpay_payment_id ?? 'N/A',
        });
        const emailResult = await sendOfferingConfirmationEmail({
          to:          offering.email,
          name:        offering.devotee_name,
          offeringRef: offering.offering_ref,
          purpose:     offering.purpose,
          amountPaise: offering.amount,
          paymentId:   offering.razorpay_payment_id ?? 'N/A',
          receiptPdf:  pdf,
        });
        if (!emailResult.sent) {
          return Response.json({ success: false, error: emailResult.error ?? 'Failed to send email' }, { status: 500 });
        }
        const { data } = await admin.from('offerings')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', id!).select().single();
        result = data;
        break;
      }
    }

    await admin.from('audit_log').insert({
      table_name: 'offerings', record_id: id,
      action: parsed.action, old_data: offering, actor_id: user.id,
    });

    return Response.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    console.error('admin offerings PATCH error', err);
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
