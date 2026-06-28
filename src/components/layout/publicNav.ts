import { sr } from '@/i18n/sr';
import type { SubTabItem } from './SubTabs';

/**
 * The two grouped sections in the public site. Each parent tab in the
 * header (Rezultati, Nagrade) links to the first child by default; that
 * child page renders the sub-tab bar so visitors can navigate within the
 * group without returning to the header.
 */

export const resultsSubTabs: SubTabItem[] = [
  { to: '/grupe', label: sr.nav.groups },
  { to: '/raspored', label: sr.nav.schedule },
  { to: '/rezultati', label: sr.nav.results },
  { to: '/nokaut', label: sr.nav.knockout },
  { to: '/timovi', label: sr.nav.teams },
];

export const awardsSubTabs: SubTabItem[] = [
  { to: '/nagrade', label: sr.nav.awards },
  { to: '/lutrija', label: sr.nav.lottery },
  { to: '/kup-sanka', label: sr.nav.kupSanka },
  { to: '/precka', label: sr.nav.crossbar },
];

export const resultsPaths = new Set(resultsSubTabs.map((t) => t.to));
export const awardsPaths = new Set(awardsSubTabs.map((t) => t.to));
