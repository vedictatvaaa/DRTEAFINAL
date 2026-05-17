import type { JournalAuthor } from '@/data/journal-authors';

export default function AuthorByline({
  author,
  variant = 'compact',
  date,
}: {
  author: JournalAuthor;
  variant?: 'compact' | 'full';
  date?: string;
}) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2.5">
        <Avatar author={author} size={32} />
        <div className="min-w-0 leading-tight">
          <p className="text-[12px] font-semibold text-foreground truncate">{author.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{author.role}{date ? ` · ${date}` : ''}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-4 p-5 sm:p-6 rounded-2xl bg-white border border-border">
      <Avatar author={author} size={56} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">Written by</p>
        <p className="text-[16px] font-serif font-semibold text-foreground">{author.name}</p>
        <p className="text-[11px] text-muted-foreground mb-2">{author.role}</p>
        <p className="text-[13px] text-muted-foreground leading-relaxed">{author.bio}</p>
      </div>
    </div>
  );
}

function Avatar({ author, size }: { author: JournalAuthor; size: number }) {
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden bg-[#1a2416] text-amber-200 flex items-center justify-center font-serif font-bold ring-1 ring-black/5"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {author.avatar ? (
        <img
          src={author.avatar}
          alt={author.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span>{author.initials}</span>
      )}
    </div>
  );
}
