import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function SchedulePage() {
  return (
    <PagePlaceholder
      title={sr.nav.schedule}
      description="Raspored po danima i terenima. Unosi se iz administratorskog panela."
    />
  );
}
