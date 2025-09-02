import { useEffect, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./broadcastChannel.css";


const EMOJI_PALETTE = [
  "👍","🥰","🔥","😮","😢","👎",
  "😡", "🙂"
];

/** Single message bubble with dynamic reactions + emoji picker */
function Message({ msg, onReact, onTogglePicker, isPickerOpen, onPickEmoji }) {
  const reactions = Object.entries(msg.reactions || {}); // [[emoji, count], ...]
  const roleClass =
    msg.author === "Admin" || msg.author === "Main Administrator"
      ? "admin"
      : "other";

  return (
    <div className={`bc-msg ${roleClass}`}>
      <div className="bc-author">{msg.author}</div>
      <div className="bc-bubble">
        <p>{msg.text}</p>
      </div>

      <div className="bc-reactions">
        {reactions.map(([emoji, count]) => (
          <button
            key={emoji}
            className="bc-chip"
            type="button"
            onClick={() => onReact(msg.id, emoji)}
            aria-label={`React ${emoji}`}
          >
            <span className="bc-chip-emoji">{emoji}</span>
            <span className="bc-chip-count">{count}</span>
          </button>
        ))}

        {/* Add reaction opens the emoji-only picker */}
        <button
          className="bc-chip bc-chip-add"
          type="button"
          title="Add reaction"
          onClick={() => onTogglePicker(msg.id)}
          aria-expanded={isPickerOpen ? "true" : "false"}
          aria-controls={`picker-${msg.id}`}
        >
          ＋
        </button>

        {/* Inline emoji picker (emojis only) */}
        {isPickerOpen && (
          <div className="bc-emoji-pop" id={`picker-${msg.id}`} role="menu">
            {EMOJI_PALETTE.map((e) => (
              <button
                key={e}
                className="bc-emoji-btn"
                type="button"
                role="menuitem"
                onClick={() => onPickEmoji(msg.id, e)}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Broadcast() {
  const [tab, setTab] = useState("everyone");
  const [draft, setDraft] = useState("");
  const feedRef = useRef(null);

  // start empty
  const [messages, setMessages] = useState([]);

  // which message has the emoji picker open
  const [pickerForId, setPickerForId] = useState(null);

  const filtered = messages.filter((m) =>
    tab === "admins" ? m.audience === "admins" : m.audience === "everyone"
  );

  // keep feed scrolled to bottom when list grows
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        audience: tab,
        author: tab === "admins" ? "Admin" : "Main Administrator",
        text,
        reactions: {}
      }
    ]);

    setDraft("");
  };

  const handleEnter = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const react = (id, emoji) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              reactions: { ...m.reactions, [emoji]: (m.reactions[emoji] || 0) + 1 }
            }
          : m
      )
    );
  };

  /** Open/close the emoji-only picker for a specific message */
  const togglePicker = (id) => {
    setPickerForId((cur) => (cur === id ? null : id));
  };

  /** When an emoji is chosen from the palette */
  const pickEmoji = (id, emoji) => {
    react(id, emoji);
    setPickerForId(null);
  };

  return (
    <>
      <Navbar />
      <div className="main-content">
        <HeaderButton />

        {/* Tabs */}
        <div className="bc-tabs center-row">
          <button
            className={`bc-tab ${tab === "everyone" ? "active" : ""}`}
            onClick={() => setTab("everyone")}
          >
            For Everyone
          </button>
          <button
            className={`bc-tab ${tab === "admins" ? "active" : ""}`}
            onClick={() => setTab("admins")}
          >
            Admins
          </button>
        </div>

        <div className="header-row">
          <h1 className="page-title">Broadcast Channel</h1>
          <HeaderButton />
        </div>

        <hr className="bc-title-rule" />

        {/* Feed */}
        <div className="bc-feed" ref={feedRef}>
          {filtered.length === 0 ? (
            <div className="bc-empty">No messages yet.</div>
          ) : (
            filtered.map((m) => (
              <Message
                key={m.id}
                msg={m}
                onReact={react}
                onTogglePicker={togglePicker}
                isPickerOpen={pickerForId === m.id}
                onPickEmoji={pickEmoji}
              />
            ))
          )}
        </div>

        {/* Composer with icon INSIDE the field */}
        <div className="bc-composer" style={{ position: "relative" }}>
          <textarea
            className="bc-input"
            placeholder="Type a message..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleEnter}
            style={{ paddingRight: 48 }}        // room for the icon
          />
          <button className="bc-send" onClick={sendMessage} aria-label="Send">
            <img
              src="https://cdn-icons-png.flaticon.com/512/126/126475.png"
              alt="Send"
              className="bc-send-icon"
            />
          </button>
        </div>
      </div>
    </>
  );
}