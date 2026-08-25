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
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="mt-5 font-vibe text-[52px] font-black tracking-[-0.02em] text-on-surface">
          Vibe Finder
        </h1>
      </div>

      <div className="grid sm:grid-cols-2 gap-md max-w-2xl">
        {MOOD_SLIDERS.map(({ key, label, lo, hi }) => (
          <div key={key} className="flex flex-col gap-xs">
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface">{label}</span>
              <span className="font-body-sm text-[11px] text-on-surface-variant tabular-nums">
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
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant/70">
              <span>{lo}</span>
              <span>{hi}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={saveAsPlaylist}
        disabled={!user || saving || tracks.length === 0}
        className="self-start flex items-center gap-xs bg-primary text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full hover:scale-105 transition-transform uppercase disabled:opacity-40 disabled:hover:scale-100"
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
        <div className="flex flex-col">
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
