const SUPPORT_EMAIL = 'vishwanagayakshi@gmail.com';

export async function sendOfferingConfirmationEmail(params: {
  to: string;
  name: string;
  offeringRef: string;
  purpose: string;
  amountPaise: number;
  paymentId: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const from = import.meta.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error('RESEND_API_KEY / RESEND_FROM_EMAIL not configured; skipping email send');
    return { sent: false, error: 'Email not configured' };
  }

  const amount = `₹${(params.amountPaise / 100).toLocaleString('en-IN')}`;

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #2d1810;">
      <h1 style="color: #7a1912; font-size: 22px;">Thank you, ${escapeHtml(params.name)}</h1>
      <p>Your offering to Sree Pulikkal Vishwanagayakshi Temple has been received.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; color: #5e4334;">Reference</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${escapeHtml(params.offeringRef)}</td></tr>
        <tr style="border-top: 1px solid #dcbfa6;"><td style="padding: 8px 0; color: #5e4334;">Purpose</td><td style="padding: 8px 0; text-align: right;">${escapeHtml(params.purpose)}</td></tr>
        <tr style="border-top: 1px solid #dcbfa6;"><td style="padding: 8px 0; color: #5e4334;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${amount}</td></tr>
        <tr style="border-top: 1px solid #dcbfa6;"><td style="padding: 8px 0; color: #5e4334;">Payment ID</td><td style="padding: 8px 0; text-align: right; font-size: 12px;">${escapeHtml(params.paymentId)}</td></tr>
      </table>
      <p style="color: #5e4334; font-size: 14px;">
        This email serves as your receipt. For any questions, contact the temple at
        +91 99463 73522 or ${SUPPORT_EMAIL}.
      </p>
      <p style="color: #5e4334; font-size: 14px;">Om Nagayakshinnyai Namaha.</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        bcc: SUPPORT_EMAIL,
        reply_to: SUPPORT_EMAIL,
        subject: `Payment Confirmation — ${params.offeringRef}`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Resend send failed', res.status, body);
      return { sent: false, error: body };
    }
    return { sent: true };
  } catch (err) {
    console.error('Resend send threw', err);
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
