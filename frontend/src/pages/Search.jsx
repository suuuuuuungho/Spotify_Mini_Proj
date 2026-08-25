import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import TrackRow from "../components/TrackRow";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import VibeFinderCard from "../components/VibeFinderCard";

export default function Search() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingTrack, setAddingTrack] = useState(null);
  const [vibeLoading, setVibeLoading] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    api.chatHistory().then(({ messages }) => setMessages(messages));
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearChat = async () => {
    if (!confirm("Clear this conversation?")) return;
    if (user) await api.clearChatHistory();
    setMessages([]);
  };

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const { reply, tracks, show_mood_picker } = await api.chat(
        nextMessages.map(({ role, content }) => ({ role, content }))
      );
      setMessages([
        ...nextMessages,
        { role: "assistant", content: reply, tracks, show_mood_picker },
      ]);
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
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {messages.length > 0 && (
        <div className="fixed top-16 left-72 right-0 z-30 bg-surface-container-low/90 backdrop-blur-md px-lg py-sm">
          <div className="max-w-2xl mx-auto flex justify-end">
            <button
              onClick={clearChat}
              className="flex items-center gap-xs text-on-surface-variant hover:text-on-surface font-label-bold text-label-bold px-md py-xs rounded-full hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-base">add_comment</span>
              New chat
            </button>
          </div>
        </div>
      )}
      <div className={`flex-1 flex flex-col gap-md pb-64 ${messages.length > 0 ? "pt-14" : ""}`}>
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

      <form
        onSubmit={send}
        className="fixed bottom-[80px] left-72 right-0 bg-surface/90 backdrop-blur-md px-lg py-md z-30"
      >
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
