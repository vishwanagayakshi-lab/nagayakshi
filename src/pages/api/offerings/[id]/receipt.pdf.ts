import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';
import { generateReceiptPDF } from '@/lib/receipt';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return new Response('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const { data: offering, error } = await admin
    .from('offerings')
    .select('*')
    .eq('id', id)
    .eq('status', 'paid')
    .single();

  if (error || !offering) {
    return new Response('Receipt not found', { status: 404 });
  }

  const pdf = await generateReceiptPDF({
    offeringRef:  offering.offering_ref,
    devoteeName:  offering.devotee_name,
    nakshatraKey: offering.nakshatra,
    purpose:      offering.purpose,
    amountPaise:  offering.amount,
    createdAt:    offering.payment_captured_at ?? offering.created_at,
    paymentId:    offering.razorpay_payment_id ?? '',
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${offering.offering_ref}.pdf"`,
    },
  });
};
