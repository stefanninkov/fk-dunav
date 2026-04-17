import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function AboutPage() {
  return (
    <PagePlaceholder
      title={sr.nav.about}
      description="O FK Dunav Ostrovo, organizatorima i istoriji turnira."
    />
  );
}
