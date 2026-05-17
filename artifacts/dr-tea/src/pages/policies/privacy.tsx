import PolicyLayout from '@/components/legal/PolicyLayout';

export default function PrivacyPolicy() {
  return (
    <PolicyLayout
      title="Privacy Policy"
      description="How Dr Tea collects, uses, and protects your personal information when you shop our crafted Indian teas."
      lastUpdated="May 1, 2026"
      slug="privacy"
    >
      <p>
        Dr Tea ("we", "us", "our") respects your privacy. This policy explains what information we collect when you
        use <strong>drtea.in</strong>, why we collect it, and the choices you have. By using the site you agree to the
        practices described here.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account &amp; order details</strong> — name, email, phone, shipping address, order history.</li>
        <li><strong>Payment data</strong> — handled directly by our payment processors (e.g. Razorpay). We never store
          your full card or UPI credentials on our servers.</li>
        <li><strong>Usage data</strong> — pages viewed, products clicked, cart events, device + browser, IP address.
          Used to improve the site and prevent fraud.</li>
        <li><strong>Communications</strong> — emails you send us, newsletter sign-ups, customer-care chats.</li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To process and deliver orders and provide customer service.</li>
        <li>To send transactional emails (order confirmations, shipping updates) and, with consent, marketing.</li>
        <li>To personalise product recommendations and brewing guides.</li>
        <li>To detect, prevent, and address fraud or abuse.</li>
        <li>To comply with our legal and tax obligations.</li>
      </ul>

      <h2>3. Cookies &amp; analytics</h2>
      <p>
        We use first-party cookies for cart and login state, and privacy-respecting analytics to understand which pages
        and products are useful. You can clear cookies in your browser settings at any time; doing so may sign you out
        and clear your cart.
      </p>

      <h2>4. Sharing your information</h2>
      <p>We share data only with parties that help us operate the store:</p>
      <ul>
        <li>Payment processors (Razorpay and any future provider) for transaction processing.</li>
        <li>Shipping carriers to deliver your order.</li>
        <li>Email and notification providers for transactional and marketing messages.</li>
        <li>Cloud and infrastructure providers that host the site.</li>
      </ul>
      <p>We never sell personal data.</p>

      <h2>5. Your rights</h2>
      <p>
        You can ask us to access, correct, export, or delete your personal data, and to stop sending marketing emails,
        by writing to <a href="mailto:care@drtea.in">care@drtea.in</a>. We will respond within 30 days.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain order and tax records for as long as required by law (typically 7 years in India). Account and
        marketing data are retained while your account is active and removed on request.
      </p>

      <h2>7. Children</h2>
      <p>The site is intended for adults aged 18+. We do not knowingly collect data from minors.</p>

      <h2>8. Updates to this policy</h2>
      <p>
        Material changes will be announced on this page with a new "Last updated" date. Significant changes will also
        be emailed to subscribers.
      </p>

      <h2>9. Contact</h2>
      <p>
        Dr Tea Care · <a href="mailto:care@drtea.in">care@drtea.in</a><br />
        For data-protection requests, mark your email "Data request".
      </p>
    </PolicyLayout>
  );
}
