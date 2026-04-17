import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function TeamsPage() {
  return (
    <PagePlaceholder
      title={sr.nav.teams}
      description="Svi timovi, grbovi, sastavi, odigrane utakmice i statistika."
    />
  );
}
