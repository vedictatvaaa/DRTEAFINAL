import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { LuxuryCard } from '@/components/gift-cards/LuxuryCard';
import {
  checkGiftCard,
  fetchGiftCardDesigns,
  type GiftCardCheck,
  type GiftCardDesign,
} from '@/lib/gift-cards';

/**
 * Printable card artwork at real CR80 dimensions (85.6mm × 53.98mm).
 * Front + back are stacked so a single A4 sheet duplex print produces a
 * cuttable card. Includes a hairline crop guide.
 *
 * URL: /print-card/:code
 *
 * Designed to be opened in a new tab and `Ctrl/Cmd+P` printed at 100%
 * scale, no margins. The page hides itself from the chrome with a
 * print-only stylesheet.
 */
export default function PrintCardPage() {
  const [match, params] = useRoute<{ code: string }>('/print-card/:code');
  const [card, setCard] = useState<GiftCardCheck | null>(null);
  const [design, setDesign] = useState<GiftCardDesign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!match || !params?.code) return;
    void checkGiftCard(params.code).then((r) => {
      if (r.ok) {
        setCard(r);
      } else {
        setError(r.reason);
      }
    });
    void fetchGiftCardDesigns().then((d) => {
      // We don't have designId on the public /check response, so default to
      // a neutral evergreen design. The visual still matches because tier
      // drives the card body — design only contributes the motif.
      const def = d.find((x) => x.id === 'classic-evergreen') ?? d[0] ?? null;
      setDesign(def);
    });
  }, [match, params?.code]);

  if (error) {
    return (
      <div style={{ padding: 48, fontFamily: 'serif', textAlign: 'center' }}>
        Card not found: {error}
      </div>
    );
  }
  if (!card) {
    return (
      <div style={{ padding: 48, fontFamily: 'serif', textAlign: 'center' }}>
        Loading print artwork…
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
        }
        .crop {
          outline: 0.2mm dashed rgba(0,0,0,0.35);
          outline-offset: 1.5mm;
        }
      `}</style>
      <div style={{ background: '#f5f3ee', minHeight: '100vh', padding: '12mm' }}>
        <div className="no-print" style={{ marginBottom: 16, fontFamily: 'serif' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Dr Tea — Print Artwork</h1>
          <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
            Card {card.code} · Tier {card.tier} · Serial {card.serial || '—'}.
            Print at 100% scale, no scaling, on coated 350gsm card stock for
            a true CR80 finish. Use the crop guide to trim.
          </p>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              marginTop: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background: '#1a2416',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Print this sheet
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10mm',
            alignItems: 'flex-start',
          }}
        >
          <div className="crop">
            <LuxuryCard
              design={design ?? undefined}
              tier={card.tier}
              serial={card.serial}
              amount={card.balance}
              recipientName=""
              print
              code={card.code}
              expiresAt={card.expiresAt}
            />
          </div>
          <div className="crop">
            <LuxuryCard
              design={design ?? undefined}
              tier={card.tier}
              serial={card.serial}
              amount={card.balance}
              print
              back
              code={card.code}
              expiresAt={card.expiresAt}
            />
          </div>
        </div>
      </div>
    </>
  );
}
