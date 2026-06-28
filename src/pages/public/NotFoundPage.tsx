import { NavLink } from 'react-router-dom';

import { sr } from '@/i18n/sr';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-[1200px] flex-col items-start gap-4 px-page-x py-20 lg:px-page-x-lg">
      <span className="font-display text-6xl font-700 text-brand-600">404</span>
      <h1 className="font-display text-2xl font-700">Stranica nije pronađena</h1>
      <p className="text-ink-secondary">
        Link je možda zastareo ili je stranica uklonjena.
      </p>
      <NavLink
        to="/"
        className="inline-flex h-touch items-center rounded-md bg-brand-600 px-5 font-600 text-ink-primary hover:bg-brand-500"
      >
        {sr.nav.home}
      </NavLink>
    </section>
  );
}
