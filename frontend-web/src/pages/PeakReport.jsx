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
  // EXPORT FUNCTIONS
  // ===========================
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
      showToast(
        "Export failed",
        "Please install 'jspdf' and 'html2canvas'.",
        "error"
      );
    }
  };

const exportExcel = async () => {
  if (!report || !report.perStation) {
    showToast("Error", "No data to export", "error");
    return;
  }

  try {
    const { default: html2canvas } = await import("html2canvas");

    const workbook = new ExcelJS.Workbook();

    // ============================================
    // SHEET 1 — Peak Summary Table
    // ============================================
    const sheet1 = workbook.addWorksheet("Peak Summary");

    sheet1.columns = [
      { header: "Station Name", key: "StationName", width: 20 },
      { header: "Peak Day", key: "peakDay", width: 15 },
      { header: "Peak Day Count", key: "peakDayCount", width: 15 },
      { header: "Off-Peak Day", key: "offPeakDay", width: 15 },
      { header: "Off-Peak Day Count", key: "offPeakDayCount", width: 18 },
      { header: "Peak Hour", key: "peakHour", width: 12 },
      { header: "Peak Hour Count", key: "peakHourCount", width: 15 },
      { header: "Off-Peak Hour", key: "offPeakHour", width: 15 },
      { header: "Off-Peak Hour Count", key: "offPeakHourCount", width: 18 },
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

    // ============================================
    // HELPER: Capture chart as image and insert in sheet
    // ============================================
    const captureChart = async (chartId, sheet, startRow) => {
      const el = document.getElementById(chartId);
      if (!el) return;

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
    };

    // ============================================
    // SHEET 2 — Global Charts
    // ============================================
    const sheet2 = workbook.addWorksheet("Global Charts");

    sheet2.getCell("A1").value = "Global Bookings by Day of Week";
    sheet2.getCell("A1").font = { bold: true, size: 16 };
    await captureChart("globalDayChart", sheet2, 2);

    sheet2.getCell("A25").value = "Global Bookings by Hour";
    sheet2.getCell("A25").font = { bold: true, size: 16 };
    await captureChart("globalHourChart", sheet2, 26);

    // ============================================
    // SHEET 3 — Station Charts
    // ============================================
    const sheet3 = workbook.addWorksheet("Station Charts");

    sheet3.getCell("A1").value = `${selectedStation} – Bookings by Day`;
    sheet3.getCell("A1").font = { bold: true, size: 16 };
    await captureChart("stationDayChart", sheet3, 2);

    sheet3.getCell("A25").value = `${selectedStation} – Bookings by Hour`;
    sheet3.getCell("A25").font = { bold: true, size: 16 };
    await captureChart("stationHourChart", sheet3, 26);

    // ============================================
    // DOWNLOAD EXCEL FILE
    // ============================================
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PeakReport_${fmt(start)}-${fmt(end)}.xlsx`;
    link.click();

    showToast("Success!", "Excel exported with charts!", "success");
  } catch (err) {
    console.error(err);
    showToast("Export failed", "Error generating Excel file.", "error");
  }
};



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

  // Color palette
  const stationColors = [
    "#2E5BFF", "#FFB020", "#1BC882", "#8C54FF",
    "#FF4D4F", "#00C1D4", "#FF7A45", "#52C41A"
  ];

  // ===========================
  // GLOBAL DAY + STATION MERGED
  // ===========================
  const globalDayWithStations = (() => {
    if (!report?.perStation) return sortedGlobalDayData;

    const dayMap = {};

    sortedGlobalDayData.forEach(day => {
      dayMap[day.day_name] = {
        day_name: day.day_name,
        total: day.total
      };
    });

    report.perStation.forEach(st => {
      st.byDay.forEach(d => {
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

    globalHourData.forEach(h => {
      hourMap[h.label] = {
        label: h.label,
        total: h.total
      };
    });

    report.perStation.forEach(st => {
      st.byHour.forEach(h => {
        if (!hourMap[h.label]) hourMap[h.label] = { label: h.label };
        hourMap[h.label][st.StationName] = h.total;
      });
    });

    return Object.values(hourMap);
  })();

  return (
    <>
      <Navbar />
      <HeaderButton />
      <Toast open={toast.open} title={toast.title} message={toast.message} tone={toast.tone} />

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
                      <YAxis allowDecimals={false} domain={[0, "dataMax + 1"]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#8C54FF" name="Total Bookings" />
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
                      <YAxis allowDecimals={false} domain={[0, "dataMax + 1"]} />
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
