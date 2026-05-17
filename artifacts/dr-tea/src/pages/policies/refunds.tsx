import PolicyLayout from '@/components/legal/PolicyLayout';

export default function RefundPolicy() {
  return (
    <PolicyLayout
      title="Refunds &amp; Returns"
      description="Dr Tea's 7-day return window, refund process, and food-safety rules for opened tea, teaware, and gifts."
      lastUpdated="May 1, 2026"
      slug="refunds"
    >
      <h2>Our 7-day promise</h2>
      <p>
        <strong>Free returns within 7 days, no questions asked.</strong> Every Dr Tea order is hand-checked before it
        leaves our kitchen. If something arrives damaged, defective, or simply isn't for you, we'll arrange a free
        pickup and make it right — you don't need to justify why.
      </p>
      <p style={{ fontSize: '0.85em', opacity: 0.75 }}>
        A short note: for food-safety reasons we cannot resell opened tea, so opened pouches are eligible for store
        credit rather than a cash refund. Everything else (sealed tea, teaware, gifts) is fully refundable.
      </p>

      <h2>Return window</h2>
      <ul>
        <li>You have <strong>7 days</strong> from delivery to raise a return or replacement request.</li>
        <li>Email <a href="mailto:care@drtea.in">care@drtea.in</a> with your order number and a short description
          (and photos, where applicable).</li>
      </ul>

      <h2>What can be returned</h2>
      <ul>
        <li><strong>Sealed</strong> tea pouches and tins in original condition.</li>
        <li>Teaware (kettles, cups, infusers) in original packaging with no signs of use.</li>
        <li>Items received damaged, defective, or incorrect.</li>
      </ul>

      <h2>What cannot be returned</h2>
      <ul>
        <li><strong>Opened or partially used</strong> tea — for food-safety reasons.</li>
        <li>Gift cards, samples, and promotional add-ons.</li>
        <li>Items returned more than 7 days after delivery.</li>
      </ul>

      <h2>How refunds work</h2>
      <ul>
        <li>Once we receive and inspect the return, we issue a refund within <strong>5–7 working days</strong> to the
          original payment method.</li>
        <li>For COD orders, refunds are issued via UPI or bank transfer to an account you confirm with us.</li>
        <li>Shipping fees are non-refundable unless the return is due to our error.</li>
      </ul>

      <h2>Cancellations</h2>
      <p>
        Orders can be cancelled at no cost any time before they ship. Once shipped, cancellations follow the return
        process above.
      </p>

      <h2>Contact</h2>
      <p><a href="mailto:care@drtea.in">care@drtea.in</a></p>
    </PolicyLayout>
  );
}
