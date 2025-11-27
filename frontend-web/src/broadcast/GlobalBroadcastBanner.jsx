import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBroadcast } from "./BroadcastProvider";
import "./GlobalBroadcastBanner.css";

/* ---------- helpers ---------- */

const firstNonEmpty = (...vals) =>
  vals
    .map((v) => v ?? "")
    .map(String)
    .map((s) => s.trim())
    .find(Boolean) || "";

function stationWithSuffix(name) {
  const n = (name || "").trim();
  if (!n) return "";
  return /station$/i.test(n) ? n : `${n} Station`;
}

/** Try hard to locate the station name in common fields, in `from`, or inside the text. */
function pickStationName(msg) {
  if (!msg) return "";

  // 1) Common backend fields
  const direct = firstNonEmpty(
    msg.Station_Name,
    msg.station_name,
    msg.Station,
    msg.station,
    msg.StationName,
    msg.stationName,
    msg.Sender_Station_Name,
    msg.SenderStationName,
    msg.Location_Name,
    msg.location_name,
    msg.Station_Location,
    msg.station_location
  );
  if (direct) return direct;

  // 2) Parse from "from" like "Station Admin | Quinta"
  const from = String(msg.from || "").trim();
  if (from.includes("|")) {
    const rhs = from.split("|").slice(1).join("|").trim();
    if (rhs) return rhs;
  }
  const pipeMatch = /admin\s*\|\s*(.+)$/i.exec(from);
  if (pipeMatch?.[1]) return pipeMatch[1].trim();

  // 3) Heuristic from body text, e.g., "Trip 8:00 AM from Kalawan ..."
  const text = String(msg.text || msg.body || "").trim();
  const fromText = /\bfrom\s+([A-Za-z][\w\s.-]{1,40})/i.exec(text);
  if (fromText?.[1]) return fromText[1].trim();

  return "";
}

/** Audience: "Admins" or "Everyone" */
function resolveAudience(msg) {
  const raw = String(
    msg?.audience ||
      msg?.visibility ||
      msg?.target ||
      msg?.scope ||
      msg?.to ||
      ""
  ).toLowerCase();
  return ["admins", "admin", "admin_only", "admins_only"].includes(raw)
    ? "Admins"
    : "Everyone";
}

/** Header format: "Everyone | Quinta Station" or "Admins | Quinta Station" */
function buildHeader(msg) {
  const audience = resolveAudience(msg);
  const station = stationWithSuffix(pickStationName(msg)) || "Station";
  return `${audience} | ${station}`;
}

const noop = () => {}; // stable fallback

/* ---------- component ---------- */

export default function GlobalBroadcastBanner({
  autoHideMs = 3500,
  offsetTop = 16,
}) {
  const ctx = useBroadcast() || {};
  const unreadCount = ctx.unreadCount ?? 0;
  const latest = ctx.latest ?? null;
  const markAllRead = ctx.markAllRead || noop;

  const location = useLocation();
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [lastShownId, setLastShownId] = useState(null);

  const onBroadcastPage = location.pathname === "/broadcast";

  const { title, body } = useMemo(() => {
    const header = buildHeader(latest);
    const raw = String(latest?.text || "").trim();
    return { title: header || "Broadcast", body: raw };
  }, [latest]);

  // Show banner only once per NEW latest message
  useEffect(() => {
    if (!latest || !latest.id) return;
    if (onBroadcastPage) return;
    if (unreadCount <= 0) return;
    if (lastShownId === latest.id) return; // already shown this message

    setLastShownId(latest.id);
    setVisible(true);
  }, [latest, unreadCount, onBroadcastPage, lastShownId]);

  // Auto-hide
  useEffect(() => {
    if (!visible || hovered || autoHideMs <= 0) return;
    const t = setTimeout(() => setVisible(false), autoHideMs);
    return () => clearTimeout(t);
  }, [visible, hovered, autoHideMs]);

  // Extra safety: when on /broadcast, mark all as read and hide
  useEffect(() => {
    if (onBroadcastPage && unreadCount > 0) {
      try {
        markAllRead();
      } catch (err) {
        console.error("markAllRead failed in banner", err);
      }
      setVisible(false);
    }
  }, [onBroadcastPage, unreadCount, markAllRead]);

  if (!visible) return null;

  const openBroadcast = () => {
    navigate("/broadcast");
    try {
      markAllRead();
    } catch (err) {
      console.error("markAllRead failed on click", err);
    }
    setVisible(false);
  };

  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openBroadcast();
    }
  };

  return (
    <div
      className="bb-banner"
      style={{ top: offsetTop }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={openBroadcast}
      onKeyDown={onKey}
      role="button"
      tabIndex={0}
      aria-label="Open Broadcast Channel"
    >
      <div className="bb-text">
        <div className="bb-title">{title}</div>
        {body ? <div className="bb-body">{body}</div> : null}
      </div>
    </div>
  );
}
