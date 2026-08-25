import { useEffect, useState } from "react";
import { api } from "../api";
import TrackRow from "../components/TrackRow";
import StatTile from "../components/charts/StatTile";
import BarList from "../components/charts/BarList";
import DecadeHistogram from "../components/charts/DecadeHistogram";
import ExplicitRing from "../components/charts/ExplicitRing";

const GENRE_LIMIT = 12;

export default function Stats() {
  const [overview, setOverview] = useState(null);
  const [genres, setGenres] = useState(null);
  const [artists, setArtists] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [decades, setDecades] = useState(null);

  useEffect(() => {
    api.statsOverview().then(setOverview);
    api.statsGenres().then(setGenres);
    api.statsTopArtists(20).then(setArtists);
    api.statsTopTracks(15).then(setTracks);
    api.statsReleaseDecades().then(setDecades);
  }, []);

  return (
    <div className="flex flex-col gap-xl">
      <div>
        <h1 className="mt-5 font-vibe text-[52px] font-black tracking-[-0.02em] text-on-surface">
          Stats
        </h1>
      </div>

      {overview && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <StatTile label="Tracks" value={overview.total_tracks.toLocaleString()} />
          <StatTile label="Artists" value={overview.total_artists.toLocaleString()} />
          <StatTile label="Albums" value={overview.total_albums.toLocaleString()} />
          <StatTile label="Playlists" value={overview.total_playlists.toLocaleString()} />
          <StatTile label="Avg energy" value={overview.avg_energy.toFixed(2)} />
          <StatTile label="Avg danceability" value={overview.avg_danceability.toFixed(2)} />
          <StatTile label="Avg mood (valence)" value={overview.avg_valence.toFixed(2)} />
          <StatTile label="Avg tempo" value={`${Math.round(overview.avg_tempo)} BPM`} />
        </section>
      )}

      <section className="flex flex-col gap-md max-w-2xl">
        <h2 className="font-headline-md text-headline-md text-on-surface">Top genres</h2>
        {genres ? (
          <BarList
            rank
            items={genres.slice(0, GENRE_LIMIT).map((g) => ({
              id: g.id,
              label: g.name,
              value: g.track_count,
            }))}
          />
        ) : (
          <p className="text-on-surface-variant font-body-sm text-body-sm">Loading...</p>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-xl">
        <section className="flex flex-col gap-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Albums by decade
          </h2>
          {decades ? (
            <DecadeHistogram data={decades} />
          ) : (
            <p className="text-on-surface-variant font-body-sm text-body-sm">Loading...</p>
          )}
        </section>

        <section className="flex flex-col gap-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Explicit content
          </h2>
          {overview ? (
            <ExplicitRing
              explicitCount={overview.explicit_tracks}
              totalCount={overview.total_tracks}
            />
          ) : (
            <p className="text-on-surface-variant font-body-sm text-body-sm">Loading...</p>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-md max-w-2xl">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Top tracks by popularity
        </h2>
        {tracks ? (
          <div className="flex flex-col">
            {tracks.map((track) => (
              <TrackRow key={track.id} track={track} />
            ))}
          </div>
        ) : (
          <p className="text-on-surface-variant font-body-sm text-body-sm">Loading...</p>
        )}
      </section>

      <section className="flex flex-col gap-md max-w-2xl">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Top artists by followers
        </h2>
        {artists ? (
          <BarList
            rank
            items={artists.map((a) => ({
              id: a.id,
              label: a.name,
              value: a.followers,
            }))}
          />
        ) : (
          <p className="text-on-surface-variant font-body-sm text-body-sm">Loading...</p>
        )}
      </section>
    </div>
  );
}
