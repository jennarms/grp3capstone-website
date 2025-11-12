import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import "./ScanButtonModule.css";

const apiUrl = import.meta.env.VITE_API_URL;

// Idle gap (ms) for scanners that don't send Enter
const SCAN_IDLE_MS = 120;

export default function ScanButtonModule({ action = "boarding" }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null); // "scanning" | "scanned" | "success" | "denied"
  const [result, setResult] = useState(null); // { name, code, from, to }

  const bufferRef = useRef("");      // live keystroke buffer
  const idleTimerRef = useRef(null); // idle timer for no-Enter scanners
  const isMountedRef = useRef(false);

  const resetAll = useCallback(() => {
    bufferRef.current = "";
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setResult(null);
    setStatus(null);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    resetAll();
  }, [resetAll]);

  const commitScan = useCallback((raw) => {
    const code = (raw ?? bufferRef.current).trim();
    bufferRef.current = "";
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (!code) return;

    setStatus("scanned"); // show "Processing…"
    handleScan(code);
  }, []); 

  const handleScan = useCallback(
    async (qrCode) => {
      try {
        const resp = await axios.post(`${apiUrl}/api/scan/scan_qrcode`, {
          QRCode_ID: qrCode,
          action,
        });

        if (!isMountedRef.current) return;
        setResult({
          name: resp?.data?.name ?? "",
          code: resp?.data?.code ?? qrCode,
          from: resp?.data?.from ?? "",
          to: resp?.data?.to ?? "",
        });
        setStatus("success");
      } catch (err) {
        if (!isMountedRef.current) return;
        setResult((prev) => ({
          ...(prev ?? {}),
          code: (prev?.code ?? qrCode) || "—",
        }));
        
        // Check if the error is about the QR code already being processed
        if (err?.response?.data?.error?.includes("already disembarked") || 
            err?.response?.data?.error?.includes("already boarded")) {
          setStatus("denied");
          console.error("Scan failed:", err?.response?.data?.error);
        } else {
          setStatus("denied");
          console.error("Scan failed:", err?.response?.data ?? err);
        }
      }
    },
    [action]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!(open && status === "scanning")) return;

    const ignored = new Set([
      "Shift",
      "Control",
      "Meta",
      "Alt",
      "CapsLock",
      "Tab",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]);
    const singleAlphaNum = /^[a-z0-9]$/i;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }

      if (ignored.has(e.key)) return;

      if (e.key === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        commitScan();
        return;
      }

      if (singleAlphaNum.test(e.key)) {
        bufferRef.current += e.key;
      }

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => commitScan(), SCAN_IDLE_MS);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [open, status, commitScan, closeModal]);

  return (
    <>
      <button
        className="sbm-btn"
        onClick={() => {
          setOpen(true);
          setStatus("scanning");
          setResult(null);
          bufferRef.current = "";
          if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
          }
        }}
        aria-label="Scan passenger QR code"
      >
        Scan
      </button>

      {open && (
        <div
          className="sbm-backdrop"
          onClick={closeModal}
          aria-hidden="true"
        >
          <div
            className={`sbm-card ${status === "success" || status === "denied" ? "sbm-card--left" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sbm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="sbm-title" className="sbm-title">Scan Passenger QR Code</h3>
            {status === "scanning" && (
              <>
                <p className="sbm-sub">Please scan the passenger’s QR code using the scanner device.</p>
                <div className="sbm-illustration" aria-hidden="true">📷</div>
                <p className="sbm-hint">Waiting for QR code…</p>
                <div className="sbm-actions">
                  <button className="sbm-close" onClick={closeModal}>Close</button>
                </div>
              </>
            )}
            {status === "scanned" && (
              <>
                <p className="sbm-sub">Scanned QR: <strong>{result?.code || "…"}</strong></p>
                <p className="sbm-hint">Processing…</p>
              </>
            )}
            {status === "success" && (
              <>
                <h4 className="sbm-confirm">Passenger Confirmed 🎉</h4>
                <div className="sbm-details">
                  <div className="sbm-line"><strong>{result.name}</strong></div>
                  <div className="sbm-line">Ticket Code: <strong>{result?.code}</strong></div>
                  <div className="sbm-line">From: {result?.from}</div>
                  <div className="sbm-line">Destination: {result?.to}</div>
                </div>
              </>
            )}
            {status === "denied" && (
              <>
                <h4 className="sbm-denied">QR Denied ❌</h4>
                <div className="sbm-details">
                  <div className="sbm-line">Scanned Code: <strong>{result?.code}</strong></div>
                  <div className="sbm-line">
                    This QR code has already been processed or is invalid.
                  </div>
                </div>
              </>
            )}
            {(status === "success" || status === "denied") && (
              <div className="sbm-actions">
                <button className="sbm-close" onClick={closeModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
