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

  const buildFilterText = () => {
    const includedStations =
      stationNames.length > 0 ? stationNames.join(" · ") : "None";
    return `Date Range: ${fmt(start)} — ${fmt(end)} | Station View: ${
      selectedStation || "N/A"
    } | Stations Included: ${includedStations}`;
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
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const COLORS = {
      white: "#FFFFFF",
      green: "#3fe19b",
      blue: "#000c6f",
    };

    const exportedAt = formatExportDateTime();
    const filterText = buildFilterText();

    // ---------- HEADER ----------
    const drawHeader = (title) => {
      doc.setFillColor(COLORS.blue);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setFillColor(COLORS.green);
      doc.rect(0, 18, pageW, 2, "F");

      doc.setTextColor(COLORS.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(title, 12, 12);
    };

    // ---------- FOOTER ----------
    const drawFooter = () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Page ${page}`, pageW - 20, pageH - 6);
    };

    // ---------- PAGE 1: SUMMARY ----------
    drawHeader("Peak & Off-Peak Analysis Report");

    // Wrap filter text so it doesn't cut
    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const maxTextW = pageW - 24; // 12mm left + 12mm right
    const filterLines = doc.splitTextToSize(
      `Filter Applied: ${filterText}`,
      maxTextW
    );

    let y = 28;
    doc.text(filterLines, 12, y);
    y += filterLines.length * 5;

    doc.text(`Exported At: ${exportedAt}`, 12, y);
    y += 6;

    // Summary table
    const head = [
      [
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
      ],
    ];

    const body = report.perStation.map((s, idx) => [
      String(idx + 1),
      s.StationName || "N/A",
      s.peakDay?.day_name || "N/A",
      String(s.peakDay?.total || 0),
      s.offPeakDay?.day_name || "N/A",
      String(s.offPeakDay?.total || 0),
      s.peakHour?.label || "N/A",
      String(s.peakHour?.total || 0),
      s.offPeakHour?.label || "N/A",
      String(s.offPeakHour?.total || 0),
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
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
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: [240, 253, 248],
      },
      margin: { left: 8, right: 8 },
      tableWidth: "auto",
      didDrawPage: () => {
        drawFooter();
      },
    });

    // Ensure footer exists for the first page (in case table fits and didDrawPage timing varies)
    drawFooter();

    // ---------- CHART PAGES (2 charts per page) ----------
    const addTwoChartsPage = async ({
      pageTitle,
      chartIdTop,
      titleTop,
      chartIdBottom,
      titleBottom,
    }) => {
      const elTop = document.getElementById(chartIdTop);
      const elBottom = document.getElementById(chartIdBottom);

      if (!elTop && !elBottom) return;

      const capture = async (el) => {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });
        return { canvas, imgData: canvas.toDataURL("image/png") };
      };

      const topCap = elTop ? await capture(elTop) : null;
      const bottomCap = elBottom ? await capture(elBottom) : null;

      doc.addPage();
      drawHeader(pageTitle);

      // Filter lines (wrapped)
      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const maxTextW2 = pageW - 24;
      const filterLines2 = doc.splitTextToSize(
        `Filter Applied: ${filterText}`,
        maxTextW2
      );

      const metaY = 28;
      doc.text(filterLines2, 12, metaY);

      const marginX = 12;
      const gap = 6;
      const labelH = 5;

      let yStart = metaY + filterLines2.length * 5 + 6;

      const bottomMargin = 14;
      const availableH = pageH - yStart - bottomMargin;

      const chartBoxH = (availableH - gap - labelH * 2) / 2;
      const maxW3 = pageW - marginX * 2;

      const drawChartBlock = (cap, blockTitle, yy) => {
        if (!cap) return yy + chartBoxH + labelH + gap;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30);
        doc.text(blockTitle, marginX, yy);

        const imgTopY = yy + labelH;

        const imgW0 = maxW3;
        const imgH0 = (cap.canvas.height * imgW0) / cap.canvas.width;

        let drawW = imgW0;
        let drawH = imgH0;

        // Fit by height first
        if (drawH > chartBoxH) {
          drawH = chartBoxH;
          drawW = (cap.canvas.width * drawH) / cap.canvas.height;
        }
        // Safety fit by width
        if (drawW > maxW3) {
          drawW = maxW3;
          drawH = (cap.canvas.height * drawW) / cap.canvas.width;
        }

        const x = (pageW - drawW) / 2;
        doc.addImage(cap.imgData, "PNG", x, imgTopY, drawW, drawH);

        return imgTopY + chartBoxH + gap;
      };

      // Top chart
      yStart = drawChartBlock(topCap, titleTop, yStart);
      // Bottom chart
      yStart = drawChartBlock(bottomCap, titleBottom, yStart);

      drawFooter();
    };

    await addTwoChartsPage({
      pageTitle: "Global Charts",
      chartIdTop: "globalDayChart",
      titleTop: "Global Bookings by Day of Week",
      chartIdBottom: "globalHourChart",
      titleBottom: "Global Bookings by Hour",
    });

    await addTwoChartsPage({
      pageTitle: "Station Charts",
      chartIdTop: "stationDayChart",
      titleTop: `${selectedStation} – Bookings by Day`,
      chartIdBottom: "stationHourChart",
      titleBottom: `${selectedStation} – Bookings by Hour`,
    });

    // ---------- FINAL PAGE: APPROVAL (SIGNATURE AT THE END) ----------
    doc.addPage();
    drawHeader("Report Approval");

    // Repeat key meta info on approval page (wrapped)
    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const approvalMeta = doc.splitTextToSize(
      `Report Range: ${fmt(start)} — ${fmt(end)}\nSelected Station View: ${
        selectedStation || "N/A"
      }\nExported At: ${exportedAt}`,
      pageW - 24
    );

    doc.text(approvalMeta, 12, 30);

    const signY = 70;

    doc.setDrawColor(170);
    doc.setTextColor(40);
    doc.setFontSize(11);

    doc.text("Report Approved:", 12, signY);
    doc.line(45, signY, 120, signY);

    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Signature over Printed Name", 45, signY + 5);

    doc.setTextColor(40);
    doc.setFontSize(11);
    doc.text("Date:", 130, signY);
    doc.line(142, signY, 170, signY);

    drawFooter();

    // Save
    doc.save(`PeakReport_${start}-${end}.pdf`);
    showToast("Success!", "PDF exported with charts!", "success");
  } catch (err) {
    console.error(err);
    showToast(
      "Export failed",
      "Please install 'html2canvas' and 'jspdf-autotable'.",
      "error"
    );
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

    // Theme ARGB colors
    const BLUE = "FF000C6F";
    const GREEN = "FF3FE19B";
    const WHITE = "FFFFFFFF";
    const LIGHT_GREEN = "FFF0FDF8";
    const BORDER = "FFD9D9D9";
    const GREY = "FF666666";

    const exportedAt = formatExportDateTime();
    const filterText = buildFilterText();

    // -------------------------
    // Helpers
    // -------------------------
    const setCommonPrint = (sheet) => {
      sheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
        margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      };
    };

    const addHeaderBlock = (sheet, lastColLetter, title) => {
      // Title band
      sheet.mergeCells(`A1:${lastColLetter}1`);
      const t = sheet.getCell("A1");
      t.value = title;
      t.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
      t.alignment = { vertical: "middle", horizontal: "left" };
      t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      sheet.getRow(1).height = 26;

      // Accent line
      sheet.mergeCells(`A2:${lastColLetter}2`);
      const a = sheet.getCell("A2");
      a.value = "";
      a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
      sheet.getRow(2).height = 6;

      // Filter Applied (wrapped)
      sheet.mergeCells(`A3:${lastColLetter}3`);
      const f = sheet.getCell("A3");
      f.value = `Filter Applied: ${filterText}`;
      f.font = { name: "Calibri", size: 11 };
      f.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      sheet.getRow(3).height = 30;

      // Exported at
      sheet.mergeCells(`A4:${lastColLetter}4`);
      const e = sheet.getCell("A4");
      e.value = `Exported At: ${exportedAt}`;
      e.font = { name: "Calibri", size: 11 };
      e.alignment = { vertical: "middle", horizontal: "left" };
      sheet.getRow(4).height = 18;

      // Spacer
      sheet.mergeCells(`A5:${lastColLetter}5`);
      sheet.getRow(5).height = 6;
    };

    const addSignatureBlock = (sheet, lastColLetter, signRow) => {
      sheet.getRow(signRow).height = 18;

      sheet.getCell(`A${signRow}`).value = "Report Approved:";
      sheet.getCell(`A${signRow}`).font = { name: "Calibri", size: 11, bold: true };

      sheet.mergeCells(`B${signRow}:E${signRow}`);
      sheet.getCell(`B${signRow}`).border = {
        bottom: { style: "thin", color: { argb: GREY } },
      };

      sheet.mergeCells(`B${signRow + 1}:E${signRow + 1}`);
      sheet.getCell(`B${signRow + 1}`).value = "Signature over Printed Name";
      sheet.getCell(`B${signRow + 1}`).font = { name: "Calibri", size: 10, color: { argb: GREY } };

      sheet.getCell(`F${signRow}`).value = "Date:";
      sheet.getCell(`F${signRow}`).font = { name: "Calibri", size: 11, bold: true };

      sheet.mergeCells(`G${signRow}:H${signRow}`);
      sheet.getCell(`G${signRow}`).border = {
        bottom: { style: "thin", color: { argb: GREY } },
      };

      // Ensure printing includes signature area
      sheet.pageSetup.printArea = `A1:${lastColLetter}${signRow + 2}`;
    };

    const captureToBase64 = async (chartId) => {
      const el = document.getElementById(chartId);
      if (!el) return null;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      return canvas.toDataURL("image/png");
    };

    /**
     * Chart sheet layout (A..H)
     * Rows:
     *  1-5 header/meta
     *  6    title 1
     *  7-24 chart 1 image
     *  26   title 2
     *  27-44 chart 2 image
     *  46+  signature
     */
    const buildTwoChartsSheet = async (sheet, sheetTitle, top, bottom) => {
      // Make sure columns A..H exist with friendly widths
      sheet.columns = Array.from({ length: 8 }, (_, i) => ({
        header: "",
        key: `c${i + 1}`,
        width: i === 0 ? 34 : 18,
      }));

      setCommonPrint(sheet);
      sheet.views = [{ state: "frozen", ySplit: 5 }];

      const lastColLetter = "H";
      addHeaderBlock(sheet, lastColLetter, sheetTitle);

      // Title 1
      sheet.getCell("A6").value = top.title;
      sheet.getCell("A6").font = { name: "Calibri", size: 14, bold: true };
      sheet.getRow(6).height = 20;

      // Chart 1 image (starts at Excel row 7)
      const top64 = await captureToBase64(top.id);
      if (top64) {
        const imgId = workbook.addImage({ base64: top64, extension: "png" });
        sheet.addImage(imgId, {
          tl: { col: 0, row: 6 }, // 0-based row=6 => row 7
          ext: { width: 900, height: 360 },
        });
      } else {
        sheet.getCell("A8").value = "(Chart not found in DOM)";
        sheet.getCell("A8").font = { name: "Calibri", size: 11, color: { argb: GREY } };
      }

      // Spacer
      sheet.getRow(25).height = 8;

      // Title 2
      sheet.getCell("A26").value = bottom.title;
      sheet.getCell("A26").font = { name: "Calibri", size: 14, bold: true };
      sheet.getRow(26).height = 20;

      // Chart 2 image (starts at Excel row 27)
      const bottom64 = await captureToBase64(bottom.id);
      if (bottom64) {
        const imgId2 = workbook.addImage({ base64: bottom64, extension: "png" });
        sheet.addImage(imgId2, {
          tl: { col: 0, row: 26 }, // 0-based row=26 => row 27
          ext: { width: 900, height: 360 },
        });
      } else {
        sheet.getCell("A28").value = "(Chart not found in DOM)";
        sheet.getCell("A28").font = { name: "Calibri", size: 11, color: { argb: GREY } };
      }

      // Signature (NOT overwritten, placed after chart area)
      // (chart images occupy roughly rows 7-24 and 27-44 visually)
      addSignatureBlock(sheet, lastColLetter, 47);
    };

    // ======================================================
    // SHEET 1 — PEAK SUMMARY (styled table)
    // ======================================================
    const sheet1 = workbook.addWorksheet("Peak Summary", {
      views: [{ state: "frozen", ySplit: 6 }],
    });
    setCommonPrint(sheet1);

    const cols = [
      { header: "#", key: "__row", width: 6 },
      { header: "Station Name", key: "StationName", width: 22 },
      { header: "Peak Day", key: "peakDay", width: 14 },
      { header: "Peak Day Count", key: "peakDayCount", width: 16 },
      { header: "Off-Peak Day", key: "offPeakDay", width: 14 },
      { header: "Off-Peak Day Count", key: "offPeakDayCount", width: 18 },
      { header: "Peak Hour", key: "peakHour", width: 14 },
      { header: "Peak Hour Count", key: "peakHourCount", width: 16 },
      { header: "Off-Peak Hour", key: "offPeakHour", width: 16 },
      { header: "Off-Peak Hour Count", key: "offPeakHourCount", width: 20 },
    ];
    sheet1.columns = cols;
    const lastColLetter1 = sheet1.getColumn(cols.length).letter;

    addHeaderBlock(sheet1, lastColLetter1, "Peak & Off-Peak Analysis Report");

    // Header row
    const headerRowIndex = 6;
    const headerRow = sheet1.getRow(headerRowIndex);
    cols.forEach((c, i) => {
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

    sheet1.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: cols.length },
    };

    // Data
    const summaryRows = report.perStation.map((s, idx) => ({
      __row: idx + 1,
      StationName: s.StationName,
      peakDay: s.peakDay?.day_name || "N/A",
      peakDayCount: s.peakDay?.total || 0,
      offPeakDay: s.offPeakDay?.day_name || "N/A",
      offPeakDayCount: s.offPeakDay?.total || 0,
      peakHour: s.peakHour?.label || "N/A",
      peakHourCount: s.peakHour?.total || 0,
      offPeakHour: s.offPeakHour?.label || "N/A",
      offPeakHourCount: s.offPeakHour?.total || 0,
    }));

    sheet1.addRows(summaryRows);

    const startRow = headerRowIndex + 1;
    const endRow = sheet1.rowCount;

    for (let r = startRow; r <= endRow; r++) {
      const row = sheet1.getRow(r);
      row.height = 18;
      const isAlt = (r - startRow) % 2 === 1;

      for (let c = 1; c <= cols.length; c++) {
        const cell = row.getCell(c);

        cell.fill = isAlt
          ? { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } }
          : { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };

        cell.border = {
          top: { style: "thin", color: { argb: BORDER } },
          left: { style: "thin", color: { argb: BORDER } },
          bottom: { style: "thin", color: { argb: BORDER } },
          right: { style: "thin", color: { argb: BORDER } },
        };

        const key = cols[c - 1].key;
        const centerKeys = ["__row", "peakDayCount", "offPeakDayCount", "peakHourCount", "offPeakHourCount"];
        cell.alignment = {
          vertical: "middle",
          horizontal: centerKeys.includes(key) ? "center" : "left",
          wrapText: true,
        };
        cell.font = { name: "Calibri", size: 10 };
      }
    }

    // Signature directly after table (not too far)
    addSignatureBlock(sheet1, lastColLetter1, endRow + 3);

    // ======================================================
    // SHEET 2 — GLOBAL CHARTS (FIXED formatting + signature)
    // ======================================================
    const sheet2 = workbook.addWorksheet("Global Charts");
    await buildTwoChartsSheet(sheet2, "Global Charts", {
      id: "globalDayChart",
      title: "Global Bookings by Day of Week",
    }, {
      id: "globalHourChart",
      title: "Global Bookings by Hour",
    });

    // ======================================================
    // SHEET 3 — STATION CHARTS (FIXED formatting + signature)
    // ======================================================
    const sheet3 = workbook.addWorksheet("Station Charts");
    await buildTwoChartsSheet(sheet3, "Station Charts", {
      id: "stationDayChart",
      title: `${selectedStation} – Bookings by Day`,
    }, {
      id: "stationHourChart",
      title: `${selectedStation} – Bookings by Hour`,
    });

    // ======================================================
    // DOWNLOAD
    // ======================================================
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PeakReport_${start}-${end}.xlsx`;
    link.click();

    showToast("Success!", "Excel exported with charts!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "Error generating Excel file.", "error");
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
