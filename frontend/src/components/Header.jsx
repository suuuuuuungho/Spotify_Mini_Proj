import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface/80 backdrop-blur-xl z-40 flex items-center justify-between px-lg">
      <div className="flex items-center gap-md">
        <div className="flex gap-xs">
          <button
            onClick={() => navigate(-1)}
            className="p-xs bg-surface-container-lowest rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-xs bg-surface-container-lowest rounded-full text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-md">
        {user ? (
          <div className="flex items-center gap-sm">
            <span className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-xs font-bold">
              {(user.display_name || "?")[0]}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {user.display_name}
            </span>
          </div>
        ) : (
          <span className="font-body-sm text-body-sm text-on-surface-variant">Not logged in</span>
        )}
      </div>
    </header>
  );
}
