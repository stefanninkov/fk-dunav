/**
 * Inline-styled fallback rendered by the root Sentry ErrorBoundary when
 * a render crash escapes every page. Intentionally does NOT import from
 * the design system — those modules might be what crashed. Keep deps
 * to zero beyond React.
 */
export function CrashFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#000c1e',
        color: '#e8eef6',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Nešto je pošlo naopako.
        </h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '1rem' }}>
          Osvežite stranicu. Ako se problem ponovi, greška je prijavljena i
          biće rešena.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '0.375rem',
            background: '#01458E',
            color: '#fff',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Osveži
        </button>
      </div>
    </div>
  );
}
