import { useEffect, useRef, useState } from "react";

export default function ScanButtonModule({ passengerList, onScanSuccess }) {
  const [showScan, setShowScan] = useState(false);
  const [scanState, setScanState] = useState(null); // "scanning" | "success" | "denied" | null
  const [scanResult, setScanResult] = useState(null);
  const inputRef = useRef("");

  // Handle keyboard input from scanner
  useEffect(() => {
    if (!showScan || scanState !== "scanning") return;

    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        const code = inputRef.current.trim();
        inputRef.current = "";

        const passenger = passengerList.find(p => p.qrCodeID === code);
        if (passenger) {
          setScanResult({
            name: passenger.name,
            code: passenger.qrCodeID,
            from: passenger.origin,
            to: passenger.destination,
          });
          setScanState("success");
          onScanSuccess?.(passenger); // callback to backend
        } else {
          // QR code not found
          setScanResult({ code });
          setScanState("denied");
        }
      } else {
        inputRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showScan, scanState, passengerList, onScanSuccess]);

  return (
    <>
      <button
        className="scan-btn"
        onClick={() => {
          setShowScan(true);
          setScanState("scanning");
          setScanResult(null);
          inputRef.current = "";
        }}
      >
        <span className="btn-icon">💻</span>
        Scan
      </button>

      {showScan && (
        <div
          className="boarding-modal-backdrop"
          onClick={() => {
            setShowScan(false);
            setScanState(null);
            setScanResult(null);
          }}
          aria-hidden="true"
        >
          <div
            className={"boarding-scan-card" + ((scanState === "success" || scanState === "denied") ? " boarding-scan--left" : "")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scanTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="scanTitle" className="boarding-scan-title">Scan Passenger QR Code</h3>

            {scanState === "scanning" && (
              <>
                <p className="boarding-scan-sub">Please scan the passenger’s QR code using the scanner device.</p>
                <div className="boarding-scan-illustration" aria-hidden="true">📷</div>
                <p className="boarding-scan-hint">Waiting for QR code...</p>
                <div className="boarding-scan-actions">
                  <button
                    className="boarding-scan-close"
                    onClick={() => {
                      setShowScan(false);
                      setScanState(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {scanState === "success" && (
              <>
                <h4 className="boarding-scan-confirm">Passenger Confirmed 🎉</h4>
                <div className="boarding-scan-details">
                  {scanResult?.name && <div className="boarding-scan-line"><strong>{scanResult.name}</strong></div>}
                  <div className="boarding-scan-line">Ticket Code: <strong>{scanResult?.code || "—"}</strong></div>
                  <div className="boarding-scan-line">From: {scanResult?.from || "—"}</div>
                  <div className="boarding-scan-line">Destination: {scanResult?.to || "—"}</div>
                </div>
              </>
            )}

            {scanState === "denied" && (
              <>
                <h4 className="boarding-scan-denied">QR Denied ❌</h4>
                <div className="boarding-scan-details">
                  <div className="boarding-scan-line">Scanned Code: <strong>{scanResult?.code || "—"}</strong></div>
                  <div className="boarding-scan-line">This QR code is invalid or not found in the system.</div>
                </div>
              </>
            )}

            {(scanState === "success" || scanState === "denied") && (
              <div className="boarding-scan-actions">
                <button
                  className="boarding-scan-close"
                  onClick={() => {
                    setShowScan(false);
                    setScanState(null);
                    setScanResult(null);
                  }}
                >
                  Close
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
