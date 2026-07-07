import Razorpay from 'razorpay';
import crypto from 'crypto';

let _razorpay: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id:     import.meta.env.RAZORPAY_KEY_ID,
      key_secret: import.meta.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

export async function createRazorpayOrder(params: {
  amount:   number;
  currency: string;
  receipt:  string;
  notes?:   Record<string, string>;
}) {
  const rp = getRazorpay();
  return rp.orders.create({
    amount:   params.amount,
    currency: params.currency,
    receipt:  params.receipt,
    notes:    params.notes ?? {},
  });
}

export function verifyRazorpaySignature(params: {
  order_id:   string;
  payment_id: string;
  signature:  string;
}): boolean {
  const body     = `${params.order_id}|${params.payment_id}`;
  const expected = crypto
    .createHmac('sha256', import.meta.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === params.signature;
}
