import type { APIRoute } from 'astro';
import { generateReceiptPDF } from '@/lib/receipt';
import { sendOfferingConfirmationEmail } from '@/lib/resend';

export const prerender = false;

const DUMMY = {
  offeringRef:  'OFR-TEST-0001',
  devoteeName:  'Test Devotee',
  nakshatraKey: 'ashlesha',
  purpose:      'Ayilyam Pooja',
  amountPaise:  100000,
  createdAt:    new Date().toISOString(),
  paymentId:    'pay_test_dummy123',
};

export const GET: APIRoute = async ({ url }) => {
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== import.meta.env.TEST_SECRET) {
    return new Response('Not found', { status: 404 });
  }

  const mode = url.searchParams.get('mode') ?? 'pdf';

  if (mode === 'pdf') {
    const pdf = await generateReceiptPDF(DUMMY);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'inline; filename="test-receipt.pdf"',
      },
    });
  }

  if (mode === 'email') {
    const to = url.searchParams.get('to');
    if (!to) {
      return Response.json({ success: false, error: 'Pass ?to=your@email.com' }, { status: 400 });
    }
    const pdf = await generateReceiptPDF(DUMMY);
    const result = await sendOfferingConfirmationEmail({
      to,
      name:        DUMMY.devoteeName,
      offeringRef: DUMMY.offeringRef,
      purpose:     DUMMY.purpose,
      amountPaise: DUMMY.amountPaise,
      paymentId:   DUMMY.paymentId,
      receiptPdf:  pdf,
    });
    return Response.json(result);
  }

  return Response.json({ success: false, error: 'mode must be "pdf" or "email"' }, { status: 400 });
};
