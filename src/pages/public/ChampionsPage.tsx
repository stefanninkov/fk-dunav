import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function ChampionsPage() {
  return (
    <PagePlaceholder
      title={sr.nav.champions}
      description="Lista šampiona iz prethodnih izdanja turnira."
    />
  );
}
