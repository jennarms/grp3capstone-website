import { useEffect, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./broadcastChannel.css";

/** Single message bubble with dynamic reactions */
function Message({ msg, onReact, onAddReaction }) {
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

        <button
          className="bc-chip bc-chip-add"
          type="button"
          title="Add reaction"
          onClick={() => onAddReaction(msg.id)}
        >
          ＋
        </button>
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

  const addReaction = (id) => {
    const raw = window.prompt("React with an emoji (e.g., 😍 👍 🔥):");
    if (!raw) return;
    const emoji = Array.from(raw.trim())[0]; // first grapheme
    if (!emoji) return;
    react(id, emoji);
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
                onAddReaction={addReaction}
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