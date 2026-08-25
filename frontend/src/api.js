const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export const api = {
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
  loginUrl: () => `${BASE_URL}/auth/login`,

  genres: () => request("/genres"),
  libraryArtists: () => request("/library/artists"),
  libraryAlbums: () => request("/library/albums"),
  recentlyPlayed: () => request("/library/recently-played"),
  recordPlay: (trackId) =>
    request("/library/recently-played", {
      method: "POST",
      body: JSON.stringify({ track_id: trackId }),
    }),
  tracks: ({ q = "", genre = "", limit = 24, offset = 0 } = {}) =>
    request(`/tracks?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(genre)}&limit=${limit}&offset=${offset}`),
  track: (id) => request(`/tracks/${id}`),
  album: (id) => request(`/albums/${id}`),
  artist: (id) => request(`/artists/${id}`),

  playlists: () => request("/playlists"),
  importSpotifyPlaylists: () => request("/playlists/import-spotify", { method: "POST" }),
  createPlaylist: (body) => request("/playlists", { method: "POST", body: JSON.stringify(body) }),
  playlist: (id) => request(`/playlists/${id}`),
  updatePlaylist: (id, body) =>
    request(`/playlists/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePlaylist: (id) => request(`/playlists/${id}`, { method: "DELETE" }),
  addTrack: (playlistId, trackId) =>
    request(`/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: JSON.stringify({ track_id: trackId }),
    }),
  removeTrack: (playlistId, trackId) =>
    request(`/playlists/${playlistId}/tracks/${trackId}`, { method: "DELETE" }),
  addTracksBulk: (playlistId, trackIds) =>
    request(`/playlists/${playlistId}/tracks/bulk`, {
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),

  discoverMood: ({ energy, valence, danceability, acousticness, liveness, speechiness, limit = 30 }) =>
    request(
      `/discover/mood?energy=${energy}&valence=${valence}&danceability=${danceability}&acousticness=${acousticness}&liveness=${liveness}&speechiness=${speechiness}&limit=${limit}`
    ),

  chat: (messages, sessionId) =>
    request("/chat", {
      method: "POST",
      body: JSON.stringify({ messages, session_id: sessionId || null }),
    }),
  chatSessions: () => request("/chat/sessions"),
  createChatSession: () => request("/chat/sessions", { method: "POST" }),
  chatSessionHistory: (sessionId) => request(`/chat/sessions/${sessionId}/history`),
  deleteChatSession: (sessionId) =>
    request(`/chat/sessions/${sessionId}`, { method: "DELETE" }),

  statsGenres: () => request("/stats/genres"),
  statsTopArtists: (limit = 20) => request(`/stats/top-artists?limit=${limit}`),
  statsTopTracks: (limit = 15) => request(`/stats/top-tracks?limit=${limit}`),
  statsOverview: () => request("/stats/overview"),
  statsReleaseDecades: () => request("/stats/release-decades"),
};
