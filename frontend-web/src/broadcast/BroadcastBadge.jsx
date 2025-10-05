import React from "react";
import { useBroadcast } from "./BroadcastProvider";

/**
 * Usage in navbar:
 *   <BroadcastBadge variant="circle" className="broadcast-badge-circle" />
 */
export default function BroadcastBadge({ className = "", variant = "pill" }) {
  const { unreadCount } = useBroadcast();
  if (!unreadCount) return null;

  if (variant === "circle") {
    return (
      <span
        aria-label={`${unreadCount} unread broadcasts`}
        className={`broadcast-badge base-circle ${className}`}
      >
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    );
  }

  // default small pill (if you ever want it elsewhere)
  return (
    <span
      aria-label={`${unreadCount} unread broadcasts`}
      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-5 text-white ${className}`}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
