import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'brewlite:skip-envelope';

/** For ops routes (and, later, SSE) — the response is returned exactly as the handler built it. */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
