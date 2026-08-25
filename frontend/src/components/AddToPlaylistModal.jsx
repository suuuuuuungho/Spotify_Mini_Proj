import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function AddToPlaylistModal({ track, onClose }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (user) api.playlists().then(setPlaylists);
  }, [user]);

  const add = async (playlistId) => {
    try {
      await api.addTrack(playlistId, track.id);
      setStatus("Added");
      setTimeout(onClose, 500);
    } catch (e) {
      setStatus(e.message);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-high rounded-xl w-80 max-h-[70vh] overflow-y-auto p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-body-lg text-body-lg font-bold mb-sm truncate">
          Add "{track.name}" to a playlist
        </h3>
        {!user && (
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            You need to log in first.
          </p>
        )}
        {user && playlists.length === 0 && (
          <p className="text-on-surface-variant font-body-sm text-body-sm">
            You don't have any playlists yet — create one first.
          </p>
        )}
        <ul className="flex flex-col gap-xs mt-sm">
          {playlists.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => add(p.id)}
                className="w-full text-left px-sm py-xs rounded-lg hover:bg-surface-container-highest transition-colors font-body-sm text-body-sm"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        {status && (
          <p className="mt-sm text-primary font-body-sm text-body-sm">{status}</p>
        )}
        <button
          onClick={onClose}
          className="mt-md w-full py-xs rounded-full bg-surface-container-highest hover:bg-outline/30 transition-colors font-label-bold text-label-bold uppercase"
        >
          Close
        </button>
      </div>
    </div>
  );
}
