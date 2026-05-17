import PolicyLayout from '@/components/legal/PolicyLayout';

export default function ShippingPolicy() {
  return (
    <PolicyLayout
      title="Shipping &amp; Delivery"
      description="Dispatch times, shipping fees, free-shipping threshold, and delivery timelines for Dr Tea orders across India."
      lastUpdated="May 1, 2026"
      slug="shipping"
    >
      <h2>Dispatch &amp; delivery</h2>
      <ul>
        <li>Orders placed before <strong>2 PM IST</strong> (Monday–Saturday) are dispatched the same working day.</li>
        <li>Standard delivery to most metros: <strong>3–5 working days</strong>.</li>
        <li>Tier-2 / tier-3 cities and the North-East: <strong>5–8 working days</strong>.</li>
        <li>You'll receive a tracking link by email and SMS as soon as the order ships.</li>
      </ul>

      <h2>Shipping fees</h2>
      <ul>
        <li><strong>Free shipping</strong> on all orders ₹999 and above.</li>
        <li>Flat shipping fee of <strong>₹99</strong> on orders below ₹999.</li>
        <li>Cash on Delivery: a small handling fee may apply at checkout.</li>
      </ul>

      <h2>Where we ship</h2>
      <p>
        We currently ship to all serviceable PIN codes within India. International shipping is being rolled out — drop
        a note at <a href="mailto:care@drtea.in">care@drtea.in</a> if you'd like to be informed when your country is
        added.
      </p>

      <h2>Order tracking</h2>
      <p>
        Track your order any time at <a href="/account">My Account → Orders</a>, or by clicking the tracking link in
        your shipping email.
      </p>

      <h2>Failed delivery &amp; reattempts</h2>
      <p>
        Couriers will attempt delivery up to <strong>three times</strong>. If the package is undeliverable and returns
        to us, we'll reach out to confirm a new address; reshipping fees may apply.
      </p>

      <h2>Damaged or missing parcels</h2>
      <p>
        If your parcel arrives damaged, please email a photo of the unopened package within <strong>48 hours</strong>{' '}
        of delivery to <a href="mailto:care@drtea.in">care@drtea.in</a>. We'll arrange a replacement at no cost.
      </p>

      <h2>Contact</h2>
      <p><a href="mailto:care@drtea.in">care@drtea.in</a></p>
    </PolicyLayout>
  );
}
