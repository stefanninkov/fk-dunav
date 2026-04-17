import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function SponsorsPage() {
  return (
    <PagePlaceholder
      title={sr.nav.sponsors}
      description="Hvala svima koji podržavaju turnir."
    />
  );
}
