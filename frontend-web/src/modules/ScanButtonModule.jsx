import axios from "axios";
import { useEffect, useRef, useState } from "react";

// Define the API URL from environment variables
const apiUrl = import.meta.env.VITE_API_URL;

export default function ScanButtonModule() {
  const [showScan, setShowScan] = useState(false);
  const [scanState, setScanState] = useState(null); // "scanning" | "scanned" | "success" | "denied" | null
  const [scanResult, setScanResult] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false); // To toggle the modal
  const inputRef = useRef(""); // Ref to hold the scanned code

  // Handle keyboard input from scanner
  useEffect(() => {
    if (showScan && scanState === "scanning") {
      const handleKeyPress = (e) => {
        console.log(`Key pressed: ${e.key}`);  // Log every key pressed by scanner

        // Ignore Shift, Control, Meta, Alt, CapsLock, and other special keys
        const ignoredKeys = ['Shift', 'Control', 'Meta', 'Alt', 'CapsLock', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

        // If the key is in the ignored keys, just return
        if (ignoredKeys.includes(e.key)) return;

        // If the key is alphanumeric, add it to the input
        const alphanumericRegex = /^[a-z0-9]+$/i; // Regular expression for alphanumeric characters
        if (alphanumericRegex.test(e.key)) {
          inputRef.current += e.key; // Add alphanumeric key to the input
        }

          // If the key is 'Enter', process the QR code (this is when the scanner finishes sending the data)
          if (e.key === "Enter") {
            const code = inputRef.current.trim();  // Trim any extra whitespace or Enter key
            inputRef.current = "";  // Reset the input field
            console.log("Scanned QR Code:", code);  // Log the scanned QR code value

            // Remove the "Enter" key if it's in the code
            const cleanCode = code.replace("Enter", "").trim(); // Remove the 'Enter' part from the scanned code

            // Send QR code to the backend to fetch the passenger details
            handleScan(cleanCode);
          }
        };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
    }
  }, [showScan, scanState]);

  const handleScan = async (qrCode) => {
  try {
    // Add the "boarding" action to the request payload
    const response = await axios.post(`${apiUrl}/api/scan/scan_qrcode`, {
      QRCode_ID: qrCode,
      action: "boarding", // Add the action as "boarding"
    });

    // If the passenger is found, show the details
    setScanResult({
      name: response.data.name,
      code: response.data.code,
      from: response.data.from,
      to: response.data.to,
    });
    setScanState("success");
    setShowDetailsModal(true); // Show the modal after successful scan
  } catch (err) {
    console.error('Scan failed:', err.response?.data || err);
    setScanState("denied");
  }
};

  return (
    <>
      <button
        className="scan-btn"
        onClick={() => {
          setShowScan(true);  // Open modal
          setScanState("scanning");  // Set state to scanning
          setScanResult(null);  // Reset scan result
          inputRef.current = "";  // Reset the scanned code input
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

            {scanState === "scanned" && (
              <>
                <p className="boarding-scan-sub">Scanned QR: {scanResult?.code}</p>
                <p className="boarding-scan-hint">Processing...</p>
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

      {/* Modal to show scanned QR details */}
      {showDetailsModal && (
        <div className="actionbtn-modal-confirm-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="actionbtn-modal-confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3>Scanned QR Details</h3>
            <div className="boarding-modal-sub">
              <p><strong>Name:</strong> {scanResult?.name}</p>
              <p><strong>Ticket Code:</strong> {scanResult?.code}</p>
              <p><strong>From:</strong> {scanResult?.from}</p>
              <p><strong>Destination:</strong> {scanResult?.to}</p>
            </div>
            <div className="boarding-modal-actions">
              <button
                className="actionbtn-modal-cancel-btn"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
