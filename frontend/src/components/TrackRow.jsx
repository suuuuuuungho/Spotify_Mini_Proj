import { Link } from "react-router-dom";
import { useNowPlaying } from "../NowPlayingContext";

function formatDuration(ms) {
  if (!ms) return "--:--";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function TrackRow({ track, onAction, actionIcon = "add", actionLabel = "Add" }) {
  const { setTrack } = useNowPlaying();

  return (
    <div className="flex items-center gap-md px-sm py-xs rounded-lg hover:bg-surface-container-high group transition-colors">
      <button
        onClick={() => setTrack(track)}
        className="w-11 h-11 rounded-md overflow-hidden bg-surface-container-high shrink-0 relative"
      >
        {track.album_image_url ? (
          <img src={track.album_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant flex items-center justify-center w-full h-full">
            music_note
          </span>
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="material-symbols-outlined text-white text-lg">play_arrow</span>
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <Link
          to={`/tracks/${track.id}`}
          className="font-body-lg text-body-lg text-on-surface hover:underline truncate block"
        >
          {track.name}
        </Link>
        <span className="font-body-sm text-body-sm text-on-surface-variant truncate block">
          {(track.artists || []).map((a) => a.name).join(", ")}
          {track.album_name ? ` · ${track.album_name}` : ""}
        </span>
      </div>

      {track.explicit && (
        <span className="text-[10px] px-1 rounded bg-surface-container-highest text-on-surface-variant">
          E
        </span>
      )}

      <span className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
        {formatDuration(track.duration_ms)}
      </span>

      {onAction && (
        <button
          onClick={() => onAction(track)}
          title={actionLabel}
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-xl">{actionIcon}</span>
        </button>
      )}
    </div>
  );
}
