import { serverTimestamp, setDoc } from 'firebase/firestore';

import { contentPageDoc } from '@/lib/firestore/refs';
import type { ContentPage, ContentPageId } from '@/lib/firestore/types';

/**
 * Upsert the markdown content of an admin-editable page. Doc id = page id
 * so every page has exactly one document — easy to read, no duplicates.
 */
export async function saveContentPage(
  tournamentId: string,
  pageId: ContentPageId,
  title: string,
  body: string,
  updatedBy: string,
): Promise<void> {
  await setDoc(
    contentPageDoc(tournamentId, pageId),
    {
      title,
      body,
      updatedAt: serverTimestamp(),
      updatedBy,
    } as unknown as ContentPage,
    { merge: true },
  );
}
