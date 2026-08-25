import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import TrackRow from "../components/TrackRow";
import AddToPlaylistModal from "../components/AddToPlaylistModal";

export default function ArtistDetail() {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [addingTrack, setAddingTrack] = useState(null);

  useEffect(() => {
    setArtist(null);
    api.artist(id).then(setArtist);
  }, [id]);

  if (!artist) return <p className="text-on-surface-variant">Loading...</p>;

  return (
    <div className="flex flex-col gap-lg max-w-3xl">
      <div className="flex flex-col gap-xs">
        <span className="font-label-bold text-label-bold text-on-surface-variant uppercase">
          Artist
        </span>
        <h1 className="font-display-lg text-headline-lg text-on-surface">{artist.name}</h1>
        {artist.followers != null && (
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {artist.followers.toLocaleString()} followers
          </span>
        )}
        {artist.spotify_url && (
          <a
            href={artist.spotify_url}
            target="_blank"
            rel="noreferrer"
            className="self-start mt-sm flex items-center gap-xs bg-surface-container-high text-on-surface font-label-bold text-label-bold px-md py-xs rounded-full hover:bg-surface-container-highest transition-colors uppercase"
          >
            Open in Spotify
          </a>
        )}
      </div>

      <h2 className="font-headline-md text-headline-md text-on-surface">Popular tracks</h2>
      <div className="flex flex-col">
        {artist.tracks.map((track) => (
          <TrackRow key={track.id} track={track} onAction={setAddingTrack} />
        ))}
      </div>

      {addingTrack && (
        <AddToPlaylistModal track={addingTrack} onClose={() => setAddingTrack(null)} />
      )}
    </div>
  );
}
