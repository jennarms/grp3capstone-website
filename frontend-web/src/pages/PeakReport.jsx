import axios from 'axios';
import ExcelJS from 'exceljs';
import { jsPDF } from "jspdf";
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
    const fetchPeakReport = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/generatereport/generate_peak_report`, {
          params: {
            start_date: start,
            end_date: end,
          }
        });
        setReport(response.data);

        // Default selected station (first in list)
        if (response.data.perStation && response.data.perStation.length > 0) {
          setSelectedStation(response.data.perStation[0].StationName);
        }

        showToast("Report refreshed", `Range: ${fmt(start)} — ${fmt(end)}`, "success");
      } catch (error) {
        console.error("Error fetching peak report:", error);
        showToast("Error", "Failed to fetch peak report data", "error");
      }
    };

    fetchPeakReport();
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

      pdf.save(`PeakReport_${fmt(start)}-${fmt(end)}.pdf`);
      showToast("Success!", "PDF exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'jspdf' and 'html2canvas'.", "error");
    }
  };

  const exportExcel = async () => {
    if (!report || !report.perStation) {
      showToast("Error", "No data to export", "error");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Per-Station Peak/Off-Peak Summary
      const sheet1 = workbook.addWorksheet("Peak Summary");
      sheet1.columns = [
        { header: 'Station Name', key: 'StationName', width: 20 },
        { header: 'Peak Day', key: 'peakDay', width: 15 },
        { header: 'Peak Day Count', key: 'peakDayCount', width: 15 },
        { header: 'Off-Peak Day', key: 'offPeakDay', width: 15 },
        { header: 'Off-Peak Day Count', key: 'offPeakDayCount', width: 18 },
        { header: 'Peak Hour', key: 'peakHour', width: 12 },
        { header: 'Peak Hour Count', key: 'peakHourCount', width: 15 },
        { header: 'Off-Peak Hour', key: 'offPeakHour', width: 15 },
        { header: 'Off-Peak Hour Count', key: 'offPeakHourCount', width: 18 },
      ];

      const summaryData = report.perStation.map((s) => ({
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

      sheet1.addRows(summaryData);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PeakReport_${fmt(start)}-${fmt(end)}.xlsx`;
      link.click();

      showToast("Success!", "Excel exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'exceljs'.", "error");
    }
  };

  // Data helpers
  const formatDayOrder = (data) => {
    const order = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const map = {};
    data.forEach((d) => {
      map[d.day_name] = d;
    });
    return order
      .filter((name) => map[name])
      .map((name) => map[name]);
  };

  const globalDayData = report?.global?.byDay || [];
  const globalHourData = report?.global?.byHour || [];

  const stationData =
    report?.perStation?.find((s) => s.StationName === selectedStation) || null;

  const stationDayData = stationData?.byDay || [];
  const stationHourData = stationData?.byHour || [];

  const sortedGlobalDayData = formatDayOrder(globalDayData);
  const sortedStationDayData = formatDayOrder(stationDayData);

  return (
    <>
      <Navbar />
      <HeaderButton />
      <Toast open={toast.open} title={toast.title} message={toast.message} tone={toast.tone} onClose={() => setToast((t) => ({ ...t, open: false }))} />

      <div className="reports-page" id="peakReportsPage">
        <main className="reports-main">
          <header className="reports-header-row">
            <div>
              <h1 className="reports-title">Peak & Off-Peak Analysis</h1>
              <div className="reports-subtitle">Station Peak Times and Busiest Days Report</div>
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

          {/* Station Selector */}
          {report?.perStation && report.perStation.length > 0 && (
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
              <div className="rg-range-label">Report for <b>{fmt(start)}</b> — <b>{fmt(end)}</b></div>
            </div>

            {/* Peak/Off-Peak Summary Table */}
            {report?.perStation && report.perStation.length > 0 && (
              <div className="rg-table-wrap" role="region" aria-label="Peak summary">
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

            {/* Charts Section */}
            {report && (
              <div className="rg-charts" style={{ marginTop: '40px' }}>
                {/* Global - By Day of Week */}
                <section className="chart-card" style={{ marginBottom: '30px' }}>
                  <h3 className="chart-title">Global Bookings by Day of Week</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={sortedGlobalDayData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day_name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#2E5BFF" name="Total Bookings" />
                    </BarChart>
                  </ResponsiveContainer>
                </section>

                {/* Global - By Hour */}
                <section className="chart-card" style={{ marginBottom: '30px' }}>
                  <h3 className="chart-title">Global Bookings by Hour</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={globalHourData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" stroke="#1BC882" name="Total Bookings" />
                    </LineChart>
                  </ResponsiveContainer>
                </section>

                {/* Per Station - By Day */}
                {stationData && (
                  <section className="chart-card" style={{ marginBottom: '30px' }}>
                    <h3 className="chart-title">
                      {stationData.StationName} – Bookings by Day of Week
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={sortedStationDayData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day_name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#8C54FF" name="Total Bookings" />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>
                )}

                {/* Per Station - By Hour */}
                {stationData && (
                  <section className="chart-card" style={{ marginBottom: '30px' }}>
                    <h3 className="chart-title">
                      {stationData.StationName} – Bookings by Hour
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={stationHourData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" stroke="#FFB020" name="Total Bookings" />
                      </LineChart>
                    </ResponsiveContainer>
                  </section>
                )}
              </div>
            )}
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