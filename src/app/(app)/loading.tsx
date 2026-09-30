export default function Loading() {
  return (
    <div className="grid gap-4" role="status" aria-label="Cargando">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-40 animate-pulse rounded-3xl bg-surface-2" />
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-surface-2"
          />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
