interface Props {
  title: string;
  description?: string;
}

/**
 * Placeholder shell used by Week-1 route stubs. Each page gets replaced with
 * real content in the later roadmap weeks (SPEC.md sections 3.x).
 */
export function PagePlaceholder({ title, description }: Props) {
  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-12 lg:px-page-x-lg lg:py-16">
      <h1 className="font-display text-3xl font-700 text-ink-primary sm:text-4xl">{title}</h1>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm text-ink-secondary sm:text-base">{description}</p>
      ) : null}
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-tertiary">
        Uskoro
      </p>
    </section>
  );
}
