import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import "./reportGeneration.css";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* --------- Seed data (can be swapped with real API later) --------- */
const STATION_ROWS = [
  { stationName: "Escolta", totalBookings: 1210, femaleCount: 670, maleCount: 540, peakStart: "5:00PM",  peakEnd: "6:30PM", mobApp: 160, chatbot: 180, gmail: 120, manual: 230 },
  { stationName: "Lawton",  totalBookings: 980,  femaleCount: 540, maleCount: 440, peakStart: "6:30AM",  peakEnd: "8:00AM", mobApp: 200, chatbot: 170, gmail: 150, manual: 120 },
  { stationName: "Quinta",  totalBookings: 750,  femaleCount: 410, maleCount: 340, peakStart: "3:30PM",  peakEnd: "4:30PM", mobApp: 180, chatbot: 90,  gmail: 140, manual: 80  },
  { stationName: "PUP",     totalBookings: 1360, femaleCount: 780, maleCount: 580, peakStart: "3:00PM",  peakEnd: "6:00PM", mobApp: 560, chatbot: 270, gmail: 210, manual: 320 },
  { stationName: "Sta. Ana",totalBookings: 840,  femaleCount: 480, maleCount: 360, peakStart: "4:30PM",  peakEnd: "6:30PM", mobApp: 190, chatbot: 160, gmail: 120, manual: 150 },
  { stationName: "Lambingan", totalBookings: 600, femaleCount: 340, maleCount: 260, peakStart: "10:30AM", peakEnd: "12:00PM", mobApp: 120, chatbot: 90,  gmail: 120, manual: 120 },
  { stationName: "Valenzuela", totalBookings: 930, femaleCount: 590, maleCount: 340, peakStart: "12:00PM", peakEnd: "2:30PM",  mobApp: 220, chatbot: 190, gmail: 150, manual: 120 },
  { stationName: "Hulo",    totalBookings: 560,  femaleCount: 250, maleCount: 310, peakStart: "9:00AM",  peakEnd: "10:30AM", mobApp: 140, chatbot: 130, gmail: 109, manual: 110 },
  { stationName: "Guadalupe", totalBookings: 710, femaleCount: 390, maleCount: 320, peakStart: "12:00PM", peakEnd: "1:40PM", mobApp: 210, chatbot: 140, gmail: 130, manual: 90  },
  { stationName: "Meycauayan", totalBookings: 430, femaleCount: 240, maleCount: 190, peakStart: "3:30PM", peakEnd: "5:00PM", mobApp: 180, chatbot: 100, gmail: 60,  manual: 90  },
];

/* Helpers */
const fmt = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

const COLORS = ["#2E5BFF", "#1BC882", "#FFB020", "#E66C6C", "#8C54FF"];

/* -------- Toast component (non-intrusive) -------- */
function Toast({ open, title, message, tone = "success", onClose }) {
  if (!open) return null;
  return (
    <div className={`rg-toast ${tone}`} role="status" aria-live="polite">
      <div className="rg-toast-title">{title}</div>
      <div className="rg-toast-msg">{message}</div>
    </div>
  );
}

export function Report() {
  /* Dates only affect labels in this demo dataset (no per-day rows here) */
  const today = new Date();
  const aWeekAgo = new Date(today);
  aWeekAgo.setDate(today.getDate() - 7);

  const [start, setStart] = useState(aWeekAgo.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));
  const [rows] = useState(STATION_ROWS);

  const reportRef = useRef(null);

  /* Toast state */
  const [toast, setToast] = useState({ open: false, title: "", message: "", tone: "success" });
  const toastTimer = useRef(null);
  const showToast = (title, message, tone = "success") => {
    setToast({ open: true, title, message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, open: false })), 2800);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  /* Aggregations for charts */
  const totalsData = useMemo(
    () => rows.map((r) => ({ name: r.stationName, total: r.totalBookings })),
    [rows]
  );

  const genderTotals = useMemo(() => {
    let f = 0, m = 0;
    rows.forEach((r) => {
      f += r.femaleCount || 0;
      m += r.maleCount || 0;
    });
    return [
      { name: "Female", value: f },
      { name: "Male", value: m },
    ];
  }, [rows]);

  const genderPerStation = useMemo(
    () =>
      rows.map((r) => ({
        name: r.stationName,
        Female: r.femaleCount,
        Male: r.maleCount,
      })),
    [rows]
  );

  const sourceTotals = useMemo(() => {
    const agg = { "Mobile App": 0, Chatbot: 0, Gmail: 0, Manual: 0 };
    rows.forEach((r) => {
      agg["Mobile App"] += r.mobApp || 0;
      agg["Chatbot"] += r.chatbot || 0;
      agg["Gmail"] += r.gmail || 0;
      agg["Manual"] += r.manual || 0;
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const sourcePerStation = useMemo(
    () =>
      rows.map((r) => ({
        name: r.stationName,
        "Mobile App": r.mobApp,
        Chatbot: r.chatbot,
        Gmail: r.gmail,
        Manual: r.manual,
      })),
    [rows]
  );

  /* --- Exports --- */
  const exportPDF = async () => {
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const node = reportRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
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
      const XLSX = await import("xlsx");

      // 1) Stations table
      const sheet1 = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet1, "Stations");

      // 2) Totals (gender + sources)
      const sheet2 = XLSX.utils.json_to_sheet([
        { Metric: "Female Total", Value: genderTotals[0].value },
        { Metric: "Male Total", Value: genderTotals[1].value },
        ...sourceTotals.map((s) => ({ Metric: s.name, Value: s.value })),
      ]);
      XLSX.utils.book_append_sheet(wb, sheet2, "Totals");

      XLSX.writeFile(wb, `StationReport_${fmt(start)}-${fmt(end)}.xlsx`);
      showToast("Success!", "Excel exported successfully!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed", "Please install 'xlsx'.", "error");
    }
  };

  /* Generate handler (kept simple for now) */
  const handleGenerate = () => {
    // plug your fetch/filter logic here later
    showToast("Report refreshed", `Range: ${fmt(start)} — ${fmt(end)}`, "success");
  };

  return (
    <>
      <Navbar />
      {/* Fixed header buttons (gear + logout) */}
      <HeaderButton />

      {/* Top toast (under the navbar) */}
      <Toast
        open={toast.open}
        title={toast.title}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />

      {/* PAGE-SCOPED SCROLLER — see CSS: .reports-page owns the vertical scrollbar */}
      <div className="reports-page" id="reportsPage">
        <main className="reports-main">
          {/* Header */}
          <header className="reports-header-row">
            <div>
              <h1 className="reports-title">Report Generation</h1>
              <div className="reports-subtitle">Station Usage Summary Report</div>
            </div>
          </header>

          {/* Controls (just the date pickers now) */}
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

          {/* CONTENT used for PDF capture */}
          <div ref={reportRef}>
            {/* Table header bar: label left, Generate button right */}
            <div className="rg-table-head">
              <div className="rg-range-label">
                Report for <b>{fmt(start)}</b> — <b>{fmt(end)}</b>
              </div>
              <button className="rg-btn rg-btn-generate" type="button" onClick={handleGenerate}>
                Generate Report
              </button>
            </div>

            {/* ===== Scrollable table (has its own scrollbars inside the card) ===== */}
            <div className="rg-table-wrap" role="region" aria-label="Station totals">
              <table className="rg-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>StationName</th>
                    <th>TotalBookings</th>
                    <th>FemaleCount</th>
                    <th>MaleCount</th>
                    <th>PeakStart</th>
                    <th>PeakEnd</th>
                    <th>MobApp</th>
                    <th>Chatbot</th>
                    <th>Gmail</th>
                    <th>Manual</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.stationName}>
                      <td>{idx + 1}</td>
                      <td>{r.stationName}</td>
                      <td>{r.totalBookings}</td>
                      <td>{r.femaleCount}</td>
                      <td>{r.maleCount}</td>
                      <td>{r.peakStart}</td>
                      <td>{r.peakEnd}</td>
                      <td>{r.mobApp}</td>
                      <td>{r.chatbot}</td>
                      <td>{r.gmail}</td>
                      <td>{r.manual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Charts */}
            <div className="rg-charts">
              <section className="chart-card">
                <h3 className="chart-title">Total Bookings</h3>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={totalsData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="total" name="Total" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card">
                <h3 className="chart-title">Gender Ratio</h3>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie
                        data={genderTotals}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {genderTotals.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card">
                <h3 className="chart-title">Gender per Station</h3>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      layout="vertical"
                      data={genderPerStation}
                      margin={{ top: 8, right: 16, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={90} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Female" fill={COLORS[1]} />
                      <Bar dataKey="Male" fill={COLORS[3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card">
                <h3 className="chart-title">Booking Source</h3>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie
                        data={sourceTotals}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={85}
                        label
                      >
                        {sourceTotals.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="chart-card chart-span-2">
                <h3 className="chart-title">Booking Source per Station</h3>
                <div className="chart-body">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      layout="vertical"
                      data={sourcePerStation}
                      margin={{ top: 8, right: 16, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={90} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Mobile App" fill={COLORS[0]} />
                      <Bar dataKey="Chatbot" fill={COLORS[2]} />
                      <Bar dataKey="Gmail" fill={COLORS[3]} />
                      <Bar dataKey="Manual" fill={COLORS[4]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </div>

          {/* Export buttons */}
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