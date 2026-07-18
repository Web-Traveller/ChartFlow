import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  CandlestickChart,
  Database,
  Calendar,
  Terminal,
  Settings,
  Upload,
  Activity,
  ArrowRight,
  ShieldCheck,
  Cpu
} from "lucide-react";

interface Session {
  id: string;
  name: string;
  symbol: string;
  all_instruments: boolean;
  all_time: boolean;
  time_start: string;
  time_end: string;
  created_at: number;
}

interface LogEntry {
  level: string;
  timestamp: string;
}

export default function DashboardPage() {
  const { sessionId: activeSessionId } = useSession();
  const [sessions, setSessions] = useState<{ [key: string]: Session }>({});
  const [sessionsCount, setSessionsCount] = useState(0);
  const [symbolsCount, setSymbolsCount] = useState(0);
  const [dbPath, setDbPath] = useState("");
  const [errorCount, setErrorCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/1.1/sessions").then((r) => r.json()),
      fetch("http://localhost:8000/1.1/app_settings").then((r) => r.json()),
      fetch("http://localhost:8000/1.1/symbol_settings").then((r) => r.json()),
      fetch("http://localhost:8000/1.1/logs?limit=500").then((r) => r.json()),
    ])
      .then(([sessionsData, settings, symbols, logs]) => {
        setSessions(sessionsData);
        setSessionsCount(Object.keys(sessionsData).length);
        setSymbolsCount(Object.keys(symbols).length);
        setDbPath(settings.data_folder_path || "db");
        setErrorCount(
          logs.filter(
            (l: LogEntry) => l.level === "error" || l.level === "warning",
          ).length,
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted font-mono text-xs">
        <Activity className="w-4 h-4 animate-spin text-accent mr-2" />
        LOADING WORKSPACE TERMINAL...
      </div>
    );
  }

  // Determine active sessions display list (sorted by creation date)
  const sessionsList = Object.values(sessions).sort((a, b) => b.created_at - a.created_at);

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-sans">
      
      {/* Header */}
      <section className="flex items-center justify-between pb-1 border-b border-border-subtle/50">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="meta-text mt-0.5">Trading environment overview</p>
        </div>
      </section>

      {/* Status Grid (4 Columns) */}
      <section className="grid grid-cols-4 gap-3">
        <MetricBox
          title="Database"
          value="ONLINE"
          icon={Database}
          status="good"
        />
        <MetricBox
          title="Symbols"
          value={symbolsCount}
          icon={CandlestickChart}
        />
        <MetricBox
          title="Sessions"
          value={sessionsCount}
          icon={Calendar}
        />
        <MetricBox
          title="Alerts"
          value={errorCount}
          icon={Terminal}
          status={errorCount > 0 ? "bad" : "good"}
        />
      </section>

      {/* Main Workspace Layout Split */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Active Sessions - 2 Columns wide */}
        <div className="lg:col-span-2 panel flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between mb-3 border-b border-border-subtle/50 pb-2">
            <h2 className="section-title flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-accent" />
              Active Viewing Sessions
            </h2>
            <Link
              to="/sessions"
              className="text-[12px] text-accent hover:text-accent-hover flex items-center gap-1 transition-colors"
            >
              Configure
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {sessionsCount === 0 ? (
              <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-xs text-text-muted border border-dashed border-border-subtle rounded-md bg-bg-base/20">
                <span>No active viewing sessions found.</span>
                <Link to="/sessions" className="text-accent hover:underline mt-1">Create one here</Link>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary text-[11px] uppercase font-semibold">
                    <th className="py-2 px-2">Name</th>
                    <th className="py-2 px-2">Symbol</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {sessionsList.map((sess) => {
                    const isRunning = sess.id === activeSessionId;
                    return (
                      <tr key={sess.id} className="compact-row text-xs hover:bg-bg-surface-elevated/45 transition-colors">
                        <td className="py-2 px-2 font-medium text-text-primary">{sess.name}</td>
                        <td className="py-2 px-2 font-mono">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-bg-base border border-border-subtle text-[10px] text-accent font-semibold">
                            {sess.symbol}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`status-badge ${isRunning ? 'running' : 'paused'} py-0 px-2 text-[10px] h-5`}>
                            {isRunning ? 'RUNNING' : 'PAUSED'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Link
                            to={`/chart?session=${sess.id}`}
                            className="inline-flex items-center justify-center h-7 px-3 bg-accent hover:bg-accent-hover text-black text-xs font-bold rounded transition-all cursor-pointer"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions Panel - 1 Column wide */}
        <div className="panel flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-border-subtle/50 pb-2">
            <h2 className="section-title flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-accent" />
              Quick Actions
            </h2>
          </div>

          <div className="flex-1 flex flex-col gap-2 justify-center">
            <Link
              to={activeSessionId ? `/chart?session=${activeSessionId}` : "/chart"}
              className="flex items-center justify-between px-3 py-2 rounded bg-bg-base border border-border-subtle hover:border-accent hover:bg-bg-surface-elevated text-xs font-semibold text-text-primary transition-all group"
            >
              <span className="flex items-center gap-2">
                <CandlestickChart className="w-4 h-4 text-text-secondary group-hover:text-accent" />
                Open Chart
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary" />
            </Link>

            <Link
              to="/sessions"
              className="flex items-center justify-between px-3 py-2 rounded bg-bg-base border border-border-subtle hover:border-accent hover:bg-bg-surface-elevated text-xs font-semibold text-text-primary transition-all group"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-secondary group-hover:text-accent" />
                New Session
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary" />
            </Link>

            <Link
              to="/import"
              className="flex items-center justify-between px-3 py-2 rounded bg-bg-base border border-border-subtle hover:border-accent hover:bg-bg-surface-elevated text-xs font-semibold text-text-primary transition-all group"
            >
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-text-secondary group-hover:text-accent" />
                Import Data
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary" />
            </Link>

            <Link
              to="/settings?tab=app"
              className="flex items-center justify-between px-3 py-2 rounded bg-bg-base border border-border-subtle hover:border-accent hover:bg-bg-surface-elevated text-xs font-semibold text-text-primary transition-all group"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-text-secondary group-hover:text-accent" />
                Settings
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary" />
            </Link>
          </div>
        </div>
      </section>

      {/* System Information footer row */}
      <section className="panel">
        <div className="flex items-center justify-between mb-3 border-b border-border-subtle/50 pb-2">
          <h2 className="section-title flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent" />
            System Information
          </h2>
          <span className="text-[11px] text-bull font-mono uppercase tracking-wider flex items-center gap-1.5">
            <span className="pulse-indicator" />
            Terminal Connected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div>
            <span className="text-text-muted font-medium">Database Path</span>
            <p className="mt-1 font-mono text-text-primary bg-bg-base border border-border-subtle px-2.5 py-1.5 rounded truncate select-all" title={dbPath}>
              {dbPath}
            </p>
          </div>

          <div>
            <span className="text-text-muted font-medium">Storage Status</span>
            <p className="mt-1 font-mono text-text-primary bg-bg-base border border-border-subtle px-2.5 py-1.5 rounded flex items-center justify-between">
              <span>LOCAL DUCKDB SQLITE</span>
              <span className="text-bull text-[10px] font-bold">ACTIVE</span>
            </p>
          </div>

          <div>
            <span className="text-text-muted font-medium">Application Status</span>
            <p className="mt-1 font-mono text-text-primary bg-bg-base border border-border-subtle px-2.5 py-1.5 rounded flex items-center justify-between">
              <span>READY / DIAGNOSTICS OK</span>
              <span className="text-accent text-[10px] font-bold">
                {errorCount === 0 ? "0 ERRORS" : `${errorCount} WARNINGS`}
              </span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* Compact Dashboard Metric Module */
function MetricBox({
  title,
  value,
  icon: Icon,
  status,
}: {
  title: string;
  value: string | number;
  icon: any;
  status?: "good" | "bad";
}) {
  return (
    <div className="bg-bg-surface border border-border-subtle rounded-lg px-3 py-2.5 flex items-center justify-between">
      <div className="space-y-1">
        <span className="text-[11px] text-text-secondary uppercase font-semibold tracking-wider">
          {title}
        </span>
        <div
          className={`text-lg font-bold font-mono tracking-tight
            ${status === "good" ? "text-bull" : ""}
            ${status === "bad" ? "text-bear" : ""}
            ${!status ? "text-text-primary" : ""}
          `}
        >
          {value}
        </div>
      </div>
      <div className="w-8 h-8 rounded bg-bg-base border border-border-subtle/55 flex items-center justify-center">
        <Icon
          className={`w-4 h-4
            ${status === "bad" ? "text-bear" : ""}
            ${status === "good" ? "text-bull" : "text-accent"}
          `}
        />
      </div>
    </div>
  );
}
