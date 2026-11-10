import { OfflineView } from '@/components/OfflineView';

// Prerendered once and precached by the service worker: it must not depend on the request,
// so the language is settled on the client (OfflineView).
export const dynamic = 'force-static';

export default function OfflinePage() {
  return <OfflineView />;
}
