/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export const BroadcastContext = createContext(null);

export const useBroadcast = () =>
  useContext(BroadcastContext) ?? {
    unreadCount: 0,
    unreadByChannel: { everyone: 0, admins: 0 },
    latest: null,
    markAllRead: () => {},
  };

const apiUrl = import.meta.env.VITE_API_URL;

/* Friendly sender label */
function makeFromLabel(msg) {
  if (msg?.from && String(msg.from).trim()) return String(msg.from).trim();
  if (msg?.Sender_Station_ID || msg?.Station_Name) {
    const station = (msg.Station_Name || msg.station_name || "").trim();
    return station ? `Station Admin | ${station}` : "Station Admin";
  }
  if (msg?.Sender_MainAdmin_ID || msg?.Sender_MainAdmin_Username) {
    const name = (msg.Sender_MainAdmin_Username || msg.main_admin_name || "").trim();
    return name ? `Main Admin | ${name}` : "Main Admin";
  }
  if (msg?.sender_role || msg?.sender_name) {
    const role = (msg.sender_role || "").toString().toLowerCase();
    const name = (msg.sender_name || "").trim();
    if (role.includes("station"))
      return name ? `Station Admin | ${name}` : "Station Admin";
    if (role.includes("main"))
      return name ? `Main Admin | ${name}` : "Main Admin";
  }
  if (msg?.author) return String(msg.author);
  return "Broadcast";
}

/* Normalize shape using backend summary.latest */
function normalizeFromSummary(latest, audience) {
  if (!latest) return null;

  const id = latest.id || latest.Message_ID || String(latest.Message_ID || "");
  const createdAt =
    latest.createdAt ||
    latest.Sent_At ||
    latest.sent_at ||
    new Date().toISOString();
  const text =
    latest.text ||
    latest.Message_Content ||
    latest.message_content ||
    "";

  const from = makeFromLabel(latest);

  return {
    id: String(id),
    createdAt: new Date(createdAt).toISOString(),
    text,
    from,
    audience: audience || latest.audience || "everyone",
    raw: latest,
  };
}

export function BroadcastProvider({ children, userRole: userRoleProp }) {
  const [userRole, setUserRole] = useState(
    () => userRoleProp || localStorage.getItem("role") || "user"
  );

  const [latest, setLatest] = useState(null);
  const [unreadByChannel, setUnreadByChannel] = useState({
    everyone: 0,
    admins: 0,
  });

  // Sync userRole from props / localStorage
  useEffect(() => {
    if (userRoleProp) {
      setUserRole(userRoleProp);
    } else {
      const role = localStorage.getItem("role");
      if (role) setUserRole(role);
    }
  }, [userRoleProp]);

  // Poll summaries from backend (everyone + admins)
  useEffect(() => {
    let cancelled = false;

    async function fetchSummary(path, audience) {
      try {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");

        const url = `${apiUrl}/api/broadcast/${path}/summary`;
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-User-Role": role,
          },
        });

        if (!res.ok) {
          console.error("Broadcast summary error", path, res.status);
          return { latest: null, unread: 0 };
        }

        const data = await res.json();
        const norm = normalizeFromSummary(data.latest, audience);
        const unread = Number(data.unread_count || 0);
        return { latest: norm, unread };
      } catch (err) {
        console.error("Broadcast summary fetch failed", path, err);
        return { latest: null, unread: 0 };
      }
    }

    async function poll() {
      if (cancelled) return;

      try {
        const everyone = await fetchSummary("everyone", "everyone");

        let admins = { latest: null, unread: 0 };
        const role = userRole || localStorage.getItem("role");
        if (role === "main-admin" || role === "station-admin") {
          admins = await fetchSummary("admins", "admins");
        }

        if (cancelled) return;

        const candidates = [everyone.latest, admins.latest].filter(Boolean);
        const newest =
          candidates.length > 0
            ? [...candidates].sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )[0]
            : null;

        setLatest(newest);
        setUnreadByChannel({
          everyone: everyone.unread,
          admins: admins.unread,
        });
      } catch (err) {
        console.error("Broadcast poll error", err);
      }
    }

    // initial + interval
    poll();
    const t = setInterval(poll, 10000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [userRole]);

  const unreadCount = unreadByChannel.everyone + unreadByChannel.admins;

  const markAllRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const role = userRole || localStorage.getItem("role");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-User-Role": role,
      };

      // everyone is always visible
      await fetch(`${apiUrl}/api/broadcast/everyone/mark-read`, {
        method: "POST",
        headers,
      });

      // admins channel only for admins
      if (role === "main-admin" || role === "station-admin") {
        await fetch(`${apiUrl}/api/broadcast/admins/mark-read`, {
          method: "POST",
          headers,
        });
      }

      // optimistically update UI
      setUnreadByChannel({ everyone: 0, admins: 0 });
    } catch (err) {
      console.error("markAllRead failed", err);
    }
  };

  const value = {
    unreadCount,
    unreadByChannel,
    latest,
    markAllRead,
  };

  return (
    <BroadcastContext.Provider value={value}>
      {children}
    </BroadcastContext.Provider>
  );
}
