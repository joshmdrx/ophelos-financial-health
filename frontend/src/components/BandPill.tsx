import type { AssessmentBand } from "@/api";
import { BAND_META } from "@/lib/bands";

export function BandPill({ band }: { band: AssessmentBand }) {
  return (
    <span className="band-pill" data-band={band}>
      {BAND_META[band].label}
    </span>
  );
}
