import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import TrackRow from "../components/TrackRow";

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);

  const load = () => api.playlist(id).then(setPlaylist);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const removeTrack = async (track) => {
    await api.removeTrack(id, track.id);
    load();
  };

  const deletePlaylist = async () => {
    if (!confirm(`Delete "${playlist.name}"?`)) return;
    await api.deletePlaylist(id);
    navigate("/playlists");
  };

  if (!playlist) return <p className="text-on-surface-variant">Loading...</p>;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-end gap-lg">
        <div className="w-40 h-40 rounded-lg overflow-hidden bg-surface-container-high shrink-0 shadow-lg flex items-center justify-center">
          {playlist.image_url ? (
            <img src={playlist.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              queue_music
            </span>
          )}
        </div>
        <div className="flex flex-col gap-xs">
          <span className="font-label-bold text-label-bold text-on-surface-variant uppercase">
            Playlist
          </span>
          <h1 className="font-display-lg text-headline-lg text-on-surface">{playlist.name}</h1>
          {playlist.description && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {playlist.description}
            </p>
          )}
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {playlist.tracks.length} tracks
          </span>
          <button
            onClick={deletePlaylist}
            className="self-start mt-sm text-on-surface-variant hover:text-error font-body-sm text-body-sm"
          >
            Delete playlist
          </button>
        </div>
      </div>

      {playlist.tracks.length === 0 ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">
          Add tracks from search or Vibe Finder.
        </p>
      ) : (
        <div className="flex flex-col">
          {playlist.tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              onAction={removeTrack}
              actionIcon="close"
              actionLabel="Remove"
            />
          ))}
        </div>
      )}
    </div>
  );
}
