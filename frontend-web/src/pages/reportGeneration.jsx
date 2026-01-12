// reportGeneration.jsx
import axios from "axios";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./reportGeneration.css";

const fmt = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

function Toast({ open, title, message, tone = "success" }) {
  if (!open) return null;
  return (
    <div className={`rg-toast ${tone}`} role="status" aria-live="polite">
      <div className="rg-toast-title">{title}</div>
      <div className="rg-toast-msg">{message}</div>
    </div>
  );
}

export function Report() {
  const apiUrl = import.meta.env.VITE_API_URL;

  const today = new Date();
  const aWeekAgo = new Date(today);
  aWeekAgo.setDate(today.getDate() - 7);

  const [start, setStart] = useState(aWeekAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);

  const reportRef = useRef(null);

  const [toast, setToast] = useState({
    open: false,
    title: "",
    message: "",
    tone: "success",
  });
  const toastTimer = useRef(null);
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

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const response = await axios.get(
          `${apiUrl}/api/generatereport/generate_report`,
          {
            params: {
              start_date: start,
              end_date: end,
            },
          }
        );
        setRows(response.data || []);
        showToast("Report refreshed", `Range: ${fmt(start)} — ${fmt(end)}`, "success");
      } catch (error) {
        console.error("Error fetching report data:", error);
        showToast("Error", "Failed to fetch report data", "error");
      }
    };

    fetchReportData();
  }, [start, end, apiUrl]);

  // ===========================
  // Helpers (format + theme)
  // ===========================
  const THEME = {
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



  // ===========================
  // DATA for Charts
  // ===========================
  const bookingsCancelledData = rows.map((r) => ({
    name: r.StationName,
    totalBookings: r.TotalBookings,
    cancelled: r.CanceledCount,
  }));

  const genderPerStationData = rows.map((r) => ({
    name: r.StationName,
    female: r.FemaleCount,
    male: r.MaleCount,
    other: r.OtherGenderCount,
  }));

  const agePerStationData = rows.map((r) => ({
    name: r.StationName,
    "0-18": r.Age_0_18,
    "19-25": r.Age_19_25,
    "26-40": r.Age_26_40,
    "41-60": r.Age_41_60,
    "60+": r.Age_60Plus,
  }));

  const demographicsData = rows.map((r) => ({
    name: r.StationName,
    student: r.StudentCount,
    senior: r.SeniorCount,
    pwd: r.PWDCount,
  }));

  const platformSourceData = rows.map((r) => ({
    name: r.StationName,
    mobileApp: r.MobileAppCount,
    chatbot: r.ChatbotCount,
    email: r.EmailCount,
    manual: r.ManualBookingCount,
  }));

  // ===========================
  // ✅ exportPDF (FIXED)
  // ===========================
const exportPDF = async () => {
  if (!rows?.length) {
    showToast("Error", "No data to export", "error");
    return;
  }

  try {
    const { default: html2canvas } = await import("html2canvas");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const exportedAt = formatExportDateTime();
    const filterText = `Date Range: ${fmt(start)} — ${fmt(end)}`;

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
    const drawHeader = (title, showMeta = true) => {
      const y = 12;

      doc.addImage(mmdaLogo, "PNG", 12, y, 20, 20);
      doc.addImage(bpLogo, "PNG", pageW - 32, y, 20, 20);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Republic of the Philippines", pageW / 2, y + 4, { align: "center" });

      doc.setFontSize(10);
      doc.text("Office of the President", pageW / 2, y + 9, { align: "center" });

      doc.setFontSize(13);
      doc.text(
        "METROPOLITAN MANILA DEVELOPMENT AUTHORITY",
        pageW / 2,
        y + 16,
        { align: "center" }
      );

      doc.setFontSize(9);
      doc.text(
        "(Pangasiwaan Sa Pagpapaunlad Ng Kalakhang Maynila)",
        pageW / 2,
        y + 22,
        { align: "center" }
      );

      doc.text("ISO 9001:2015 CERTIFIED", pageW / 2, y + 27, {
        align: "center",
      });

      doc.setFontSize(12);
      doc.text(title, pageW / 2, y + 36, { align: "center" });

      let nextY = y + 44;

      if (showMeta) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        const lines = doc.splitTextToSize(
          `Filter Applied: ${filterText}`,
          pageW - 24
        );
        doc.text(lines, 12, nextY);
        nextY += lines.length * 4;

        doc.text(`Exported At: ${exportedAt}`, 12, nextY);
        nextY += 6;
      }

      return nextY;
    };

    const drawFooter = () => {
      doc.setFontSize(9);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber}`,
        pageW - 20,
        pageH - 10
      );
    };

    /* ================= PAGE 1 — TABLE ================= */
    let y = drawHeader("COMPREHENSIVE TOTAL STATION REPORT");

    autoTable(doc, {
      startY: y,
      margin: { left: 6, right: 6 },
      styles: {
        fontSize: 7.5,
        cellPadding: 1,
        valign: "middle",
      },
      headStyles: {
        fillColor: [0, 12, 111],
        textColor: 255,
        halign: "center",
        valign: "middle",
        fontSize: 7.5,
        minCellHeight: 12,
      },
      alternateRowStyles: { fillColor: [240, 253, 248] },
      head: [[
        "#",
        "Station Name",
        "Total\nBookings",
        "Cancelled",
        "Female",
        "Male",
        "Other",
        "Age\n0–18",
        "Age\n19–25",
        "Age\n26–40",
        "Age\n41–60",
        "Age\n60+",
        "Student",
        "Senior",
        "PWD",
        "Mobile\nApp",
        "Chatbot",
        "Email",
        "Manual",
      ]],
      body: rows.map((r, i) => ([
        i + 1,
        r.StationName,
        r.TotalBookings,
        r.CanceledCount,
        r.FemaleCount,
        r.MaleCount,
        r.OtherGenderCount,
        r.Age_0_18,
        r.Age_19_25,
        r.Age_26_40,
        r.Age_41_60,
        r.Age_60Plus,
        r.StudentCount,
        r.SeniorCount,
        r.PWDCount,
        r.MobileAppCount,
        r.ChatbotCount,
        r.EmailCount,
        r.ManualBookingCount,
      ])),
      didDrawPage: drawFooter,
    });

    /* ================= CHART HELPERS ================= */
    const capture = async (id) => {
      const el = document.getElementById(id);
      if (!el) return null;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      return canvas.toDataURL("image/png");
    };

    const addChart = (img, yPos) => {
      const maxW = pageW - 24;
      const maxH = 85;

      const props = doc.getImageProperties(img);
      let w = maxW;
      let h = (props.height * w) / props.width;

      if (h > maxH) {
        h = maxH;
        w = (props.width * h) / props.height;
      }

      const x = (pageW - w) / 2;
      doc.addImage(img, "PNG", x, yPos, w, h);
      return yPos + h + 8;
    };

    const addTwoChartsPage = async (title, topId, bottomId) => {
      const top = await capture(topId);
      const bottom = bottomId ? await capture(bottomId) : null;
      if (!top && !bottom) return;

      doc.addPage();
      let yy = drawHeader(title);

      if (top) yy = addChart(top, yy);
      if (bottom) addChart(bottom, yy);

      drawFooter();
    };

    /* ================= CHART PAGES ================= */
    await addTwoChartsPage(
      "CHARTS - COMPREHENSIVE TOTAL STATION REPORT",
      "chart-bookings-cancelled",
      "chart-gender"
    );

    await addTwoChartsPage(
      "CHARTS - COMPREHENSIVE TOTAL STATION REPORT",
      "chart-age",
      "chart-demographics"
    );

    await addTwoChartsPage(
      "CHARTS - COMPREHENSIVE TOTAL STATION REPORT",
      "chart-platform",
      null
    );

    /* ================= FINAL PAGE — APPROVAL (NO META) ================= */
    doc.addPage();
    drawHeader("REPORT APPROVAL - COMPREHENSIVE TOTAL STATION REPORT", false);

    doc.setFontSize(10);
    doc.text("Remarks:", 12, 70);
    doc.rect(30, 65, pageW - 45, 24);

    const signY = 105;
    doc.text("Report Approved:", 12, signY);
    doc.line(50, signY, 130, signY);

    doc.setFontSize(9);
    doc.text("Signature over Printed Name", 50, signY + 5);

    doc.setFontSize(10);
    doc.text("Date:", 140, signY);
    doc.line(155, signY, 185, signY);

    drawFooter();

    doc.save(`StationReport_${start}-${end}.pdf`);
    showToast("Success!", "PDF exported successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "PDF export failed.", "error");
  }
};




  // ===========================
  // ✅ exportExcel (FIXED + Styled + Charts)
  // ===========================
const exportExcel = async () => {
  if (!rows?.length) {
    showToast("Error", "No data to export", "error");
    return;
  }

  try {
    const { default: html2canvas } = await import("html2canvas");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MCTS";
    workbook.created = new Date();

    /* ================= COLORS ================= */
    const BLUE = "FF000C6F";
    const GREEN = "FF3FE19B";
    const WHITE = "FFFFFFFF";
    const LIGHT_GREEN = "FFF0FDF8";
    const BORDER = "FFD9D9D9";
    const GREY = "FF777777";

    const exportedAt = formatExportDateTime();
    const filterText = `Date Range: ${fmt(start)} — ${fmt(end)}`;

    /* ================= COMMON ================= */
    const setPrint = (sheet) => {
      sheet.pageSetup = {
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      };
    };

    const addHeader = (sheet, lastCol, title, showMeta = true) => {
      const rows = [
        "Republic of the Philippines",
        "Office of the President",
        "METROPOLITAN MANILA DEVELOPMENT AUTHORITY",
        "(Pangasiwaan Sa Pagpapaunlad Ng Kalakhang Maynila)",
        "ISO 9001:2015 CERTIFIED",
        title,
      ];

      rows.forEach((txt, i) => {
        const r = i + 1;
        sheet.mergeCells(`A${r}:${lastCol}${r}`);
        const c = sheet.getCell(`A${r}`);
        c.value = txt;
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.font =
          i === 2
            ? { bold: true, size: 13 }
            : i === 5
            ? { bold: true, size: 14 }
            : { size: 10 };
        sheet.getRow(r).height = 22;
      });

      if (showMeta) {
        sheet.mergeCells(`A7:${lastCol}7`);
        sheet.getCell("A7").value = `Filter Applied: ${filterText}`;
        sheet.getCell("A7").alignment = { wrapText: true };
        sheet.getRow(7).height = 24;

        sheet.mergeCells(`A8:${lastCol}8`);
        sheet.getCell("A8").value = `Exported At: ${exportedAt}`;
        sheet.getRow(8).height = 18;
      }
    };

    const addRemarksAndSign = (sheet, lastCol, startRow) => {
      sheet.mergeCells(`A${startRow}:${lastCol}${startRow + 2}`);
      const r = sheet.getCell(`A${startRow}`);
      r.value = "Remarks:";
      r.alignment = { wrapText: true };
      r.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };

      sheet.getRow(startRow).height = 24;
      sheet.getRow(startRow + 1).height = 24;
      sheet.getRow(startRow + 2).height = 24;

      sheet.addRow([]);
      sheet.addRow(["Report Approved:"]).getCell(1).font = { bold: true };

      const sig = sheet.addRow([]);
      sheet.mergeCells(`A${sig.number}:E${sig.number}`);
      sheet.getCell(`A${sig.number}`).value = "______________________________";

      sheet.mergeCells(`F${sig.number}:G${sig.number}`);
      sheet.getCell(`F${sig.number}`).value = "Date:";

      sheet.mergeCells(`H${sig.number}:${lastCol}${sig.number}`);
      sheet.getCell(`H${sig.number}`).value = "____________";

      const lbl = sheet.addRow([]);
      sheet.mergeCells(`A${lbl.number}:E${lbl.number}`);
      sheet.getCell(`A${lbl.number}`).value =
        "Signature over Printed Name";
    };

    const capture = async (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const canvas = await html2canvas(el, {
        scale: 1, // 🔥 PREVENT STRETCH / CRASH
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      return canvas.toDataURL("image/png");
    };

    /* ======================================================
       SHEET 1 — TABLE
    ====================================================== */
    const sheet1 = workbook.addWorksheet("Station Summary", {
      views: [{ state: "frozen", ySplit: 9 }],
    });
    setPrint(sheet1);

    sheet1.columns = [
      { width: 5 },  { width: 18 }, { width: 12 }, { width: 10 },
      { width: 9 },  { width: 9 },  { width: 9 },  { width: 9 },
      { width: 9 },  { width: 9 },  { width: 9 },  { width: 9 },
      { width: 9 },  { width: 9 },  { width: 9 },  { width: 10 },
      { width: 9 },  { width: 9 },  { width: 9 },
    ];

    const lastCol1 = sheet1.getColumn(19).letter;
    addHeader(sheet1, lastCol1, "COMPREHENSIVE TOTAL STATION REPORT");

    const header = sheet1.addRow([
      "#","Station Name","Total","Canceled","Female","Male","Other",
      "0–18","19–25","26–40","41–60","60+",
      "Student","Senior","PWD",
      "Mobile","Chatbot","Email","Manual",
    ]);

    header.eachCell((c) => {
      c.font = { bold: true, size: 9, color: { argb: WHITE } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      c.border = { top:{style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"} };
    });
    header.height = 22;

    rows.forEach((r, i) => {
      const row = sheet1.addRow([
        i + 1,
        r.StationName,
        r.TotalBookings,
        r.CanceledCount,
        r.FemaleCount,
        r.MaleCount,
        r.OtherGenderCount,
        r.Age_0_18,
        r.Age_19_25,
        r.Age_26_40,
        r.Age_41_60,
        r.Age_60Plus,
        r.StudentCount,
        r.SeniorCount,
        r.PWDCount,
        r.MobileAppCount,
        r.ChatbotCount,
        r.EmailCount,
        r.ManualBookingCount,
      ]);

      row.eachCell((c) => {
        c.font = { size: 9 };
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.border = { top:{style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"} };
        if (i % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } };
        }
      });
    });

    addRemarksAndSign(sheet1, lastCol1, sheet1.lastRow.number + 2);

   /* ======================================================
   SHEET 2 — CHARTS
====================================================== */
const sheet2 = workbook.addWorksheet("Charts");
setPrint(sheet2);

sheet2.columns = Array.from({ length: 8 }, () => ({ width: 20 }));
addHeader(sheet2, "H", "CHARTS - COMPREHENSIVE TOTAL STATION REPORT");

let cursor = 9;

const addChart = async (id) => {
  const img = await capture(id);
  if (!img) return;

  const imageId = workbook.addImage({
    base64: img,
    extension: "png",
  });

  sheet2.addImage(imageId, {
    tl: { col: 0, row: cursor },
    ext: { width: 600, height: 260 }, // ✅ not stretched
  });

  cursor += 16;
};

await addChart("chart-bookings-cancelled");
await addChart("chart-gender");
await addChart("chart-age");
await addChart("chart-demographics");
await addChart("chart-platform");

// ✅ FIX: REMARKS + SIGNATURE NOW INCLUDED
addRemarksAndSign(sheet2, "H", cursor + 2);


    /* ================= DOWNLOAD ================= */
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `StationReport_${start}-${end}.xlsx`;
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
      <HeaderButton />
      <Toast open={toast.open} title={toast.title} message={toast.message} tone={toast.tone} />

      <div className="reports-page" id="reportsPage">
        <main className="reports-main">
          <header className="reports-header-row">
            <div>
              <h1 className="reports-title">Comprehensive Report</h1>
              <div className="reports-subtitle">Station Demographics & Activity Report</div>
            </div>
          </header>

          <div className="reports-controls">
            <div className="rg-dates">
              <span>Date range:</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                aria-label="start date"
              />
              <span>—</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                aria-label="end date"
              />
            </div>
          </div>

          <div ref={reportRef}>
            <div className="rg-table-head">
              <div className="rg-range-label">
                Report for <b>{fmt(start)}</b> — <b>{fmt(end)}</b>
              </div>
            </div>

            <div className="rg-table-wrap" role="region" aria-label="Station totals">
              <table className="rg-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Station Name</th>
                    <th>Total Bookings</th>
                    <th>Canceled Bookings</th>
                    <th>Female Count</th>
                    <th>Male Count</th>
                    <th>Other Gender Count</th>
                    <th>Age 0-18</th>
                    <th>Age 19-25</th>
                    <th>Age 26-40</th>
                    <th>Age 41-60</th>
                    <th>Age 60+</th>
                    <th>Student Count</th>
                    <th>Senior Count</th>
                    <th>PWD Count</th>
                    <th>Mobile App</th>
                    <th>Chatbot</th>
                    <th>Gmail</th>
                    <th>Manual</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={`${r.StationName}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>{r.StationName}</td>
                      <td>{r.TotalBookings}</td>
                      <td>{r.CanceledCount}</td>
                      <td>{r.FemaleCount}</td>
                      <td>{r.MaleCount}</td>
                      <td>{r.OtherGenderCount}</td>
                      <td>{r.Age_0_18}</td>
                      <td>{r.Age_19_25}</td>
                      <td>{r.Age_26_40}</td>
                      <td>{r.Age_41_60}</td>
                      <td>{r.Age_60Plus}</td>
                      <td>{r.StudentCount}</td>
                      <td>{r.SeniorCount}</td>
                      <td>{r.PWDCount}</td>
                      <td>{r.MobileAppCount}</td>
                      <td>{r.ChatbotCount}</td>
                      <td>{r.EmailCount}</td>
                      <td>{r.ManualBookingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Charts Section */}
            <div className="rg-charts" style={{ marginTop: "40px" }}>
              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="chart-bookings-cancelled">
                  <h3 className="chart-title">Total Bookings and Cancelled Bookings Per Station</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={bookingsCancelledData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalBookings" fill="#41A67E" name="Total Bookings" />
                      <Bar dataKey="cancelled" fill="#DA6C6C" name="Cancelled" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="chart-gender">
                  <h3 className="chart-title">Gender Distribution Per Station</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={genderPerStationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="female" fill="#FF6B9D" name="Female" />
                      <Bar dataKey="male" fill="#9FB3DF" name="Male" />
                      <Bar dataKey="other" fill="#9B7EBD" name="Other" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="chart-age">
                  <h3 className="chart-title">Age Distribution Per Station</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={agePerStationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="0-18" fill="#8967B3" name="0-18" />
                      <Bar dataKey="19-25" fill="#FADFA1" name="19-25" />
                      <Bar dataKey="26-40" fill="#b8f2e6" name="26-40" />
                      <Bar dataKey="41-60" fill="#FF8A8A" name="41-60" />
                      <Bar dataKey="60+" fill="#5F6F65" name="60+" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="chart-demographics">
                  <h3 className="chart-title">Demographics Distribution Per Station</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={demographicsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="student" fill="#cc8b86" name="Student" />
                      <Bar dataKey="senior" fill="#d496a7" name="Senior" />
                      <Bar dataKey="pwd" fill="#5d576b" name="PWD" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="chart-platform">
                  <h3 className="chart-title">Preferred Platform Source of Booking Per Station</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={platformSourceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="mobileApp" fill="#1BC882" name="Mobile App" />
                      <Bar dataKey="chatbot" fill="#2E5BFF" name="Chatbot" />
                      <Bar dataKey="email" fill="#EA4335" name="Email" />
                      <Bar dataKey="manual" fill="#FADA7A" name="Manual Booking" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>

          <div className="rg-export-row">
            <button className="rg-export" onClick={exportPDF}>
              Export as PDF
            </button>
            <button className="rg-export" onClick={exportExcel}>
              Export as Excel
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
