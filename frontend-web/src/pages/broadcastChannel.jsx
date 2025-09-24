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

// =================== MESSAGE COMPONENT ===================
function Message({ msg, userId, onReact, onTogglePicker, isPickerOpen, onPickEmoji, canReact }) {
  const userIdStr = String(userId || "").trim();

  const isMine = useMemo(() => {
    if (msg.Sender_MainAdmin_ID) return String(msg.Sender_MainAdmin_ID).trim() === userIdStr;
    if (msg.Sender_Station_ID) return String(msg.Sender_Station_ID).trim() === userIdStr;
    if (msg.userId) return String(msg.userId).trim() === userIdStr;
    return false;
  }, [msg, userIdStr]);

  const wrapperClass = isMine ? "bc-msg mine" : "bc-msg other";

  const getAuthorName = () => {
    if (msg.Sender_MainAdmin_ID) return msg.Sender_MainAdmin_Username ? `Main Admin (${msg.Sender_MainAdmin_Username})` : "Main Admin";
    if (msg.Sender_Station_ID) return msg.Station_Name ? `Station Admin (${msg.Station_Name})` : "Station Admin";
    return msg.author || "Unknown";
  };

  const getMessageText = () => msg.text || msg.Message_Content;
  const getMessageTime = () => new Date(msg.sent_at || msg.Sent_At).toLocaleString();
  const id = msg.id || msg.Message_ID;

  return (
    <div className={wrapperClass}>
      <div className="bc-author">{getAuthorName()}</div>
      <div className="bc-bubble">
        {getMessageText()}
        <div className="bc-timestamp">{getMessageTime()}</div>
      </div>

      <div className="bc-reactions">
        {msg.reactions && Object.entries(msg.reactions).map(([emoji, count]) => {
          const userHasReacted = msg.userReactions?.includes(emoji) || false;

          // Only allow deletion if current user reacted
          const canDelete = userHasReacted;

          return (
            <button
              key={emoji}
              className={`bc-reaction-chip ${userHasReacted ? "reacted" : ""}`}
              onClick={() => {
                if (!userHasReacted) {
                  onReact(id, emoji, false); // add reaction
                } else if (canDelete) {
                  onReact(id, emoji, true);  // delete reaction
                }
              }}
              disabled={!canReact || (!userHasReacted && count === 0)}
            >
              {emoji} {count}
            </button>
          );
        })}
        {canReact && <button className="bc-add-reaction" onClick={() => onTogglePicker(id)}>+</button>}
      </div>


      {isPickerOpen && (
        <div className="bc-emoji-pop">
          {EMOJI_PALETTE.map((emoji) => (
            <button key={emoji} className="bc-emoji-btn" onClick={() => onPickEmoji(id, emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =================== CUSTOM HOOK ===================
function useRole() {
  const [role, setRole] = useState("");
  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);
  return role;
}

// =================== BROADCAST COMPONENT ===================
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
  const userId = localStorage.getItem("admin_id");

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (feedRef.current) {
      const el = feedRef.current;
      el.scrollTop = el.scrollHeight; // always scroll to the bottom
    }
  }, [messages]);


  // =================== API CALL ===================
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

  const canSendMessage = useCallback(() => role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN, [role]);
  const canViewChannel = useCallback(() => tab === "everyone" || role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN, [tab, role]);
  const canReact = useCallback(() => tab === "everyone" || role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN, [tab, role]);

  // =================== LOAD MESSAGES ===================
  const loadMessages = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const endpoint = tab === "admins" ? "/admins" : "/everyone";
      const data = await apiCall(endpoint);

      const processedMessages = await Promise.all(data.map(async (msg) => {
        try {
          const reactionEndpoint = tab === "admins" ? `/admins/reactions/${msg.id || msg.Message_ID}` : `/everyone/reactions/${msg.id || msg.Message_ID}`;
          const reactionData = await apiCall(reactionEndpoint);
          const userReactions = reactionData.reactions?.filter(r => {
            if (role === ROLES.USER) return r.reactor_user_id === userId;
            if (role === ROLES.MAIN_ADMIN) return r.reactor_mainadmin_id === userId;
            if (role === ROLES.STATION_ADMIN) return r.reactor_station_id === userId;
            return false;
          })?.map(r => r.reaction_type) || [];
          return { ...msg, userReactions };
        } catch {
          return { ...msg, userReactions: [] };
        }
      }));

      setMessages(processedMessages.sort((a, b) => new Date(a.sent_at || a.Sent_At) - new Date(b.sent_at || b.Sent_At)));
    } catch (err) {
      setError(`Failed to load messages: ${err.message}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [tab, apiCall, role, userId]);

  useEffect(() => {
    if (role && canViewChannel()) loadMessages(true);
  }, [tab, role, loadMessages, canViewChannel]);

  useEffect(() => {
    if (!role || !canViewChannel()) return;
    const id = setInterval(() => loadMessages(false), 10000);
    return () => clearInterval(id);
  }, [role, tab, loadMessages, canViewChannel]);

  // =================== SEND MESSAGE ===================
  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !canSendMessage()) return;

    setSendingMessage(true);
    try {
      const endpoint = tab === "admins" ? "/admins/send" : "/everyone/send";
      await apiCall(endpoint, { method: "POST", body: JSON.stringify({ message_content: text }) });
      setDraft("");
      await loadMessages(false);
    } catch (err) {
      setError(`Failed to send message: ${err.message}`);
    } finally {
      setSendingMessage(false);
    }
  }, [draft, tab, apiCall, loadMessages, canSendMessage]);

  const handleEnter = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // =================== REACTIONS ===================
  const react = useCallback(async (id, emoji, userHasReacted = false) => {
      try {
        setLoading(true);
        const endpointBase = tab === "admins" ? "/admins" : "/everyone";

        if (userHasReacted) {
          // Delete reaction (only allowed if current user reacted)
          await apiCall(`${endpointBase}/reaction/delete`, {
            method: "POST",
            body: JSON.stringify({ message_id: id, reaction_type: emoji }),
          });
        } else {
          // Add reaction
          await apiCall(`${endpointBase}/react`, {
            method: "POST",
            body: JSON.stringify({ message_id: id, reaction_type: emoji }),
          });
        }

        await loadMessages(false);
      } catch (err) {
        setError(`Failed to react: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, [tab, apiCall, loadMessages]);


  const togglePicker = (id) => setPickerForId((cur) => (cur === id ? null : id));

  const pickEmoji = (id, emoji) => {
    const msg = messages.find((m) => m.id === id || m.Message_ID === id);
    const userHasReacted = msg?.userReactions?.includes(emoji) || false;
    react(id, emoji, userHasReacted);
    setPickerForId(null);
  };

  const NavbarComponent = role === ROLES.STATION_ADMIN ? StationNavbar : Navbar;

  const filtered = useMemo(() => messages.filter((m) => (tab === "admins" ? m.audience === "admins" : m.audience === "everyone")), [messages, tab]);

  if (!canViewChannel())
    return (
      <div className="broadcast-channel">
        <NavbarComponent />
        <div className="main-content">
          <HeaderButton />
          <div className="bc-error">You don't have permission to view this channel.</div>
        </div>
      </div>
    );

  return (
    <div className="broadcast-channel">
      <NavbarComponent />
      <div className="main-content">
        <HeaderButton />
        <div className="bc-tabs center-row">
          <button className={`bc-tab ${tab === "everyone" ? "active" : ""}`} onClick={() => setTab("everyone")}>For Everyone</button>
          {(role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN) && <button className={`bc-tab ${tab === "admins" ? "active" : ""}`} onClick={() => setTab("admins")}>Admins Only</button>}
        </div>
        <h1 className="page-title">Broadcast Channel {tab === "admins" ? "(Admin)" : ""}</h1>
        {error && <div className="bc-error">{error}</div>}
        <div className="bc-feed" ref={feedRef}>
          {filtered.map((m) => (
            <Message
              key={m.id || m.Message_ID}
              msg={m}
              userId={userId}
              onReact={react}
              onTogglePicker={togglePicker}
              isPickerOpen={pickerForId === (m.id || m.Message_ID)}
              onPickEmoji={pickEmoji}
              canReact={canReact()}
            />
          ))}
          {(loading || sendingMessage) && <div className="bc-loading-overlay">Loading…</div>}
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
            <button className="bc-send" onClick={sendMessage} disabled={sendingMessage || loading || !draft.trim()}>{sendingMessage ? "…" : "➤"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
