import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { LogoutButton } from "../components/logout_button";
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

// =================== CUSTOM HOOK FOR ROLE ===================
function useRole() {
  const [role, setRole] = useState("");
  
  useEffect(() => {
    const storedRole = localStorage.getItem("role") || "";
    setRole(storedRole);
    
    // Listen for role changes (if user logs out/in during session)
    const handleStorageChange = () => {
      setRole(localStorage.getItem("role") || "");
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  
  return role;
}

// =================== NAVBAR AND BUTTON SELECTOR ===================
function NavbarSelector({ role }) {
  if (role === ROLES.STATION_ADMIN) {
    return <StationNavbar />;
  } else {
    return <Navbar />;
  }
}

function ButtonSelector({ role }) {
  if (role === ROLES.STATION_ADMIN) {
    return <LogoutButton />;
  } else {
    return <HeaderButton />;
  }
}

// =================== MESSAGE COMPONENT ===================
function Message({ 
  msg, 
  userId, 
  userRole,
  onReact, 
  onTogglePicker, 
  isPickerOpen, 
  onPickEmoji, 
  canReact,
  onEdit
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const textareaRef = useRef(null);

  const userIdStr = String(userId || "").trim();

  const isMine = useMemo(() => {
    if (msg.Sender_MainAdmin_ID) return String(msg.Sender_MainAdmin_ID).trim() === userIdStr;
    if (msg.Sender_Station_ID) return String(msg.Sender_Station_ID).trim() === userIdStr;
    if (msg.userId) return String(msg.userId).trim() === userIdStr;
    return false;
  }, [msg, userIdStr]);

  const canEdit = useMemo(() => {
    return isMine && (userRole === ROLES.MAIN_ADMIN || userRole === ROLES.STATION_ADMIN);
  }, [isMine, userRole]);

  const wrapperClass = isMine ? "bc-msg mine" : "bc-msg other";

  const getAuthorName = () => {
    if (msg.Sender_MainAdmin_ID) return msg.Sender_MainAdmin_Username ? `Main Admin (${msg.Sender_MainAdmin_Username})` : "Main Admin";
    if (msg.Sender_Station_ID) return msg.Station_Name ? `Station Admin (${msg.Station_Name})` : "Station Admin";
    return msg.author || "Unknown";
  };

  const getMessageText = () => msg.text || msg.Message_Content;
  const getMessageTime = () => new Date(msg.sent_at || msg.Sent_At).toLocaleString();
  const id = msg.id || msg.Message_ID;

  const handleEditStart = () => {
    setEditText(getMessageText());
    setIsEditing(true);
    setEditError("");
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText("");
    setEditError("");
  };

  const handleEditSave = async () => {
    const trimmedText = editText.trim();
    if (!trimmedText || trimmedText === getMessageText()) {
      setIsEditing(false);
      return;
    }

    try {
      setEditError("");
      await onEdit(id, trimmedText);
      setIsEditing(false);
      setEditText("");
    } catch (error) {
      console.error("Edit error:", error);
      setEditError("Failed to edit message. Please try again.");
    }
  };

  const handleEditKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === "Escape") {
      handleEditCancel();
    }
  };

  // Auto-focus and resize textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [isEditing]);

  // Clear edit error after 5 seconds
  useEffect(() => {
    if (editError) {
      const timer = setTimeout(() => setEditError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [editError]);

  return (
    <div className={wrapperClass}>
      <div className="bc-author">{getAuthorName()}</div>
      <div className="bc-bubble">
        <div className="bc-message-content">
          {isEditing ? (
            <div className="bc-edit-container">
              <textarea
                ref={textareaRef}
                className="bc-edit-textarea"
                value={editText}
                onChange={(e) => {
                  setEditText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={handleEditKeyDown}
                placeholder="Edit your message..."
              />
              <div className="bc-edit-buttons">
                <button 
                  className="bc-edit-save"
                  onClick={handleEditSave}
                  disabled={!editText.trim()}
                >
                  Save
                </button>
                <button 
                  className="bc-edit-cancel"
                  onClick={handleEditCancel}
                >
                  Cancel
                </button>
              </div>
              {editError && <div className="bc-edit-error">{editError}</div>}
            </div>
          ) : (
            <div className="bc-message-text">
              {getMessageText()}
              {canEdit && (
                <button 
                  className="bc-edit-button"
                  onClick={handleEditStart}
                  title="Edit message"
                >
                  ✏️
                </button>
              )}
            </div>
          )}
        </div>
        <div className="bc-timestamp">{getMessageTime()}</div>
      </div>

      <div className="bc-reactions">
        {msg.reactions && Object.entries(msg.reactions).map(([emoji, count]) => {
          const userHasReacted = msg.userReactions?.includes(emoji) || false;

          return (
            <button
              key={emoji}
              className={`bc-reaction-chip ${userHasReacted ? "reacted" : ""}`}
              onClick={() => onReact(id, emoji)}
              disabled={!canReact}
            >
              {emoji} {count}
            </button>
          );
        })}
        {canReact && (
          <button 
            className="bc-add-reaction" 
            onClick={() => onTogglePicker(id)}
          >
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
      el.scrollTop = el.scrollHeight;
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
      const endpoint = `/${tab}`;
      const data = await apiCall(endpoint);

      const processedMessages = await Promise.all(data.map(async (msg) => {
        try {
          const reactionEndpoint = `/${tab}/reactions/${msg.id || msg.Message_ID}`;
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

  // =================== EDIT MESSAGE ===================
  const editMessage = useCallback(async (messageId, newContent) => {
    try {
      const endpoint = `/${tab}/edit`;
      await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({
          message_id: messageId,
          new_content: newContent
        })
      });
      
      // Reload messages after successful edit
      await loadMessages(false);
    } catch (err) {
      // Still reload messages to check current state
      await loadMessages(false);
      throw err;
    }
  }, [tab, apiCall, loadMessages]);

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
      const endpoint = `/${tab}/send`;
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

  // =================== REACTIONS - FIXED ===================
  const react = useCallback(async (id, emoji) => {
    try {
      const endpoint = `/${tab}/react`;
      const body = JSON.stringify({ message_id: id, reaction_type: emoji });

      await apiCall(endpoint, {
        method: "POST",
        body: body,
      });

      // Reload messages to get updated reaction counts
      await loadMessages(false);
    } catch (err) {
      setError(`Failed to react: ${err.message}`);
    }
  }, [tab, apiCall, loadMessages]);

  // =================== EMOJI PICKER - FIXED FOR EDITING ===================
  const togglePicker = useCallback((id) => {
    setPickerForId((current) => (current === id ? null : id));
  }, []);

  const pickEmoji = useCallback(async (id, emoji) => {
    // Close picker first
    setPickerForId(null);
    
    try {
      const msg = messages.find((m) => (m.id || m.Message_ID) === id);
      const userReactions = msg?.userReactions || [];
      
      // Check if user already has this specific reaction
      if (userReactions.includes(emoji)) {
        // User already has this reaction, don't do anything
        return;
      }
      
      // If user has any existing reactions, remove them first (edit behavior)
      if (userReactions.length > 0) {
        for (const existingEmoji of userReactions) {
          await apiCall(`/${tab}/react`, {
            method: "POST",
            body: JSON.stringify({ message_id: id, reaction_type: existingEmoji }),
          });
        }
      }
      
      // Add the new reaction
      await apiCall(`/${tab}/react`, {
        method: "POST",
        body: JSON.stringify({ message_id: id, reaction_type: emoji }),
      });
      
      // Reload messages to get updated reaction counts
      await loadMessages(false);
    } catch (err) {
      setError(`Failed to change reaction: ${err.message}`);
    }
  }, [messages, tab, apiCall, loadMessages]);

  const filtered = useMemo(() => messages.filter((m) => (tab === "admins" ? m.audience === "admins" : m.audience === "everyone")), [messages, tab]);

  if (!canViewChannel())
    return (
      <div className="broadcast-channel">
        <NavbarSelector role={role} />
        <div className="main-content">
          <ButtonSelector role={role} />
          <div className="bc-error">You don't have permission to view this channel.</div>
        </div>
      </div>
    );

  return (
    <div className="broadcast-channel">
      <NavbarSelector role={role} />
      <div className="main-content">
        <ButtonSelector role={role} />
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
              userId={userId}
              userRole={role}
              onReact={react}
              onTogglePicker={togglePicker}
              isPickerOpen={pickerForId === (m.id || m.Message_ID)}
              onPickEmoji={pickEmoji}
              canReact={canReact()}
              onEdit={editMessage}
            />
          ))}
          {(loading || sendingMessage) && (
            <div className="bc-loading-overlay">Loading…</div>
          )}
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