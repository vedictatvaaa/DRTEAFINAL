import { useEffect } from "react";
import { useGetActiveExperience } from "@workspace/api-client-react";

/**
 * Live Experience theme applier.
 *
 * Fetches the active experience from the API and writes its theme tokens
 * to :root as CSS custom properties. Tokens use bare names (e.g. "primary"),
 * which maps to the `--primary` variables defined in `index.css`.
 */
export default function ThemeApplier() {
  const { data } = useGetActiveExperience();

  useEffect(() => {
    const tokens = data?.themeTokens;
    if (!tokens) return;
    const root = document.documentElement;
    const applied: string[] = [];
    for (const [key, value] of Object.entries(tokens)) {
      if (typeof value !== "string") continue;
      const cssName = `--${key}`;
      root.style.setProperty(cssName, value);
      applied.push(cssName);
    }
    if (data?.id) {
      root.dataset.experience = data.id;
    }
    return () => {
      // Clear overrides on switch so the next theme starts clean.
      for (const name of applied) root.style.removeProperty(name);
    };
  }, [data]);

  return null;
}
