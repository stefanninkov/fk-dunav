import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function RulesPage() {
  return (
    <PagePlaceholder
      title={sr.nav.rules}
      description="Format turnira, pravila igre, bodovanje i disciplinski postupak."
    />
  );
}
