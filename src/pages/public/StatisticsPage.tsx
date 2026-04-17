import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function StatisticsPage() {
  return (
    <PagePlaceholder
      title={sr.nav.statistics}
      description="Najbolji strelci, kartoni, Kup Šanka, Prečka, nagrade, Lutrija i glasanje navijača."
    />
  );
}
