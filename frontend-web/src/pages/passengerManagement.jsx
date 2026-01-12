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
    blue: "#000c6f",
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
  const exportPDF = async () => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [215.9, 330.2], // 8.5 x 13 inches (LONG)
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    /* ================= LOGOS ================= */
    const leftLogo =
      "https://upload.wikimedia.org/wikipedia/commons/6/6d/Metropolitan_Manila_Development_Authority_%28MMDA%29.png";
    const rightLogo =
      "https://upload.wikimedia.org/wikipedia/commons/b/b1/Bagong_Pilipinas_logo.png";

    const loadImage = (url) =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.src = url;
      });

    const [mmdaLogo, bpLogo] = await Promise.all([
      loadImage(leftLogo),
      loadImage(rightLogo),
    ]);

    /* ================= HEADER ================= */
    const startY = 15;

    doc.addImage(mmdaLogo, "PNG", 15, startY, 25, 25);
    doc.addImage(bpLogo, "PNG", pageW - 40, startY, 25, 25);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Republic of the Philippines", pageW / 2, startY + 4, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.text("Office of the President", pageW / 2, startY + 9, {
      align: "center",
    });

    doc.setFontSize(13);
    doc.text(
      "METROPOLITAN MANILA DEVELOPMENT AUTHORITY",
      pageW / 2,
      startY + 16,
      { align: "center" }
    );

    doc.setFontSize(9);
    doc.text(
      "(Pangasiwaan Sa Pagpapaunlad Ng Kalakhang Maynila)",
      pageW / 2,
      startY + 22,
      { align: "center" }
    );

    doc.text("ISO 9001:2015 CERTIFIED", pageW / 2, startY + 27, {
      align: "center",
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("PASSENGER MANIFEST REPORT", pageW / 2, startY + 36, {
      align: "center",
    });

    /* ================= META ================= */
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let yMeta = startY + 46;

    doc.text(`Filter Applied: ${buildFilterAppliedText()}`, 15, yMeta);
    yMeta += 6;
    doc.text(`Exported At: ${formatExportDateTime()}`, 15, yMeta);

    /* ================= TABLE ================= */
    const head = [
      ["#", ...columns.map((c) => c.replace(/_/g, " ").toUpperCase())],
    ];

    const body = filtered.map((r, i) => [
      i + 1,
      ...columns.map((c) => String(r[c] ?? "")),
    ]);

    autoTable(doc, {
  startY: yMeta + 6,
  head,
  body,

  styles: {
    fontSize: 8,           // body font
    cellPadding: 2,
    valign: "middle",
  },

  headStyles: {
    fillColor: [0, 12, 111],
    textColor: 255,
    fontStyle: "bold",
    fontSize: 7,           // ✅ smaller header font
    cellPadding: {         // ✅ thinner header height
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
    },
    halign: "center",
    valign: "middle",
  },

  alternateRowStyles: {
    fillColor: [240, 253, 248],
  },

  margin: { left: 10, right: 10 },

  didDrawPage: () => {
    doc.setFontSize(9);
    doc.text(
      `Page ${doc.getCurrentPageInfo().pageNumber}`,
      pageW - 20,
      pageH - 10
    );
  },
});


   /* ================= REMARKS + SIGNATURE ================= */
const baseY = doc.lastAutoTable.finalY + 20;

/* ---------- Remarks (ON TOP) ---------- */
doc.setFontSize(10);
doc.text("Remarks:", 15, baseY);

// remarks box
doc.rect(35, baseY - 5, pageW - 50, 20);

/* ---------- Signature Section ---------- */
const signY = baseY + 30;

doc.text("Report Approved:", 15, signY);

// signature line
doc.line(55, signY, 130, signY);

doc.setFontSize(9);
doc.text("Signature over Printed Name", 55, signY + 5);

/* ---------- Date ---------- */
doc.setFontSize(10);
doc.text("Date:", 145, signY);
doc.line(158, signY, 190, signY);


    doc.save("Passenger_Manifest_Report.pdf");
    showToast("Success!", "PDF exported successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "PDF export failed.", "error");
  }
};


const exportExcel = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MCTS";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Passenger Manifest", {
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        paperSize: 9,
      },
      views: [{ state: "frozen", ySplit: 8 }],
    });

    /* ================== STYLES ================== */
    const center = { vertical: "middle", horizontal: "center", wrapText: true };
    const left = { vertical: "top", horizontal: "left", wrapText: true };
    const thin = { style: "thin" };

    const headerBlue = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF000C6F" },
    };

    const lightGreenFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0FDF8" }, // ✅ alternating row color
    };

    /* ================== HEADER ================== */
    sheet.mergeCells("A1:L1");
    sheet.getCell("A1").value = "Republic of the Philippines";
    sheet.getCell("A1").alignment = center;
    sheet.getCell("A1").font = { bold: true, size: 11 };

    sheet.mergeCells("A2:L2");
    sheet.getCell("A2").value = "Office of the President";
    sheet.getCell("A2").alignment = center;
    sheet.getCell("A2").font = { size: 10 };

    sheet.mergeCells("A3:L3");
    sheet.getCell("A3").value =
      "METROPOLITAN MANILA DEVELOPMENT AUTHORITY";
    sheet.getCell("A3").alignment = center;
    sheet.getCell("A3").font = { bold: true, size: 13 };

    sheet.mergeCells("A4:L4");
    sheet.getCell("A4").value =
      "(Pangasiwaan Sa Pagpapaunlad Ng Kalakhang Maynila)";
    sheet.getCell("A4").alignment = center;
    sheet.getCell("A4").font = { size: 9 };

    sheet.mergeCells("A5:L5");
    sheet.getCell("A5").value = "ISO 9001:2015 CERTIFIED";
    sheet.getCell("A5").alignment = center;
    sheet.getCell("A5").font = { size: 9 };

    sheet.mergeCells("A6:L6");
    sheet.getCell("A6").value = "PASSENGER MANIFEST REPORT";
    sheet.getCell("A6").alignment = center;
    sheet.getCell("A6").font = { bold: true, size: 14 };

    sheet.mergeCells("A7:L7");
    sheet.getCell("A7").value = `Filter Applied: ${buildFilterAppliedText()}`;
    sheet.getCell("A7").alignment = left;

    sheet.mergeCells("A8:L8");
    sheet.getCell("A8").value = `Exported At: ${formatExportDateTime()}`;
    sheet.getCell("A8").alignment = left;

    /* ================== TABLE HEADER ================== */
    const headers = [
      "#",
      "FULL NAME",
      "AGE",
      "GENDER",
      "CONTACT NUMBER",
      "ADDRESS",
      "PROFESSION",
      "PLATFORM SOURCE",
      "ORIGIN",
      "DESTINATION",
      "DEPARTURE DATE",
      "DEPARTURE TIME",
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.fill = headerBlue;
      cell.alignment = center;
      cell.border = {
        top: thin,
        bottom: thin,
        left: thin,
        right: thin,
      };
    });

    /* ================== DATA ================== */
    filtered.forEach((r, i) => {
      const row = sheet.addRow([
        i + 1,
        r.full_name ?? "",
        r.age ?? "",
        r.gender ?? "",
        r.contact_number ?? "",
        r.address ?? "",
        r.profession ?? "",
        r.platform_source ?? "",
        r.origin_name ?? "",
        r.destination_name ?? "",
        r.departure_date ?? "",
        r.departure_time ?? "",
      ]);

      row.eachCell((cell) => {
        cell.alignment = left;
        cell.border = {
          top: thin,
          bottom: thin,
          left: thin,
          right: thin,
        };

        // ✅ ALTERNATING LIGHT GREEN ROWS
        if (i % 2 === 0) {
          cell.fill = lightGreenFill;
        }
      });
    });

    /* ================== COLUMN WIDTHS ================== */
    sheet.columns = [
      { width: 5 },
      { width: 24 },
      { width: 6 },
      { width: 10 },
      { width: 18 },
      { width: 30 },
      { width: 18 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];

    /* ================== REMARKS ================== */
    sheet.addRow([]);
    sheet.mergeCells(
      `A${sheet.lastRow.number + 1}:L${sheet.lastRow.number + 3}`
    );
    sheet.getCell(`A${sheet.lastRow.number - 2}`).value = "Remarks:";
    sheet.getCell(`A${sheet.lastRow.number - 2}`).alignment = left;
    sheet.getCell(`A${sheet.lastRow.number - 2}`).border = {
      top: thin,
      bottom: thin,
      left: thin,
      right: thin,
    };

    /* ================== SIGNATURE ================== */
    sheet.addRow([]);
    sheet.addRow(["Report Approved:"]);
    sheet.addRow([
      "______________________________",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Date:",
      "____________",
    ]);
    sheet.addRow(["Signature over Printed Name"]);

    /* ================== EXPORT ================== */
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Passenger_Manifest_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    link.click();

    showToast("Success!", "Excel exported successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "Excel export failed.", "error");
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
