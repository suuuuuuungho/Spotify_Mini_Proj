import { useState } from "react";
import { useNowPlaying } from "../NowPlayingContext";

function formatDuration(ms) {
  if (!ms) return "0:00";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const FEATURES = [
  ["danceability", "Danceability"],
  ["energy", "Energy"],
  ["valence", "Positivity"],
  ["acousticness", "Acousticness"],
];

function Transport({ track, compact = false }) {
  return (
    <div className="flex items-center gap-md">
      <span
        title="Not available in this demo"
        className={`material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed ${
          compact ? "text-lg" : ""
        }`}
      >
        shuffle
      </span>
      <span
        title="Not available in this demo"
        className="material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed"
      >
        skip_previous
      </span>
      {track?.spotify_url ? (
        <a
          href={track.spotify_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open in Spotify (no preview audio available, playback isn't supported)"
          className="w-8 h-8 rounded-full bg-on-surface text-surface flex items-center justify-center hover:scale-110 transition-transform"
        >
          <span className="material-symbols-outlined">play_arrow</span>
        </a>
      ) : (
        <span className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant/40 flex items-center justify-center">
          <span className="material-symbols-outlined">play_arrow</span>
        </span>
      )}
      <span
        title="Not available in this demo"
        className="material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed"
      >
        skip_next
      </span>
      <span
        title="Not available in this demo"
        className={`material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed ${
          compact ? "text-lg" : ""
        }`}
      >
        repeat
      </span>
    </div>
  );
}

export default function PlayerBar() {
  const { track } = useNowPlaying();
  const [expanded, setExpanded] = useState(false);

  if (!track) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded "now playing" drawer, slides up above the compact bar */}
      <div
        className={`bg-surface-container-lowest/98 backdrop-blur-2xl border-t border-surface-container-high overflow-hidden transition-[height] duration-300 ease-out ${
          expanded ? "h-[380px]" : "h-0"
        }`}
      >
        {track && (
          <div className="h-[380px] flex flex-col items-center justify-center gap-md px-lg">
            <div className="w-40 h-40 rounded-lg overflow-hidden bg-surface-container shadow-2xl">
              {track.album_image_url ? (
                <img src={track.album_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-5xl text-on-surface-variant flex items-center justify-center w-full h-full">
                  music_note
                </span>
              )}
            </div>
            <div className="text-center">
              <div className="font-headline-md text-headline-md text-on-surface">
                {track.name}
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant">
                {track.artists?.map((a) => a.name).join(", ")}
              </div>
            </div>
            <Transport track={track} />
            {track.danceability != null && (
              <div className="w-full max-w-sm flex flex-col gap-xs mt-sm">
                {FEATURES.map(([key, label]) =>
                  track[key] != null ? (
                    <div key={key} className="flex items-center gap-sm">
                      <span className="w-20 shrink-0 font-body-sm text-[11px] text-on-surface-variant">
                        {label}
                      </span>
                      <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.round(track[key] * 100)}%` }}
                        />
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compact bar */}
      <div
        onClick={() => track && setExpanded((v) => !v)}
        className={`h-[88px] bg-surface-container-lowest/95 backdrop-blur-2xl px-md flex items-center justify-between ${
          track ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex items-center gap-md w-1/3 min-w-0">
          <div className="w-14 h-14 bg-surface-container rounded-lg flex items-center justify-center overflow-hidden shrink-0">
            {track?.album_image_url ? (
              <img src={track.album_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant">music_note</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body-lg text-body-lg text-on-surface leading-tight truncate">
              {track ? track.name : "No track selected"}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
              {track?.artists?.map((a) => a.name).join(", ") || " "}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-xs w-1/3">
          <div onClick={(e) => e.stopPropagation()}>
            <Transport track={track} />
          </div>
          <div className="w-full flex items-center gap-sm px-lg">
            <span className="font-body-sm text-[11px] text-on-surface-variant">0:00</span>
            <div className="flex-1 h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full w-0 bg-on-surface" />
            </div>
            <span className="font-body-sm text-[11px] text-on-surface-variant">
              {formatDuration(track?.duration_ms)}
            </span>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-sm w-1/3"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            title="Not available in this demo"
            className="material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed hidden lg:inline"
          >
            lyrics
          </span>
          <span
            title="Not available in this demo"
            className="material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed hidden lg:inline"
          >
            queue_music
          </span>
          <span
            title="Not available in this demo"
            className="material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed hidden lg:inline"
          >
            devices
          </span>
          <div className="hidden lg:flex items-center gap-xs" title="Not available in this demo">
            <span className="material-symbols-outlined text-on-surface-variant/40 cursor-not-allowed">
              volume_up
            </span>
            <div className="w-20 h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-on-surface-variant/40" />
            </div>
          </div>
          {track && (
            <>
              <button
                onClick={() => setExpanded(false)}
                title="Mini player"
                className={`p-xs rounded-full transition-colors hover:bg-surface-container-high ${
                  !expanded ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-xl">picture_in_picture_alt</span>
              </button>
              <button
                onClick={() => setExpanded(true)}
                title="Expand now playing"
                className={`p-xs rounded-full transition-colors hover:bg-surface-container-high ${
                  expanded ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-xl">open_in_full</span>
              </button>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
