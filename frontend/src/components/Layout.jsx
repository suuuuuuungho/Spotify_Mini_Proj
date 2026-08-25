import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import PlayerBar from "./PlayerBar";
import { useNowPlaying } from "../NowPlayingContext";

export default function Layout() {
  const { track } = useNowPlaying();

  return (
    <>
      <Sidebar />
      <div className="pl-72 flex flex-col min-h-screen">
        <Header />
        <main
          className={`flex-1 pt-16 px-lg bg-gradient-to-b from-surface-container-low to-surface ${
            track ? "pb-[104px]" : "pb-lg"
          }`}
        >
          <Outlet />
        </main>
      </div>
      <PlayerBar />
    </>
  );
}
