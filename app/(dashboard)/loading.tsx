// CANONICAL: route-level loading skeleton for FamComply dashboard pages.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-8 w-72 rounded-lg bg-slate-200" />
      </div>
      <div className="h-28 rounded-2xl bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((slot) => (
          <div key={slot} className="h-16 rounded-xl bg-slate-200" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <div key={slot} className="h-24 rounded-xl bg-slate-200" />
        ))}
      </div>
    </div>
  )
}
