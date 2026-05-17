import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

type Notes = {
  version: string;
  title?: string;
  highlights: string[];
};

const STORAGE_KEY = "dr-tea:release-notes-seen";
const JUST_UPDATED_KEY = "dr-tea:just-updated";

export default function ReleaseNotes() {
  const [notes, setNotes] = useState<Notes | null>(null);

  useEffect(() => {
    // Only show after the SW update + reload flow has just completed.
    let justUpdated = false;
    try {
      justUpdated = sessionStorage.getItem(JUST_UPDATED_KEY) === "1";
      if (justUpdated) sessionStorage.removeItem(JUST_UPDATED_KEY);
    } catch {
      /* ignore */
    }
    if (!justUpdated) return;

    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}release-notes.json?ts=${Date.now()}`;

    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Notes | null) => {
        if (cancelled || !data || !data.version) return;
        if (!Array.isArray(data.highlights) || data.highlights.length === 0) {
          return;
        }

        let seen: string | null = null;
        try {
          seen = window.localStorage.getItem(STORAGE_KEY);
        } catch {
          /* storage unavailable — fall through and show this session */
        }

        if (seen === data.version) return;

        setNotes(data);
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!notes) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, notes.version);
    } catch {
      /* ignore */
    }
    setNotes(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="dr-tea-release-notes-title"
      className="fixed inset-x-0 bottom-4 z-[55] flex justify-center px-4 sm:bottom-6"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <div className="w-9 h-9 shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-700" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p
              id="dr-tea-release-notes-title"
              className="text-[14px] font-semibold text-[#1a2416] leading-snug"
            >
              {notes.title ?? "What's new in Dr Tea"}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-stone-500 mt-0.5">
              Version {notes.version}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss release notes"
            className="w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ul className="px-4 pb-4 pt-1 space-y-1.5">
          {notes.highlights.slice(0, 4).map((item, i) => (
            <li
              key={i}
              className="text-[13px] text-stone-700 leading-snug flex gap-2"
            >
              <span
                aria-hidden
                className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#3a5a2c] shrink-0"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={dismiss}
            className="w-full text-[12px] font-bold uppercase tracking-wider bg-[#3a5a2c] hover:bg-[#2e4823] text-white px-3 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
