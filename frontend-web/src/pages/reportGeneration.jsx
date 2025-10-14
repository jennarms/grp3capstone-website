import axios from 'axios';
import ExcelJS from 'exceljs'; // Import exceljs
import { jsPDF } from "jspdf"; // Import jsPDF for PDF export
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./reportGeneration.css";

/* Helpers */
const fmt = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

const COLORS = ["#2E5BFF", "#1BC882", "#FFB020", "#E66C6C", "#8C54FF"];

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
  const apiUrl = import.meta.env.VITE_API_URL; // API URL from environment

  const today = new Date();
  const aWeekAgo = new Date(today);
  aWeekAgo.setDate(today.getDate() - 7);

  const [start, setStart] = useState(aWeekAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState([]); // This will hold the fetched report data

  const reportRef = useRef(null);

  const [toast, setToast] = useState({ open: false, title: "", message: "", tone: "success" });
  const toastTimer = useRef(null);
  const showToast = (title, message, tone = "success") => {
    setToast({ open: true, title, message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), 2800);
  };

  useEffect(() => {
    // Clean up toast timer
    return () => toastTimer.current && clearTimeout(toastTimer.current);
  }, []);

  // Fetch data from backend when the date range changes
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/generatereport/generate_report`, {
          params: {
            start_date: start,
            end_date: end,
          }
        });
        setRows(response.data); // Set fetched data to rows state
        showToast("Report refreshed", `Range: ${fmt(start)} — ${fmt(end)}`, "success");
      } catch (error) {
        console.error("Error fetching report data:", error);
        showToast("Error", "Failed to fetch report data", "error");
      }
    };

    fetchReportData();
  }, [start, end, apiUrl]);

  // Export as PDF
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

  // Export as Excel
  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();

      // 1) Stations table
      const sheet1 = workbook.addWorksheet("Stations");
      sheet1.columns = [
        { header: 'Station Name', key: 'stationName', width: 20 },
        { header: 'Total Bookings', key: 'totalBookings', width: 15 },
        { header: 'Canceled Bookings', key: 'canceledBookings', width: 15 },
        { header: 'Female Count', key: 'femaleCount', width: 15 },
        { header: 'Male Count', key: 'maleCount', width: 15 },
        { header: 'Other Gender Count', key: 'otherGenderCount', width: 20 },
        { header: 'Age 0-18', key: 'age0_18', width: 12 },
        { header: 'Age 19-25', key: 'age19_25', width: 12 },
        { header: 'Age 26-40', key: 'age26_40', width: 12 },
        { header: 'Age 41-60', key: 'age41_60', width: 12 },
        { header: 'Age 60+', key: 'age60Plus', width: 12 },
        { header: 'Student Count', key: 'studentCount', width: 15 },
        { header: 'Senior Count', key: 'seniorCount', width: 15 },
        { header: 'PWD Count', key: 'pwdCount', width: 12 },
        { header: 'Peak Day', key: 'peakDay', width: 15 },
        { header: 'Peak Time', key: 'peakTime', width: 15 },
        { header: 'Off Peak Day', key: 'offPeakDay', width: 15 },
        { header: 'Off Peak Time', key: 'offPeakTime', width: 15 },
        { header: 'Mobile App', key: 'mobileApp', width: 12 },
        { header: 'Chatbot', key: 'chatbot', width: 12 },
        { header: 'Gmail', key: 'gmail', width: 12 },
        { header: 'Manual', key: 'manual', width: 12 }
      ];
      sheet1.addRows(rows);

      // Save the workbook
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `StationReport_${fmt(start)}-${fmt(end)}.xlsx`;
      link.click();

      showToast("Success!", "Excel exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'exceljs'.", "error");
    }
  };

  // Aggregating data for charts
  const totalsData = rows.map((r) => ({ name: r.stationName, total: r.totalBookings }));
  const genderTotals = [
    { name: "Female", value: rows.reduce((acc, r) => acc + r.femaleCount, 0) },
    { name: "Male", value: rows.reduce((acc, r) => acc + r.maleCount, 0) },
  ];

  const sourceTotals = [
    { name: "Mobile App", value: rows.reduce((acc, r) => acc + r.mobileApp, 0) },
    { name: "Chatbot", value: rows.reduce((acc, r) => acc + r.chatbot, 0) },
    { name: "Gmail", value: rows.reduce((acc, r) => acc + r.gmail, 0) },
    { name: "Manual", value: rows.reduce((acc, r) => acc + r.manual, 0) },
  ];

  return (
    <>
      <Navbar />
      <HeaderButton />
      <Toast open={toast.open} title={toast.title} message={toast.message} tone={toast.tone} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      <div className="reports-page" id="reportsPage">
        <main className="reports-main">
          <header className="reports-header-row">
            <div>
              <h1 className="reports-title">Report Generation</h1>
              <div className="reports-subtitle">Station Usage Summary Report</div>
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
            <div className="rg-table-head">
              <div className="rg-range-label">Report for <b>{fmt(start)}</b> — <b>{fmt(end)}</b></div>
              <button className="rg-btn rg-btn-generate" type="button" onClick={exportPDF}>Generate Report</button>
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
                    <th>Peak Day</th>
                    <th>Peak Time</th>
                    <th>Off Peak Day</th>
                    <th>Off Peak Time</th>
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
                      <td>{r.PeakDay}</td>
                      <td>{r.PeakTime}</td>
                      <td>{r.OffPeakDay}</td>
                      <td>{r.OffPeakTime}</td>
                      <td>{r.MobileAppCount}</td>
                      <td>{r.ChatbotCount}</td>
                      <td>{r.EmailCount}</td>
                      <td>{r.ManualBookingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts */}
          <div className="rg-charts">
            <section className="chart-card">
              <h3 className="chart-title">Total Bookings</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={totalsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section className="chart-card">
              <h3 className="chart-title">Gender Ratio</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Legend />
                  <Tooltip />
                  <Pie data={genderTotals} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {genderTotals.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </section>

            <section className="chart-card">
              <h3 className="chart-title">Booking Source</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie data={sourceTotals} dataKey="value" nameKey="name" outerRadius={80}>
                    {sourceTotals.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </section>
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
