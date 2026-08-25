import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";

const links = [
  { to: "/", label: "Architecture", icon: "account_tree", end: true },
  { to: "/search", label: "Search", icon: "search" },
  { to: "/playlists", label: "Playlist", icon: "library_music" },
  { to: "/discover", label: "Vibe Finder", icon: "tune" },
  { to: "/stats", label: "Stats", icon: "bar_chart" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId: activeSessionId } = useParams();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.chatSessions().then(setSessions);
  }, [user, location.pathname]);

  const startNewChat = async () => {
    const session = await api.createChatSession();
    setSessions((prev) => [session, ...prev]);
    navigate(`/search/${session.id}`);
  };

  const deleteChat = async (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${session.title}"?`)) return;
    await api.deleteChatSession(session.id);
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    if (activeSessionId === session.id) navigate("/search");
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-50 flex flex-col pt-md pb-xl overflow-y-auto">
      <div className="px-md mb-lg flex items-center gap-xs">
        <span className="material-symbols-outlined text-primary text-3xl">headphones</span>
        <span className="font-vibe text-4xl font-black tracking-[-0.02em]">Taste</span>
      </div>
      <nav className="flex-1 px-base space-y-xs">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center px-md py-sm rounded-lg transition-all group ${
                isActive
                  ? "bg-surface-container-highest text-on-surface font-bold"
                  : "text-on-surface-variant hover:text-on-surface"
              }`
            }
          >
            <span className="material-symbols-outlined mr-sm group-hover:text-primary transition-colors">
              {link.icon}
            </span>
            <span className="font-body-lg text-body-lg">{link.label}</span>
          </NavLink>
        ))}

        {user && (
          <>
            <div className="border-t border-outline-variant !mt-sm !mb-sm" />
            <button
              onClick={startNewChat}
              className="w-full flex items-center px-md py-sm rounded-lg bg-primary text-on-primary hover:scale-[1.02] transition-transform"
            >
              <span className="material-symbols-outlined mr-sm">add_comment</span>
              <span className="font-label-bold text-label-bold">New chat</span>
            </button>
            <div className="flex flex-col gap-1 mt-xs">
              {sessions.map((s) => (
                <div key={s.id} className="group flex items-center">
                  <NavLink
                    to={`/search/${s.id}`}
                    className={({ isActive }) =>
                      `flex-1 min-w-0 px-md py-xs rounded-md truncate font-body-sm text-body-sm transition-colors ${
                        isActive
                          ? "bg-surface-container-highest text-on-surface"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                      }`
                    }
                    title={s.title}
                  >
                    {s.title}
                  </NavLink>
                  <button
                    onClick={(e) => deleteChat(e, s)}
                    title="Delete chat"
                    className="p-xs mr-xs rounded-full text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error hover:bg-surface-container-highest transition-all shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </nav>
      <div className="px-md mt-auto pt-lg">
        {user ? (
          <button
            onClick={logout}
            className="w-full bg-surface-container-high text-on-surface font-label-bold text-label-bold py-sm rounded-full hover:bg-surface-container-highest transition-colors uppercase tracking-widest"
          >
            Log out
          </button>
        ) : (
          <a
            href={api.loginUrl()}
            className="block text-center w-full bg-primary text-on-primary font-label-bold text-label-bold py-sm rounded-full hover:scale-105 transition-transform uppercase tracking-widest"
          >
            Log in with Spotify
          </a>
        )}
      </div>
    </aside>
  );
}
