import { Link } from 'wouter';
import { Leaf } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-6">
          <Leaf className="w-6 h-6" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-3">Lost in the tea garden</p>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4 leading-tight">This page is steeping somewhere else.</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          The leaves you’re looking for aren’t on this shelf. Wander back to the shop, or let us pour you something we know you’ll love.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="px-6 py-3 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider rounded-sm">
            Back to home
          </Link>
          <Link href="/shop" className="px-6 py-3 border border-primary text-primary text-[11px] font-bold uppercase tracking-wider rounded-sm">
            Browse all teas
          </Link>
        </div>
      </div>
    </div>
  );
}
