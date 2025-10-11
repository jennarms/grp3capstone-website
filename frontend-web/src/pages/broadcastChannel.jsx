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

/* ============== helper: identify if a message is mine (by role) ============== */
function isMineByRole(msg, userRole, userIdRaw) {
  const uid = String(userIdRaw ?? "").trim();

  if (userRole === ROLES.MAIN_ADMIN && msg?.Sender_MainAdmin_ID)
    return String(msg.Sender_MainAdmin_ID).trim() === uid;
  if (userRole === ROLES.STATION_ADMIN && msg?.Sender_Station_ID)
    return String(msg.Sender_Station_ID).trim() === uid;
  if (userRole === ROLES.USER && msg?.userId)
    return String(msg.userId).trim() === uid;

  // fallbacks for older data
  if (msg?.Sender_MainAdmin_ID) return String(msg.Sender_MainAdmin_ID).trim() === uid;
  if (msg?.Sender_Station_ID) return String(msg.Sender_Station_ID).trim() === uid;
  if (msg?.userId) return String(msg.userId).trim() === uid;

  return false;
}

/* =================== CUSTOM HOOK FOR ROLE =================== */
function useRole() {
  const [role, setRole] = useState("");

  useEffect(() => {
    const storedRole = localStorage.getItem("role") || "";
    setRole(storedRole);

    const handleStorageChange = () => {
      setRole(localStorage.getItem("role") || "");
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return role;
}

/* =================== NAVBAR AND BUTTON SELECTOR =================== */
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

/* =================== MESSAGE COMPONENT =================== */
function Message({
  msg,
  userId,
  userRole,
  onReact,
  onTogglePicker,
  isPickerOpen,
  onPickEmoji,
  canReact,
  onEdit,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState("");
  const textareaRef = useRef(null);

  const userIdStr = String(userId ?? "").trim();

  const isMine = useMemo(() => {
    const uid = userIdStr;
    if (userRole === ROLES.MAIN_ADMIN && msg?.Sender_MainAdmin_ID)
      return String(msg.Sender_MainAdmin_ID).trim() === uid;
    if (userRole === ROLES.STATION_ADMIN && msg?.Sender_Station_ID)
      return String(msg.Sender_Station_ID).trim() === uid;
    if (userRole === ROLES.USER && msg?.userId)
      return String(msg.userId).trim() === uid;

    if (msg?.Sender_MainAdmin_ID) return String(msg.Sender_MainAdmin_ID).trim() === uid;
    if (msg?.Sender_Station_ID) return String(msg.Sender_Station_ID).trim() === uid;
    if (msg?.userId) return String(msg.userId).trim() === uid;
    return false;
  }, [msg, userRole, userIdStr]);

  const canEdit = useMemo(() => {
    return isMine && (userRole === ROLES.MAIN_ADMIN || userRole === ROLES.STATION_ADMIN);
  }, [isMine, userRole]);

  const wrapperClass = isMine ? "bc-msg mine" : "bc-msg other";

  const getAuthorName = () => {
    if (msg?.Sender_MainAdmin_ID)
      return msg.Sender_MainAdmin_Username
        ? `Main Admin (${msg.Sender_MainAdmin_Username})`
        : "Main Admin";
    if (msg?.Sender_Station_ID)
      return msg.Station_Name ? `Station Admin (${msg.Station_Name})` : "Station Admin";
    return msg?.author || "Unknown";
  };

  const getMessageText = () => msg?.text || msg?.Message_Content || "";
  const getMessageTime = () => {
    const t = msg?.sent_at || msg?.Sent_At;
    const d = t ? new Date(t) : null;
    return d && !isNaN(d) ? d.toLocaleString() : "";
  };
  const id = msg?.id || msg?.Message_ID;

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

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [isEditing]);

  useEffect(() => {
    if (!editError) return;
    const timer = setTimeout(() => setEditError(""), 5000);
    return () => clearTimeout(timer);
  }, [editError]);

  return (
    <div className={wrapperClass} data-self={isMine ? "mine" : "other"}>
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
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
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
                <button className="bc-edit-cancel" onClick={handleEditCancel}>
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
        {msg?.reactions &&
          Object.entries(msg.reactions).map(([emoji, count]) => {
            const userHasReacted = Array.isArray(msg.userReactions)
              ? msg.userReactions.includes(emoji)
              : false;
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

/* =================== BROADCAST COMPONENT =================== */
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

  // ===== BADGE / BANNER STATE =====
  const [unseen, setUnseen] = useState({ everyone: 0, admins: 0 });
  const [bannerVisible, setBannerVisible] = useState(false);

  const readLastSeen = useCallback((t) => {
    const v = localStorage.getItem(`bc:lastSeen:${t}`);
    return v ? Number(v) : 0;
  }, []);
  const writeLastSeen = useCallback((t, ts) => {
    localStorage.setItem(`bc:lastSeen:${t}`, String(ts));
  }, []);

  // Initialize lastSeen keys if missing
  useEffect(() => {
    if (!localStorage.getItem("bc:lastSeen:everyone")) writeLastSeen("everyone", Date.now());
    if (!localStorage.getItem("bc:lastSeen:admins")) writeLastSeen("admins", Date.now());
  }, [writeLastSeen]);

  // 🔔 Clear badges immediately when this page is opened (from Navbar/StationNavbar)
  useEffect(() => {
    const now = Date.now();
    writeLastSeen("everyone", now);
    writeLastSeen("admins", now);
    setUnseen({ everyone: 0, admins: 0 });
    setBannerVisible(false);
    // storage "ping" so Navbar/StationNavbar can hide their badge instantly
    localStorage.setItem("bc:lastOpenAt", String(now));
  }, [writeLastSeen]);

  // auto-clear transient error
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(t);
  }, [error]);

  // Only auto-scroll if user is already at/near bottom
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 4;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // =================== API CALL ===================
  const apiCall = useCallback(
    async (endpoint, options = {}) => {
      const token = localStorage.getItem("token");
      const hdrRole = localStorage.getItem("role");
      const fullUrl = `${apiUrl}/api/broadcast${endpoint}`;

      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
          "X-User-Role": hdrRole || "",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      return await response.json();
    },
    []
  );

  const canSendMessage = useCallback(
    () => role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN,
    [role]
  );
  const canViewChannel = useCallback(
    () => tab === "everyone" || role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN,
    [tab, role]
  );
  const canReact = useCallback(
    () => tab === "everyone" || role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN,
    [tab, role]
  );

  // =================== LOAD MESSAGES ===================
  const loadMessages = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);

      try {
        const endpoint = `/${tab}`;
        const data = await apiCall(endpoint);

        const processedMessages = await Promise.all(
          (data || []).map(async (msg) => {
            try {
              const reactionEndpoint = `/${tab}/reactions/${msg.id || msg.Message_ID}`;
              const reactionData = await apiCall(reactionEndpoint);

              const userReactions =
                reactionData?.reactions
                  ?.filter((r) => {
                    if (role === ROLES.USER) return r?.reactor_user_id === userId;
                    if (role === ROLES.MAIN_ADMIN) return r?.reactor_mainadmin_id === userId;
                    if (role === ROLES.STATION_ADMIN) return r?.reactor_station_id === userId;
                    return false;
                  })
                  ?.map((r) => r?.reaction_type) || [];

              return { ...msg, userReactions };
            } catch {
              return { ...msg, userReactions: [] };
            }
          })
        );

        // sort ascending by sent time (kept identical to your original)
        const sorted = processedMessages.sort((a, b) => {
          const at = new Date(a?.sent_at || a?.Sent_At || 0).getTime();
          const bt = new Date(b?.sent_at || b?.Sent_At || 0).getTime();
          return at - bt;
        });

        setMessages(sorted);

        // compute unseen for current tab (excluding my own posts)
        const lastSeenTs = readLastSeen(tab);
        const fromOthersNew = sorted.filter((m) => {
          const ts = new Date(m?.sent_at || m?.Sent_At || 0).getTime();
          if (!ts || ts <= lastSeenTs) return false;
          return !isMineByRole(m, role, userId);
        }).length;

        setUnseen((u) => ({ ...u, [tab]: fromOthersNew }));
        setBannerVisible(fromOthersNew > 0);

        // opportunistically update the other tab’s unseen count
        const otherTab = tab === "everyone" ? "admins" : "everyone";
        const canSeeAdmins = role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN;
        if (otherTab === "everyone" || canSeeAdmins) {
          try {
            const otherData = await apiCall(`/${otherTab}`);
            const otherSorted = (otherData || []).slice().sort((a, b) => {
              const at = new Date(a?.sent_at || a?.Sent_At || 0).getTime();
              const bt = new Date(b?.sent_at || b?.Sent_At || 0).getTime();
              return at - bt;
            });
            const otherLastSeenTs = readLastSeen(otherTab);
            const otherCount = otherSorted.filter((m) => {
              const ts = new Date(m?.sent_at || m?.Sent_At || 0).getTime();
              if (!ts || ts <= otherLastSeenTs) return false;
              return !isMineByRole(m, role, userId);
            }).length;
            setUnseen((u) => ({ ...u, [otherTab]: otherCount }));
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        setError(`Failed to load messages: ${err.message}`);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [tab, apiCall, role, userId, readLastSeen]
  );

  // =================== EDIT MESSAGE ===================
  const editMessage = useCallback(
    async (messageId, newContent) => {
      try {
        const endpoint = `/${tab}/edit`;
        await apiCall(endpoint, {
          method: "POST",
          body: JSON.stringify({ message_id: messageId, new_content: newContent }),
        });

        await loadMessages(false);
      } catch (err) {
        await loadMessages(false);
        throw err;
      }
    },
    [tab, apiCall, loadMessages]
  );

  // initial + tab change loads
  useEffect(() => {
    if (role && canViewChannel()) loadMessages(true);
  }, [tab, role, loadMessages, canViewChannel]);

  // polling
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
      await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({ message_content: text }),
      });

      setDraft("");
      await loadMessages(false);
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

  // =================== REACTIONS ===================
  const react = useCallback(
    async (id, emoji) => {
      try {
        const endpoint = `/${tab}/react`;
        const body = JSON.stringify({ message_id: id, reaction_type: emoji });
        await apiCall(endpoint, { method: "POST", body });
        await loadMessages(false);
      } catch (err) {
        setError(`Failed to react: ${err.message}`);
      }
    },
    [tab, apiCall, loadMessages]
  );

  // =================== EMOJI PICKER ===================
  const togglePicker = useCallback((id) => {
    setPickerForId((current) => (current === id ? null : id));
  }, []);

  const pickEmoji = useCallback(
    async (id, emoji) => {
      setPickerForId(null);
      try {
        const msg = messages.find((m) => (m?.id || m?.Message_ID) === id);
        const userReactions = msg?.userReactions || [];

        if (userReactions.includes(emoji)) return;

        if (userReactions.length > 0) {
          for (const existingEmoji of userReactions) {
            await apiCall(`/${tab}/react`, {
              method: "POST",
              body: JSON.stringify({ message_id: id, reaction_type: existingEmoji }),
            });
          }
        }

        await apiCall(`/${tab}/react`, {
          method: "POST",
          body: JSON.stringify({ message_id: id, reaction_type: emoji }),
        });

        await loadMessages(false);
      } catch (err) {
        setError(`Failed to change reaction: ${err.message}`);
      }
    },
    [messages, tab, apiCall, loadMessages]
  );

  const filtered = useMemo(
    () =>
      messages.filter((m) =>
        tab === "admins" ? m?.audience === "admins" : m?.audience === "everyone"
      ),
    [messages, tab]
  );

  // Mark current tab as seen when user reaches bottom or focuses window
  const markSeen = useCallback(() => {
    const now = Date.now();
    writeLastSeen(tab, now);
    setUnseen((u) => ({ ...u, [tab]: 0 }));
    setBannerVisible(false);
    localStorage.setItem("bc:lastOpenAt", String(now)); // notify navbars
  }, [tab, writeLastSeen]);

  useEffect(() => {
    markSeen(); // on tab change
  }, [tab, markSeen]);

  useEffect(() => {
    const onFocus = () => {
      const el = feedRef.current;
      if (!el) return;
      const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 4;
      if (atBottom) markSeen();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [markSeen]);

  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 4;
      if (atBottom) markSeen();
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages, markSeen]);

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
            onClick={() => {
              setTab("everyone");
              // Zero instantly for immediate feedback on click
              const now = Date.now();
              writeLastSeen("everyone", now);
              setUnseen((u) => ({ ...u, everyone: 0 }));
              localStorage.setItem("bc:lastOpenAt", String(now));
            }}
          >
            For Everyone
            {unseen.everyone > 0 && <span className="bc-badge">{unseen.everyone}</span>}
          </button>

          {(role === ROLES.MAIN_ADMIN || role === ROLES.STATION_ADMIN) && (
            <button
              className={`bc-tab ${tab === "admins" ? "active" : ""}`}
              onClick={() => {
                setTab("admins");
                const now = Date.now(); // FIX: use Date.now(), not Date.Now()
                writeLastSeen("admins", now);
                setUnseen((u) => ({ ...u, admins: 0 }));
                localStorage.setItem("bc:lastOpenAt", String(now));
              }}
            >
              Admins Only
              {unseen.admins > 0 && <span className="bc-badge">{unseen.admins}</span>}
            </button>
          )}
        </div>

        <h1 className="page-title">
          Broadcast Channel {tab === "admins" ? "(Admin)" : ""}
        </h1>

        {error && <div className="bc-error">{error}</div>}

        <div className="bc-feed" ref={feedRef}>
          {bannerVisible && unseen[tab] > 0 && (
            <div
              className="bc-new-banner"
              onClick={() => {
                const el = feedRef.current;
                if (el) el.scrollTop = el.scrollHeight;
                markSeen();
              }}
            >
              {unseen[tab]} new message{unseen[tab] > 1 ? "s" : ""} — click to jump
            </div>
          )}

          {filtered.map((m) => (
            <Message
              key={m?.id || m?.Message_ID}
              msg={m}
              userId={userId}
              userRole={role}
              onReact={react}
              onTogglePicker={togglePicker}
              isPickerOpen={pickerForId === (m?.id || m?.Message_ID)}
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
              placeholder={`Type a message${
                tab === "admins" ? " to admins" : " to everyone"
              }...`}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
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

// (Optional) default export to aid preview environments
export default Broadcast;
