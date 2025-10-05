import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useSOSStore } from "./SOSContext";
import "./GlobalSOSBanner.css";

const DEFAULT_AUTO_HIDE_MS = 6000; // 6 seconds

export default function GlobalSOSBanner() {
  const { banner, setBanner, triggerTest, openCount } = useSOSStore();
  const navigate = useNavigate();

  const handleGoToSOS = () => {
    setBanner(null);
    navigate("/stationsos");
  };

  // Auto-hide after a few seconds (unless you navigate).
  useEffect(() => {
    if (!banner) return;
    const ms = Number(banner.durationMs) > 0 ? Number(banner.durationMs) : DEFAULT_AUTO_HIDE_MS;
    const t = setTimeout(() => setBanner(null), ms);
    return () => clearTimeout(t);
  }, [banner, setBanner]);

  const DevFab = (
    <button
      className="sos-fab"
      onClick={() =>
        triggerTest && triggerTest({ userName: "FAB Tester", note: "Global FAB test" })
      }
      title={`Send test SOS (open: ${openCount || 0})`}
      aria-label="Send test SOS"
      type="button"
    >
      SOS
    </button>
  );

  if (!banner) return <>{DevFab}</>;

  const content = (
    <>
      <div className="sos-banner-wrap" aria-live="assertive" aria-atomic="true">
        {/* Card is clickable to open SOS */}
        <div
          className="sos-banner-card sos-banner-clickable"
          role="alert"
          tabIndex={0}
          onClick={handleGoToSOS}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleGoToSOS();
            }
          }}
          aria-label="Open SOS page"
          title="Open SOS page"
        >
          <div className="sos-banner-icon" aria-hidden="true">!</div>

          <div className="sos-banner-content">
            <div className="sos-banner-title">Emergency SOS</div>
            <div className="sos-banner-text">
              {banner.text || "Received SOS Alert!"}
            </div>
          </div>

          <div className="sos-banner-actions">
            <button
              className="sos-btn primary"
              onClick={(e) => { e.stopPropagation(); handleGoToSOS(); }}
              aria-label="Open SOS page"
              type="button"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {DevFab}
    </>
  );

  return createPortal(content, document.body);
}
