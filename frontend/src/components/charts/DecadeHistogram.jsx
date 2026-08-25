function formatDecade(decade) {
  return `${decade}s`;
}

export default function DecadeHistogram({ data }) {
  const max = Math.max(...data.map((d) => d.album_count), 1);
  return (
    <div>
      <div className="flex items-end gap-xs h-40">
        {data.map((d) => (
          <div key={d.decade} className="flex-1 flex flex-col items-center justify-end h-full group">
            <span className="font-body-sm text-[10px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity mb-1 tabular-nums">
              {d.album_count}
            </span>
            <div
              className="w-full bg-primary rounded-t-sm min-h-[2px]"
              style={{ height: `${(d.album_count / max) * 100}%` }}
              title={`${formatDecade(d.decade)}: ${d.album_count} albums`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-xs mt-xs">
        {data.map((d) => (
          <span
            key={d.decade}
            className="flex-1 text-center font-body-sm text-[10px] text-on-surface-variant"
          >
            {formatDecade(d.decade)}
          </span>
        ))}
      </div>
    </div>
  );
}
