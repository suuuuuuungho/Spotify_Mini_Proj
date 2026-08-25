import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import TrackRow from "../components/TrackRow";
import AddToPlaylistModal from "../components/AddToPlaylistModal";

const GRADIENTS = [
  "from-indigo-500 to-purple-800",
  "from-emerald-600 to-teal-900",
  "from-rose-500 to-red-900",
  "from-amber-500 to-orange-900",
  "from-sky-500 to-blue-900",
];

const TABS = [
  { key: "playlists", label: "Playlists" },
  { key: "artists", label: "Artists" },
  { key: "albums", label: "Albums" },
  { key: "recent", label: "Recently played" },
];

export default function Library() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("playlists");
  const [playlists, setPlaylists] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [recent, setRecent] = useState([]);
  const [addingTrack, setAddingTrack] = useState(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("name");

  const loadPlaylists = () => api.playlists().then(setPlaylists);

  useEffect(() => {
    if (!user) return;
    if (tab === "playlists") loadPlaylists();
    if (tab === "artists") api.libraryArtists().then(setArtists);
    if (tab === "albums") api.libraryAlbums().then(setAlbums);
    if (tab === "recent") api.recentlyPlayed().then(setRecent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab]);

  const visiblePlaylists = useMemo(() => {
    let list = playlists.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "tracks") list = [...list].sort((a, b) => b.track_count - a.track_count);
    return list;
  }, [playlists, query, sort]);

  const visibleArtists = useMemo(
    () => artists.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())),
    [artists, query]
  );
  const visibleAlbums = useMemo(
    () => albums.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())),
    [albums, query]
  );
  const visibleRecent = useMemo(
    () => recent.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())),
    [recent, query]
  );

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createPlaylist({ name: name.trim() });
    setName("");
    setCreating(false);
    loadPlaylists();
  };

  const remove = async (e, playlist) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${playlist.name}"?`)) return;
    await api.deletePlaylist(playlist.id);
    loadPlaylists();
  };

  const importFromSpotify = async () => {
    setImporting(true);
    setImportMessage("");
    try {
      const result = await api.importSpotifyPlaylists();
      setImportMessage(
        `Imported ${result.playlists_imported} playlists and ${result.tracks_imported} tracks.`
      );
      loadPlaylists();
    } catch (error) {
      setImportMessage(error.message);
    } finally {
      setImporting(false);
    }
  };

  if (authLoading) return null;

  if (!user) {
    return (
      <p className="text-on-surface-variant font-body-lg text-body-lg">
        Log in to view your library.
      </p>
    );
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md -mx-lg px-lg pt-0 pb-sm mb-md flex items-center justify-between flex-wrap gap-sm">
        <div className="flex gap-md">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setQuery("");
              }}
              className={`px-md py-sm rounded-full font-label-bold text-label-bold transition-all ${
                tab === t.key
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-sm">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            className="text-sm bg-surface-container-high rounded-full px-md py-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary w-40 focus:w-56 transition-all"
          />
          {tab === "playlists" && (
            <button
              onClick={() => setSort(sort === "name" ? "tracks" : "name")}
              className="flex items-center gap-xs px-md py-xs rounded-full text-on-surface font-label-bold text-label-bold bg-surface-container-high hover:bg-surface-container-highest transition-colors"
            >
              <span>{sort === "name" ? "By name" : "By track count"}</span>
              <span className="material-symbols-outlined text-[18px]">sort</span>
            </button>
          )}
        </div>
      </div>

      {tab === "playlists" && (
        <div className="flex flex-col gap-sm">
          <button
            onClick={importFromSpotify}
            disabled={importing}
            className="self-start flex items-center gap-xs bg-primary text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            {importing ? "Importing..." : "Import from Spotify"}
          </button>
          {importMessage && (
            <p className="text-on-surface-variant font-body-sm text-body-sm px-xs">
              {importMessage}
            </p>
          )}
          {creating ? (
            <form
              onSubmit={create}
              className="flex items-center gap-sm p-sm rounded-lg bg-surface-container-high"
            >
              <div className="w-16 h-16 rounded-md bg-surface-container-highest flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-3xl">
                  queue_music
                </span>
              </div>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => !name && setCreating(false)}
                placeholder="Playlist name"
                className="flex-1 bg-transparent border-b border-outline-variant focus:outline-none focus:border-primary text-on-surface font-body-lg text-body-lg py-xs"
              />
              <button className="bg-primary text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full uppercase">
                Create
              </button>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-md p-sm rounded-lg hover:bg-surface-container-high transition-colors group text-left"
            >
              <div className="w-16 h-16 rounded-md bg-surface-container-highest flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-3xl group-hover:text-on-surface transition-colors">
                  add
                </span>
              </div>
              <span className="font-body-lg text-body-lg text-on-surface">
                Create new playlist
              </span>
            </button>
          )}

          {visiblePlaylists.map((p, i) => (
            <Link
              key={p.id}
              to={`/playlists/${p.id}`}
              className="flex items-center justify-between p-sm rounded-lg hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-center gap-md min-w-0">
                {p.image_url ? (
                  <div
                    className="w-16 h-16 rounded-md bg-cover bg-center shadow-md shrink-0"
                    style={{ backgroundImage: `url(${p.image_url})` }}
                  />
                ) : (
                  <div
                    className={`w-16 h-16 rounded-md bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-center justify-center shadow-md shrink-0`}
                  >
                    <span className="material-symbols-outlined text-white text-3xl">
                      queue_music
                    </span>
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-body-lg text-body-lg text-on-surface truncate">
                    {p.name}
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Playlist · {p.track_count} tracks
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => remove(e, p)}
                title="Delete playlist"
                className="p-xs rounded-full text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-surface-container-highest transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-xl">delete</span>
              </button>
            </Link>
          ))}

          {visiblePlaylists.length === 0 && !creating && (
            <p className="text-on-surface-variant font-body-sm text-body-sm px-sm">
              {playlists.length === 0 ? "You don't have any playlists yet." : "No results found."}
            </p>
          )}
        </div>
      )}

      {tab === "artists" && (
        <div className="flex flex-col gap-sm">
          {visibleArtists.map((a) => (
            <Link
              key={a.id}
              to={`/artists/${a.id}`}
              className="flex items-center gap-md p-sm rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">
                  person
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-body-lg text-body-lg text-on-surface">{a.name}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Artist</span>
              </div>
            </Link>
          ))}
          {visibleArtists.length === 0 && (
            <p className="text-on-surface-variant font-body-sm text-body-sm px-sm">
              No artists yet — add tracks to a playlist to see them here.
            </p>
          )}
        </div>
      )}

      {tab === "albums" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-gutter">
          {visibleAlbums.map((al) => (
            <Link key={al.id} to={`/albums/${al.id}`} className="flex flex-col gap-sm group">
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-surface-container-high flex items-center justify-center group-hover:shadow-xl transition-shadow">
                {al.image_url ? (
                  <img src={al.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                    album
                  </span>
                )}
              </div>
              <span className="font-body-lg text-body-lg text-on-surface truncate group-hover:text-primary transition-colors">
                {al.name}
              </span>
            </Link>
          ))}
          {visibleAlbums.length === 0 && (
            <p className="text-on-surface-variant font-body-sm text-body-sm px-sm col-span-full">
              No albums yet — add tracks to a playlist to see them here.
            </p>
          )}
        </div>
      )}

      {tab === "recent" && (
        <div className="flex flex-col">
          {visibleRecent.map((track) => (
            <TrackRow key={track.id} track={track} onAction={setAddingTrack} />
          ))}
          {visibleRecent.length === 0 && (
            <p className="text-on-surface-variant font-body-sm text-body-sm px-sm">
              {recent.length === 0
                ? "Nothing played yet — click a track anywhere to start."
                : "No results found."}
            </p>
          )}
        </div>
      )}

      {addingTrack && (
        <AddToPlaylistModal track={addingTrack} onClose={() => setAddingTrack(null)} />
      )}
    </div>
  );
}
