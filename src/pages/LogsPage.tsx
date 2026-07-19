/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Terminal, RefreshCw, AlertCircle, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  source: 'backend' | 'frontend';
  level: 'info' | 'warning' | 'error';
  message: string;
  context?: any;
  stack?: string;
}

export default function LogsPage({ embedded = false }: { embedded?: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(200);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchLogs = () => {
    setIsLoading(true);
    setError('');
    const query = new URLSearchParams();
    if (levelFilter) query.append('level', levelFilter);
    if (sourceFilter) query.append('source', sourceFilter);
    query.append('limit', String(limit));

    fetch(`http://localhost:8000/1.1/logs?${query.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setLogs(data);
      })
      .catch(err => {
        setError('Failed to fetch logs: ' + err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, [levelFilter, sourceFilter, limit]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, levelFilter, sourceFilter, limit]);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(idx);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
    } catch (e) {
      return ts;
    }
  };


  const mainContent = (
    <div className="flex-1 flex flex-col space-y-3 font-sans">
      
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-2 border-b border-border-subtle/50">
        <div>
          <h2 className="section-title flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-accent" />
            Centralized System Diagnostics
          </h2>
          <p className="meta-text mt-0.5">
            Inspect logs, warnings, errors, and stack traces from the FastAPI backend and React frontend.
          </p>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-bg-surface border border-border-subtle rounded-lg p-3 flex flex-wrap gap-4 items-end justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Source</label>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="h-7 text-xs bg-bg-base border border-border-subtle rounded px-2"
            >
              <option value="">All Sources</option>
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
            </select>
          </div>

          {/* Level */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Level</label>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="h-7 text-xs bg-bg-base border border-border-subtle rounded px-2"
            >
              <option value="">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Limit */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Limit</label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="h-7 text-xs bg-bg-base border border-border-subtle rounded px-2 w-16"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 bg-bg-base border-border-subtle rounded text-accent focus:ring-accent"
            />
            <span>Auto-refresh (3s)</span>
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-bull' : 'bg-text-muted'}`} />
          </label>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="h-7 px-3 bg-bg-base border border-border-subtle hover:border-text-secondary text-text-primary rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-bear bg-bear-soft border border-bear/20 p-2.5 rounded text-xs font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-bg-base border border-border-subtle rounded-lg flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-12 text-text-muted">
              <Terminal className="w-8 h-8 mb-2 text-text-muted/50" />
              <p className="text-xs font-semibold">No diagnostic records found</p>
              <p className="text-[11px] text-text-muted mt-0.5">Logs are recorded dynamically as operations occur.</p>
            </div>
          ) : (
            <div className="w-full">
              {/* Header */}
              <div className="grid grid-cols-12 border-b border-border-subtle bg-bg-surface/50 text-text-secondary text-[10px] uppercase font-semibold py-2 px-3 gap-2 shrink-0 select-none">
                <div className="col-span-1"></div>
                <div className="col-span-3">Timestamp</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Level</div>
                <div className="col-span-4">Event Message</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border-subtle/20 font-mono text-[11px]">
                {logs.map((entry, idx) => {
                  const isExpanded = expandedIndex === idx;
                  const hasDetails = (entry.context && Object.keys(entry.context).length > 0) || entry.stack;

                  return (
                    <div key={idx} className={`hover:bg-bg-surface-elevated/20 transition-colors ${isExpanded ? 'bg-bg-surface-elevated/15' : ''}`}>
                      <div
                        className="grid grid-cols-12 py-2 px-3 gap-2 items-center cursor-pointer"
                        onClick={() => hasDetails && setExpandedIndex(isExpanded ? null : idx)}
                      >
                        <div className="col-span-1 flex items-center justify-center">
                          {hasDetails && (
                            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                          )}
                        </div>
                        
                        <div className="col-span-3 text-text-secondary">
                          {formatTimestamp(entry.timestamp)}
                        </div>

                        <div className="col-span-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase leading-none font-sans ${
                            entry.source === 'backend'
                              ? 'bg-accent/10 text-accent border-accent/20'
                              : 'bg-bg-surface-elevated text-text-primary border-border-subtle'
                          }`}>
                            {entry.source}
                          </span>
                        </div>

                        <div className="col-span-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase leading-none font-sans ${
                            entry.level === 'error'
                              ? 'bg-bear-soft text-bear border-bear/20'
                              : entry.level === 'warning'
                              ? 'bg-accent-soft text-accent border-accent/20'
                              : 'bg-bull-soft text-bull border-bull/20'
                          }`}>
                            {entry.level}
                          </span>
                        </div>

                        <div className="col-span-4 text-text-primary truncate font-medium" title={entry.message}>
                          {entry.message}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && hasDetails && (
                        <div className="bg-bg-surface border-y border-border-subtle p-3 space-y-3 font-sans text-xs">
                          {entry.context && Object.keys(entry.context).length > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Context JSON</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(JSON.stringify(entry.context, null, 2), idx);
                                  }}
                                  className="h-6 px-2 bg-bg-base border border-border-subtle hover:border-text-secondary text-text-secondary hover:text-text-primary rounded text-[10px] flex items-center gap-1 cursor-pointer transition"
                                >
                                  {copiedId === idx ? <Check className="w-3 h-3 text-bull" /> : <Copy className="w-3 h-3" />}
                                  {copiedId === idx ? 'Copied' : 'Copy Context'}
                                </button>
                              </div>
                              <pre className="bg-bg-base p-2.5 rounded border border-border-subtle text-[11px] font-mono text-text-primary overflow-x-auto max-h-48 scrollbar">
                                {JSON.stringify(entry.context, null, 2)}
                              </pre>
                            </div>
                          )}

                          {entry.stack && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Stack Trace</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(entry.stack || '', idx + 1000);
                                  }}
                                  className="h-6 px-2 bg-bg-base border border-border-subtle hover:border-text-secondary text-text-secondary hover:text-text-primary rounded text-[10px] flex items-center gap-1 cursor-pointer transition"
                                >
                                  {copiedId === idx + 1000 ? <Check className="w-3 h-3 text-bull" /> : <Copy className="w-3 h-3" />}
                                  {copiedId === idx + 1000 ? 'Copied' : 'Copy Stack'}
                                </button>
                              </div>
                              <pre className="bg-bg-base p-2.5 rounded border border-border-subtle text-[11px] font-mono text-bear overflow-x-auto max-h-60 whitespace-pre scrollbar">
                                {entry.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return mainContent;
  }

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-sans flex flex-col h-full">
      {mainContent}
    </div>
  );
}
