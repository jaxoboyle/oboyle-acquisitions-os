/** Generic route-loading skeleton — shown by Next.js while a page's Server
 * Component data is still being fetched, so sidebar navigation reads as
 * instant instead of a blank pause. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-bg-muted rounded" />
        <div className="h-3 w-72 bg-bg-muted rounded" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="h-3 w-32 bg-bg-muted rounded" />
          <div className="h-3 w-full bg-bg-muted rounded" />
          <div className="h-3 w-5/6 bg-bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
