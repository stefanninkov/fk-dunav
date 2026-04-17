import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function GroupsPage() {
  return (
    <PagePlaceholder
      title={sr.nav.groups}
      description="Tabele po grupama, bodovna pravila i rangiranje. Dostupno kada se unesu timovi i odigra prvi kolo."
    />
  );
}
