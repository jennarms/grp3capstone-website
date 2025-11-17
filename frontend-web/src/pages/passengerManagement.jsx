// passengerManagement.jsx

import axios from "axios";
import ExcelJS from 'exceljs';
import { jsPDF } from "jspdf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./passengerManagement.css";

const apiUrl = import.meta.env.VITE_API_URL;

// Manifest table columns (based on /api/users/manifest response)
const columns = [
  "User_ID",
  "full_name",
  "age",
  "gender",
  "contact_number",
  "address",
  "profession",
  "platform_source",
  "origin_name",
  "destination_name",
  "departure_date",
  "departure_time",
  "Booking_ID",
  "Schedule_ID",
];

const idOf = (v) => String(v ?? "");

const fmt = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

// Toast Component
function Toast({ open, title, message, tone = "success" }) {
  if (!open) return null;
  return (
    <div className={`rg-toast ${tone}`} role="status" aria-live="polite">
      <div className="rg-toast-title">{title}</div>
      <div className="rg-toast-msg">{message}</div>
    </div>
  );
}

// ---------- Shared mini components (same vibe as BookingInfo) ----------

const SelectField = ({ label, value, onChange, error, options, span2 }) => {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <select
          className={`boarding-manual-input boarding-manual-select ${
            error ? "boarding-field-error" : ""
          }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Select {label}
          </option>
          {options.map((o, index) => (
            <option key={index} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
};

const DateField = ({ label, value, onChange, error, span2 }) => {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <input
          type="date"
          className={`boarding-manual-input boarding-manual-date ${
            error ? "boarding-field-error" : ""
          }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
};

// Convert "08:05 PM" -> "20:05:00" for backend filtering
function to24Hour(timeStr) {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  // If no AM/PM, assume backend can handle it as-is
  if (!/am|pm/i.test(trimmed)) return trimmed;

  const date = new Date(`1970-01-01 ${trimmed}`);
  if (isNaN(date.getTime())) return trimmed;

  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

export function Passenger() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");

  // Filter modal state (matches BookingInfo style)
  const [stations, setStations] = useState([]);
  const [departureSchedules, setDepartureSchedules] = useState([]);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("");

  const [errors, setErrors] = useState({});
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ open: false, title: "", message: "", tone: "success" });
  const toastTimer = useRef(null);
  const reportRef = useRef(null);

  const showToast = (title, message, tone = "success") => {
    setToast({ open: true, title, message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), 2800);
  };

  useEffect(() => {
    return () => toastTimer.current && clearTimeout(toastTimer.current);
  }, []);

  // ------------- Fetch stations for dropdowns (same as booking) -------------
  useEffect(() => {
    axios
      .get(`${apiUrl}/api/boarding/manual/get_stations`)
      .then((response) => {
        setStations(response.data.stations || []);
      })
      .catch((error) => {
        console.error("Error fetching stations:", error);
      });
  }, []);

  // ------------- Fetch departure schedules when origin + destination chosen -------------
  useEffect(() => {
    if (!origin || !destination || origin === destination) {
      setDepartureSchedules([]);
      return;
    }

    axios
      .get(`${apiUrl}/api/boarding/manual/get_departure_schedules`, {
        params: { origin, destination },
      })
      .then((response) => {
        const schedules = response.data.schedules || [];
        setDepartureSchedules(schedules);
      })
      .catch((error) => {
        console.error("Error fetching schedules:", error);
        setDepartureSchedules([]);
      });
  }, [origin, destination]);

  // ------------- Fetch manifest from backend -------------
  const fetchManifest = useCallback(
    async (params = {}) => {
      try {
        setIsLoading(true);
        const res = await axios.get(`${apiUrl}/api/users/manifest`, {
          params,
        });
        setRows(res.data || []);
      } catch (error) {
        console.error("Failed to fetch passenger manifest:", error);
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load: all boarded passengers (no filters)
  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // ------------- Apply filters when user clicks "Apply Filter" -------------
  const validateFilters = () => {
    const nextErrors = {};
    // For accident scenarios, you usually want a specific trip, so all four are recommended.
    if (!origin) nextErrors.origin = "Please select origin";
    if (!destination) nextErrors.destination = "Please select destination";
    if (!depDate) nextErrors.depDate = "Please select departure date";
    if (!depTime) nextErrors.depTime = "Please select departure time";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const applyFilters = () => {
    if (!validateFilters()) return;

    const params = {
      origin,
      destination,
      departure_date: depDate,
      departure_time: to24Hour(depTime),
    };

    fetchManifest(params);
    setShowFilterModal(false);
  };

  // ------------- Client-side search within manifest -------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!q) return true;
      return Object.values(r).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  // ------------- Export Functions -------------
  const exportPDF = async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const node = reportRef.current;
      const canvas = await html2canvas(node, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("l", "mm", "a4"); // landscape for wide table
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }

      const filename = origin && destination && depDate
        ? `PassengerManifest_${origin}-${destination}_${depDate}.pdf`
        : `PassengerManifest_${new Date().toISOString().slice(0, 10)}.pdf`;

      pdf.save(filename);
      showToast("Success!", "PDF exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'jspdf' and 'html2canvas'.", "error");
    }
  };

  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Passenger Manifest");

      sheet.columns = [
        { header: 'User ID', key: 'User_ID', width: 12 },
        { header: 'Full Name', key: 'full_name', width: 25 },
        { header: 'Age', key: 'age', width: 8 },
        { header: 'Gender', key: 'gender', width: 10 },
        { header: 'Contact Number', key: 'contact_number', width: 18 },
        { header: 'Address', key: 'address', width: 30 },
        { header: 'Profession', key: 'profession', width: 20 },
        { header: 'Platform Source', key: 'platform_source', width: 15 },
        { header: 'Origin', key: 'origin_name', width: 20 },
        { header: 'Destination', key: 'destination_name', width: 20 },
        { header: 'Departure Date', key: 'departure_date', width: 15 },
        { header: 'Departure Time', key: 'departure_time', width: 15 },
        { header: 'Booking ID', key: 'Booking_ID', width: 15 },
        { header: 'Schedule ID', key: 'Schedule_ID', width: 15 },
      ];

      sheet.addRows(filtered);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);

      const filename = origin && destination && depDate
        ? `PassengerManifest_${origin}-${destination}_${depDate}.xlsx`
        : `PassengerManifest_${new Date().toISOString().slice(0, 10)}.xlsx`;

      link.download = filename;
      link.click();

      showToast("Success!", "Excel exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'exceljs'.", "error");
    }
  };

  return (
    <>
      <Navbar />
      <Toast
        open={toast.open}
        title={toast.title}
        message={toast.message}
        tone={toast.tone}
      />
      
      <div className="pmc-main">
        <div className="pmc-header-row">
          <h1 className="pmc-title">Passenger Report</h1>
          <HeaderButton />
        </div>

      <div className="pmc-section-label">
          Passenger Manifest (Boarded Passengers Only)
          {origin && destination && depDate && (
            <span style={{ fontWeight: 'normal', marginLeft: '10px' }}>
            — {origin} to {destination} on {fmt(depDate)} at {depTime}
            </span>
          )}
      </div>

        {/* Controls row: Search + Filter Button - NOT included in PDF */}
        <div className="pmc-controls no-print">
          <label className="pmc-search">
            <svg
              className="pmc-searchIcon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search in manifest"
              aria-label="Search passengers in manifest"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <button
            className="pmc-delete"
            type="button"
            onClick={() => setShowFilterModal(true)}
          >
            Filter Passengers
          </button>
        </div>

        <div className="pmc-content" ref={reportRef}>
          <div className="pmc-table-wrap">
            <table className="pmc-table">
              <thead>
                <tr>
                  <th className="pmc-sticky">#</th>
                  {columns.map((c) => (
                    <th key={c}>{c.replace(/_/g, " ").toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="pmc-empty">
                      Loading manifest…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="pmc-empty">
                      No passengers found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => {
                    const rowKey = idOf(r.User_ID) || `row-${idx}`;
                    return (
                      <tr key={rowKey}>
                        <td className="pmc-sticky">{idx + 1}</td>
                        {columns.map((c) => (
                          <td key={`cell-${rowKey}-${c}`}>
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export Buttons - NOT included in PDF */}
        {filtered.length > 0 && (
          <div className="rg-export-row no-print" style={{ marginTop: '20px' }}>
            <button className="rg-export" onClick={exportPDF}>
              Export as PDF
            </button>
            <button className="rg-export" onClick={exportExcel}>
              Export as Excel
            </button>
          </div>
        )}
      </div>

      {/* Filter Modal – styled like BookingInfo */}
      {showFilterModal && (
        <div
          className="pmc-confirmOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pmc-filter-title"
          aria-describedby="pmc-filter-desc"
          onClick={() => setShowFilterModal(false)}
        >
          <div className="pmc-confirmBox" onClick={(e) => e.stopPropagation()}>
            <div className="pmc-confirmHeader">
              <h3 id="pmc-filter-title" className="pmc-confirmTitle">
                Filter Passenger Manifest
              </h3>
            </div>

            <div className="pmc-confirmBody">
              <p id="pmc-filter-desc" className="pmc-confirmText">
                Select origin, destination, departure date, and time to view
                the list of passengers who boarded that specific trip. This is
                useful for incident and accident reporting.
              </p>

              <div className="boarding-manual-grid">
                <SelectField
                  label="Origin"
                  value={origin}
                  onChange={(val) => {
                    setOrigin(val);
                    setErrors((e) => ({ ...e, origin: "" }));
                  }}
                  options={stations.map((s) => s.StationName)}
                  error={errors.origin}
                />

                <SelectField
                  label="Destination"
                  value={destination}
                  onChange={(val) => {
                    setDestination(val);
                    setErrors((e) => ({ ...e, destination: "" }));
                  }}
                  options={stations
                    .filter((s) => s.StationName !== origin)
                    .map((s) => s.StationName)}
                  error={errors.destination}
                />

                <DateField
                  label="Departure Date"
                  value={depDate}
                  onChange={(val) => {
                    setDepDate(val);
                    setErrors((e) => ({ ...e, depDate: "" }));
                  }}
                  error={errors.depDate}
                />

                <SelectField
                  label="Departure Time"
                  value={depTime}
                  onChange={(val) => {
                    setDepTime(val);
                    setErrors((e) => ({ ...e, depTime: "" }));
                  }}
                  options={departureSchedules}
                  error={errors.depTime}
                />
              </div>
            </div>

            <div className="pmc-confirmActions">
              <button
                className="pmc-btn pmc-btnOutline"
                type="button"
                onClick={() => setShowFilterModal(false)}
              >
                Cancel
              </button>
              <button
                className="pmc-btn pmc-btnNavy"
                type="button"
                onClick={applyFilters}
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Passenger;