import { pool } from "@workspace/db";

const slugToImage: Record<string, string> = {
  'hibiscus-tea':            '/images/products/hibiscus-tea.png',
  'blue-pea-flower':         '/images/products/blue-pea-flower.png',
  'chamomile-tea':           '/images/products/chamomile-tea.png',
  'lavender-tea':            '/images/products/lavender-tea.png',
  'rose-tea':                '/images/products/rose-tea.png',
  'fennel-tea':              '/images/products/fennel-tea.png',
  'sea-buckthorn-tea':       '/images/products/sea-buckthorn-tea.png',
  'peppermint-tea':          '/images/products/peppermint-tea.png',
  'butterfly-pea-blue':      '/images/products/butterfly-pea-blue.png',
  'royal-masala-chai':       '/images/products/royal-masala-chai.png',
  'dr-tea-gold-ctc':         '/images/products/dr-tea-gold-ctc.png',
  'dr-tea-premium-ctc':      '/images/products/dr-tea-premium-ctc.png',
  'dr-tea-kadak-chai':       '/images/products/dr-tea-kadak-chai.png',
  'dr-tea-dum-chai':         '/images/products/dr-tea-dum-chai.png',
  'kashmiri-noon-chai':      '/images/products/kashmiri-noon-chai.png',
  'tulsi-ginger-kadha':      '/images/products/tulsi-ginger-kadha.png',
  'haldi-mulethi-kadha':     '/images/products/haldi-mulethi-kadha.png',
  'ashwagandha-kadha':       '/images/products/ashwagandha-kadha.png',
  'giloy-tulsi-kadha':       '/images/products/giloy-tulsi-kadha.png',
  'brahmi-kadha':            '/images/products/brahmi-kadha.png',
  'moringa-kadha':           '/images/products/moringa-kadha.png',
  'jeshtimadh-throat-kadha': '/images/products/jeshtimadh-throat-kadha.png',
  'himalayan-green-tea':     '/images/products/himalayan-green-tea.png',
  'lemon-green-tea':         '/images/products/lemon-green-tea.png',
  'jasmine-green-tea':       '/images/products/jasmine-green-tea.png',
  'mint-green-tea':          '/images/products/mint-green-tea.png',
  'tulsi-green-tea':         '/images/products/tulsi-green-tea.png',
  'moroccan-mint-green-tea': '/images/products/moroccan-mint-green-tea.png',
  'munnar-mountain-green':   '/images/products/munnar-mountain-green.png',
  'assam-gold':              '/images/products/assam-gold.png',
  'darjeeling-black-tea':    '/images/products/darjeeling-black-tea.png',
  'earl-grey':               '/images/products/earl-grey.png',
  'english-breakfast':       '/images/products/english-breakfast.png',
  'nilgiri-black-tea':       '/images/products/nilgiri-black-tea.png',
  'darjeeling-first-flush':  '/images/products/darjeeling-first-flush.png',
  'darjeeling-second-flush': '/images/products/darjeeling-second-flush.png',
  'darjeeling-autumn-flush': '/images/products/darjeeling-autumn-flush.png',
  'silver-needle-white':     '/images/products/silver-needle-white.png',
  'moonlight-white-tea':     '/images/products/moonlight-white-tea.png',
  'white-peony-tea':         '/images/products/white-peony-tea.png',
  'himalayan-oolong':        '/images/products/himalayan-oolong.png',
  'muscatel-oolong':         '/images/products/muscatel-oolong.png',
  'single-estate-assam':     '/images/products/single-estate-assam.png',
  'seasonal-reserve-tea':    '/images/products/seasonal-reserve-tea.png',
  'kangra-silver-tips':      '/images/products/kangra-silver-tips.png',
};

async function main() {
  const client = await pool.connect();
  let updated = 0;
  try {
    for (const [slug, imageUrl] of Object.entries(slugToImage)) {
      const res = await client.query(
        `UPDATE products SET image_url = $1 WHERE slug = $2`,
        [imageUrl, slug]
      );
      if (res.rowCount && res.rowCount > 0) {
        console.log(`✓ ${slug}`);
        updated++;
      } else {
        console.log(`- skipped (not in DB): ${slug}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`\nUpdated ${updated}/${Object.keys(slugToImage).length} products in the database.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
