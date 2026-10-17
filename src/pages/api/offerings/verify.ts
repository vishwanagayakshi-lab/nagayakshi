import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { sendOfferingConfirmationEmail } from '@/lib/resend';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  offering_id:         z.string().uuid(),
  razorpay_order_id:   z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature:  z.string(),
});

export const POST: APIRoute = async (context) => {
  try {
    const parsed = schema.parse(await context.request.json());

    const valid = verifyRazorpaySignature({
      order_id:   parsed.razorpay_order_id,
      payment_id: parsed.razorpay_payment_id,
      signature:  parsed.razorpay_signature,
    });
    if (!valid) {
      return Response.json({ success: false, error: 'Payment signature invalid' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: offering, error: fetchErr } = await admin
      .from('offerings')
      .select('*')
      .eq('id', parsed.offering_id)
      .eq('razorpay_order_id', parsed.razorpay_order_id)
      .single();

    if (fetchErr || !offering) {
      return Response.json({ success: false, error: 'Offering not found' }, { status: 404 });
    }

    const { error: updateErr } = await admin
      .from('offerings')
      .update({
        status:               'paid',
        razorpay_payment_id:  parsed.razorpay_payment_id,
        razorpay_signature:   parsed.razorpay_signature,
        payment_captured_at:  new Date().toISOString(),
      })
      .eq('id', offering.id);

    if (updateErr) {
      console.error('offerings update failed', updateErr);
      return Response.json({ success: false, error: 'Could not confirm payment' }, { status: 500 });
    }

    const emailResult = await sendOfferingConfirmationEmail({
      to:          offering.email,
      name:        offering.devotee_name,
      offeringRef: offering.offering_ref,
      purpose:     offering.purpose,
      amountPaise: offering.amount,
      paymentId:   parsed.razorpay_payment_id,
    });

    if (emailResult.sent) {
      await admin
        .from('offerings')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', offering.id);
    }

    return Response.json({
      success: true,
      data: {
        offering_ref: offering.offering_ref,
        purpose:      offering.purpose,
        amount:       offering.amount,
        devotee_name: offering.devotee_name,
        email_sent:   emailResult.sent,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    console.error('offerings/verify error', err);
    return Response.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
};
