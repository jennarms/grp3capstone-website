
export default function SOSBanner({ banner, onClose }) {
    if (!banner) return null;
    return (
      <div role="status" aria-live="assertive"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="rounded-2xl bg-red-100 text-red-900 px-6 py-3 shadow-xl flex items-center gap-3">
          <span className="text-lg font-semibold">Received SOS Alert!</span>
          <button
            onClick={onClose}
            className="ml-2 rounded-xl px-3 py-1 bg-red-200 hover:bg-red-300"
            aria-label="Dismiss SOS notification"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }
  