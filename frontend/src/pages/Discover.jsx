import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import TrackRow from "../components/TrackRow";
import { MOOD_SLIDERS, DEFAULT_MOOD_VALUES } from "../moodSliders";

export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(DEFAULT_MOOD_VALUES);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      api
        .discoverMood({ ...values, limit: 30 })
        .then(setTracks)
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.energy,
    values.valence,
    values.danceability,
    values.acousticness,
    values.liveness,
    values.speechiness,
  ]);

  const saveAsPlaylist = async () => {
    const name = prompt("Name your playlist", "Mood playlist");
    if (!name) return;
    setSaving(true);
    try {
      const playlist = await api.createPlaylist({ name });
      await api.addTracksBulk(
        playlist.id,
        tracks.map((t) => t.id)
      );
      navigate(`/playlists/${playlist.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-lg">
      <div className="relative">
        <h1 className="mt-5 font-vibe text-[52px] font-black tracking-[-0.02em] text-on-surface">
          Vibe Finder
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
          Dial in a mood and we'll surface tracks that match.
        </p>
      </div>

      <div className="relative grid sm:grid-cols-3 gap-md max-w-4xl">
        {MOOD_SLIDERS.map(({ key, label, lo, hi }) => (
          <div
            key={key}
            className="relative overflow-hidden flex flex-col gap-sm rounded-2xl p-md bg-surface-container-high/0 backdrop-blur-xl border border-t-white/40 border-x-white/10 border-b-black/30 shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-10px_16px_-12px_rgba(0,0,0,0.5)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="pointer-events-none absolute -top-8 left-4 w-20 h-10 rounded-full bg-white/20 blur-xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 w-24 h-24 rounded-full bg-black/30 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <span className="font-label-bold text-label-bold text-on-surface">{label}</span>
              <span className="font-body-sm text-[11px] text-primary tabular-nums bg-primary/10 px-xs py-0.5 rounded-full">
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
              className="relative w-full accent-primary outline-none focus:outline-none focus-visible:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(76,244,121,0.7)] [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(76,244,121,0.7)] [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="relative flex items-center justify-between text-[11px] text-on-surface-variant/70">
              <span>{lo}</span>
              <span>{hi}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={saveAsPlaylist}
        disabled={!user || saving || tracks.length === 0}
        className="relative self-start flex items-center gap-xs bg-primary/90 backdrop-blur text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full hover:scale-105 transition-transform uppercase disabled:opacity-40 disabled:hover:scale-100 shadow-[0_4px_24px_rgba(76,244,121,0.35)] border border-primary-fixed/40"
      >
        <span className="material-symbols-outlined text-base">playlist_add</span>
        {saving ? "Saving..." : "Save these results as a playlist"}
      </button>
      {!user && (
        <p className="text-on-surface-variant font-body-sm text-body-sm -mt-sm">
          Log in to save a playlist.
        </p>
      )}

      {loading ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">Searching...</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-surface-container-high/0 backdrop-blur-xl border border-t-white/40 border-x-white/10 border-b-black/30 shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-10px_16px_-12px_rgba(0,0,0,0.5)] p-sm flex flex-col">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="pointer-events-none absolute -top-8 left-8 w-24 h-10 rounded-full bg-white/40 blur-xl" />
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
