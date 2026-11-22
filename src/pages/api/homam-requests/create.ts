import type { APIRoute } from 'astro';
import { createAdminClient } from '@/lib/supabase/server';
import { sendHomamRequestAcknowledgement } from '@/lib/resend';
import { z } from 'zod';

export const prerender = false;

const schema = z.object({
  devotee_name:   z.string().trim().min(2, 'Name is required').max(120),
  nakshatra:      z.string().trim().min(1, 'Select a Nakshatra'),
  phone:          z.string().trim().min(8, 'Enter a valid phone number').max(20),
  email:          z.string().trim().email('Enter a valid email address'),
  city:           z.string().trim().max(120).optional(),
  address:        z.string().trim().max(500).optional(),
  homam_type:     z.string().trim().min(2).max(200),
  preferred_date: z.string().trim().max(20).optional(),
  message:        z.string().trim().max(1000).optional(),
});

function generateRequestRef(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `HMR-${date}-${rand}`;
}

export const POST: APIRoute = async (context) => {
  try {
    const body = schema.parse(await context.request.json());
    const admin = createAdminClient();
    const requestRef = generateRequestRef();

    const { data: request, error } = await admin
      .from('homam_requests')
      .insert({
        request_ref:    requestRef,
        devotee_name:   body.devotee_name,
        nakshatra:      body.nakshatra,
        phone:          body.phone,
        email:          body.email,
        city:           body.city || null,
        address:        body.address || null,
        homam_type:     body.homam_type,
        preferred_date: body.preferred_date || null,
        message:        body.message || null,
      })
      .select()
      .single();

    if (error || !request) {
      console.error('homam_requests insert failed', error);
      return Response.json({ success: false, error: `Database error: ${error?.message ?? 'request not created'}` }, { status: 500 });
    }

    const emailResult = await sendHomamRequestAcknowledgement({
      to:         body.email,
      name:       body.devotee_name,
      requestRef,
      homamType:  body.homam_type,
    });

    return Response.json({
      success: true,
      data: { request_ref: requestRef, email_sent: emailResult.sent },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ success: false, error: err.issues[0].message }, { status: 422 });
    }
    console.error('homam-requests/create error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
