import { useState } from "react";
import { MOOD_SLIDERS, DEFAULT_MOOD_VALUES } from "../moodSliders";

export default function VibeFinderCard({ onSearch, loading }) {
  const [values, setValues] = useState(DEFAULT_MOOD_VALUES);

  return (
    <div className="mt-sm -mx-sm bg-surface/40 rounded-xl p-md flex flex-col gap-sm">
      <span className="font-label-bold text-label-bold text-on-surface-variant uppercase">
        Vibe Finder
      </span>
      <div className="grid grid-cols-2 gap-sm">
        {MOOD_SLIDERS.map(({ key, label, lo, hi }) => (
          <div key={key} className="flex flex-col gap-xs">
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-[11px] text-on-surface">{label}</span>
              <span className="font-body-sm text-[10px] text-on-surface-variant tabular-nums">
                {values[key].toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={values[key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: parseFloat(e.target.value) }))
              }
              className="w-full accent-primary"
            />
            <div className="flex items-center justify-between text-[10px] text-on-surface-variant/70">
              <span>{lo}</span>
              <span>{hi}</span>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => onSearch(values)}
        disabled={loading}
        className="self-start flex items-center gap-xs bg-primary text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full hover:scale-105 transition-transform uppercase disabled:opacity-40 disabled:hover:scale-100"
      >
        <span className="material-symbols-outlined text-base">search</span>
        {loading ? "검색 중..." : "검색"}
      </button>
    </div>
  );
}
