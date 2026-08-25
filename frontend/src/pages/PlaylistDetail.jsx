import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useNowPlaying } from "../NowPlayingContext";

function formatYear(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).getFullYear();
}

function formatDuration(ms) {
  if (!ms) return "--:--";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatTotalDuration(tracks) {
  const totalMs = tracks.reduce((sum, t) => sum + (t.duration_ms || 0), 0);
  const totalMin = Math.floor(totalMs / 60000);
  const totalSec = Math.floor((totalMs % 60000) / 1000);
  return `${totalMin} min ${totalSec} sec`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function CoverArt({ playlist }) {
  if (playlist.image_url) {
    return <img src={playlist.image_url} alt="" className="w-full h-full object-cover" />;
  }
  const images = playlist.tracks.map((t) => t.album_image_url).filter(Boolean).slice(0, 4);
  if (images.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-high">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant">
          queue_music
        </span>
      </div>
    );
  }
  if (images.length < 4) {
    return <img src={images[0]} alt="" className="w-full h-full object-cover" />;
  }
  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2">
      {images.map((src, i) => (
        <img key={i} src={src} alt="" className="w-full h-full object-cover" />
      ))}
    </div>
  );
}

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setTrack } = useNowPlaying();
  const [playlist, setPlaylist] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTrack, setSelectedTrack] = useState(null);
  const menuRef = useRef(null);

  const load = () => api.playlist(id).then(setPlaylist);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const removeTrack = async (track) => {
    await api.removeTrack(id, track.id);
    load();
  };

  const deletePlaylist = async () => {
    if (!confirm(`Delete "${playlist.name}"?`)) return;
    await api.deletePlaylist(id);
    navigate("/playlists");
  };

  const selectTrack = (track) => {
    setSelectedTrack(track);
    api.track(track.id).then(setSelectedTrack).catch(() => {});
  };

  const play = (track) => {
    setTrack(track);
    selectTrack(track);
  };
  const playFirst = () => playlist.tracks.length > 0 && play(playlist.tracks[0]);
  const shuffle = () =>
    playlist.tracks.length > 0 &&
    play(playlist.tracks[Math.floor(Math.random() * playlist.tracks.length)]);

  const openEdit = () => {
    setName(playlist.name);
    setDescription(playlist.description || "");
    setEditing(true);
    setMenuOpen(false);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    await api.updatePlaylist(id, { name: name.trim(), description: description.trim() || null });
    setEditing(false);
    load();
  };

  if (!playlist) return <p className="text-on-surface-variant">Loading...</p>;

  return (
    <div className="flex items-start gap-lg -mx-lg -mt-16">
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="bg-gradient-to-b from-primary-container/70 via-primary-container/15 to-surface px-lg pt-24 pb-lg">
        <div className="flex items-end gap-lg">
          <div className="w-56 h-56 rounded-lg overflow-hidden bg-surface-container-high shrink-0 shadow-2xl">
            <CoverArt playlist={playlist} />
          </div>
          <div className="flex flex-col gap-sm min-w-0">
            <span className="font-label-bold text-label-bold text-on-surface uppercase">
              Playlist
            </span>
            <h1 className="font-vibe text-[64px] leading-[1.05] font-black tracking-[-0.02em] text-on-surface break-words">
              {playlist.name}
            </h1>
            {playlist.description && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {playlist.description}
              </p>
            )}
            <div className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface">
              <span className="w-6 h-6 rounded-full bg-surface-container-highest flex items-center justify-center text-[11px] font-label-bold shrink-0">
                {(user?.display_name || "U")[0]}
              </span>
              <span className="font-label-bold">{user?.display_name}</span>
              <span className="text-on-surface-variant">
                · {playlist.tracks.length} song{playlist.tracks.length === 1 ? "" : "s"}
                {playlist.tracks.length > 0 && `, ${formatTotalDuration(playlist.tracks)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-lg pt-lg pb-md flex items-center gap-lg">
        <button
          onClick={playFirst}
          disabled={playlist.tracks.length === 0}
          title="Play"
          className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
        >
          <span className="material-symbols-outlined text-3xl">play_arrow</span>
        </button>
        <button
          onClick={shuffle}
          disabled={playlist.tracks.length === 0}
          title="Shuffle play"
          className="text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-3xl">shuffle</span>
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="More"
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-3xl">more_horiz</span>
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-xs w-48 bg-surface-container-high rounded-lg shadow-xl py-xs z-10">
              <button
                onClick={openEdit}
                className="w-full text-left px-md py-sm font-body-sm text-body-sm text-on-surface hover:bg-surface-container-highest"
              >
                Name & details
              </button>
              <button
                onClick={deletePlaylist}
                className="w-full text-left px-md py-sm font-body-sm text-body-sm text-error hover:bg-surface-container-highest"
              >
                Delete playlist
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-lg pb-sm flex items-center gap-sm">
        <Link
          to="/search"
          className="flex items-center gap-xs px-md py-xs rounded-full bg-surface-container-high text-on-surface font-label-bold text-label-bold hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add
        </Link>
        <button
          onClick={openEdit}
          className="flex items-center gap-xs px-md py-xs rounded-full bg-surface-container-high text-on-surface font-label-bold text-label-bold hover:bg-surface-container-highest transition-colors"
        >
          <span className="material-symbols-outlined text-base">edit</span>
          Name & details
        </button>
      </div>

      {editing && (
        <form
          onSubmit={saveEdit}
          className="mx-lg mb-md p-md rounded-lg bg-surface-container-high flex flex-col gap-sm"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playlist name"
            className="bg-transparent border-b border-outline-variant focus:outline-none focus:border-primary text-on-surface font-body-lg text-body-lg py-xs"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="bg-transparent border-b border-outline-variant focus:outline-none focus:border-primary text-on-surface font-body-sm text-body-sm py-xs"
          />
          <div className="flex gap-sm self-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-on-surface-variant font-label-bold text-label-bold px-md py-xs"
            >
              Cancel
            </button>
            <button className="bg-primary text-on-primary font-label-bold text-label-bold px-md py-xs rounded-full uppercase">
              Save
            </button>
          </div>
        </form>
      )}

      <div className="px-lg pb-xl">
        {playlist.tracks.length === 0 ? (
          <p className="text-on-surface-variant font-body-sm text-body-sm px-sm">
            Add tracks from search or Vibe Finder.
          </p>
        ) : (
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant font-body-sm text-body-sm">
                <th className="text-left font-normal py-xs px-sm w-10">#</th>
                <th className="text-left font-normal py-xs px-sm w-auto">Title</th>
                <th className="text-left font-normal py-xs px-sm w-40 hidden md:table-cell">
                  Album
                </th>
                <th className="text-left font-normal py-xs px-sm w-32 hidden sm:table-cell">
                  Date added
                </th>
                <th className="text-right font-normal py-xs px-sm w-16">
                  <span className="material-symbols-outlined text-base align-middle">
                    schedule
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {playlist.tracks.map((track, i) => (
                <tr
                  key={track.id}
                  className={`group hover:bg-surface-container-high rounded-lg transition-colors ${
                    selectedTrack?.id === track.id ? "bg-surface-container-high" : ""
                  }`}
                >
                  <td className="py-xs px-sm text-on-surface-variant font-body-sm text-body-sm tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-xs px-sm min-w-0">
                    <button onClick={() => play(track)} className="flex items-center gap-sm min-w-0">
                      <div className="w-10 h-10 rounded overflow-hidden bg-surface-container-highest shrink-0">
                        {track.album_image_url ? (
                          <img
                            src={track.album_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-on-surface-variant flex items-center justify-center w-full h-full text-base">
                            music_note
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="font-body-lg text-body-lg text-on-surface truncate">
                          {track.name}
                        </div>
                        <div className="font-body-sm text-body-sm text-on-surface-variant truncate">
                          {(track.artists || []).map((a) => a.name).join(", ")}
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="py-xs px-sm text-on-surface-variant font-body-sm text-body-sm truncate hidden md:table-cell">
                    {track.album_name}
                  </td>
                  <td className="py-xs px-sm text-on-surface-variant font-body-sm text-body-sm hidden sm:table-cell">
                    {timeAgo(track.added_at)}
                  </td>
                  <td className="py-xs px-sm text-right">
                    <div className="flex items-center justify-end gap-sm">
                      <button
                        onClick={() => removeTrack(track)}
                        title="Remove from playlist"
                        className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                      <span className="font-body-sm text-body-sm text-on-surface-variant tabular-nums">
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {selectedTrack && (
      <aside className="w-80 shrink-0 mt-16 mr-lg sticky top-20 flex flex-col gap-md bg-surface-container-low rounded-xl p-md">
        <div className="flex items-center justify-between">
          <span className="font-label-bold text-label-bold text-on-surface-variant uppercase">
            {selectedTrack.album_name || "Song"}
          </span>
          <button
            onClick={() => setSelectedTrack(null)}
            title="Close"
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="w-full aspect-square rounded-lg overflow-hidden bg-surface-container-high shadow-xl">
          {selectedTrack.album_image_url ? (
            <img
              src={selectedTrack.album_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="material-symbols-outlined text-6xl text-on-surface-variant flex items-center justify-center w-full h-full">
              music_note
            </span>
          )}
        </div>

        <div className="font-headline-md text-headline-md text-on-surface">
          {selectedTrack.name}
        </div>

        {(selectedTrack.artists || []).map((artist) => (
          <Link
            key={artist.id}
            to={`/artists/${artist.id}`}
            className="flex items-center gap-sm -mx-xs px-xs py-xs rounded-lg hover:bg-surface-container-high transition-colors"
          >
            <span className="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-surface-variant">person</span>
            </span>
            <div className="min-w-0">
              <div className="font-body-sm text-body-sm text-on-surface-variant uppercase">
                Artist
              </div>
              <div className="font-label-bold text-label-bold text-on-surface truncate">
                {artist.name}
              </div>
            </div>
          </Link>
        ))}

        {selectedTrack.genres?.length > 0 && (
          <div className="flex flex-wrap gap-xs">
            {selectedTrack.genres.map((g) => (
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

        <div className="bg-surface-container rounded-lg p-md flex flex-col gap-xs">
          <span className="font-label-bold text-label-bold text-on-surface-variant uppercase text-xs">
            About
          </span>
          {selectedTrack.album_name && (
            <div className="flex items-center justify-between font-body-sm text-body-sm">
              <span className="text-on-surface-variant">Album</span>
              <Link
                to={`/albums/${selectedTrack.album_id}`}
                className="text-on-surface hover:underline truncate max-w-[60%] text-right"
              >
                {selectedTrack.album_name}
              </Link>
            </div>
          )}
          {formatYear(selectedTrack.release_date) && (
            <div className="flex items-center justify-between font-body-sm text-body-sm">
              <span className="text-on-surface-variant">Release year</span>
              <span className="text-on-surface">{formatYear(selectedTrack.release_date)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-body-sm text-body-sm">
            <span className="text-on-surface-variant">Duration</span>
            <span className="text-on-surface">{formatDuration(selectedTrack.duration_ms)}</span>
          </div>
          {selectedTrack.popularity != null && (
            <div className="flex items-center justify-between font-body-sm text-body-sm">
              <span className="text-on-surface-variant">Popularity</span>
              <span className="text-on-surface">{selectedTrack.popularity}</span>
            </div>
          )}
        </div>

        {selectedTrack.spotify_url && (
          <a
            href={selectedTrack.spotify_url}
            target="_blank"
            rel="noreferrer"
            className="self-start flex items-center gap-xs bg-surface-container-high text-on-surface font-label-bold text-label-bold px-md py-xs rounded-full hover:bg-surface-container-highest transition-colors uppercase"
          >
            Open in Spotify
          </a>
        )}
      </aside>
    )}
    </div>
  );
}
