import type { AssessmentBand } from "@/api";

/**
 * Per-band display metadata. Centralised so the label, headline and suggested
 * next step are consistent everywhere a band is shown, and so the language can
 * be reviewed in one place.
 *
 * Tone rules (per SPEC.md):
 *   - never alarming
 *   - never accusatory
 *   - always actionable / forward-looking
 */
export interface BandMeta {
  label: string;
  headline: string;
  nextStep: string;
}

export const BAND_META: Record<AssessmentBand, BandMeta> = {
  healthy: {
    label: "Healthy",
    headline: "You're in a good position",
    nextStep:
      "Things are looking steady. If you can, putting a little aside each month builds a useful buffer for the unexpected.",
  },
  tight: {
    label: "Tight",
    headline: "Things are tight but manageable",
    nextStep:
      "There's not a lot of slack at the moment. It's worth checking your outgoings for anything that could come down — small changes add up over a few months.",
  },
  deficit: {
    label: "Stretched",
    headline: "Your outgoings are a little ahead of your income",
    nextStep:
      "This happens to lots of people. Going through your outgoings one by one is usually the most useful next step — you might find more room than you'd expect, and we're here to help with the rest.",
  },
  insufficient_data: {
    label: "Just getting started",
    headline: "Let's build the picture",
    nextStep:
      "Add a few lines of income and your regular outgoings, and we'll show you how things look.",
  },
};
