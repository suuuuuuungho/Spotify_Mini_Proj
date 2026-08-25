import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import TrackRow from "../components/TrackRow";
import AddToPlaylistModal from "../components/AddToPlaylistModal";

export default function AlbumDetail() {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [addingTrack, setAddingTrack] = useState(null);

  useEffect(() => {
    setAlbum(null);
    api.album(id).then(setAlbum);
  }, [id]);

  if (!album) return <p className="text-on-surface-variant">Loading...</p>;

  return (
    <div className="flex flex-col gap-lg max-w-3xl">
      <div className="flex gap-lg items-end">
        <div className="w-48 h-48 rounded-lg overflow-hidden bg-surface-container-high shrink-0 shadow-lg">
          {album.image_url ? (
            <img src={album.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-6xl text-on-surface-variant flex items-center justify-center w-full h-full">
              album
            </span>
          )}
        </div>
        <div className="flex flex-col gap-sm">
          <span className="font-label-bold text-label-bold text-on-surface-variant uppercase">
            {album.album_type || "Album"}
          </span>
          <h1 className="font-display-lg text-headline-lg text-on-surface">{album.name}</h1>
          <div className="font-body-lg text-body-lg text-on-surface-variant">
            {album.artists.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link to={`/artists/${a.id}`} className="hover:underline text-on-surface">
                  {a.name}
                </Link>
              </span>
            ))}
            {album.release_date && ` · ${album.release_date.slice(0, 4)}`}
            {album.total_tracks && ` · ${album.total_tracks} tracks`}
          </div>
          {album.spotify_url && (
            <a
              href={album.spotify_url}
              target="_blank"
              rel="noreferrer"
              className="self-start flex items-center gap-xs bg-surface-container-high text-on-surface font-label-bold text-label-bold px-md py-xs rounded-full hover:bg-surface-container-highest transition-colors uppercase"
            >
              Open in Spotify
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        {album.tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={{ ...track, album_name: album.name, album_image_url: album.image_url }}
            onAction={setAddingTrack}
          />
        ))}
      </div>

      {addingTrack && (
        <AddToPlaylistModal track={addingTrack} onClose={() => setAddingTrack(null)} />
      )}
    </div>
  );
}
