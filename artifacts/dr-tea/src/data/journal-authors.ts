export interface JournalAuthor {
  name: string;
  role: string;
  bio: string;
  avatar: string;
  initials: string;
}

const FALLBACK: JournalAuthor = {
  name: 'The Dr Tea Team',
  role: 'Editorial',
  bio: 'Stories, brewing guides and tea history from the team behind every cup.',
  avatar: '/images/brand-story.webp',
  initials: 'DT',
};

const AUTHORS: Record<string, JournalAuthor> = {
  'dr arjun mehta': {
    name: 'Dr Arjun Mehta',
    role: 'Founder & Master Blender',
    bio: 'A third-generation tea taster with a PhD in plant biochemistry. Splits time between Mumbai and London, tasting upwards of 200 cups a week.',
    avatar: '/images/brand-story.webp',
    initials: 'AM',
  },
  'priya nair': {
    name: 'Priya Nair',
    role: 'Head of Sourcing',
    bio: 'Lives between Darjeeling and the Nilgiris and visits every estate Dr Tea works with at least twice a year.',
    avatar: '/images/category-green.webp',
    initials: 'PN',
  },
  'the dr tea team': FALLBACK,
};

export function getAuthor(name?: string | null): JournalAuthor {
  if (!name) return FALLBACK;
  return AUTHORS[name.trim().toLowerCase()] ?? { ...FALLBACK, name };
}
