const SIZE = 140;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function ExplicitRing({ explicitCount, totalCount }) {
  const pct = totalCount > 0 ? explicitCount / totalCount : 0;
  const dash = pct * CIRC;

  return (
    <div className="flex items-center gap-lg">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${Math.round(pct * 100)}% of tracks are marked explicit`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-surface-container-high"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          className="stroke-primary"
          strokeDasharray={`${dash} ${CIRC - dash}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text
          x={SIZE / 2}
          y={SIZE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="24"
          fontWeight="700"
          className="fill-on-surface"
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div className="flex flex-col gap-xs">
        <div className="flex items-center gap-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="font-body-sm text-body-sm text-on-surface">
            Explicit — {explicitCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-surface-container-high" />
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Clean — {(totalCount - explicitCount).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
