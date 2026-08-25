export default function BarList({ items, rank = false }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-sm">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-md">
          {rank && (
            <span className="w-5 text-right font-body-sm text-[11px] text-on-surface-variant tabular-nums">
              {i + 1}
            </span>
          )}
          <span className="w-32 shrink-0 font-body-sm text-body-sm text-on-surface truncate capitalize">
            {item.label}
          </span>
          <div className="flex-1 h-4 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 text-right font-body-sm text-[11px] text-on-surface-variant tabular-nums">
            {item.formattedValue ?? item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
