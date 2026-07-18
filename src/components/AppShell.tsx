import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import {
  Compass,
  Calendar,
  Database,
  Settings,
  CandlestickChart
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const { session } = useSession();

  // Landing page does not use desktop shell
  if (location.pathname === "/landing") {
    return <>{children}</>;
  }

  const navItems = [
    {
      name: "Dashboard",
      icon: Compass,
      path: "/",
    },
    {
      name: "Sessions",
      icon: Calendar,
      path: "/sessions",
    },
    {
      name: "Import",
      icon: Database,
      path: "/import",
    },
    {
      name: "Settings",
      icon: Settings,
      path: "/settings",
    },
  ];

  const getPathWithSession = (path: string) => {
    if (!session) return path;
    const url = new URL(path, window.location.origin);
    url.searchParams.set("session", session.id);
    return url.pathname + url.search;
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-base text-text-primary flex flex-col select-none">
      {/* Top Bar - Height 48px (h-12) */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-border-subtle bg-bg-surface shrink-0 z-20">
        
        {/* Left: Logo & Application Name */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-accent/10 border border-accent/20 flex items-center justify-center">
            <CandlestickChart className="w-4 h-4 text-accent" />
          </div>
          <span className="text-sm font-bold tracking-tight text-text-primary">
            ChartFlow
          </span>
        </div>

        {/* Center: Active Session / Timeframe / Status */}
        {session ? (
          <div className="flex items-center gap-3 bg-bg-base border border-border-subtle px-3 py-1 rounded-md text-xs">
            <span className="pulse-indicator shrink-0" />
            <span className="text-text-muted font-medium">SESSION:</span>
            <span className="font-semibold text-text-primary">{session.name}</span>
            <span className="text-text-muted">/</span>
            <span className="font-mono text-accent">{session.symbol}</span>
            <span className="text-text-muted">/</span>
            <span className="font-mono bg-bg-surface-elevated px-1.5 py-0.5 rounded text-text-secondary border border-border-subtle">
              {session.all_time ? "ALL_TIME" : "1D"}
            </span>
            <span className="status-badge running py-0 h-4 flex items-center text-[10px]">
              RUNNING
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-bg-base border border-border-subtle px-3 py-1 rounded-md text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            <span className="text-text-muted uppercase">SYSTEM:</span>
            <span className="status-badge paused py-0 h-4 flex items-center text-[10px]">
              NO ACTIVE SESSION
            </span>
          </div>
        )}

        {/* Right: System Status & User Settings */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-bull" />
            <span className="font-mono text-[11px] text-text-secondary">DB ONLINE</span>
          </div>
          <span className="text-text-muted">|</span>
          <Link
            to="/settings?tab=app"
            className="text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
            title="Application Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </Link>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Navigation Rail - Width 56px (w-14) */}
        <aside className="w-14 shrink-0 border-r border-border-subtle bg-bg-surface flex flex-col items-center py-3 z-10">
          <nav className="flex flex-col gap-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              // Strict path matching
              const active =
                location.pathname === item.path ||
                (item.path === "/settings" && location.pathname.startsWith("/settings"));

              return (
                <Link
                  key={index}
                  to={getPathWithSession(item.path)}
                  title={item.name}
                  className={`
                    relative
                    w-10
                    h-10
                    flex
                    items-center
                    justify-center
                    rounded-md
                    transition-colors
                    ${
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-surface-elevated"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto text-[9px] text-text-muted font-mono">
            V1.1
          </div>
        </aside>

        {/* Main Workspace Area - Maximum screen space */}
        <main className="flex-1 min-w-0 overflow-hidden bg-bg-base relative">
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-6 shrink-0 border-t border-border-subtle bg-bg-surface flex items-center justify-between px-4 text-[11px] text-text-muted font-mono z-20 select-none">
        <div className="flex items-center gap-2">
          <span>CHARTFLOW TERMINAL</span>
        </div>
        <div className="flex items-center gap-3">
          <span>WORKSPACE READY</span>
          <span>|</span>
          <span>LOCAL MODE</span>
        </div>
      </footer>
    </div>
  );
}
