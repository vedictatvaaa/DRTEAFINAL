export const SUBSCRIPTION_DISCOUNT = 0.5;
export const PREPAID_DISCOUNT_PCT = 0.05;
export const FREE_SHIPPING_THRESHOLD = 999;
export const ABANDON_PROMO_CODE = "COMEBACK5";
export const ABANDON_PROMO_PCT = 0.05;

export function unitPriceFor(variantPrice: number, isSubscription: boolean) {
  return isSubscription
    ? Math.round(variantPrice * (1 - SUBSCRIPTION_DISCOUNT))
    : variantPrice;
}
