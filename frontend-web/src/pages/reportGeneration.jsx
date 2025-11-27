import axios from 'axios';
import ExcelJS from 'exceljs';
import { jsPDF } from "jspdf";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./reportGeneration.css";

const fmt = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

const COLORS = ["#2E5BFF", "#1BC882", "#FFB020", "#E66C6C", "#8C54FF", "#FF6B9D", "#00D4FF", "#FFC837"];

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

  const [toast, setToast] = useState({ open: false, title: "", message: "", tone: "success" });
  const toastTimer = useRef(null);
  const showToast = (title, message, tone = "success") => {
    setToast({ open: true, title, message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), 2800);
  };

  useEffect(() => {
    return () => toastTimer.current && clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/generatereport/generate_report`, {
          params: {
            start_date: start,
            end_date: end,
          }
        });
        setRows(response.data);
        showToast("Report refreshed", `Range: ${fmt(start)} — ${fmt(end)}`, "success");
      } catch (error) {
        console.error("Error fetching report data:", error);
        showToast("Error", "Failed to fetch report data", "error");
      }
    };

    fetchReportData();
  }, [start, end, apiUrl]);

  const exportPDF = async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const node = reportRef.current;
      const canvas = await html2canvas(node, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
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

      pdf.save(`StationReport_${fmt(start)}-${fmt(end)}.pdf`);
      showToast("Success!", "PDF exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'jspdf' and 'html2canvas'.", "error");
    }
  };

const exportExcel = async () => {
  try {
    // Try to load html2canvas for chart snapshots
    let html2canvas;
    try {
      const mod = await import("html2canvas");
      html2canvas = mod.default || mod;
    } catch (err) {
      console.warn("html2canvas not available, exporting data only.", err);
    }

    const workbook = new ExcelJS.Workbook();

    // ===============================
    // SHEET 1 – RAW TABLE
    // ===============================
    const sheet1 = workbook.addWorksheet("Stations");

    sheet1.columns = [
      { header: 'Station Name', key: 'StationName', width: 20 },
      { header: 'Total Bookings', key: 'TotalBookings', width: 15 },
      { header: 'Canceled Bookings', key: 'CanceledCount', width: 15 },
      { header: 'Female Count', key: 'FemaleCount', width: 15 },
      { header: 'Male Count', key: 'MaleCount', width: 15 },
      { header: 'Other Gender Count', key: 'OtherGenderCount', width: 20 },
      { header: 'Age 0-18', key: 'Age_0_18', width: 12 },
      { header: 'Age 19-25', key: 'Age_19_25', width: 12 },
      { header: 'Age 26-40', key: 'Age_26_40', width: 12 },
      { header: 'Age 41-60', key: 'Age_41_60', width: 12 },
      { header: 'Age 60+', key: 'Age_60Plus', width: 12 },
      { header: 'Student Count', key: 'StudentCount', width: 15 },
      { header: 'Senior Count', key: 'SeniorCount', width: 15 },
      { header: 'PWD Count', key: 'PWDCount', width: 12 },
      { header: 'Mobile App', key: 'MobileAppCount', width: 12 },
      { header: 'Chatbot', key: 'ChatbotCount', width: 12 },
      { header: 'Gmail', key: 'EmailCount', width: 12 },
      { header: 'Manual', key: 'ManualBookingCount', width: 12 }
    ];

    sheet1.addRows(rows);

    // ===============================
    // If we can't add images, just export data
    // ===============================
    const canAddImages =
      typeof workbook.addImage === "function" &&
      typeof html2canvas === "function" &&
      typeof document !== "undefined";

    if (!canAddImages) {
      console.warn("Chart images not supported, exporting data only.");
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `StationReport_${fmt(start)}-${fmt(end)}.xlsx`;
      link.click();

      showToast("Success!", "Excel exported (data only).", "success");
      return;
    }

    // ===============================
    // HELPER — CAPTURE CHART AS IMAGE
    // ===============================
    const captureChart = async (chartId, sheet, startRow) => {
      try {
        const el = document.getElementById(chartId);
        if (!el) {
          console.warn(`Chart element with id=${chartId} not found`);
          return;
        }

        const canvas = await html2canvas(el, { scale: 2, useCORS: true });
        const base64 = canvas.toDataURL("image/png");

        const imgId = workbook.addImage({
          base64,
          extension: "png",
        });

        sheet.addImage(imgId, {
          tl: { col: 0, row: startRow },
          ext: { width: 900, height: 400 },
        });
      } catch (err) {
        console.error(`Failed to capture chart ${chartId}`, err);
      }
    };

    // ===============================
    // SHEET 2 – Charts
    // ===============================
    const sheet2 = workbook.addWorksheet("Charts");

    // Chart 1
    sheet2.getCell("A1").value = "Total Bookings vs Cancelled";
    sheet2.getCell("A1").font = { bold: true, size: 16 };
    await captureChart("chart-bookings-cancelled", sheet2, 2);

    // Chart 2
    sheet2.getCell("A27").value = "Gender Distribution";
    sheet2.getCell("A27").font = { bold: true, size: 16 };
    await captureChart("chart-gender", sheet2, 28);

    // Chart 3
    sheet2.getCell("A52").value = "Age Distribution";
    sheet2.getCell("A52").font = { bold: true, size: 16 };
    await captureChart("chart-age", sheet2, 53);

    // Chart 4
    sheet2.getCell("A77").value = "Demographics Distribution";
    sheet2.getCell("A77").font = { bold: true, size: 16 };
    await captureChart("chart-demographics", sheet2, 78);

    // Chart 5
    sheet2.getCell("A102").value = "Platform Source";
    sheet2.getCell("A102").font = { bold: true, size: 16 };
    await captureChart("chart-platform", sheet2, 103);

    // ===============================
    // DOWNLOAD
    // ===============================
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `StationReport_${fmt(start)}-${fmt(end)}.xlsx`;
    link.click();

    showToast("Success!", "Excel exported with charts!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "Please install 'exceljs' (and 'html2canvas' for charts).", "error");
  }
};



  // 1. Total Bookings and Cancelled Bookings Per Station
  const bookingsCancelledData = rows.map((r) => ({
    name: r.StationName,
    totalBookings: r.TotalBookings,
    cancelled: r.CanceledCount
  }));

  // 2. Gender Per Station
  const genderPerStationData = rows.map((r) => ({
    name: r.StationName,
    female: r.FemaleCount,
    male: r.MaleCount,
    other: r.OtherGenderCount
  }));

  // 3. Age Per Station
  const agePerStationData = rows.map((r) => ({
    name: r.StationName,
    "0-18": r.Age_0_18,
    "19-25": r.Age_19_25,
    "26-40": r.Age_26_40,
    "41-60": r.Age_41_60,
    "60+": r.Age_60Plus
  }));

  // 4. Demographics Distribution Per Station
  const demographicsData = rows.map((r) => ({
    name: r.StationName,
    student: r.StudentCount,
    senior: r.SeniorCount,
    pwd: r.PWDCount
  }));

  // 5. Platform Source Per Station
  const platformSourceData = rows.map((r) => ({
    name: r.StationName,
    mobileApp: r.MobileAppCount,
    chatbot: r.ChatbotCount,
    email: r.EmailCount,
    manual: r.ManualBookingCount
  }));

  return (
    <>
      <Navbar />
      <HeaderButton />
      <Toast open={toast.open} title={toast.title} message={toast.message} tone={toast.tone} onClose={() => setToast((t) => ({ ...t, open: false }))} />

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
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="start date" />
              <span>—</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="end date" />
            </div>
          </div>

          <div ref={reportRef}>
            {/* Removed the Generate Report button from here */}
            <div className="rg-table-head">
              <div className="rg-range-label">Report for <b>{fmt(start)}</b> — <b>{fmt(end)}</b></div>
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
                    {/* Removed Peak Day, Peak Time, Off Peak Day, Off Peak Time columns */}
                    <th>Mobile App</th>
                    <th>Chatbot</th>
                    <th>Gmail</th>
                    <th>Manual</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.StationName}>
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
                      {/* Removed Peak/Off-Peak data cells */}
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
            <div className="rg-charts" style={{ marginTop: '40px' }}>
              {/* Chart 1: Total Bookings and Cancelled Bookings Per Station */}
              <section className="chart-card" style={{ marginBottom: '30px' }}>
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

              {/* Chart 2: Gender Per Station */}
              <section className="chart-card" style={{ marginBottom: '30px' }}>
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

              {/* Chart 3: Age Per Station */}
              <section className="chart-card" style={{ marginBottom: '30px' }}>
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

              {/* Chart 4: Demographics Distribution Per Station */}
              <section className="chart-card" style={{ marginBottom: '30px' }}>
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

              {/* Chart 5: Platform Source Per Station */}
              <section className="chart-card" style={{ marginBottom: '30px' }}>
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
            <button className="rg-export" onClick={exportPDF}>Export as PDF</button>
            <button className="rg-export" onClick={exportExcel}>Export as Excel</button>
          </div>
        </main>
      </div>
    </>
  );
}