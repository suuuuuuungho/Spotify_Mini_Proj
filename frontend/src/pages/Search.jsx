import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useNowPlaying } from "../NowPlayingContext";
import TrackRow from "../components/TrackRow";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import VibeFinderCard from "../components/VibeFinderCard";

export default function Search() {
  const { user } = useAuth();
  const { track } = useNowPlaying();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingTrack, setAddingTrack] = useState(null);
  const [vibeLoading, setVibeLoading] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user || !sessionId) {
      setMessages([]);
      return;
    }
    api.chatSessionHistory(sessionId).then(({ messages }) => setMessages(messages));
  }, [user, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const {
        reply,
        tracks,
        show_mood_picker,
        session_id: newSessionId,
      } = await api.chat(
        nextMessages.map(({ role, content }) => ({ role, content })),
        sessionId
      );
      setMessages([
        ...nextMessages,
        { role: "assistant", content: reply, tracks, show_mood_picker },
      ]);
      if (newSessionId && newSessionId !== sessionId) {
        navigate(`/search/${newSessionId}`, { replace: true });
      }
    } catch (err) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `Something went wrong: ${err.message}`, tracks: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const searchVibe = async (index, values) => {
    setVibeLoading(index);
    try {
      const tracks = await api.discoverMood({ ...values, limit: 20 });
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, tracks } : m)));
    } finally {
      setVibeLoading(null);
    }
  };

  return (
    <div
      className={`fixed top-16 left-72 right-0 flex flex-col bg-gradient-to-b from-primary-container/15 via-surface to-surface ${
        track ? "bottom-[104px]" : "bottom-0"
      }`}
    >
      <div className="flex-1 overflow-y-auto px-lg">
        <div className="max-w-2xl mx-auto flex flex-col gap-md py-lg">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-md py-sm ${
                  m.role === "user"
                    ? "bg-primary text-on-primary rounded-br-sm"
                    : "bg-surface-container-high text-on-surface rounded-bl-sm"
                }`}
              >
                <p className="font-body-lg text-body-lg whitespace-pre-wrap">{m.content}</p>
                {m.show_mood_picker && (
                  <VibeFinderCard
                    onSearch={(values) => searchVibe(i, values)}
                    loading={vibeLoading === i}
                  />
                )}
                {m.tracks?.length > 0 && (
                  <div className="flex flex-col mt-sm -mx-sm bg-surface/40 rounded-xl overflow-hidden">
                    {m.tracks.map((track) => (
                      <TrackRow key={track.id} track={track} onAction={setAddingTrack} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-container-high text-on-surface-variant rounded-2xl rounded-bl-sm px-md py-sm font-body-sm text-body-sm">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={send} className="shrink-0 px-lg py-md">
        <div className="max-w-2xl mx-auto flex items-center gap-sm">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for a genre, artist, or vibe..."
            autoFocus
            className="flex-1 rounded-full bg-surface-container-highest border-0 py-sm px-md text-on-surface ring-1 ring-inset ring-surface-container-highest focus:ring-2 focus:ring-inset focus:ring-primary font-body-lg placeholder:text-on-surface-variant/50"
          />
          <button
            disabled={loading || !input.trim()}
            className="w-10 h-10 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </form>

      {addingTrack && (
        <AddToPlaylistModal track={addingTrack} onClose={() => setAddingTrack(null)} />
      )}
    </div>
  );
}
