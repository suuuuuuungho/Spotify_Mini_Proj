export default function StatTile({ label, value }) {
  return (
    <div className="flex flex-col gap-xs bg-surface-container-low rounded-xl p-md">
      <span className="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wide">
        {label}
      </span>
      <span className="font-headline-md text-headline-md text-on-surface tabular-nums">
        {value}
      </span>
    </div>
  );
}
