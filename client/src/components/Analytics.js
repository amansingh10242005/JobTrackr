// components/Analytics.js
import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DocumentArrowDownIcon,
  ChartPieIcon,
  ChartBarIcon,
  CalendarIcon,
  CheckIcon,
  ArrowPathIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  SatelliteIcon,
  SignalIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Scatter,
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

/**
 * Integrated Analytics component
 * - Fetches tasks from backend /api/tasks (expects JWT in localStorage under "token")
 * - Normalizes task fields (ISO date strings, booleans, defaults)
 * - Provides tasks to existing analytics logic (charts, exports, etc.)
 */

const STATUS_COLORS = {
  Active: "#2575fc",
  "In Progress": "#f0ad4e",
  Overdue: "#d9534f",
  Completed: "#22c55e",
};
const DEFAULT_COLORS = ["#2575fc", "#f0ad4e", "#d9534f", "#22c55e"];

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:10000";

/* ---------- data hook ---------- */
const useAnalyticsData = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const normalizeTask = (t) => {
    if (!t || typeof t !== "object") return null;
    const task = { ...t };

    // Booleans / status
    task.completed = !!task.completed;
    task.status = task.status || (task.completed ? "Completed" : "Active");

    // Normalize date-like fields to ISO strings (if valid)
    ["due", "completedAt", "inProgressAt", "overdueAt", "createdAt", "updatedAt"].forEach((k) => {
      if (task[k]) {
        try {
          const dt = new Date(task[k]);
          if (!isNaN(dt.getTime())) task[k] = dt.toISOString();
        } catch (e) {
          // leave as-is if cannot parse
        }
      }
    });

    task.priority = task.priority || "Medium";
    task.category = task.category || "Uncategorized";
    return task;
  };

  useEffect(() => {
    let cancelled = false;
    const fetchTasks = async () => {
      setLoading(true);
      setError("");
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
        setError("Authentication required. Please log in.");
        setLoading(false);
        return;
      }
        const res = await fetch(`${API_BASE}/api/tasks`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          let msg = `Failed to fetch tasks (${res.status})`;
          try {
            const b = await res.json();
            if (b?.error) msg = b.error;
            else if (b?.message) msg = b.message;
          } catch {}
          throw new Error(msg);
        }

        const body = await res.json();
        const serverTasks = Array.isArray(body.tasks) ? body.tasks : [];
        const normalized = serverTasks.map(normalizeTask).filter(Boolean);
        if (!cancelled) setTasks(normalized);
      } catch (err) {
        if (!cancelled) setError(err.message || "Error fetching tasks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  return { tasks, loading, error, reload: () => window.location.reload() };
};

/* ---------- Helper functions ---------- */
const safeDate = (d) => {
  if (!d) return null;
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

const startOfDay = (d) => {
  if (!d) return new Date();
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

const formatDate = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB");
  } catch {
    return String(d);
  }
};

/* ---------- Main Analytics Component ---------- */
export default function Analytics() {
  // Use internal data hook (component now fetches its own tasks)
  const { tasks, loading, error } = useAnalyticsData();

  const [dateRange, setDateRange] = useState("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [busyExport, setBusyExport] = useState(false);
  const containerRef = useRef(null);

  // ----- Filter tasks locally (Analytics respects filters) ----- 
  const filteredTasks = useMemo(() => {
    if (!Array.isArray(tasks)) return [];
    return tasks.filter((t) => {
      if (!t || typeof t !== "object") return false;
      if (filterCategory && (t.category || "") !== filterCategory) return false;
      if (filterPriority && (t.priority || "") !== filterPriority) return false;

            if (dateRange !== "custom") {
        const days = parseInt(dateRange, 10);
        if (!isNaN(days)) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          cutoff.setHours(0, 0, 0, 0);
          
          const hasRelevantDate = 
            (t.due && safeDate(t.due) >= cutoff) ||
            (t.completedAt && safeDate(t.completedAt) >= cutoff) ||
            (t.createdAt && safeDate(t.createdAt) >= cutoff);
          
          if (!hasRelevantDate) return false;
        }
      } else {
        if (customFrom) {
          const from = startOfDay(customFrom);
          const anyDate =
            (t.due && startOfDay(t.due) >= from) ||
            (t.completedAt && startOfDay(t.completedAt) >= from) ||
            (t.inProgressAt && startOfDay(t.inProgressAt) >= from) ||
            (t.overdueAt && startOfDay(t.overdueAt) >= from);
          if (!anyDate) return false;
        }
        if (customTo) {
          const to = startOfDay(customTo);
          const anyDate =
            (t.due && startOfDay(t.due) <= to) ||
            (t.completedAt && startOfDay(t.completedAt) <= to) ||
            (t.inProgressAt && startOfDay(t.inProgressAt) <= to) ||
            (t.overdueAt && startOfDay(t.overdueAt) <= to);
          if (!anyDate) return false;
        }
      }
      return true;
    });
  }, [tasks, filterCategory, filterPriority, dateRange, customFrom, customTo]);

  // ----- Core aggregated metrics ----- 
  const analytics = useMemo(() => {
    const out = {
      summary: { total: 0, completed: 0, overdue: 0, completionRate: 0 },
      statusCounts: { Active: 0, "In Progress": 0, Overdue: 0, Completed: 0 },
      categoryCounts: {},
      priorityCounts: {},
      completedByDay: {},
      overdueByDay: {},
      inProgressByDay: {},
      lifecycleDurations: [],
      dueToCompleted: [],
      completedOnTime: 0,
      completedBefore: 0,
      completedAfter: 0,
      allDates: new Set(),
    };

    const pushDayCount = (mapObj, date) => {
      if (!date) return;
      const d = startOfDay(date).toISOString().slice(0, 10);
      mapObj[d] = (mapObj[d] || 0) + 1;
      out.allDates.add(d);
    };

    const now = new Date();

    (filteredTasks || []).forEach((t) => {
      out.summary.total += 1;
      const status = t.status || "Active";
      if (!out.statusCounts[status]) out.statusCounts[status] = 0;
      out.statusCounts[status] += 1;

      // category/priority
      const cat = t.category || "Uncategorized";
      out.categoryCounts[cat] = (out.categoryCounts[cat] || 0) + 1;
      const pr = t.priority || "Medium";
      out.priorityCounts[pr] = (out.priorityCounts[pr] || 0) + 1;

      // overdue
      if (t.status === "Overdue" || (t.overdueAt && safeDate(t.overdueAt) <= now)) {
        out.summary.overdue += 1;
      }

      // completed
      if (t.completed) {
        out.summary.completed += 1;
        pushDayCount(out.completedByDay, t.completedAt);
        const completedAt = safeDate(t.completedAt);
        const inProgAt = safeDate(t.inProgressAt);
        if (inProgAt && completedAt) {
          const diff = (completedAt - inProgAt) / (1000 * 60 * 60 * 24);
          out.lifecycleDurations.push(diff);
        }
        if (t.due && completedAt) {
          const dueDate = safeDate(t.due);
          if (dueDate) {
            const diffDue = (completedAt - dueDate) / (1000 * 60 * 60 * 24);
            out.dueToCompleted.push(diffDue);
            if (diffDue < 0) out.completedBefore += 1;
            else if (Math.abs(diffDue) < 1) out.completedOnTime += 1;
            else out.completedAfter += 1;
          }
        }
      }

      // inProgress / overdue event counts for flow
      if (t.inProgressAt) pushDayCount(out.inProgressByDay, t.inProgressAt);
      if (t.overdueAt) pushDayCount(out.overdueByDay, t.overdueAt);
    });

    out.summary.completionRate = out.summary.total ? (out.summary.completed / out.summary.total) * 100 : 0;

    // derived metrics
    const avgLifecycle =
      out.lifecycleDurations.length ? out.lifecycleDurations.reduce((a, b) => a + b, 0) / out.lifecycleDurations.length : 0;
    const medianLifecycle = (() => {
      if (!out.lifecycleDurations.length) return 0;
      const s = [...out.lifecycleDurations].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    })();

    const avgDueToCompleted =
      out.dueToCompleted.length ? out.dueToCompleted.reduce((a, b) => a + b, 0) / out.dueToCompleted.length : 0;

    // streak calculation
    const completedDates = Object.keys(out.completedByDay).sort((a, b) => new Date(a) - new Date(b));
    let streak = 0;
    let cur = startOfDay(new Date());
    while (true) {
      const key = cur.toISOString().slice(0, 10);
      if (out.completedByDay[key]) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }

    // consistency calculation
    let consistency = 100;
    if (completedDates.length >= 2) {
      const diffs = [];
      for (let i = 1; i < completedDates.length; i++) {
        const a = new Date(completedDates[i - 1]);
        const b = new Date(completedDates[i]);
        diffs.push((b - a) / (1000 * 60 * 60 * 24));
      }
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const variance = diffs.reduce((a, b) => a + Math.abs(b - avg), 0) / diffs.length;
      consistency = Math.max(0, 100 - variance * 5);
    }

    out.derived = {
      avgLifecycle: Number(avgLifecycle.toFixed(2)),
      medianLifecycle: Number(medianLifecycle.toFixed(2)),
      avgDueToCompleted: Number(avgDueToCompleted.toFixed(2)),
      streak,
      consistency: Math.round(consistency),
      completedBefore: out.completedBefore,
      completedOnTime: out.completedOnTime,
      completedAfter: out.completedAfter,
    };

    return out;
  }, [filteredTasks]);

  // ----- Prepare chart data & UI derived data -----
  const statusPieData = useMemo(() => {
    return Object.entries(analytics.statusCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [analytics.statusCounts]);

  const timelineData = useMemo(() => {
    const days = dateRange === "custom" && customFrom && customTo
      ? (() => {
          const start = startOfDay(new Date(customFrom));
          const end = startOfDay(new Date(customTo));
          const arr = [];
          for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
            arr.push(new Date(cur));
          }
          return arr;
        })()
      : (() => {
          const daysCount = parseInt(dateRange, 10) || 30;
          const arr = [];
          for (let i = daysCount - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            arr.push(d);
          }
          return arr;
        })();

    return days.map((d) => {
      const key = startOfDay(d).toISOString().slice(0, 10);
      return {
        date: key,
        completed: analytics.completedByDay[key] || 0,
        inProgressEvents: analytics.inProgressByDay[key] || 0,
        overdueEvents: analytics.overdueByDay[key] || 0,
      };
    });
  }, [analytics.completedByDay, analytics.inProgressByDay, analytics.overdueByDay, dateRange, customFrom, customTo]);

  const categoryPriorityMatrix = useMemo(() => {
    const cats = Object.keys(analytics.categoryCounts || {});
    const prios = ["High", "Medium", "Low"];
    const matrix = cats.map((cat) => {
      const row = { category: cat };
      prios.forEach((p) => { row[p] = 0; });
      return row;
    });

    (filteredTasks || []).forEach((t) => {
      const cat = t.category || "Uncategorized";
      const pr = t.priority || "Medium";
      const row = matrix.find((r) => r.category === cat);
      if (row) row[pr] = (row[pr] || 0) + 1;
    });

    return { prios, matrix };
  }, [analytics.categoryCounts, filteredTasks]);

  const flowData = useMemo(() => {
    return timelineData.map((d) => ({
      date: d.date,
      Active: (analytics.statusCounts.Active || 0),
      InProgressEvents: d.inProgressEvents,
      OverdueEvents: d.overdueEvents,
      Completed: d.completed,
    }));
  }, [timelineData, analytics.statusCounts]);

  const generateInsights = () => {
    const lines = [];
    const s = analytics.summary;
    lines.push(`You have ${s.total} tasks; ${s.completed} completed (${s.completionRate.toFixed(1)}%).`);
    if (s.total) {
      const overduePct = s.total ? (s.overdue / s.total) * 100 : 0;
      if (overduePct > 20) lines.push(`🚨 Overdue rate is ${overduePct.toFixed(1)}% — consider re-prioritizing deadlines.`);
      else lines.push(`✅ Low overdue rate (${overduePct.toFixed(1)}%).`);
    }
    if (analytics.derived.streak > 0) lines.push(`🔥 Current completion streak: ${analytics.derived.streak} days.`);
    if (analytics.derived.avgLifecycle) lines.push(`⏱️ Avg time from In Progress → Completed: ${analytics.derived.avgLifecycle} days.`);
    if (analytics.derived.avgDueToCompleted) lines.push(`📅 Avg time from Due → Completed: ${analytics.derived.avgDueToCompleted.toFixed(1)} days.`);
    const cats = Object.entries(analytics.categoryCounts).sort((a, b) => b[1] - a[1]);
    if (cats.length) {
      lines.push(`📌 Top category: ${cats[0][0]} (${cats[0][1]} tasks).`);
      if (cats[0][1] / s.total > 0.5) lines.push(`⚠️ Over half of your tasks are in ${cats[0][0]}; consider splitting them into subtasks.`);
    }
    if (analytics.derived.completedAfter > analytics.derived.completedBefore) {
      lines.push(`⏳ More tasks are completed after due date (${analytics.derived.completedAfter}) than before (${analytics.derived.completedBefore}).`);
    } else {
      lines.push(`🎯 You often finish tasks before or on time.`);
    }
    return lines;
  };

  const insights = useMemo(generateInsights, [analytics]);

  // ----- Exports: PDF & Excel -----
  const exportPDF = async () => {
    if (!containerRef.current || busyExport) return;
    try {
      setBusyExport(true);
      const canvas = await html2canvas(containerRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      pdf.save(`analytics_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Export to PDF failed.");
    } finally {
      setBusyExport(false);
    }
  };

  const exportExcel = () => {
    try {
      const sheetData = [];
      sheetData.push({ Section: "Summary", Key: "Total Tasks", Value: analytics.summary.total });
      sheetData.push({ Section: "Summary", Key: "Completed", Value: analytics.summary.completed });
      sheetData.push({ Section: "Summary", Key: "Overdue", Value: analytics.summary.overdue });
      sheetData.push({ Section: "Summary", Key: "Completion Rate (%)", Value: analytics.summary.completionRate.toFixed(1) });
      sheetData.push({ Section: "Derived", Key: "Avg InProg→Completed (days)", Value: analytics.derived.avgLifecycle });
      sheetData.push({ Section: "Derived", Key: "Median InProg→Completed (days)", Value: analytics.derived.medianLifecycle });
      sheetData.push({ Section: "Derived", Key: "Avg Due→Completed (days)", Value: analytics.derived.avgDueToCompleted });
      sheetData.push({ Section: "Derived", Key: "Streak (days)", Value: analytics.derived.streak });
      sheetData.push({ Section: "Derived", Key: "Consistency (%)", Value: analytics.derived.consistency });
      sheetData.push({ Section: "Category-Priority", Key: "Category", Value: "High / Medium / Low" });
      categoryPriorityMatrix.matrix.forEach((r) => {
        sheetData.push({ Section: "Category-Priority", Key: r.category, Value: `${r.High || 0} / ${r.Medium || 0} / ${r.Low || 0}` });
      });
      sheetData.push({ Section: "TimeSeries", Key: "Date", Value: "Completed / InProgressEvents / OverdueEvents" });
      timelineData.forEach((d) => {
        sheetData.push({ Section: "TimeSeries", Key: d.date, Value: `${d.completed} / ${d.inProgressEvents} / ${d.overdueEvents}` });
      });
      const ws = XLSX.utils.json_to_sheet(sheetData, { header: ["Section", "Key", "Value"] });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analytics");
      XLSX.writeFile(wb, `analytics_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Export to Excel failed.");
    }
  };

  // Styles
  const styles = {
    page: { padding: "1.5rem", minHeight: "100vh", background: "var(--bg)" },
    controlsBar: { display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "1rem" },
    leftControls: { display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" },
    rightControls: { display: "flex", gap: "0.6rem", alignItems: "center" },
    btn: {
      padding: "0.6rem 1rem",
      border: "1px solid var(--border)",
      borderRadius: "8px",
      background: "var(--card-bg)",
      cursor: "pointer",
      fontSize: "0.9rem",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
    },
    primaryBtn: { background: "var(--hover)", borderColor: "var(--active)" },
    card: { background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1rem", boxShadow: "var(--shadow)" },
    summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1rem" },
    summaryItem: { padding: "1rem", borderRadius: "8px", textAlign: "center" },
    bigNumber: { fontSize: "1.6rem", fontWeight: 700 },
    chartContainer: { height: 320, padding: "0.75rem", borderRadius: "10px", background: "var(--card-bg)", border: "1px solid var(--border)" },
    insightsBox: { marginTop: "1rem", padding: "1rem", borderLeft: "4px solid var(--active)", borderRadius: "6px", background: "var(--hover)" },
  };

  // Loading & error states (data fetch) - AFTER all hooks
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h3>Loading analytics…</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Error loading analytics</h3>
        <p style={{ color: "red" }}>{error}</p>
        <p>Make sure you're logged in and the backend is available at {API_BASE}.</p>
      </div>
    );
  }

  // ----- Render -----
    if (!tasks || !tasks.length) {
    return (
      <div style={styles.page}>
        <div style={{...styles.card, textAlign: 'center', padding: '3rem'}}>
          <ChartPieIcon style={{ width: 64, height: 64, opacity: 0.5, margin: '0 auto 1.5rem' }} />
          <h3>No Analytics Data Available</h3>
          <p style={{ marginBottom: '1.5rem', color: 'var(--muted)' }}>
            Start creating tasks to see detailed analytics and insights about your productivity.
          </p>
          <button 
            style={{...styles.btn, ...styles.primaryBtn}}
            onClick={() => window.location.href = '/tasks'}
          >
            Go to Tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page} ref={containerRef}>
      {/* Controls */}
      <div style={styles.controlsBar}>
        <div style={styles.leftControls}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: 'wrap' }}>
            <button style={{ ...styles.btn, ...(dateRange === "7" ? styles.primaryBtn : {}) }} onClick={() => setDateRange("7")}>7d</button>
            <button style={{ ...styles.btn, ...(dateRange === "30" ? styles.primaryBtn : {}) }} onClick={() => setDateRange("30")}>30d</button>
            <button style={{ ...styles.btn, ...(dateRange === "90" ? styles.primaryBtn : {}) }} onClick={() => setDateRange("90")}>90d</button>
            <button style={{ ...styles.btn, ...(dateRange === "custom" ? styles.primaryBtn : {}) }} onClick={() => setDateRange("custom")}>Custom</button>
          </div>

          {dateRange === "custom" && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginLeft: "0.5rem", flexWrap: 'wrap' }}>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ ...styles.btn, marginLeft: 12 }}>
            <option value="">All Categories</option>
            {Object.keys(analytics.categoryCounts).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{...styles.btn, marginLeft: 8 }}>
            <option value="">All Priorities</option>
            {Object.keys(analytics.priorityCounts).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={styles.rightControls}>
          <button onClick={exportPDF} disabled={busyExport} style={{ ...styles.btn, opacity: busyExport ? 0.6 : 1 }}>
            <DocumentArrowDownIcon style={{ width: 16, height: 16 }} /> {busyExport ? "Exporting..." : "Export PDF"}
          </button>
          <button onClick={exportExcel} style={styles.btn}>
            <DocumentArrowDownIcon style={{ width: 16, height: 16 }} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={styles.summaryGrid}>
        <div style={{ ...styles.card, ...styles.summaryItem }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <ChartBarIcon style={{ width: 20, height: 20 }} />
            <div style={styles.bigNumber}>{analytics.summary.total}</div>
          </div>
          <div style={{ color: "var(--muted)" }}>Total Tasks</div>
        </div>

        <div style={{ ...styles.card, ...styles.summaryItem }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <CheckIcon style={{ width: 20, height: 20, color: STATUS_COLORS.Completed }} />
            <div style={styles.bigNumber}>{analytics.summary.completed}</div>
          </div>
          <div style={{ color: "var(--muted)" }}>Completed</div>
        </div>

        <div style={{ ...styles.card, ...styles.summaryItem }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <ArrowTrendingUpIcon style={{ width: 20, height: 20 }} />
            <div style={styles.bigNumber}>{analytics.summary.completionRate.toFixed(1)}%</div>
          </div>
          <div style={{ color: "var(--muted)" }}>Completion Rate</div>
        </div>

        <div style={{ ...styles.card, ...styles.summaryItem }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <FireIcon style={{ width: 20, height: 20, color: "#ef4444" }} />
            <div style={styles.bigNumber}>{analytics.derived.streak}d</div>
          </div>
          <div style={{ color: "var(--muted)" }}>Current Streak</div>
        </div>
      </div>

      {/* Status Distribution: full-width pie card */}
      {statusPieData.length > 0 && (
        <div style={{ ...styles.card, marginBottom: "1rem" }}>
          <h4 style={{ marginTop: 0 }}>Status Distribution</h4>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 320 }}>
            <ResponsiveContainer width="80%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  label={(entry) => `${entry.name} (${entry.value})`}
                >
                  {statusPieData.map((entry, idx) => (
                    <Cell
                      key={`c-${idx}`}
                      tabIndex={-1}
                      fill={STATUS_COLORS[entry.name] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <ReTooltip />
                <Legend verticalAlign="top" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timelineData.length > 0 && (
        <div style={{ ...styles.card, marginBottom: "1rem" }}>
          <h4 style={{ marginTop: 0 }}>Timeline (Completed / In Progress / Overdue)</h4>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <ReTooltip />
                <Bar dataKey="completed" name="Completed" barSize={14} fill={STATUS_COLORS.Completed} />
                <Line type="monotone" dataKey="inProgressEvents" name="In Progress Events" stroke={STATUS_COLORS["In Progress"]} strokeWidth={2} />
                <Line type="monotone" dataKey="overdueEvents" name="Overdue Events" stroke={STATUS_COLORS.Overdue} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Completion Timing */}
      <div style={{ ...styles.card, marginBottom: "1rem" }}>
        <h4 style={{ marginTop: 0 }}>Completion Timing</h4>
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "var(--muted)" }}>Avg InProg → Completed</div>
            <div style={{ fontWeight: 700 }}>{analytics.derived.avgLifecycle || 0} days</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "var(--muted)" }}>Median InProg → Completed</div>
            <div style={{ fontWeight: 700 }}>{analytics.derived.medianLifecycle || 0} days</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "var(--muted)" }}>Avg Due → Completed</div>
            <div style={{ fontWeight: 700 }}>{analytics.derived.avgDueToCompleted || 0} days</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "var(--muted)" }}>Completed before / on / after</div>
            <div style={{ fontWeight: 700 }}>{analytics.derived.completedBefore} / {analytics.derived.completedOnTime} / {analytics.derived.completedAfter}</div>
          </div>
        </div>

        {timelineData.length > 0 && (
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <ReTooltip />
                <Area type="monotone" dataKey="completed" name="Completed" stroke={STATUS_COLORS.Completed} fill={STATUS_COLORS.Completed} fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Category-Priority and Flow */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div style={styles.card}>
          <h4 style={{ marginTop: 0 }}>Category × Priority Matrix</h4>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>Category</th>
                  {categoryPriorityMatrix.prios.map((p) => (
                    <th key={p} style={{ textAlign: "center", padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryPriorityMatrix.matrix.map((r) => (
                  <tr key={r.category}>
                    <td style={{ padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>{r.category}</td>
                    {categoryPriorityMatrix.prios.map((p) => (
                      <td key={p} style={{ textAlign: "center", padding: "0.5rem", borderBottom: "1px solid var(--border)" }}>{r[p] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.card}>
          <h4 style={{ marginTop: 0 }}>Task Flow</h4>
          {flowData.length > 0 && (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={flowData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <ReTooltip />
                  <Line type="monotone" dataKey="Active" name="Active" stroke={STATUS_COLORS.Active} strokeWidth={2} />
                  <Line type="monotone" dataKey="InProgressEvents" name="In Progress Events" stroke={STATUS_COLORS["In Progress"]} strokeWidth={2} />
                  <Line type="monotone" dataKey="OverdueEvents" name="Overdue Events" stroke={STATUS_COLORS.Overdue} strokeWidth={2} />
                  <Line type="monotone" dataKey="Completed" name="Completed" stroke={STATUS_COLORS.Completed} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div style={styles.card}>
        <h4 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <SignalIcon style={{ width: 20, height: 20 }} /> Insights
        </h4>
        <div style={styles.insightsBox}>
          {insights.map((line, idx) => (
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              style={{ margin: "0.5rem 0" }}
            >
              {line}
            </motion.p>
          ))}
        </div>
      </div>
    </div>
  );
}