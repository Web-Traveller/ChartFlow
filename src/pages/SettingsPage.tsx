/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertTriangle, RefreshCw, X, Settings2 } from 'lucide-react';
import LogsPage from './LogsPage';

export default function SettingsPage() {
  // Tab control
  const [activeTab, setActiveTab] = useState<'symbols' | 'app' | 'logs'>(() => {
    const searchString = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const params = new URLSearchParams(searchString);
    const tabParam = params.get('tab');
    if (tabParam === 'app') return 'app';
    if (tabParam === 'logs') return 'logs';
    return 'symbols';
  });

  // Listen to search changes (e.g. back buttons or hash routing)
  useEffect(() => {
    const handleUrlChange = () => {
      const searchString = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const params = new URLSearchParams(searchString);
      const tabParam = params.get('tab');
      if (tabParam === 'app' || tabParam === 'symbols' || tabParam === 'logs') {
        setActiveTab(tabParam);
      }
    };
    
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Symbols Overview states
  const [symbolsOverview, setSymbolsOverview] = useState<any[]>([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [editingSymbol, setEditingSymbol] = useState<any | null>(null);

  // Symbol Configuration states (for the modal editor)
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('forex');
  const [exchange, setExchange] = useState('FOREX');
  const [session, setSession] = useState('24x7');
  const [timezone, setTimezone] = useState('Etc/UTC');
  const [priceScale, setPriceScale] = useState(100000);
  const [logoUrl, setLogoUrl] = useState('./logos/default.png');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Application Settings states
  const [dataFolderPath, setDataFolderPath] = useState('');
  const [defaultRiskPct, setDefaultRiskPct] = useState(1.0);
  const [defaultTimeframe, setDefaultTimeframe] = useState('1D');
  const [appTheme, setAppTheme] = useState('dark');
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [saveAppStatus, setSaveAppStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const fetchSymbolsOverview = () => {
    setIsLoadingSymbols(true);
    fetch('http://localhost:8000/1.1/symbols_overview')
      .then(res => res.json())
      .then(data => {
        setSymbolsOverview(data);
        setIsLoadingSymbols(false);
      })
      .catch(err => {
        console.error('Failed to load symbols overview:', err);
        setIsLoadingSymbols(false);
      });
  };

  useEffect(() => {
    fetchSymbolsOverview();

    // Fetch app settings
    fetch('http://localhost:8000/1.1/app_settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.data_folder_path) setDataFolderPath(data.data_folder_path);
          if (data.default_risk_pct !== undefined) setDefaultRiskPct(data.default_risk_pct);
          if (data.default_timeframe) setDefaultTimeframe(data.default_timeframe);
          if (data.theme) setAppTheme(data.theme);
        }
      })
      .catch(err => console.error('Error fetching app settings:', err));
  }, []);

  const startEditing = (sym: any) => {
    setEditingSymbol(sym);
    setSelectedSymbol(sym.symbol);
    setDescription(sym.description || '');
    setType(sym.type || 'forex');
    setExchange(sym.exchange || 'FOREX');
    setSession(sym.session || '24x7');
    setTimezone(sym.timezone || 'Etc/UTC');
    setPriceScale(sym.pricescale || 100000);
    setLogoUrl(sym.symbol_logo || './logos/default.png');
    setSaveStatus('idle');
  };

  const handleSaveSymbolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');

    const payload = {
      [selectedSymbol]: {
        name: selectedSymbol,
        ticker: selectedSymbol,
        description,
        type,
        exchange,
        session,
        timezone,
        pricescale: Number(priceScale),
        symbol_logo: logoUrl
      }
    };

    fetch('http://localhost:8000/1.1/symbol_settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setSaveStatus('success');
          fetchSymbolsOverview();
          setTimeout(() => setEditingSymbol(null), 1000);
        } else {
          setSaveStatus('error');
        }
      })
      .catch(() => {
        setSaveStatus('error');
      })
      .finally(() => {
        setIsSaving(false);
        setTimeout(() => setSaveStatus('idle'), 4000);
      });
  };

  const handleSaveAppSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApp(true);
    setSaveAppStatus('idle');

    const payload = {
      data_folder_path: dataFolderPath,
      default_risk_pct: Number(defaultRiskPct),
      default_timeframe: defaultTimeframe,
      theme: appTheme
    };

    fetch('http://localhost:8000/1.1/app_settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setSaveAppStatus('success');
        } else {
          setSaveAppStatus('error');
        }
      })
      .catch(() => {
        setSaveAppStatus('error');
      })
      .finally(() => {
        setIsSavingApp(false);
        setTimeout(() => setSaveAppStatus('idle'), 4000);
      });
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-sans">
      
      {/* Page Header */}
      <div className="pb-1 border-b border-border-subtle/50">
        <h1 className="page-title">Settings & Configurations</h1>
        <p className="meta-text mt-0.5">
          Configure symbol information, pricing models, database storage layouts, and application defaults.
        </p>
      </div>

      {/* Tab Selection */}
      <div className="flex border-b border-border-subtle gap-4 text-xs font-semibold uppercase tracking-wider">
        <button
          onClick={() => {
            setActiveTab('symbols');
            window.location.hash = '#/settings?tab=symbols';
          }}
          className={`pb-2 border-b-2 px-1 transition-all cursor-pointer ${
            activeTab === 'symbols'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Manage Symbols
        </button>
        <button
          onClick={() => {
            setActiveTab('app');
            window.location.hash = '#/settings?tab=app';
          }}
          className={`pb-2 border-b-2 px-1 transition-all cursor-pointer ${
            activeTab === 'app'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Application Defaults
        </button>
        <button
          onClick={() => {
            setActiveTab('logs');
            window.location.hash = '#/settings?tab=logs';
          }}
          className={`pb-2 border-b-2 px-1 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          System Logs
        </button>
      </div>

      {/* TAB 1: MANAGE SYMBOLS */}
      {activeTab === 'symbols' && (
        <div className="panel space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle/40">
            <h2 className="section-title flex items-center gap-1.5">
              <Settings2 className="w-4 h-4 text-accent" />
              Database Symbol Metadata Overview
            </h2>
          </div>
          
          {isLoadingSymbols ? (
            <div className="flex items-center justify-center py-10 text-xs text-text-secondary font-mono">
              <RefreshCw className="w-4 h-4 animate-spin text-accent mr-2" />
              <span>Scanning database tables...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary text-[11px] uppercase font-semibold">
                    <th className="py-2 px-2">Symbol</th>
                    <th className="py-2 px-2">Exchange & Type</th>
                    <th className="py-2 px-2">Price Scale</th>
                    <th className="py-2 px-2">Candle Boundaries</th>
                    <th className="py-2 px-2 text-center" colSpan={8}>Timeframe Counts</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                  <tr className="border-b border-border-subtle/30 text-[9px] text-text-muted font-mono bg-bg-base/30">
                    <th colSpan={4} className="py-1"></th>
                    <th className="py-1 text-center w-8">1m</th>
                    <th className="py-1 text-center w-8">5m</th>
                    <th className="py-1 text-center w-8">15m</th>
                    <th className="py-1 text-center w-8">30m</th>
                    <th className="py-1 text-center w-8">1h</th>
                    <th className="py-1 text-center w-8">4h</th>
                    <th className="py-1 text-center w-8">1d</th>
                    <th className="py-1 text-center w-8">1w</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {symbolsOverview.map((sym) => (
                    <tr key={sym.symbol} className="compact-row text-xs hover:bg-bg-surface-elevated/45 transition-colors">
                      <td className="py-2 px-2 font-semibold">
                        <div className="flex items-center gap-1.5">
                          {sym.symbol_logo && (
                            <img 
                              src={sym.symbol_logo} 
                              alt={sym.symbol} 
                              className="w-4 h-4 rounded-full bg-bg-base" 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                            />
                          )}
                          <div>
                            <span className="text-text-primary font-mono">{sym.symbol}</span>
                            <div className="text-[10px] text-text-secondary font-normal">{sym.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-[11px] leading-tight">
                        <div className="capitalize font-medium text-text-primary">{sym.type}</div>
                        <div className="text-[10px] text-text-muted font-mono">{sym.exchange}</div>
                      </td>
                      <td className="py-2 px-2 font-mono text-[11px] text-text-secondary">
                        {sym.pricescale}
                      </td>
                      <td className="py-2 px-2 text-[10px] font-mono text-text-secondary leading-tight whitespace-nowrap">
                        <div className="text-[9px] text-text-muted">Start: {sym.first_ts}</div>
                        <div className="text-[9px] text-text-muted">End: {sym.last_ts}</div>
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['1m'] ? sym.timeframe_counts['1m'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['5m'] ? sym.timeframe_counts['5m'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['15m'] ? sym.timeframe_counts['15m'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['30m'] ? sym.timeframe_counts['30m'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['1h'] ? sym.timeframe_counts['1h'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['4h'] ? sym.timeframe_counts['4h'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['1d'] ? sym.timeframe_counts['1d'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 text-center font-mono text-[11px] text-text-secondary">
                        {sym.timeframe_counts['1w'] ? sym.timeframe_counts['1w'].toLocaleString() : '-'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => startEditing(sym)}
                          className="h-6 px-2.5 bg-bg-base hover:bg-bg-surface-elevated border border-border-subtle hover:border-accent text-text-secondary hover:text-accent rounded text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          Config
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APPLICATION SETTINGS */}
      {activeTab === 'app' && (
        <div className="panel max-w-2xl">
          <h2 className="section-title mb-4 flex items-center gap-1.5 pb-2 border-b border-border-subtle/40">
            <Settings2 className="w-4 h-4 text-accent" />
            Workspace Storage & Environment
          </h2>

          <form onSubmit={handleSaveAppSettings} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="data-folder-path" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                DuckDB Database Folder Storage Path
              </label>
              <input
                id="data-folder-path"
                type="text"
                value={dataFolderPath}
                onChange={(e) => setDataFolderPath(e.target.value)}
                placeholder="e.g. /home/ajinkya/projects/TestsGithub/16_july/db"
                required
                className="w-full text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="default-timeframe" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Default View Timeframe
                </label>
                <select
                  id="default-timeframe"
                  value={defaultTimeframe}
                  onChange={(e) => setDefaultTimeframe(e.target.value)}
                  className="w-full"
                >
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="15m">15 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="4h">4 Hours</option>
                  <option value="1D">Daily (1D)</option>
                  <option value="1W">Weekly (1W)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="default-risk-pct" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Backtesting Default Risk (%)
                </label>
                <input
                  id="default-risk-pct"
                  type="number"
                  step="0.05"
                  min="0"
                  max="100"
                  value={defaultRiskPct}
                  onChange={(e) => setDefaultRiskPct(Number(e.target.value))}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label htmlFor="app-theme" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Active Terminal Theme Mode
                </label>
                <select
                  id="app-theme"
                  value={appTheme}
                  onChange={(e) => setAppTheme(e.target.value)}
                  className="w-full"
                >
                  <option value="dark">Dark Bloomberg/TradingView Terminal theme</option>
                  <option value="light">Light developer sandbox theme</option>
                </select>
              </div>
            </div>

            {/* Save Buttons & Status */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <button
                type="submit"
                disabled={isSavingApp}
                className="h-8 min-w-[150px] bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingApp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Defaults...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Configuration
                  </>
                )}
              </button>

              {saveAppStatus === 'success' && (
                <div className="flex items-center gap-1.5 text-bull bg-bull-soft border border-bull/20 px-3 py-1 rounded text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settings updated successfully!</span>
                </div>
              )}
              {saveAppStatus === 'error' && (
                <div className="flex items-center gap-1.5 text-bear bg-bear-soft border border-bear/20 px-3 py-1 rounded text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Failed to save configurations.</span>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SYSTEM LOGS */}
      {activeTab === 'logs' && (
        <div className="panel">
          <LogsPage embedded={true} />
        </div>
      )}

      {/* Symbol Edit Modal Overlay */}
      {editingSymbol && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-bg-surface border border-border-subtle rounded-lg w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-bg-surface shrink-0">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1">Configure {selectedSymbol}</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Modify ticker database overrides</p>
              </div>
              <button
                onClick={() => setEditingSymbol(null)}
                className="text-text-secondary hover:text-text-primary p-1 bg-bg-base border border-border-subtle rounded transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveSymbolSettings} className="p-4 overflow-y-auto space-y-3 flex-1">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Gold Spot / U.S. Dollar"
                  required
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Exchange</label>
                  <input
                    type="text"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value.toUpperCase())}
                    placeholder="e.g. FOREX"
                    required
                    className="w-full font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Asset Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full"
                  >
                    <option value="forex">Forex</option>
                    <option value="commodity">Commodity</option>
                    <option value="crypto">Cryptocurrency</option>
                    <option value="stock">Stock</option>
                    <option value="index">Index</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Price Scale</label>
                  <input
                    type="number"
                    value={priceScale}
                    onChange={(e) => setPriceScale(Number(e.target.value))}
                    required
                    className="w-full font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Logo URL</label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="e.g. /logos/gold.svg"
                    className="w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Session Hours</label>
                  <input
                    type="text"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    placeholder="e.g. 24x7 or 0900-1600"
                    required
                    className="w-full font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. Etc/UTC"
                    required
                    className="w-full font-mono"
                  />
                </div>
              </div>

              {saveStatus === 'success' && (
                <div className="flex items-center gap-1.5 text-bull bg-bull-soft border border-bull/20 p-2 rounded text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Metadata saved successfully!</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-1.5 text-bear bg-bear-soft border border-bear/20 p-2 rounded text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Failed to save database config.</span>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-border-subtle/50 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingSymbol(null)}
                  className="h-8 px-4 bg-bg-base border border-border-subtle hover:border-text-secondary text-text-primary rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-8 px-4 bg-accent hover:bg-accent-hover text-black rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Ticker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
