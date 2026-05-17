import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Ticket, Sparkles, Mail } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import Seo from '@/components/Seo';
import bannerImg from '@assets/ChatGPT_Image_May_10,_2026,_10_39_22_AM_1778389787347.png';

const destinations = [
  { name: 'Darjeeling', sub: 'India',           icon: '⛰️' },
  { name: 'Assam',      sub: 'India',           icon: '🌿' },
  { name: 'Munnar',     sub: 'India',           icon: '🍃' },
  { name: 'Japan',      sub: 'Tradition',       icon: '⛩️' },
  { name: 'London',     sub: 'Timeless Elegance', icon: '🏛️' },
];

const howItWorks = [
  { step: '01', title: 'Find a Scratch Pass', body: 'Look inside selected Dr Tea packs for a golden scratch card.' },
  { step: '02', title: 'Scratch & Reveal',     body: 'Uncover your unique entry code. Every pass is a real chance to win.' },
  { step: '03', title: 'Enter Below',          body: 'Submit your code with your details — winners are drawn each month.' },
];

export default function WinTrip() {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !email.trim() || !name.trim()) {
      toast({ title: 'Please fill in all fields' });
      return;
    }
    toast({
      title: 'Entry received!',
      description: `Thanks ${name.split(' ')[0]}, your code is in the draw.`,
    });
    setCode('');
    setEmail('');
    setName('');
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: 'Win a Trip to the World\u2019s Tea Gardens',
    description:
      'Enter Dr Tea\u2019s scratch & win sweepstakes for a chance to journey through Darjeeling, Assam, Munnar, Japan and London.',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    organizer: { '@type': 'Organization', name: 'Dr Tea', url: 'https://drtea.in/' },
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1a2416]">
      <Seo
        title="Win a Trip to the World\u2019s Tea Gardens — Dr Tea Scratch & Win"
        description="Experience tea beyond the cup. Look for a scratch pass inside selected Dr Tea packs and unlock a journey through Darjeeling, Assam, Munnar, Japan and London."
        canonical="https://drtea.in/win-a-trip"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <section className="relative">
        <div className="relative w-full aspect-[1024/410] sm:aspect-[1024/360] overflow-hidden bg-[#1a2416]">
          <img
            src={bannerImg}
            alt="Win a trip to the world\u2019s tea gardens — Darjeeling, Assam, Munnar, Japan and London"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-6 sm:-mt-10 relative">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-bold text-white bg-black/45 backdrop-blur px-3 py-2 rounded-full hover:bg-black/65"
          >
            <ArrowLeft className="w-3 h-3" /> Back to Home
          </Link>
        </div>
      </section>

      {/* Intro */}
      <section className="px-4 sm:px-8 pt-8 pb-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#8B6F2A] font-bold mb-2">
            Scratch &amp; Win
          </p>
          <h1 className="text-[28px] sm:text-[36px] font-serif font-bold leading-tight mb-3">
            Tea is a journey.<br className="hidden sm:block" /> Take it further.
          </h1>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Five teas. Five destinations. Every month, one tea lover wins an all-expenses
            trip to one of the world\u2019s most iconic tea gardens. Your next pack of Dr Tea
            could be the one with a golden ticket inside.
          </p>
        </div>
      </section>

      {/* Destinations */}
      <section className="px-4 sm:px-8 pb-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[18px] sm:text-[20px] font-serif font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#3a5a2c]" /> Where you could go
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {destinations.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-gray-100 p-4 text-center"
              >
                <div className="text-2xl mb-1.5" aria-hidden>{d.icon}</div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-[#1a2416]">
                  {d.name}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{d.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-gray-100 px-4 sm:px-8 py-10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[18px] sm:text-[20px] font-serif font-bold mb-5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8B6F2A]" /> How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {howItWorks.map((s) => (
              <div key={s.step} className="rounded-xl bg-[#FAF8F4] border border-gray-100 p-5">
                <p className="text-[28px] font-serif font-bold text-[#3a5a2c] leading-none mb-2">
                  {s.step}
                </p>
                <p className="text-[13px] font-bold mb-1">{s.title}</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Entry form */}
      <section className="px-4 sm:px-8 py-10">
        <div className="max-w-xl mx-auto bg-[#1a2416] text-white rounded-2xl p-6 sm:p-8">
          <h2 className="text-[20px] sm:text-[22px] font-serif font-bold mb-1 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-amber-200" /> Enter your scratch code
          </h2>
          <p className="text-[12px] text-white/60 mb-5">
            Found a golden pass? Drop your code below to enter the next monthly draw.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-3 text-[13px] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-200"
              autoComplete="name"
            />
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" aria-hidden />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-3 text-[13px] placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-200"
                autoComplete="email"
              />
            </div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Scratch code (e.g. DRTEA-2026-XXXX)"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-3 text-[13px] tracking-widest font-mono uppercase placeholder:text-white/40 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="submit"
              className="w-full bg-amber-200 text-[#1a2416] text-[12px] font-bold uppercase tracking-widest px-4 py-3.5 rounded-md hover:bg-amber-100 transition-colors"
            >
              Submit Entry
            </button>
          </form>
          <p className="text-[10px] text-white/40 mt-4 leading-relaxed">
            Open to residents 18+. One trip awarded each month. Travel dates and destination
            assigned by Dr Tea. Full terms apply.
          </p>
        </div>
      </section>
    </div>
  );
}
