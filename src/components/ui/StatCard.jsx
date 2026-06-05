export default function StatCard({ label, value, color, icon: Icon, bg, description }) {
  const chipBg = bg || `${color}1a`;

  return (
    <div className="group relative h-full overflow-hidden rounded-xl border border-[var(--panel-border)] bg-white p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 leading-relaxed sm:text-[10px] sm:leading-normal">
            {label}
          </span>
          {description && (
            <p className="mt-1 text-[11px] leading-5 text-slate-500 sm:text-[9px] sm:leading-4">
              {description}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/70 sm:h-8 sm:w-8"
            style={{ background: chipBg }}
          >
            <Icon size={15} strokeWidth={2.1} style={{ color }} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-start gap-1 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between">
        <span className="text-[2rem] font-extrabold leading-none tracking-tight sm:text-3xl" style={{ color }}>
          {value}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">
          Snapshot
        </span>
      </div>
    </div>
  );
}
