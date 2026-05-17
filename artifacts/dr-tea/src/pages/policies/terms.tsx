import PolicyLayout from '@/components/legal/PolicyLayout';

export default function TermsAndConditions() {
  return (
    <PolicyLayout
      title="Terms &amp; Conditions"
      description="The terms that govern your use of drtea.in and any purchase you make from Dr Tea."
      lastUpdated="May 1, 2026"
      slug="terms"
    >
      <p>
        These Terms govern your access to and purchases from <strong>drtea.in</strong> (the "Site"), operated by Dr Tea
        ("we", "us"). By using the Site or placing an order you accept these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 18 years old and able to form a legally binding contract to place an order.</p>

      <h2>2. Products &amp; pricing</h2>
      <ul>
        <li>All teas are described to the best of our knowledge. Photography is illustrative; actual colour and aroma
          may vary by batch and harvest.</li>
        <li>Prices are listed in Indian Rupees (INR) and include applicable GST unless stated otherwise.</li>
        <li>We reserve the right to correct pricing or stock errors and to cancel orders affected by such errors,
          with a full refund.</li>
      </ul>

      <h2>3. Orders &amp; payment</h2>
      <ul>
        <li>Placing an order constitutes an offer to purchase. The contract is formed when we send the order
          confirmation.</li>
        <li>We accept UPI, debit and credit cards via Razorpay (and other providers we may onboard), and Cash on
          Delivery for eligible PIN codes.</li>
        <li>Orders may be cancelled or held for review where we suspect fraud or abuse.</li>
      </ul>

      <h2>4. Shipping &amp; delivery</h2>
      <p>
        See our <a href="/shipping">Shipping &amp; Delivery</a> policy for timelines, fees, and serviceable areas.
      </p>

      <h2>5. Returns, refunds &amp; cancellations</h2>
      <p>
        See our <a href="/refunds">Refund &amp; Returns</a> policy. Food safety regulations limit returns of opened
        consumables.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        All content on the Site — including the Dr Tea name, logo, photography, illustrations, and copy — is owned by
        us or our licensors and is protected by intellectual property laws. You may not reproduce or use it
        commercially without written permission.
      </p>

      <h2>7. User content</h2>
      <p>
        Reviews and other content you post must be your own and must not be unlawful, infringing, or defamatory. You
        grant us a non-exclusive, royalty-free licence to display and promote your content in connection with the
        product.
      </p>

      <h2>8. Acceptable use</h2>
      <p>
        Don't try to disrupt, scrape, reverse-engineer, or attack the Site or its services. We may suspend access for
        any user who violates these Terms.
      </p>

      <h2>9. Disclaimer &amp; liability</h2>
      <p>
        Our teas and tisanes are food products, not medicines. Statements about wellness benefits are not evaluated by
        any regulatory authority and are not intended to diagnose, treat, cure, or prevent any disease. To the maximum
        extent permitted by law, our liability for any claim arising from your use of the Site or a product is
        limited to the amount you paid for the relevant order.
      </p>

      <h2>10. Governing law &amp; jurisdiction</h2>
      <p>
        These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the
        courts at our registered office.
      </p>

      <h2>11. Changes</h2>
      <p>We may update these Terms occasionally. The "Last updated" date at the top reflects the most recent change.</p>

      <h2>12. Contact</h2>
      <p><a href="mailto:care@drtea.in">care@drtea.in</a></p>
    </PolicyLayout>
  );
}
