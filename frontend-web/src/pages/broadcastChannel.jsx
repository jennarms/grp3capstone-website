import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { StationNavbar } from "../components/station_navbar";
import "./broadcastChannel.css";

const EMOJI_PALETTE = ["👍", "🥰", "😮", "😢", "👎", "😡", "🙂"];
const apiUrl = import.meta.env.VITE_API_URL;

const ROLES = {
  MAIN_ADMIN: "main-admin",
  STATION_ADMIN: "station-admin",
  USER: "user",
};

function Message({
  msg,
  role,
  userId,
  onReact,
  onTogglePicker,
  isPickerOpen,
  onPickEmoji,
  canReact,
}) {
  const isMine =
    (msg.Sender_MainAdmin_ID &&
      role === ROLES.MAIN_ADMIN &&
      String(msg.Sender_MainAdmin_ID) === userId) ||
    (msg.Sender_Station_ID &&
      role === ROLES.STATION_ADMIN &&
      String(msg.Sender_Station_ID) === userId);

  const wrapperClass = isMine ? "bc-msg mine" : "bc-msg other";

  const getAuthorName = () => {
    if (msg.Sender_MainAdmin_ID) {
      return msg.Sender_MainAdmin_Username
        ? `Main Administrator (${msg.Sender_MainAdmin_Username})`
        : "Main Administrator";
    }
    if (msg.Sender_Station_ID) {
      return msg.Station_Name
        ? `Station Administrator (${msg.Station_Name})`
        : "Station Administrator";
    }
    return msg.author || "Unknown";
  };

  const getMessageText = () => msg.text || msg.Message_Content;

  const getMessageTime = () => {
    const ts = msg.sent_at || msg.Sent_At;
    return new Date(ts).toLocaleString();
  };

  const id = msg.id || msg.Message_ID;

  return (
    <div className={wrapperClass}>
      {!isMine && <div className="bc-author">{getAuthorName()}</div>}

      <div className="bc-bubble">
        {getMessageText()}
        <div className="bc-timestamp">{getMessageTime()}</div>
      </div>

      <div className="bc-reactions">
        {msg.reactions &&
          Object.entries(msg.reactions).map(([emoji, count]) => (
            <button
              key={emoji}
              className="bc-reaction-chip"
              onClick={() => canReact && onReact(id, emoji)}
              disabled={!canReact}
            >
              {emoji} {count}
            </button>
          ))}

        {canReact && (
          <button className="bc-add-reaction" onClick={() => onTogglePicker(id)}>
            +
          </button>
        )}
      </div>

      {isPickerOpen && (
        <div className="bc-emoji-pop">
          {EMOJI_PALETTE.map((emoji) => (
            <button
              key={emoji}
              className="bc-emoji-btn"
              onClick={() => onPickEmoji(id, emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useRole() {
  const [role, setRole] = useState("");
  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    setRole(storedRole || "");
  }, []);
  return role;
}

export function Broadcast() {
  const [tab, setTab] = useState("everyone");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [pickerForId, setPickerForId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const feedRef = useRef(null);

  const role = useRole();
  const userId = localStorage.getItem("userId");

  // Auto-clear errors after 5s
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // Auto scroll only if near bottom
  useEffect(() => {
    if (!feedRef.current) return;
    const el = feedRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const fullUrl = `${apiUrl}/api/broadcast${endpoint}`;

    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-User-Role": role,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    return await response.json();
  }, []);

  const canSendMessage = useCallback(
    () => role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN,
    [role]
  );

  const canViewChannel = useCallback(
    () =>
      tab === "everyone" ||
      role === ROLES.MAIN_ADMIN ||
      role === ROLES.STATION_ADMIN,
    [tab, role]
  );

  const canReact = useCallback(
    () =>
      tab === "everyone" ||
      role === ROLES.MAIN_ADMIN ||
      role === ROLES.STATION_ADMIN,
    [tab, role]
  );

  // Updated loadMessages with a flag to control overlay
  const loadMessages = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const endpoint = tab === "admins" ? "/admins" : "/everyone";
      const data = await apiCall(endpoint);

      setMessages(
        data.sort(
          (a, b) =>
            new Date(a.sent_at || a.Sent_At) - new Date(b.sent_at || b.Sent_At)
        )
      );
    } catch (err) {
      setError(`Failed to load messages: ${err.message}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [tab, apiCall]);

  // Initial load (shows loading)
  useEffect(() => {
    if (role && canViewChannel()) {
      loadMessages(true);
    }
  }, [tab, role, loadMessages, canViewChannel]);

  // Polling every 10s (silent)
  useEffect(() => {
    if (!role || !canViewChannel()) return;
    const id = setInterval(() => loadMessages(false), 10000);
    return () => clearInterval(id);
  }, [role, tab, loadMessages, canViewChannel]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !canSendMessage()) return;

    setSendingMessage(true);
    try {
      const endpoint = tab === "admins" ? "/admins/send" : "/everyone/send";
      await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({ message_content: text }),
      });
      setDraft("");
      await loadMessages(false); // update silently
    } catch (err) {
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setSendingMessage(false);
    }
  }, [draft, tab, apiCall, loadMessages, canSendMessage]);

  const handleEnter = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const react = useCallback(
    async (id, emoji) => {
      try {
        const endpoint = tab === "admins" ? "/admins/react" : "/everyone/react";
        await apiCall(endpoint, {
          method: "POST",
          body: JSON.stringify({ message_id: id, reaction_type: emoji }),
        });

        await loadMessages(false); // refresh silently
      } catch (err) {
        setError(`Failed to react: ${err.message}`);
      }
    },
    [tab, apiCall, loadMessages]
  );

  const togglePicker = (id) => {
    setPickerForId((cur) => (cur === id ? null : id));
  };

  const pickEmoji = (id, emoji) => {
    react(id, emoji);
    setPickerForId(null);
  };

  const NavbarComponent = role === ROLES.STATION_ADMIN ? StationNavbar : Navbar;

  const filtered = useMemo(
    () =>
      messages.filter((m) =>
        tab === "admins" ? m.audience === "admins" : m.audience === "everyone"
      ),
    [messages, tab]
  );

  if (!canViewChannel()) {
    return (
      <div className="broadcast-channel">
        <NavbarComponent />
        <div className="main-content">
          <HeaderButton />
          <div className="bc-error">You don't have permission to view this channel.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="broadcast-channel">
      <NavbarComponent />
      <div className="main-content">
        <HeaderButton />

        <div className="bc-tabs center-row">
          <button
            className={`bc-tab ${tab === "everyone" ? "active" : ""}`}
            onClick={() => setTab("everyone")}
          >
            For Everyone
          </button>
          {(role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN) && (
            <button
              className={`bc-tab ${tab === "admins" ? "active" : ""}`}
              onClick={() => setTab("admins")}
            >
              Admins Only
            </button>
          )}
        </div>

        <h1 className="page-title">
          Broadcast Channel {tab === "admins" ? "(Admin)" : ""}
        </h1>

        {error && <div className="bc-error">{error}</div>}

        <div className="bc-feed" ref={feedRef}>
          {filtered.map((m) => (
            <Message
              key={m.id || m.Message_ID}
              msg={m}
              role={role}
              userId={userId}
              onReact={react}
              onTogglePicker={togglePicker}
              isPickerOpen={pickerForId === (m.id || m.Message_ID)}
              onPickEmoji={pickEmoji}
              canReact={canReact()}
            />
          ))}
          {loading && <div className="bc-loading-overlay">Loading…</div>}
        </div>

        {canSendMessage() && (
          <div className="bc-composer">
            <textarea
              className="bc-input"
              placeholder={`Type a message${tab === "admins" ? " to admins" : " to everyone"}...`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={handleEnter}
              disabled={sendingMessage || loading}
            />
            <button
              className="bc-send"
              onClick={sendMessage}
              disabled={sendingMessage || loading || !draft.trim()}
            >
              {sendingMessage ? "…" : "➤"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
