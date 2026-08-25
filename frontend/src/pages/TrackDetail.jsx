import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useNowPlaying } from "../NowPlayingContext";
import AddToPlaylistModal from "../components/AddToPlaylistModal";

const FEATURES = [
  ["danceability", "Danceability"],
  ["energy", "Energy"],
  ["valence", "Positivity"],
  ["acousticness", "Acousticness"],
  ["instrumentalness", "Instrumentalness"],
  ["liveness", "Liveness"],
  ["speechiness", "Speechiness"],
];

export default function TrackDetail() {
  const { id } = useParams();
  const [track, setTrack] = useState(null);
  const [adding, setAdding] = useState(false);
  const { setTrack: setNowPlaying } = useNowPlaying();

  useEffect(() => {
    setTrack(null);
    api.track(id).then((t) => {
      setTrack(t);
      setNowPlaying(t);
    });
  }, [id, setNowPlaying]);

  if (!track) return <p className="text-on-surface-variant">Loading...</p>;

  return (
    <div className="flex flex-col gap-lg max-w-3xl">
      <div className="flex gap-lg items-end">
        <div className="w-48 h-48 rounded-lg overflow-hidden bg-surface-container-high shrink-0 shadow-lg">
          {track.album_image_url ? (
            <img src={track.album_image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-6xl text-on-surface-variant flex items-center justify-center w-full h-full">
              music_note
            </span>
          )}
        </div>
        <div className="flex flex-col gap-sm">
          <span className="font-label-bold text-label-bold text-on-surface-variant uppercase">
            Track
          </span>
          <h1 className="font-display-lg text-headline-lg text-on-surface">{track.name}</h1>
          <div className="font-body-lg text-body-lg text-on-surface-variant">
            {track.artists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link to={`/artists/${a.id}`} className="hover:underline text-on-surface">
                  {a.name}
                </Link>
              </span>
            ))}
            {track.album_name && (
              <>
                {" · "}
                <Link to={`/albums/${track.album_id}`} className="hover:underline">
                  {track.album_name}
                </Link>
              </>
            )}
          </div>
          <div className="flex gap-sm mt-sm">
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-xs bg-primary text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full hover:scale-105 transition-transform uppercase"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Add to playlist
            </button>
            {track.spotify_url && (
              <a
                href={track.spotify_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-xs bg-surface-container-high text-on-surface font-label-bold text-label-bold px-md py-xs rounded-full hover:bg-surface-container-highest transition-colors uppercase"
              >
                Open in Spotify
              </a>
            )}
          </div>
        </div>
      </div>

      {track.genres?.length > 0 && (
        <div className="flex gap-xs flex-wrap">
          {track.genres.map((g) => (
            <Link
              key={g.id}
              to={`/search?genre=${encodeURIComponent(g.id)}`}
              className="text-xs px-sm py-1 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface capitalize"
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {track.danceability != null && (
        <div className="flex flex-col gap-sm bg-surface-container-low rounded-xl p-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Audio features</h2>
          {FEATURES.map(([key, label]) =>
            track[key] != null ? (
              <div key={key} className="flex items-center gap-md">
                <span className="w-28 font-body-sm text-body-sm text-on-surface-variant shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
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

      {adding && <AddToPlaylistModal track={track} onClose={() => setAdding(false)} />}
    </div>
  );
}
