// Allowed cadence options exposed to the storefront. Keep in sync with the
// <select> in /account so we don't end up with arbitrary frequencies in the
// DB that the UI can't display.
export const SUBSCRIPTION_FREQUENCIES_WEEKS = [2, 4, 6, 8, 12] as const;
export const DEFAULT_SUBSCRIPTION_FREQUENCY_WEEKS = 4;
export const SUBSCRIPTION_DISCOUNT_PCT = 50;

/** Unit price for a subscribed line item — single source of truth, mirrored
 *  by `unitPriceFor` on the storefront (artifacts/dr-tea/src/lib/cart-pricing.ts).
 *  Keep these two in sync. */
export function subscriptionUnitPrice(variantPrice: number, isSubscription: boolean): number {
  return isSubscription
    ? Math.round(variantPrice * (1 - SUBSCRIPTION_DISCOUNT_PCT / 100))
    : variantPrice;
}

export function isValidFrequencyWeeks(n: number): boolean {
  return (SUBSCRIPTION_FREQUENCIES_WEEKS as readonly number[]).includes(n);
}

/** Compute the next delivery date by adding `weeks` weeks to `from`. */
export function addWeeks(from: Date, weeks: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** First delivery is the cadence after the order — gives ~4 weeks for the
 *  first shipment to arrive and the shopper to brew through it. */
export function defaultFirstDelivery(weeks = DEFAULT_SUBSCRIPTION_FREQUENCY_WEEKS): Date {
  return addWeeks(new Date(), weeks);
}
