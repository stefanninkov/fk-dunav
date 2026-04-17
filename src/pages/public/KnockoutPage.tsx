import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function KnockoutPage() {
  return (
    <PagePlaceholder
      title={sr.nav.knockout}
      description="Nokaut faza — vizualno drvo, automatsko napredovanje pobednika."
    />
  );
}
