import { useEffect, useRef, useState } from "react";

export default function SOSBanner({ banner, onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(8);
  const [shownTime, setShownTime] = useState("");
  const audioRef = useRef(null);

  // Format time
  function formatTime() {
    const d = new Date();
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  useEffect(() => {
    if (!banner) return;

    setSecondsLeft(8);
    setShownTime(formatTime());

    // 🔊 Play online beep sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [banner, onClose]);

  if (!banner) return null;

  return (
    <>
      {/* 🔊 Online sound (no need to upload file) */}
      <audio
        ref={audioRef}
        src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        preload="auto"
      />

      <div role="status" aria-live="assertive" className="station-sos-banner">
        <div className="station-sos-banner-box">
          <span className="station-sos-banner-text">
            🚨 {banner.text} •{" "}
            <strong>{shownTime}</strong>{" "}
            <span style={{ opacity: 0.9 }}>
              (closing in {secondsLeft}s)
            </span>
          </span>

          <button
            className="station-sos-banner-close"
            onClick={onClose}
            aria-label="Dismiss SOS notification"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
