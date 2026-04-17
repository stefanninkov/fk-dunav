import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { sr } from '@/i18n/sr';

export function GalleryPage() {
  return (
    <PagePlaceholder
      title={sr.nav.gallery}
      description="Fotografije i video zapisi sa turnira. Svako može da pošalje svoj materijal."
    />
  );
}
