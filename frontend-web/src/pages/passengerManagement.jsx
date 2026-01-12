// passengerManagement.jsx
import axios from "axios";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./passengerManagement.css";

const apiUrl = import.meta.env.VITE_API_URL;

// Manifest table columns (based on /api/users/manifest response)
const columns = [
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
  const [toast, setToast] = useState({
    open: false,
    title: "",
    message: "",
    tone: "success",
  });
  const toastTimer = useRef(null);
  const reportRef = useRef(null);

  const showToast = (title, message, tone = "success") => {
    setToast({ open: true, title, message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, open: false })),
      2800
    );
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
  const fetchManifest = useCallback(async (params = {}) => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${apiUrl}/api/users/manifest`, { params });
      setRows(res.data || []);
    } catch (error) {
      console.error("Failed to fetch passenger manifest:", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load: all boarded passengers (no filters)
  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // ------------- Apply filters when user clicks "Apply Filter" -------------
  const validateFilters = () => {
    const nextErrors = {};
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
  const COLORS = {
    white: "#FFFFFF",
    green: "#3fe19b",
    blue: "#3c65e6",
  };

  const formatExportDateTime = () => {
    const d = new Date();
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const buildFilterAppliedText = () => {
    const parts = [];
    if (origin) parts.push(`Origin: ${origin}`);
    if (destination) parts.push(`Destination: ${destination}`);
    if (depDate) parts.push(`Departure Date: ${fmt(depDate)}`);
    if (depTime) parts.push(`Departure Time: ${depTime}`);
    return parts.length ? parts.join("  |  ") : "None (All Boarded Passengers)";
  };

  // ✅ NEW PDF EXPORT (NO html2canvas screenshot)
  const exportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Header band
      doc.setFillColor(COLORS.blue);
      doc.rect(0, 0, pageW, 18, "F");

      // Accent line
      doc.setFillColor(COLORS.green);
      doc.rect(0, 18, pageW, 2, "F");

      // Title
      doc.setTextColor(COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Passenger Manifest Report", 12, 12);

      // Meta info
      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const filterText = buildFilterAppliedText();
      const exportedAt = formatExportDateTime();

      doc.text(`Filter Applied: ${filterText}`, 12, 28);
      doc.text(`Exported At: ${exportedAt}`, 12, 34);

      // Table
      const head = [
        ["#", ...columns.map((c) => c.replace(/_/g, " ").toUpperCase())],
      ];

      const body = filtered.map((r, idx) => [
        String(idx + 1),
        ...columns.map((c) => String(r?.[c] ?? "")),
      ]);

      autoTable(doc, {
        startY: 40,
        head,
        body,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          valign: "middle",
          textColor: 20,
          lineColor: 220,
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: COLORS.blue,
          textColor: COLORS.white,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [240, 253, 248], // light green tint for readability
        },
        margin: { left: 8, right: 8 },
        tableWidth: "auto",
        didDrawPage: () => {
          const page = doc.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(`Page ${page}`, pageW - 20, pageH - 6);
        },
      });

      // Approval / Signature section
      const lastY = doc.lastAutoTable?.finalY ?? 40;
      const signY = Math.min(lastY + 12, pageH - 22);

      doc.setDrawColor(170);
      doc.setTextColor(40);
      doc.setFontSize(10);
      doc.text("Report Approved:", 12, signY);

      // Signature line
      doc.line(45, signY, 120, signY);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text("Signature over Printed Name", 45, signY + 5);

      // Date line
      doc.setTextColor(40);
      doc.setFontSize(10);
      doc.text("Date:", 130, signY);
      doc.line(142, signY, 170, signY);

      const filename =
        origin && destination && depDate
          ? `PassengerManifest_${origin}-${destination}_${depDate}.pdf`
          : `PassengerManifest_${new Date().toISOString().slice(0, 10)}.pdf`;

      doc.save(filename);
      showToast("Success!", "PDF exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast(
        "Export failed",
        "Please install 'jspdf-autotable' (npm i jspdf-autotable).",
        "error"
      );
    }
  };

const exportExcel = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MCTS";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Passenger Manifest", {
      views: [{ state: "frozen", ySplit: 6 }], // freeze pane after meta + header
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      },
    });

    // ----- Theme colors -----
    const BLUE = "FF3C65E6";
    const GREEN = "FF3FE19B";
    const WHITE = "FFFFFFFF";
    const LIGHT_GREEN = "FFF0FDF8";
    const BORDER = "FFD9D9D9";

    const exportedAt = new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const filterText = (() => {
      const parts = [];
      if (origin) parts.push(`Origin: ${origin}`);
      if (destination) parts.push(`Destination: ${destination}`);
      if (depDate) parts.push(`Departure Date: ${fmt(depDate)}`);
      if (depTime) parts.push(`Departure Time: ${depTime}`);
      return parts.length ? parts.join(" | ") : "None (All Boarded Passengers)";
    })();

    // ----- Column setup (includes # column) -----
    const excelCols = [
      { header: "#", key: "__row", width: 6 },
      { header: "User ID", key: "User_ID", width: 12 },
      { header: "Full Name", key: "full_name", width: 24 },
      { header: "Age", key: "age", width: 6 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "Contact Number", key: "contact_number", width: 18 },
      { header: "Address", key: "address", width: 28 },
      { header: "Profession", key: "profession", width: 18 },
      { header: "Platform Source", key: "platform_source", width: 16 },
      { header: "Origin", key: "origin_name", width: 18 },
      { header: "Destination", key: "destination_name", width: 18 },
      { header: "Departure Date", key: "departure_date", width: 14 },
      { header: "Departure Time", key: "departure_time", width: 14 },
      { header: "Booking ID", key: "Booking_ID", width: 14 },
      { header: "Schedule ID", key: "Schedule_ID", width: 14 },
    ];

    sheet.columns = excelCols;

    const lastColLetter = sheet.getColumn(excelCols.length).letter;

    // ----- Title band -----
    sheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = sheet.getCell("A1");
    titleCell.value = "Passenger Manifest Report";
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
    titleCell.alignment = { vertical: "middle", horizontal: "left" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    sheet.getRow(1).height = 26;

    // Accent line
    sheet.mergeCells(`A2:${lastColLetter}2`);
    const accentCell = sheet.getCell("A2");
    accentCell.value = "";
    accentCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    sheet.getRow(2).height = 6;

    // ----- Meta lines -----
    sheet.mergeCells(`A3:${lastColLetter}3`);
    sheet.getCell("A3").value = `Filter Applied: ${filterText}`;
    sheet.getCell("A3").font = { name: "Calibri", size: 11 };
    sheet.getCell("A3").alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    sheet.getRow(3).height = 20;

    sheet.mergeCells(`A4:${lastColLetter}4`);
    sheet.getCell("A4").value = `Exported At: ${exportedAt}`;
    sheet.getCell("A4").font = { name: "Calibri", size: 11 };
    sheet.getCell("A4").alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(4).height = 18;

    // Spacer row
    sheet.mergeCells(`A5:${lastColLetter}5`);
    sheet.getRow(5).height = 6;

    // ----- Header row (Row 6) -----
    const headerRowIndex = 6;
    const headerRow = sheet.getRow(headerRowIndex);

    excelCols.forEach((c, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = c.header;
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      cell.border = {
        top: { style: "thin", color: { argb: BORDER } },
        left: { style: "thin", color: { argb: BORDER } },
        bottom: { style: "thin", color: { argb: BORDER } },
        right: { style: "thin", color: { argb: BORDER } },
      };
    });
    headerRow.height = 20;

    // AutoFilter
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: excelCols.length },
    };

    // ----- Data rows start at Row 7 -----
    const startRow = headerRowIndex + 1;

    const data = filtered.map((r, idx) => ({
      __row: idx + 1,
      ...r,
    }));

    sheet.addRows(data);

    // Style data rows (zebra + borders + alignment)
    const endRow = sheet.rowCount;

    for (let r = startRow; r <= endRow; r++) {
      const row = sheet.getRow(r);
      row.height = 18;

      const isAlt = (r - startRow) % 2 === 1;

      for (let c = 1; c <= excelCols.length; c++) {
        const cell = row.getCell(c);

        // zebra fill
        cell.fill = isAlt
          ? { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } }
          : { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };

        // borders
        cell.border = {
          top: { style: "thin", color: { argb: BORDER } },
          left: { style: "thin", color: { argb: BORDER } },
          bottom: { style: "thin", color: { argb: BORDER } },
          right: { style: "thin", color: { argb: BORDER } },
        };

        // alignment
        const key = excelCols[c - 1].key;
        const centerKeys = ["__row", "age", "gender", "departure_date", "departure_time"];
        cell.alignment = {
          vertical: "middle",
          horizontal: centerKeys.includes(key) ? "center" : "left",
          wrapText: true,
        };

        cell.font = { name: "Calibri", size: 10 };
      }
      row.commit?.();
    }

    // ----- “Report Approved” section (after table) -----
    const signStart = sheet.rowCount + 3;
    sheet.getRow(signStart).height = 18;
    sheet.getCell(`A${signStart}`).value = "Report Approved:";
    sheet.getCell(`A${signStart}`).font = { name: "Calibri", size: 11, bold: true };

    // signature line (B..E)
    sheet.mergeCells(`B${signStart}:E${signStart}`);
    sheet.getCell(`B${signStart}`).border = {
      bottom: { style: "thin", color: { argb: "FF666666" } },
    };

    // printed name hint
    sheet.mergeCells(`B${signStart + 1}:E${signStart + 1}`);
    sheet.getCell(`B${signStart + 1}`).value = "Signature over Printed Name";
    sheet.getCell(`B${signStart + 1}`).font = { name: "Calibri", size: 10, color: { argb: "FF666666" } };

    // date line (F..G)
    sheet.getCell(`F${signStart}`).value = "Date:";
    sheet.getCell(`F${signStart}`).font = { name: "Calibri", size: 11, bold: true };
    sheet.mergeCells(`G${signStart}:H${signStart}`);
    sheet.getCell(`G${signStart}`).border = {
      bottom: { style: "thin", color: { argb: "FF666666" } },
    };

    // ----- Export file -----
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);

    const filename =
      origin && destination && depDate
        ? `PassengerManifest_${origin}-${destination}_${depDate}.xlsx`
        : `PassengerManifest_${new Date().toISOString().slice(0, 10)}.xlsx`;

    link.download = filename;
    link.click();

    showToast("Success!", "Excel exported successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "Excel export failed. Please check ExcelJS install.", "error");
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
            <span style={{ fontWeight: "normal", marginLeft: "10px" }}>
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
  <colgroup>
    <col style={{ width: "44px" }} />   {/* # */}
    <col style={{ width: "160px" }} />  {/* Full Name */}
    <col style={{ width: "70px" }} />   {/* Age */}
    <col style={{ width: "90px" }} />   {/* Gender */}
    <col style={{ width: "160px" }} />  {/* Contact Number */}
    <col style={{ width: "260px" }} />  {/* Address */}
    <col style={{ width: "140px" }} />  {/* Profession */}
    <col style={{ width: "160px" }} />  {/* Platform Source */}
    <col style={{ width: "130px" }} />  {/* Origin */}
    <col style={{ width: "130px" }} />  {/* Destination */}
    <col style={{ width: "120px" }} />  {/* Departure Date */}
    <col style={{ width: "120px" }} />  {/* Departure Time */}
  </colgroup>

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
          <div className="rg-export-row no-print" style={{ marginTop: "20px" }}>
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
                Select origin, destination, departure date, and time to view the
                list of passengers who boarded that specific trip. This is
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
