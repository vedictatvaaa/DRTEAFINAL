import { Mail, MessageCircle, Clock, MapPin, Phone } from 'lucide-react';
import PolicyLayout from '@/components/legal/PolicyLayout';

export default function ContactPage() {
  return (
    <PolicyLayout
      title="Contact Us"
      description="Reach the Dr Tea care team — order help, wholesale enquiries, press, and support hours."
      lastUpdated="May 1, 2026"
      slug="contact"
    >
      <p className="not-prose mb-6">
        We answer every email personally, usually within one working day. For the fastest help with an order, please
        include your <strong>order number</strong>.
      </p>

      <div className="not-prose grid sm:grid-cols-2 gap-3 my-6">
        <a href="tel:+918929892922" className="block p-4 rounded-xl border border-border bg-white hover:border-foreground/30 transition-colors">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <Phone className="w-4 h-4" /> <span className="font-semibold text-[14px]">Call us</span>
          </div>
          <p className="text-[14px] text-foreground font-semibold tracking-wide tabular-nums">+91-8929-8929-22</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Mon–Sat · 10:00 – 19:00 IST</p>
        </a>
        <a href="https://wa.me/918929892922" target="_blank" rel="noopener noreferrer" className="block p-4 rounded-xl border border-border bg-white hover:border-foreground/30 transition-colors">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <MessageCircle className="w-4 h-4 text-emerald-600" /> <span className="font-semibold text-[14px]">WhatsApp</span>
          </div>
          <p className="text-[14px] text-foreground font-semibold tracking-wide tabular-nums">+91-8929-8929-22</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Fastest replies · same day</p>
        </a>
        <a href="mailto:care@drtea.in" className="block p-4 rounded-xl border border-border bg-white hover:border-foreground/30 transition-colors">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <Mail className="w-4 h-4" /> <span className="font-semibold text-[14px]">Customer care</span>
          </div>
          <p className="text-[12px] text-muted-foreground">care@drtea.in</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Order help · Returns</p>
        </a>
        <a href="mailto:wholesale@drtea.in" className="block p-4 rounded-xl border border-border bg-white hover:border-foreground/30 transition-colors">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <MessageCircle className="w-4 h-4" /> <span className="font-semibold text-[14px]">Wholesale &amp; HoReCa</span>
          </div>
          <p className="text-[12px] text-muted-foreground">wholesale@drtea.in</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Cafés · Hotels · Bulk</p>
        </a>
        <a href="mailto:press@drtea.in" className="block p-4 rounded-xl border border-border bg-white hover:border-foreground/30 transition-colors">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <Mail className="w-4 h-4" /> <span className="font-semibold text-[14px]">Press &amp; partnerships</span>
          </div>
          <p className="text-[12px] text-muted-foreground">press@drtea.in</p>
        </a>
        <div className="block p-4 rounded-xl border border-border bg-white">
          <div className="flex items-center gap-2 text-foreground mb-1">
            <Clock className="w-4 h-4" /> <span className="font-semibold text-[14px]">Hours</span>
          </div>
          <p className="text-[12px] text-muted-foreground">Mon–Sat · 10:00 – 19:00 IST</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Closed on public holidays</p>
        </div>
      </div>

      <h2>Office</h2>
      <p className="not-prose flex items-start gap-2 text-[13px] text-muted-foreground">
        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Dr Tea Pvt. Ltd.<br />
          Founder: <strong className="text-foreground">Mr Mohit Barman</strong><br />
          Crafted Tea &amp; Teaware<br />
          Jorhat, Assam · India
        </span>
      </p>

      <h2>Looking for something else?</h2>
      <ul>
        <li><a href="/shipping">Shipping &amp; delivery timelines</a></li>
        <li><a href="/refunds">Refunds &amp; returns</a></li>
        <li><a href="/privacy">Privacy policy</a></li>
        <li><a href="/terms">Terms &amp; conditions</a></li>
      </ul>
    </PolicyLayout>
  );
}
