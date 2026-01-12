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

  const buildFilterText = () => `Date Range: ${fmt(start)} — ${fmt(end)}`;

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

    const buildFilterText = () => `Date Range: ${fmt(start)} — ${fmt(end)}`;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const exportedAt = formatExportDateTime();
    const filterText = buildFilterText();

    const drawHeader = (title) => {
      doc.setFillColor(THEME.blue);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setFillColor(THEME.green);
      doc.rect(0, 18, pageW, 2, "F");

      doc.setTextColor(THEME.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(title, 12, 12);
    };

    const drawFooter = () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Page ${page}`, pageW - 20, pageH - 6);
    };

    // --------------------------
    // PAGE 1 — TABLE (NEVER CUTS)
    // --------------------------
    drawHeader("Comprehensive Report");

    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const maxTextW = pageW - 24;
    const filterLines = doc.splitTextToSize(`Filter Applied: ${filterText}`, maxTextW);

    let y = 28;
    doc.text(filterLines, 12, y);
    y += filterLines.length * 5;

    doc.text(`Exported At: ${exportedAt}`, 12, y);
    y += 6;

    const head = [[
      "#",
      "Station Name",
      "Total Bookings",
      "Canceled",
      "Female",
      "Male",
      "Other",
      "Age 0-18",
      "Age 19-25",
      "Age 26-40",
      "Age 41-60",
      "Age 60+",
      "Student",
      "Senior",
      "PWD",
      "Mobile App",
      "Chatbot",
      "Gmail",
      "Manual",
    ]];

    const body = rows.map((r, idx) => ([
      String(idx + 1),
      r.StationName ?? "",
      String(r.TotalBookings ?? 0),
      String(r.CanceledCount ?? 0),
      String(r.FemaleCount ?? 0),
      String(r.MaleCount ?? 0),
      String(r.OtherGenderCount ?? 0),
      String(r.Age_0_18 ?? 0),
      String(r.Age_19_25 ?? 0),
      String(r.Age_26_40 ?? 0),
      String(r.Age_41_60 ?? 0),
      String(r.Age_60Plus ?? 0),
      String(r.StudentCount ?? 0),
      String(r.SeniorCount ?? 0),
      String(r.PWDCount ?? 0),
      String(r.MobileAppCount ?? 0),
      String(r.ChatbotCount ?? 0),
      String(r.EmailCount ?? 0),
      String(r.ManualBookingCount ?? 0),
    ]));

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,          // compact for many columns
        cellPadding: 1.5,
        valign: "middle",
        textColor: 20,
        lineColor: 220,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: THEME.blue,
        textColor: THEME.white,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: [240, 253, 248],
      },
      margin: { left: 6, right: 6 },
      didDrawPage: drawFooter,
    });

    // Ensure footer on first page
    drawFooter();

    // --------------------------
    // Chart capture helpers
    // --------------------------
    const captureEl = async (id) => {
      const el = document.getElementById(id);
      if (!el) return null;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      return { canvas, imgData: canvas.toDataURL("image/png") };
    };

    // 2 charts per page
    const addTwoChartsPage = async (pageTitle, top, bottom) => {
      const topCap = await captureEl(top.id);
      const bottomCap = await captureEl(bottom.id);

      if (!topCap && !bottomCap) return;

      doc.addPage();
      drawHeader(pageTitle);

      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const lines = doc.splitTextToSize(`Filter Applied: ${filterText}`, maxTextW);
      const metaY = 28;
      doc.text(lines, 12, metaY);

      const marginX = 12;
      const gap = 6;
      const labelH = 5;

      let yStart = metaY + lines.length * 5 + 6;

      const bottomMargin = 14;
      const availableH = pageH - yStart - bottomMargin;

      const chartBoxH = (availableH - gap - labelH * 2) / 2;
      const maxW = pageW - marginX * 2;

      const drawChartBlock = (cap, title, yy) => {
        if (!cap) return yy + chartBoxH + labelH + gap;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30);
        doc.text(title, marginX, yy);

        const imgTopY = yy + labelH;

        let drawW = maxW;
        let drawH = (cap.canvas.height * drawW) / cap.canvas.width;

        // fit by height
        if (drawH > chartBoxH) {
          drawH = chartBoxH;
          drawW = (cap.canvas.width * drawH) / cap.canvas.height;
        }
        // fit by width safety
        if (drawW > maxW) {
          drawW = maxW;
          drawH = (cap.canvas.height * drawW) / cap.canvas.width;
        }

        const x = (pageW - drawW) / 2;
        doc.addImage(cap.imgData, "PNG", x, imgTopY, drawW, drawH);

        return imgTopY + chartBoxH + gap;
      };

      yStart = drawChartBlock(topCap, top.title, yStart);
      yStart = drawChartBlock(bottomCap, bottom.title, yStart);

      drawFooter();
    };

    // 1 chart per page (no duplicates)
    const addOneChartPage = async (pageTitle, chart) => {
      const cap = await captureEl(chart.id);
      if (!cap) return;

      doc.addPage();
      drawHeader(pageTitle);

      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const lines = doc.splitTextToSize(`Filter Applied: ${filterText}`, maxTextW);
      const metaY = 28;
      doc.text(lines, 12, metaY);

      const marginX = 12;
      const labelH = 6;
      const bottomMargin = 14;

      let yStart = metaY + lines.length * 5 + 8;

      const availableH = pageH - yStart - bottomMargin;
      const maxW = pageW - marginX * 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text(chart.title, marginX, yStart);

      const imgTopY = yStart + labelH;

      let drawW = maxW;
      let drawH = (cap.canvas.height * drawW) / cap.canvas.width;

      // fit by height
      if (drawH > availableH - labelH) {
        drawH = availableH - labelH;
        drawW = (cap.canvas.width * drawH) / cap.canvas.height;
      }
      // fit by width safety
      if (drawW > maxW) {
        drawW = maxW;
        drawH = (cap.canvas.height * drawW) / cap.canvas.width;
      }

      const x = (pageW - drawW) / 2;
      doc.addImage(cap.imgData, "PNG", x, imgTopY, drawW, drawH);

      drawFooter();
    };

    // --------------------------
    // CHART PAGES
    // --------------------------
    await addTwoChartsPage("Charts",
      { id: "chart-bookings-cancelled", title: "Total vs Cancelled Bookings Per Station" },
      { id: "chart-gender", title: "Gender Distribution Per Station" }
    );

    await addTwoChartsPage("Charts",
      { id: "chart-age", title: "Age Distribution Per Station" },
      { id: "chart-demographics", title: "Demographics Distribution Per Station" }
    );

    // ✅ last one is single chart (NO DUPLICATE)
    await addOneChartPage("Charts", {
      id: "chart-platform",
      title: "Preferred Platform Source Per Station",
    });

    // --------------------------
    // FINAL PAGE — APPROVAL
    // --------------------------
    doc.addPage();
    drawHeader("Report Approval");

    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const approvalMeta = doc.splitTextToSize(
      `Report Range: ${fmt(start)} — ${fmt(end)}\nExported At: ${exportedAt}`,
      maxTextW
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
    doc.save(`StationReport_${start}-${end}.pdf`);
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

      // ARGB theme colors
      const BLUE = "FF000C6F";
      const GREEN = "FF3FE19B";
      const WHITE = "FFFFFFFF";
      const LIGHT_GREEN = "FFF0FDF8";
      const BORDER = "FFD9D9D9";
      const GREY = "FF666666";

      const exportedAt = formatExportDateTime();
      const filterText = buildFilterText();

      const setCommonPrint = (sheet) => {
        sheet.pageSetup = {
          orientation: "landscape",
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

      const addHeaderBlock = (sheet, lastColLetter, title) => {
        sheet.mergeCells(`A1:${lastColLetter}1`);
        const t = sheet.getCell("A1");
        t.value = title;
        t.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
        t.alignment = { vertical: "middle", horizontal: "left" };
        t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
        sheet.getRow(1).height = 26;

        sheet.mergeCells(`A2:${lastColLetter}2`);
        const a = sheet.getCell("A2");
        a.value = "";
        a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
        sheet.getRow(2).height = 6;

        sheet.mergeCells(`A3:${lastColLetter}3`);
        const f = sheet.getCell("A3");
        f.value = `Filter Applied: ${filterText}`;
        f.font = { name: "Calibri", size: 11 };
        f.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        sheet.getRow(3).height = 30;

        sheet.mergeCells(`A4:${lastColLetter}4`);
        const e = sheet.getCell("A4");
        e.value = `Exported At: ${exportedAt}`;
        e.font = { name: "Calibri", size: 11 };
        e.alignment = { vertical: "middle", horizontal: "left" };
        sheet.getRow(4).height = 18;

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
        sheet.getCell(`B${signRow + 1}`).font = {
          name: "Calibri",
          size: 10,
          color: { argb: GREY },
        };

        sheet.getCell(`F${signRow}`).value = "Date:";
        sheet.getCell(`F${signRow}`).font = { name: "Calibri", size: 11, bold: true };

        sheet.mergeCells(`G${signRow}:H${signRow}`);
        sheet.getCell(`G${signRow}`).border = {
          bottom: { style: "thin", color: { argb: GREY } },
        };

        sheet.pageSetup.printArea = `A1:${lastColLetter}${signRow + 2}`;
      };

      const captureBase64 = async (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        return canvas.toDataURL("image/png");
      };

      // --------------------------
      // Sheet 1: Stations (styled table)
      // --------------------------
      const sheet1 = workbook.addWorksheet("Stations", {
        views: [{ state: "frozen", ySplit: 6 }],
      });
      setCommonPrint(sheet1);

      const cols = [
        { header: "#", key: "__row", width: 6 },
        { header: "Station Name", key: "StationName", width: 20 },
        { header: "Total Bookings", key: "TotalBookings", width: 15 },
        { header: "Canceled", key: "CanceledCount", width: 12 },
        { header: "Female", key: "FemaleCount", width: 10 },
        { header: "Male", key: "MaleCount", width: 10 },
        { header: "Other", key: "OtherGenderCount", width: 10 },
        { header: "Age 0-18", key: "Age_0_18", width: 10 },
        { header: "Age 19-25", key: "Age_19_25", width: 10 },
        { header: "Age 26-40", key: "Age_26_40", width: 10 },
        { header: "Age 41-60", key: "Age_41_60", width: 10 },
        { header: "Age 60+", key: "Age_60Plus", width: 10 },
        { header: "Student", key: "StudentCount", width: 10 },
        { header: "Senior", key: "SeniorCount", width: 10 },
        { header: "PWD", key: "PWDCount", width: 10 },
        { header: "Mobile App", key: "MobileAppCount", width: 12 },
        { header: "Chatbot", key: "ChatbotCount", width: 10 },
        { header: "Gmail", key: "EmailCount", width: 10 },
        { header: "Manual", key: "ManualBookingCount", width: 10 },
      ];
      sheet1.columns = cols;

      const lastColLetter1 = sheet1.getColumn(cols.length).letter;
      addHeaderBlock(sheet1, lastColLetter1, "Comprehensive Station Report");

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

      const dataRows = rows.map((r, idx) => ({
        __row: idx + 1,
        StationName: r.StationName ?? "",
        TotalBookings: r.TotalBookings ?? 0,
        CanceledCount: r.CanceledCount ?? 0,
        FemaleCount: r.FemaleCount ?? 0,
        MaleCount: r.MaleCount ?? 0,
        OtherGenderCount: r.OtherGenderCount ?? 0,
        Age_0_18: r.Age_0_18 ?? 0,
        Age_19_25: r.Age_19_25 ?? 0,
        Age_26_40: r.Age_26_40 ?? 0,
        Age_41_60: r.Age_41_60 ?? 0,
        Age_60Plus: r.Age_60Plus ?? 0,
        StudentCount: r.StudentCount ?? 0,
        SeniorCount: r.SeniorCount ?? 0,
        PWDCount: r.PWDCount ?? 0,
        MobileAppCount: r.MobileAppCount ?? 0,
        ChatbotCount: r.ChatbotCount ?? 0,
        EmailCount: r.EmailCount ?? 0,
        ManualBookingCount: r.ManualBookingCount ?? 0,
      }));

      sheet1.addRows(dataRows);

      const startData = headerRowIndex + 1;
      const endData = sheet1.rowCount;

      const centerKeys = new Set([
        "__row",
        "TotalBookings",
        "CanceledCount",
        "FemaleCount",
        "MaleCount",
        "OtherGenderCount",
        "Age_0_18",
        "Age_19_25",
        "Age_26_40",
        "Age_41_60",
        "Age_60Plus",
        "StudentCount",
        "SeniorCount",
        "PWDCount",
        "MobileAppCount",
        "ChatbotCount",
        "EmailCount",
        "ManualBookingCount",
      ]);

      for (let r = startData; r <= endData; r++) {
        const row = sheet1.getRow(r);
        row.height = 18;
        const isAlt = (r - startData) % 2 === 1;

        for (let c = 1; c <= cols.length; c++) {
          const cell = row.getCell(c);
          const key = cols[c - 1].key;

          cell.fill = isAlt
            ? { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_GREEN } }
            : { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };

          cell.border = {
            top: { style: "thin", color: { argb: BORDER } },
            left: { style: "thin", color: { argb: BORDER } },
            bottom: { style: "thin", color: { argb: BORDER } },
            right: { style: "thin", color: { argb: BORDER } },
          };

          cell.alignment = {
            vertical: "middle",
            horizontal: centerKeys.has(key) ? "center" : "left",
            wrapText: true,
          };

          cell.font = { name: "Calibri", size: 10 };
        }
      }

      // signature right after table
      addSignatureBlock(sheet1, lastColLetter1, endData + 3);

      // --------------------------
      // Sheet 2: Charts (styled header + 2 charts per block + signature)
      // --------------------------
      const sheet2 = workbook.addWorksheet("Charts", {
        views: [{ state: "frozen", ySplit: 5 }],
      });
      setCommonPrint(sheet2);

      // create A..H columns so header merges reliably
      sheet2.columns = Array.from({ length: 8 }, (_, i) => ({
        header: "",
        key: `c${i + 1}`,
        width: i === 0 ? 34 : 18,
      }));

      const lastColLetter2 = "H";
      addHeaderBlock(sheet2, lastColLetter2, "Comprehensive Station Report — Charts");

      const putTitle = (row, title) => {
        sheet2.getCell(`A${row}`).value = title;
        sheet2.getCell(`A${row}`).font = { name: "Calibri", size: 14, bold: true };
        sheet2.getRow(row).height = 20;
      };

      const putImage = (base64, row1Based) => {
        if (!base64) return;
        const imgId = workbook.addImage({ base64, extension: "png" });
        // exceljs image coords use 0-based row indexes
        sheet2.addImage(imgId, {
          tl: { col: 0, row: row1Based - 1 },
          ext: { width: 900, height: 360 },
        });
      };

      // Chart block 1 (two charts)
      putTitle(6, "Total Bookings vs Cancelled");
      putImage(await captureBase64("chart-bookings-cancelled"), 7);

      putTitle(26, "Gender Distribution");
      putImage(await captureBase64("chart-gender"), 27);

      // Chart block 2 (two charts)
      putTitle(46, "Age Distribution");
      putImage(await captureBase64("chart-age"), 47);

      putTitle(66, "Demographics Distribution");
      putImage(await captureBase64("chart-demographics"), 67);

      // Chart block 3 (one chart)
      putTitle(86, "Platform Source");
      putImage(await captureBase64("chart-platform"), 87);

      // signature under charts
      addSignatureBlock(sheet2, lastColLetter2, 107);

      // --------------------------
      // Download
      // --------------------------
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `StationReport_${start}-${end}.xlsx`;
      link.click();

      showToast("Success!", "Excel exported with charts!", "success");
    } catch (err) {
      console.error(err);
      showToast(
        "Export failed",
        "Please install 'exceljs' and 'html2canvas' for charts.",
        "error"
      );
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
