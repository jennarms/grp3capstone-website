// PeakReport.jsx 
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
  Line,
  LineChart,
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

function Toast({ open, title, message, tone = "success" }) {
  if (!open) return null;
  return (
    <div className={`rg-toast ${tone}`} role="status" aria-live="polite">
      <div className="rg-toast-title">{title}</div>
      <div className="rg-toast-msg">{message}</div>
    </div>
  );
}

export default function PeakReport() {
  const apiUrl = import.meta.env.VITE_API_URL;

  const today = new Date();
  const aWeekAgo = new Date(today);
  aWeekAgo.setDate(today.getDate() - 7);

  const [start, setStart] = useState(aWeekAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [selectedStation, setSelectedStation] = useState("");

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

  // ===========================
  // FETCH PEAK REPORT
  // ===========================
  useEffect(() => {
    const fetchPeakReport = async () => {
      try {
        const response = await axios.get(
          `${apiUrl}/api/generatereport/generate_peak_report`,
          {
            params: {
              start_date: start,
              end_date: end,
            },
          }
        );

        const clean = JSON.parse(JSON.stringify(response.data));

        if (clean.perStation) {
          clean.perStation = clean.perStation.map((s) => ({
            ...s,
            peakDay: s.peakDay
              ? { ...s.peakDay, total: Math.floor(s.peakDay.total || 0) }
              : {},
            offPeakDay: s.offPeakDay
              ? { ...s.offPeakDay, total: Math.floor(s.offPeakDay.total || 0) }
              : {},
            peakHour: s.peakHour
              ? { ...s.peakHour, total: Math.floor(s.peakHour.total || 0) }
              : {},
            offPeakHour: s.offPeakHour
              ? { ...s.offPeakHour, total: Math.floor(s.offPeakHour.total || 0) }
              : {},

            byDay:
              s.byDay?.map((d) => ({
                ...d,
                total: Math.floor(d.total || 0),
              })) || [],

            byHour:
              s.byHour?.map((h) => ({
                ...h,
                total: Math.floor(h.total || 0),
              })) || [],
          }));
        }

        if (clean.global) {
          clean.global.byDay =
            clean.global.byDay?.map((d) => ({
              ...d,
              total: Math.floor(d.total || 0),
            })) || [];

          clean.global.byHour =
            clean.global.byHour?.map((h) => ({
              ...h,
              total: Math.floor(h.total || 0),
            })) || [];
        }

        setReport(clean);

        if (clean.perStation && clean.perStation.length > 0) {
          setSelectedStation(clean.perStation[0].StationName);
        }

        showToast(
          "Report refreshed",
          `Range: ${fmt(start)} — ${fmt(end)}`,
          "success"
        );
      } catch (error) {
        console.error("Error fetching peak report:", error);
        showToast("Error", "Failed to fetch peak report data", "error");
      }
    };

    fetchPeakReport();
  }, [start, end, apiUrl]);

  // ===========================
  // SORT DAYS SUNDAY → SATURDAY
  // ===========================
  const formatDayOrder = (data) => {
    const order = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const map = {};
    data.forEach((d) => {
      map[d.day_name] = d;
    });
    return order.filter((name) => map[name]).map((name) => map[name]);
  };

  const globalDayData = report?.global?.byDay || [];
  const globalHourData = report?.global?.byHour || [];

  const stationData =
    report?.perStation?.find((s) => s.StationName === selectedStation) || null;

  const sortedGlobalDayData = formatDayOrder(globalDayData);

  // List of station names
  const stationNames =
    report?.perStation?.map((s) => s.StationName).filter(Boolean) || [];

  // Color palette (charts only)
  const stationColors = [
    "#2E5BFF",
    "#FFB020",
    "#1BC882",
    "#8C54FF",
    "#FF4D4F",
    "#00C1D4",
    "#FF7A45",
    "#52C41A",
  ];

  // ===========================
  // GLOBAL DAY + STATION MERGED
  // ===========================
  const globalDayWithStations = (() => {
    if (!report?.perStation) return sortedGlobalDayData;

    const dayMap = {};

    sortedGlobalDayData.forEach((day) => {
      dayMap[day.day_name] = {
        day_name: day.day_name,
        total: day.total,
      };
    });

    report.perStation.forEach((st) => {
      st.byDay.forEach((d) => {
        if (!dayMap[d.day_name]) {
          dayMap[d.day_name] = { day_name: d.day_name };
        }
        dayMap[d.day_name][st.StationName] = d.total;
      });
    });

    return Object.values(dayMap);
  })();

  // ===========================
  // GLOBAL HOUR + STATION MERGED
  // ===========================
  const globalHourWithStations = (() => {
    if (!report?.perStation) return globalHourData;

    const hourMap = {};

    globalHourData.forEach((h) => {
      hourMap[h.label] = {
        label: h.label,
        total: h.total,
      };
    });

    report.perStation.forEach((st) => {
      st.byHour.forEach((h) => {
        if (!hourMap[h.label]) hourMap[h.label] = { label: h.label };
        hourMap[h.label][st.StationName] = h.total;
      });
    });

    return Object.values(hourMap);
  })();

  // ===========================
  // EXPORT FUNCTIONS
  // ===========================
  const COLORS = {
    white: "#FFFFFF",
    green: "#3fe19b",
    blue: "#000c6f",
  };

// ✅ exportPDF (COMPLETE) — summary table + 2 charts per page + SIGNATURE AT THE END
// Requires: npm i jspdf jspdf-autotable html2canvas

const exportPDF = async () => {
  if (!report?.perStation?.length) {
    showToast("Error", "No data to export", "error");
    return;
  }

  try {
    const { default: html2canvas } = await import("html2canvas");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [215.9, 330.2], // 8.5 x 13
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
    const drawHeader = (title) => {
      const y = 15;

      doc.addImage(mmdaLogo, "PNG", 15, y, 25, 25);
      doc.addImage(bpLogo, "PNG", pageW - 40, y, 25, 25);

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

      return y + 46;
    };

    const drawFooter = () => {
      doc.setFontSize(9);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber}`,
        pageW - 20,
        pageH - 10
      );
    };

    /* ================= PAGE 1 — SUMMARY ================= */
    let y = drawHeader("PEAK & OFF-PEAK ANALYSIS REPORT");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const summaryFilter = doc.splitTextToSize(
      `Filter Applied: Date Range: ${fmt(start)} — ${fmt(end)} | Stations Included: ${stationNames.join(" · ")}`,
      pageW - 30
    );

    doc.text(summaryFilter, 15, y);
    y += summaryFilter.length * 5;

    doc.text(`Exported At: ${formatExportDateTime()}`, 15, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [[
        "#",
        "Station Name",
        "Peak Day",
        "Peak Day Count",
        "Off-Peak Day",
        "Off-Peak Day Count",
        "Peak Hour",
        "Peak Hour Count",
        "Off-Peak Hour",
        "Off-Peak Hour Count",
      ]],
      body: report.perStation.map((s, i) => [
        i + 1,
        s.StationName,
        s.peakDay?.day_name || "N/A",
        s.peakDay?.total || 0,
        s.offPeakDay?.day_name || "N/A",
        s.offPeakDay?.total || 0,
        s.peakHour?.label || "N/A",
        s.peakHour?.total || 0,
        s.offPeakHour?.label || "N/A",
        s.offPeakHour?.total || 0,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [0, 12, 111],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [240, 253, 248] },
      margin: { left: 10, right: 10 },
      didDrawPage: drawFooter,
    });

    /* ================= TWO CHARTS PER PAGE ================= */
    const addTwoChartsPage = async ({
      title,
      filterText,
      topChartId,
      topTitle,
      bottomChartId,
      bottomTitle,
    }) => {
      const capture = async (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        return { canvas, img: canvas.toDataURL("image/png") };
      };

      const top = await capture(topChartId);
      const bottom = await capture(bottomChartId);
      if (!top && !bottom) return;

      doc.addPage();
      let yy = drawHeader(title);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      const lines = doc.splitTextToSize(filterText, pageW - 30);
      doc.text(lines, 15, yy);
      yy += lines.length * 5 + 4;

      const maxW = pageW - 30;
      const gap = 8;
      const labelH = 6;
      const availH = pageH - yy - 20;
      const chartH = (availH - gap - labelH * 2) / 2;

      const drawChart = (cap, label, yStart) => {
        if (!cap) return yStart + chartH + gap;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(label, 15, yStart);

        const imgH = (cap.canvas.height * maxW) / cap.canvas.width;
        const drawH = Math.min(imgH, chartH);

        doc.addImage(
          cap.img,
          "PNG",
          15,
          yStart + labelH,
          maxW,
          drawH
        );

        return yStart + labelH + chartH + gap;
      };

      let posY = yy;
      posY = drawChart(top, topTitle, posY);
      drawChart(bottom, bottomTitle, posY);

      drawFooter();
    };

    /* ---------- GLOBAL CHARTS ---------- */
    await addTwoChartsPage({
      title: "GLOBAL CHARTS",
      filterText: `Filter Applied: Date Range: ${fmt(start)} — ${fmt(end)} | Stations Included: ${stationNames.join(" · ")}`,
      topChartId: "globalDayChart",
      topTitle: "Global Bookings by Day of Week",
      bottomChartId: "globalHourChart",
      bottomTitle: "Global Bookings by Hour",
    });

    /* ---------- STATION CHARTS ---------- */
    await addTwoChartsPage({
      title: "STATION CHARTS",
      filterText: `Filter Applied: Date Range: ${fmt(start)} — ${fmt(end)} | Station View: ${selectedStation}`,
      topChartId: "stationDayChart",
      topTitle: `${selectedStation} – Bookings by Day`,
      bottomChartId: "stationHourChart",
      bottomTitle: `${selectedStation} – Bookings by Hour`,
    });

    /* ================= FINAL PAGE — SIGNATURE ================= */
    doc.addPage();
    drawHeader("REPORT APPROVAL");

    doc.setFontSize(10);
    doc.text("Remarks:", 15, 70);
    doc.rect(35, 65, pageW - 50, 20);

    const signY = 110;
    doc.text("Report Approved:", 15, signY);
    doc.line(55, signY, 130, signY);

    doc.setFontSize(9);
    doc.text("Signature over Printed Name", 55, signY + 5);

    doc.setFontSize(10);
    doc.text("Date:", 145, signY);
    doc.line(158, signY, 190, signY);

    drawFooter();

    doc.save(`PeakReport_${start}-${end}.pdf`);
    showToast("Success!", "PDF exported successfully!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "PDF export failed.", "error");
  }
};


// ✅ Excel Export (FINAL FIX): pro header on ALL sheets + 2 charts per sheet + signature on ALL sheets
// Requires: npm i exceljs html2canvas

const exportExcel = async () => {
  if (!report?.perStation?.length) {
    showToast("Error", "No data to export", "error");
    return;
  }

  try {
    const { default: html2canvas } = await import("html2canvas");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MCTS";
    workbook.created = new Date();

    /* ================= STYLES ================= */
    const headerBlue = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF000C6F" },
    };

    const lightGreenFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0FDF8" },
    };

    const thin = { style: "thin" };
    const center = { vertical: "middle", horizontal: "center", wrapText: true };
    const left = { vertical: "top", horizontal: "left", wrapText: true };

    const dateRangeText = `Date Range: ${fmt(start)} — ${fmt(end)}`;
    const stationsIncluded = stationNames.join(" · ");

    /* ================= COMMON HEADER ================= */
    const baseHeader = (sheet, lastCol, title, filterText) => {
      sheet.mergeCells(`A1:${lastCol}1`);
      sheet.getCell("A1").value = "Republic of the Philippines";
      sheet.getCell("A1").alignment = center;
      sheet.getCell("A1").font = { bold: true, size: 11 };

      sheet.mergeCells(`A2:${lastCol}2`);
      sheet.getCell("A2").value = "Office of the President";
      sheet.getCell("A2").alignment = center;
      sheet.getCell("A2").font = { size: 10 };

      sheet.mergeCells(`A3:${lastCol}3`);
      sheet.getCell("A3").value =
        "METROPOLITAN MANILA DEVELOPMENT AUTHORITY";
      sheet.getCell("A3").alignment = center;
      sheet.getCell("A3").font = { bold: true, size: 13 };

      sheet.mergeCells(`A4:${lastCol}4`);
      sheet.getCell("A4").value =
        "(Pangasiwaan Sa Pagpapaunlad Ng Kalakhang Maynila)";
      sheet.getCell("A4").alignment = center;
      sheet.getCell("A4").font = { size: 9 };

      sheet.mergeCells(`A5:${lastCol}5`);
      sheet.getCell("A5").value = "ISO 9001:2015 CERTIFIED";
      sheet.getCell("A5").alignment = center;
      sheet.getCell("A5").font = { size: 9 };

      sheet.mergeCells(`A6:${lastCol}6`);
      sheet.getCell("A6").value = title;
      sheet.getCell("A6").alignment = center;
      sheet.getCell("A6").font = { bold: true, size: 14 };

      sheet.mergeCells(`A7:${lastCol}7`);
      sheet.getCell("A7").value = `Filter Applied: ${filterText}`;
      sheet.getCell("A7").alignment = left;

      sheet.mergeCells(`A8:${lastCol}8`);
      sheet.getCell("A8").value = `Exported At: ${formatExportDateTime()}`;
      sheet.getCell("A8").alignment = left;
    };

    /* ================= REMARKS + SIGNATURE ================= */
    const addRemarksAndSignature = (sheet, lastCol) => {
      const thinBorder = { style: "thin" };

      sheet.addRow([]);
      const start = sheet.lastRow.number + 1;

      sheet.mergeCells(`A${start}:${lastCol}${start + 2}`);
      const remarks = sheet.getCell(`A${start}`);
      remarks.value = "Remarks:";
      remarks.alignment = left;
      remarks.border = {
        top: thinBorder,
        bottom: thinBorder,
        left: thinBorder,
        right: thinBorder,
      };

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
        "Date:",
        "____________",
      ]);
      sheet.addRow(["Signature over Printed Name"]);
    };

    /* =====================================================
       SHEET 1 — PEAK SUMMARY
    ===================================================== */
    const sheet1 = workbook.addWorksheet("Peak Summary", {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, paperSize: 9 },
      views: [{ state: "frozen", ySplit: 8 }],
    });

    const cols = [
      "#",
      "STATION NAME",
      "PEAK DAY",
      "PEAK DAY COUNT",
      "OFF-PEAK DAY",
      "OFF-PEAK DAY COUNT",
      "PEAK HOUR",
      "PEAK HOUR COUNT",
      "OFF-PEAK HOUR",
      "OFF-PEAK HOUR COUNT",
    ];

    sheet1.columns = [
      { width: 5 }, { width: 22 }, { width: 14 }, { width: 16 },
      { width: 14 }, { width: 18 }, { width: 14 }, { width: 16 },
      { width: 16 }, { width: 18 },
    ];

    const lastCol1 = sheet1.getColumn(cols.length).letter;

    baseHeader(
      sheet1,
      lastCol1,
      "PEAK & OFF-PEAK ANALYSIS REPORT",
      `${dateRangeText} | Stations Included: ${stationsIncluded}`
    );

    const headerRow = sheet1.addRow(cols);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.fill = headerBlue;
      cell.alignment = center;
      cell.border = { top: thin, bottom: thin, left: thin, right: thin };
    });

    report.perStation.forEach((s, i) => {
      const row = sheet1.addRow([
        i + 1,
        s.StationName,
        s.peakDay?.day_name || "N/A",
        s.peakDay?.total || 0,
        s.offPeakDay?.day_name || "N/A",
        s.offPeakDay?.total || 0,
        s.peakHour?.label || "N/A",
        s.peakHour?.total || 0,
        s.offPeakHour?.label || "N/A",
        s.offPeakHour?.total || 0,
      ]);

      row.eachCell((cell) => {
        cell.alignment = left;
        cell.border = { top: thin, bottom: thin, left: thin, right: thin };
        if (i % 2 === 0) cell.fill = lightGreenFill;
      });
    });

    addRemarksAndSignature(sheet1, lastCol1);

    /* =====================================================
       SHEET 2 — GLOBAL CHARTS
    ===================================================== */
    const sheet2 = workbook.addWorksheet("Global Charts", {
      pageSetup: { orientation: "landscape", paperSize: 9 },
    });

    baseHeader(
      sheet2,
      "H",
      "GLOBAL CHARTS",
      `${dateRangeText} | Stations Included: ${stationsIncluded}`
    );

    const capture = async (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#fff" });
      return canvas.toDataURL("image/png");
    };

    const gDay = await capture("globalDayChart");
    const gHour = await capture("globalHourChart");

    if (gDay) {
      const img = workbook.addImage({ base64: gDay, extension: "png" });
      sheet2.addImage(img, { tl: { col: 0, row: 9 }, ext: { width: 900, height: 350 } });
    }

    if (gHour) {
      const img = workbook.addImage({ base64: gHour, extension: "png" });
      sheet2.addImage(img, { tl: { col: 0, row: 28 }, ext: { width: 900, height: 350 } });
    }

    addRemarksAndSignature(sheet2, "H");

    /* =====================================================
       SHEET 3 — STATION CHARTS
    ===================================================== */
    const sheet3 = workbook.addWorksheet("Station Charts", {
      pageSetup: { orientation: "landscape", paperSize: 9 },
    });

    baseHeader(
      sheet3,
      "H",
      "STATION CHARTS",
      `${dateRangeText} | Station View: ${selectedStation}`
    );

    const sDay = await capture("stationDayChart");
    const sHour = await capture("stationHourChart");

    if (sDay) {
      const img = workbook.addImage({ base64: sDay, extension: "png" });
      sheet3.addImage(img, { tl: { col: 0, row: 9 }, ext: { width: 900, height: 350 } });
    }

    if (sHour) {
      const img = workbook.addImage({ base64: sHour, extension: "png" });
      sheet3.addImage(img, { tl: { col: 0, row: 28 }, ext: { width: 900, height: 350 } });
    }

    addRemarksAndSignature(sheet3, "H");

    /* ================= DOWNLOAD ================= */
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PeakReport_${start}-${end}.xlsx`;
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
      <Toast
        open={toast.open}
        title={toast.title}
        message={toast.message}
        tone={toast.tone}
      />

      <div className="reports-page" id="peakReportsPage">
        <main className="reports-main">
          <header className="reports-header-row">
            <div>
              <h1 className="reports-title">Peak & Off-Peak Analysis</h1>
              <div className="reports-subtitle">
                Station Peak Times and Busiest Days Report
              </div>
            </div>
          </header>

          {/* Filters */}
          <div className="reports-controls">
            <div className="rg-dates">
              <span>Date range:</span>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span>—</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Station Selector */}
          {report?.perStation && (
            <div className="reports-controls" style={{ marginTop: 0 }}>
              <div className="rg-dates">
                <span>Station view:</span>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  style={{
                    height: "40px",
                    borderRadius: "10px",
                    border: "1px solid #9da9c2",
                    padding: "6px 10px",
                    minWidth: "200px",
                  }}
                >
                  {report.perStation.map((s) => (
                    <option key={s.StationName} value={s.StationName}>
                      {s.StationName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div ref={reportRef}>
            <div className="rg-table-head">
              <div className="rg-range-label">
                Report for <b>{fmt(start)}</b> — <b>{fmt(end)}</b>
              </div>

              {stationNames.length > 0 && (
                <div className="rg-station-list">
                  <span>Stations included:&nbsp;</span>
                  <span className="rg-station-names">
                    {stationNames.join(" · ")}
                  </span>
                </div>
              )}
            </div>

            {/* Summary Table */}
            {report?.perStation && (
              <div className="rg-table-wrap">
                <table className="rg-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Station Name</th>
                      <th>Peak Day</th>
                      <th>Peak Day Count</th>
                      <th>Off-Peak Day</th>
                      <th>Off-Peak Day Count</th>
                      <th>Peak Hour</th>
                      <th>Peak Hour Count</th>
                      <th>Off-Peak Hour</th>
                      <th>Off-Peak Hour Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.perStation.map((s, idx) => (
                      <tr key={s.StationName}>
                        <td>{idx + 1}</td>
                        <td>{s.StationName}</td>
                        <td>{s.peakDay?.day_name || "N/A"}</td>
                        <td>{s.peakDay?.total || 0}</td>
                        <td>{s.offPeakDay?.day_name || "N/A"}</td>
                        <td>{s.offPeakDay?.total || 0}</td>
                        <td>{s.peakHour?.label || "N/A"}</td>
                        <td>{s.peakHour?.total || 0}</td>
                        <td>{s.offPeakHour?.label || "N/A"}</td>
                        <td>{s.offPeakHour?.total || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===========================
                CHARTS SECTION
                =========================== */}
            <div className="rg-charts" style={{ marginTop: "40px" }}>
              {/* Global Day Chart w/ Stations */}
              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="globalDayChart">
                  <h3 className="chart-title">Global Bookings by Day of Week</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={globalDayWithStations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day_name" />
                      <YAxis allowDecimals={false} domain={[0, "dataMax + 1"]} />
                      <Tooltip />
                      <Legend />

                      {report?.perStation?.map((s, i) => (
                        <Bar
                          key={s.StationName}
                          dataKey={s.StationName}
                          stackId="stations"
                          fill={stationColors[i % stationColors.length]}
                        />
                      ))}

                      <Bar dataKey="total" fill="#000000" name="Global Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Global Hour Chart w/ Stations */}
              <section className="chart-card" style={{ marginBottom: "30px" }}>
                <div id="globalHourChart">
                  <h3 className="chart-title">Global Bookings by Hour</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={globalHourWithStations}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} domain={[0, "dataMax + 1"]} />
                      <Tooltip />
                      <Legend />

                      {report?.perStation?.map((s, i) => (
                        <Line
                          key={s.StationName}
                          type="monotone"
                          dataKey={s.StationName}
                          stroke={stationColors[i % stationColors.length]}
                        />
                      ))}

                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#000000"
                        strokeWidth={2}
                        name="Global Total"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Per-Station Day Chart */}
              {stationData && (
                <section className="chart-card" style={{ marginBottom: "30px" }}>
                  <div id="stationDayChart">
                    <h3 className="chart-title">
                      {stationData.StationName} – Bookings by Day of Week
                    </h3>

                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={formatDayOrder(stationData.byDay)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day_name" />
                        <YAxis
                          allowDecimals={false}
                          domain={[0, "dataMax + 1"]}
                        />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="total"
                          fill="#8C54FF"
                          name="Total Bookings"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {/* Per-Station Hour Chart */}
              {stationData && (
                <section className="chart-card" style={{ marginBottom: "30px" }}>
                  <div id="stationHourChart">
                    <h3 className="chart-title">
                      {stationData.StationName} – Bookings by Hour
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={stationData.byHour}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis
                          allowDecimals={false}
                          domain={[0, "dataMax + 1"]}
                        />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#FFB020"
                          name="Total Bookings"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
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
