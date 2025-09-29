export default function SOSBanner({ banner, onClose }) {
  if (!banner) return null;
  return (
    <div role="status" aria-live="assertive" className="station-sos-banner">
      <div className="station-sos-banner-box">
        <span className="station-sos-banner-text">🚨 {banner.text}</span>
        <button
          className="station-sos-banner-close"
          onClick={onClose}
          aria-label="Dismiss SOS notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
