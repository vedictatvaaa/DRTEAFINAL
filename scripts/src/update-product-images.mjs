import fs from 'fs';

const slugs = [
  'hibiscus-tea','blue-pea-flower','chamomile-tea','lavender-tea','rose-tea',
  'fennel-tea','sea-buckthorn-tea','peppermint-tea','butterfly-pea-blue',
  'royal-masala-chai','dr-tea-gold-ctc','dr-tea-premium-ctc','dr-tea-kadak-chai',
  'dr-tea-dum-chai','kashmiri-noon-chai','tulsi-ginger-kadha','haldi-mulethi-kadha',
  'ashwagandha-kadha','giloy-tulsi-kadha','brahmi-kadha','moringa-kadha',
  'jeshtimadh-throat-kadha','himalayan-green-tea','lemon-green-tea','jasmine-green-tea',
  'mint-green-tea','tulsi-green-tea','moroccan-mint-green-tea','munnar-mountain-green',
  'assam-gold','darjeeling-black-tea','earl-grey','english-breakfast','nilgiri-black-tea',
  'darjeeling-first-flush','darjeeling-second-flush','darjeeling-autumn-flush',
  'silver-needle-white','moonlight-white-tea','white-peony-tea','himalayan-oolong',
  'muscatel-oolong','single-estate-assam','seasonal-reserve-tea','kangra-silver-tips'
];

let content = fs.readFileSync('artifacts/dr-tea/src/data/products.ts', 'utf8');
let updated = 0;
const notFound = [];

for (const slug of slugs) {
  const newUrl = `/images/products/${slug}.png`;
  // Find position of this slug literal in the file
  const slugLiteral = `slug: '${slug}',`;
  const slugIdx = content.indexOf(slugLiteral);
  if (slugIdx === -1) {
    notFound.push(slug);
    console.log(`✗ NOT FOUND: ${slug}`);
    continue;
  }
  // From that position, find the next imageUrl: '...' occurrence
  const searchFrom = slugIdx;
  const imageUrlRe = /imageUrl:\s*'[^']+'/g;
  imageUrlRe.lastIndex = searchFrom;
  const match = imageUrlRe.exec(content);
  if (!match || match.index > slugIdx + 3000) {
    notFound.push(slug);
    console.log(`✗ imageUrl not found near ${slug}`);
    continue;
  }
  content = content.slice(0, match.index) + `imageUrl: '${newUrl}'` + content.slice(match.index + match[0].length);
  updated++;
  console.log(`✓ ${slug}`);
}

fs.writeFileSync('artifacts/dr-tea/src/data/products.ts', content);
console.log(`\nUpdated ${updated}/${slugs.length} products.`);
if (notFound.length) console.log('Not found:', notFound.join(', '));
