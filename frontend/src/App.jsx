import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { NowPlayingProvider } from "./NowPlayingContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Search from "./pages/Search";
import Discover from "./pages/Discover";
import Stats from "./pages/Stats";
import TrackDetail from "./pages/TrackDetail";
import AlbumDetail from "./pages/AlbumDetail";
import ArtistDetail from "./pages/ArtistDetail";
import PlaylistDetail from "./pages/PlaylistDetail";

export default function App() {
  return (
    <AuthProvider>
      <NowPlayingProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/tracks/:id" element={<TrackDetail />} />
              <Route path="/albums/:id" element={<AlbumDetail />} />
              <Route path="/artists/:id" element={<ArtistDetail />} />
              <Route path="/playlists" element={<Library />} />
              <Route path="/playlists/:id" element={<PlaylistDetail />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/stats" element={<Stats />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NowPlayingProvider>
    </AuthProvider>
  );
}
