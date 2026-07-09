export type OrderPaymentFields = {
  payment_status?: string | null;
  stripe_payment_intent_id?: string | null;
  payment_intent_id?: string | null;
};

export function isOrderPaymentCompleted(order: OrderPaymentFields): boolean {
  const paymentStatus = order.payment_status;
  if (paymentStatus === 'succeeded') return true;
  if (!paymentStatus && (order.stripe_payment_intent_id || order.payment_intent_id)) return true;
  return false;
}

export function getOrderPaymentStatusLabel(order: OrderPaymentFields, options?: { short?: boolean }): string {
  const short = options?.short === true;
  if (isOrderPaymentCompleted(order)) return 'Paid';
  const ps = (order.payment_status || '').toLowerCase();
  if (ps === 'awaiting_payment') return short ? 'Awaiting' : 'Awaiting payment';
  if (ps === 'failed') return short ? 'Failed' : 'Payment failed';
  if (ps === 'canceled') return short ? 'Canceled' : 'Payment canceled';
  return 'Unpaid';
}

export function getOrderPaymentStatusColor(order: OrderPaymentFields): string {
  if (isOrderPaymentCompleted(order)) return '#1E794F';
  const ps = (order.payment_status || '').toLowerCase();
  if (ps === 'failed' || ps === 'canceled') return '#B91C1C';
  if (ps === 'awaiting_payment') return '#B45309';
  return '#667085';
}
