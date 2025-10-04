import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export const BroadcastContext = createContext(null);
export const useBroadcast = () =>
  useContext(BroadcastContext) ?? {
    unreadCount: 0,
    unreadByChannel: { everyone: 0, admins: 0 },
    latest: null,
    markAllRead: () => {},
  };

const apiUrl = import.meta.env.VITE_API_URL;

function storageKey(userId) { return `broadcast:lastSeen:${userId}`; }
function getLastSeen(userId) { try { return localStorage.getItem(storageKey(userId)); } catch { return null; } }
function setLastSeen(userId, iso) { try { localStorage.setItem(storageKey(userId), iso); } catch {} }

/* Friendly sender label */
function makeFromLabel(msg) {
  if (msg.from && String(msg.from).trim()) return String(msg.from).trim();
  if (msg.Sender_Station_ID || msg.Station_Name) {
    const station = (msg.Station_Name || msg.station_name || "").trim();
    return station ? `Station Admin | ${station}` : "Station Admin";
  }
  if (msg.Sender_MainAdmin_ID || msg.Sender_MainAdmin_Username) {
    const name = (msg.Sender_MainAdmin_Username || msg.main_admin_name || "").trim();
    return name ? `Main Admin | ${name}` : "Main Admin";
  }
  if (msg.sender_role || msg.sender_name) {
    const role = (msg.sender_role || "").toString().toLowerCase();
    const name = (msg.sender_name || "").trim();
    if (role.includes("station")) return name ? `Station Admin | ${name}` : "Station Admin";
    if (role.includes("main")) return name ? `Main Admin | ${name}` : "Main Admin";
  }
  if (msg.author) return String(msg.author);
  return "Broadcast";
}

/* Normalize shape; audience is injected by the fetcher */
function normalize(msg, audience) {
  const id = msg.id ?? msg.Message_ID ?? String(msg.Sent_At ?? msg.sent_at ?? Date.now());
  const createdAt = msg.createdAt ?? msg.sent_at ?? msg.Sent_At ?? new Date().toISOString();
  const text = msg.text ?? msg.Message_Content ?? "";
  const from = makeFromLabel(msg);
  return {
    id: String(id),
    createdAt: new Date(createdAt).toISOString(),
    text,
    from,
    audience: audience || msg.audience || "everyone",
  };
}

export function BroadcastProvider({ children, userId = "user" }) {
  const [messages, setMessages] = useState([]);  // newest first
  const [lastSeen, setLastSeenState] = useState(() => getLastSeen(userId));

  useEffect(() => { setLastSeenState(getLastSeen(userId)); }, [userId]);

  useEffect(() => {
    let cancelled = false;
    let lastPushedId = null;

    async function fetchLatestFor(path, audience) {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");
      const url = `${apiUrl}/api/broadcast/${path}`;
      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Role": role,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [data];
      const newest = list
        .map((msg) => normalize(msg, audience))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return newest || null;
    }

    async function poll() {
      try {
        const role = localStorage.getItem("role");
        const cands = [];
        const cEveryone = await fetchLatestFor("everyone", "everyone");
        if (cEveryone) cands.push(cEveryone);
        if (role === "main-admin" || role === "station-admin") {
          try {
            const cAdmins = await fetchLatestFor("admins", "admins");
            if (cAdmins) cands.push(cAdmins);
          } catch {}
        }
        if (cancelled || cands.length === 0) return;

        const newest = cands.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (newest && newest.id !== lastPushedId) {
          lastPushedId = newest.id;
          setMessages((prev) => {
            if (prev.find((m) => m.id === newest.id)) return prev;
            const next = [newest, ...prev].slice(0, 100);
            return next;
          });
        }
      } catch {
        /* swallow; next interval retries */
      }
    }

    poll();
    const t = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const latest = messages[0] || null;

  const lastSeenTs = useMemo(
    () => (lastSeen ? new Date(lastSeen).getTime() : 0),
    [lastSeen]
  );

  const unreadByChannel = useMemo(() => {
    const newer = messages.filter((m) => new Date(m.createdAt).getTime() > lastSeenTs);
    return {
      everyone: newer.filter((m) => m.audience === "everyone").length,
      admins: newer.filter((m) => m.audience === "admins").length,
    };
  }, [messages, lastSeenTs]);

  const unreadCount = unreadByChannel.everyone + unreadByChannel.admins;

  const markAllRead = () => {
    const newestISO = (latest && latest.createdAt) || new Date().toISOString();
    setLastSeenState(newestISO);
    setLastSeen(userId, newestISO);
  };

  const value = { unreadCount, unreadByChannel, latest, markAllRead };

  return (
    <BroadcastContext.Provider value={value}>
      {children}
    </BroadcastContext.Provider>
  );
}
