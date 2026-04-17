import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function LivePage() {
  return (
    <PagePlaceholder
      title={sr.nav.live}
      description="Prati utakmice u stvarnom vremenu. Strelci, kartoni, minuta po minuta."
    />
  );
}
