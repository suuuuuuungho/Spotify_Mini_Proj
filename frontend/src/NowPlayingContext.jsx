import { createContext, useCallback, useContext, useState } from "react";
import { api } from "./api";
import { useAuth } from "./AuthContext";

const NowPlayingContext = createContext(null);

export function NowPlayingProvider({ children }) {
  const [track, setTrackState] = useState(null);
  const { user } = useAuth();

  const setTrack = useCallback(
    (nextTrack) => {
      setTrackState(nextTrack);
      if (nextTrack && user) {
        api.recordPlay(nextTrack.id).catch((err) => {
          console.error("Failed to record play:", err.message);
        });
      }
    },
    [user]
  );

  return (
    <NowPlayingContext.Provider value={{ track, setTrack }}>
      {children}
    </NowPlayingContext.Provider>
  );
}

export function useNowPlaying() {
  return useContext(NowPlayingContext);
}
