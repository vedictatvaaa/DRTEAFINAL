import { Truck, ShieldCheck, RotateCcw, Leaf } from 'lucide-react';

const ITEMS = [
  { Icon: Truck, label: 'Ships in 24h', sub: 'Dispatch Mon–Sat' },
  { Icon: ShieldCheck, label: 'Secure payments', sub: 'UPI · Cards · COD' },
  { Icon: RotateCcw, label: 'Free 7-day returns', sub: 'No questions asked' },
  { Icon: Leaf, label: 'Small-batch', sub: 'Hand-checked' },
];

export default function PdpTrustBar() {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-5">
      {ITEMS.map(({ Icon, label, sub }) => (
        <li
          key={label}
          className="flex items-start gap-2 p-3 rounded-lg border border-border bg-white"
        >
          <Icon className="w-4 h-4 text-[#3a5a2c] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold leading-tight text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{sub}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
