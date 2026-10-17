import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';
import { createRazorpayOrder } from '@/lib/razorpay';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  devotee_name: z.string().trim().min(2, 'Name is required').max(120),
  nakshatra:    z.string().trim().min(1, 'Select a Nakshatra'),
  phone:        z.string().trim().min(8, 'Enter a valid phone number').max(20),
  email:        z.string().trim().email('Enter a valid email address'),
  city:         z.string().trim().min(2, 'City is required').max(120),
  address:      z.string().trim().min(5, 'Full address is required').max(500),
  purpose:      z.string().trim().min(2).max(200),
  amount:       z.number().int().min(1, 'Minimum amount is ₹1'), // rupees
});

function generateOfferingRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `OFR-${date}-${rand}`;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = schema.parse(await context.request.json());
    const admin = createAdminClient();
    const offeringRef = generateOfferingRef();
    const amountPaise = body.amount * 100;

    const { data: offering, error: insertErr } = await admin
      .from('offerings')
      .insert({
        offering_ref:  offeringRef,
        devotee_name:  body.devotee_name,
        nakshatra:     body.nakshatra,
        phone:         body.phone,
        email:         body.email,
        city:          body.city,
        address:       body.address,
        purpose:       body.purpose,
        amount:        amountPaise,
        status:        'pending',
      })
      .select()
      .single();

    if (insertErr || !offering) {
      console.error('offerings insert failed', insertErr);
      return Response.json({ success: false, error: 'Could not start your offering. Please try again.' }, { status: 500 });
    }

    const order = await createRazorpayOrder({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  offeringRef,
      notes:    {
        offering_id: offering.id,
        purpose:     body.purpose,
        phone:       body.phone,
      },
    });

    await admin
      .from('offerings')
      .update({ razorpay_order_id: order.id, status: 'payment_init' })
      .eq('id', offering.id);

    return Response.json({
      success: true,
      data: {
        offering_id:  offering.id,
        offering_ref: offeringRef,
        order_id:     order.id,
        amount:       order.amount,
        currency:     order.currency,
        key:          import.meta.env.PUBLIC_RAZORPAY_KEY_ID,
        prefill:      { name: body.devotee_name, contact: body.phone, email: body.email },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    console.error('offerings/create error', err);
    return Response.json({ success: false, error: 'Payment gateway error' }, { status: 500 });
  }
};
