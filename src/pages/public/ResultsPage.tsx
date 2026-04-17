import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function ResultsPage() {
  return (
    <PagePlaceholder
      title={sr.nav.results}
      description="Rezultati odigranih utakmica — grupna faza i nokaut razdvojeni."
    />
  );
}
