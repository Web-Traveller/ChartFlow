import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CandlestickChart, Save, CheckCircle2, AlertTriangle, RefreshCw, Compass, Plus, Terminal } from 'lucide-react'

interface SymbolConfig {
  name: string
  ticker: string
  description: string
  type: string
  exchange: string
  session: string
  timezone: string
  pricescale: number
  symbol_logo: string
}

export default function SettingsPage() {
  // Tab control
  const [activeTab, setActiveTab] = useState<'symbol' | 'app'>(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    return tabParam === 'app' ? 'app' : 'symbol'
  })

  // Listen to search changes (e.g. back buttons)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam === 'app' || tabParam === 'symbol') {
      setActiveTab(tabParam)
    }
  }, [window.location.search])

  // Symbol Configuration states
  const [configs, setConfigs] = useState<{ [key: string]: SymbolConfig }>({})
  const [selectedSymbol, setSelectedSymbol] = useState('XAUUSD')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('forex')
  const [exchange, setExchange] = useState('FOREX')
  const [session, setSession] = useState('24x7')
  const [timezone, setTimezone] = useState('Etc/UTC')
  const [priceScale, setPriceScale] = useState(100000)
  const [logoUrl, setLogoUrl] = useState('/logos/gold.svg')
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Application Settings states
  const [dataFolderPath, setDataFolderPath] = useState('/home/ajinkya/projects/TestsGithub/16_july/db')
  const [defaultRiskPct, setDefaultRiskPct] = useState(1.0)
  const [defaultTimeframe, setDefaultTimeframe] = useState('1D')
  const [appTheme, setAppTheme] = useState('dark')
  const [isSavingApp, setIsSavingApp] = useState(false)
  const [saveAppStatus, setSaveAppStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    // Fetch symbol settings
    fetch('http://localhost:8000/1.1/symbol_settings')
      .then(res => res.json())
      .then(data => {
        setConfigs(data)
        const active = data[selectedSymbol]
        if (active) {
          loadSymbolConfig(active)
        } else {
          // Defaults for XAUUSD if not yet saved
          setDescription('Gold / U.S. Dollar')
          setType('forex')
          setExchange('FOREX')
          setSession('24x7')
          setTimezone('Etc/UTC')
          setPriceScale(100000)
          setLogoUrl('/logos/gold.svg')
        }
      })
      .catch(err => console.error('Error fetching settings:', err))

    // Fetch app settings
    fetch('http://localhost:8000/1.1/app_settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.data_folder_path) setDataFolderPath(data.data_folder_path)
          if (data.default_risk_pct !== undefined) setDefaultRiskPct(data.default_risk_pct)
          if (data.default_timeframe) setDefaultTimeframe(data.default_timeframe)
          if (data.theme) setAppTheme(data.theme)
        }
      })
      .catch(err => console.error('Error fetching app settings:', err))
  }, [])

  const loadSymbolConfig = (cfg: SymbolConfig) => {
    setDescription(cfg.description || '')
    setType(cfg.type || 'forex')
    setExchange(cfg.exchange || 'FOREX')
    setSession(cfg.session || '24x7')
    setTimezone(cfg.timezone || 'Etc/UTC')
    setPriceScale(cfg.pricescale || 100000)
    setLogoUrl(cfg.symbol_logo || '/logos/default.png')
  }

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym)
    const active = configs[sym]
    if (active) {
      loadSymbolConfig(active)
    } else {
      // Set sensible defaults for common other symbols if selected
      if (sym === 'XAGUSD') {
        setDescription('Silver / U.S. Dollar')
        setType('commodity')
        setExchange('FOREX')
        setSession('24x7')
        setTimezone('Etc/UTC')
        setPriceScale(100)
        setLogoUrl('/logos/silver.svg')
      } else if (sym === 'BTCUSD') {
        setDescription('Bitcoin / U.S. Dollar')
        setType('crypto')
        setExchange('FOREX')
        setSession('24x7')
        setTimezone('Etc/UTC')
        setPriceScale(100)
        setLogoUrl('/logos/XTVCBTC.svg')
      } else {
        setDescription(`${sym} – Local DuckDB`)
        setType('forex')
        setExchange('FOREX')
        setSession('24x7')
        setTimezone('Etc/UTC')
        setPriceScale(100000)
        setLogoUrl('/logos/default.png')
      }
    }
  }

  const handleSaveSymbolSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveStatus('idle')

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
    }

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
          setConfigs(prev => ({ ...prev, ...payload }))
          setSaveStatus('success')
        } else {
          setSaveStatus('error')
        }
      })
      .catch(() => {
        setSaveStatus('error')
      })
      .finally(() => {
        setIsSaving(false)
        setTimeout(() => setSaveStatus('idle'), 4000)
      })
  }

  const handleSaveAppSettings = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingApp(true)
    setSaveAppStatus('idle')

    const payload = {
      data_folder_path: dataFolderPath,
      default_risk_pct: Number(defaultRiskPct),
      default_timeframe: defaultTimeframe,
      theme: appTheme
    }

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
          setSaveAppStatus('success')
        } else {
          setSaveAppStatus('error')
        }
      })
      .catch(() => {
        setSaveAppStatus('error')
      })
      .finally(() => {
        setIsSavingApp(false)
        setTimeout(() => setSaveAppStatus('idle'), 4000)
      })
  }

  return (
    <div className="min-h-screen bg-tv-bg-primary text-tv-text-primary font-tv flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-tv-border bg-tv-bg-secondary/50 backdrop-blur flex flex-col p-6">
        <div className="flex items-center gap-2 mb-10">
          <CandlestickChart className="w-8 h-8 text-tv-brand" />
          <span className="text-xl font-bold text-tv-text-primary">
            ChartFlow
          </span>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Compass className="w-5 h-5" />
            Dashboard
          </Link>
          <Link to="/chart" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <CandlestickChart className="w-5 h-5" />
            Launch Chart
          </Link>
          <Link to="/settings" className="flex items-center gap-3 bg-tv-bg-tertiary border border-tv-border text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Plus className="w-5 h-5 text-tv-brand" />
            Settings Manager
          </Link>
          <Link to="/logs" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Terminal className="w-5 h-5" />
            App Logs
          </Link>
        </nav>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-4xl">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-tv-text-primary leading-tight">
            Settings & Configurations
          </h1>
          <p className="text-tv-text-muted text-lg max-w-2xl">
            Configure symbol information, pricing models, database storage layouts, and application defaults.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-tv-border mb-8 gap-6">
          <button
            onClick={() => {
              setActiveTab('symbol')
              window.history.pushState(null, '', '/settings?tab=symbol')
            }}
            className={`pb-4 text-lg font-semibold border-b-2 px-1 transition-all ${
              activeTab === 'symbol'
                ? 'border-tv-brand text-tv-brand'
                : 'border-transparent text-tv-text-muted hover:text-tv-text-primary'
            }`}
          >
            Symbol Configuration
          </button>
          <button
            onClick={() => {
              setActiveTab('app')
              window.history.pushState(null, '', '/settings?tab=app')
            }}
            className={`pb-4 text-lg font-semibold border-b-2 px-1 transition-all ${
              activeTab === 'app'
                ? 'border-tv-brand text-tv-brand'
                : 'border-transparent text-tv-text-muted hover:text-tv-text-primary'
            }`}
          >
            Application Settings
          </button>
        </div>

        {/* TAB 1: SYMBOL CONFIGURATION */}
        {activeTab === 'symbol' && (
          <div className="bg-tv-bg-secondary border border-tv-border rounded-tv-xl p-8 backdrop-blur-xl shadow-2xl">
            <form onSubmit={handleSaveSymbolSettings} className="space-y-6">
              
              {/* Symbol Select Option */}
              <div className="space-y-2">
                <label htmlFor="symbol" className="block text-sm font-semibold text-tv-text-muted">
                  Select Active Symbol
                </label>
                <select
                  id="symbol"
                  value={selectedSymbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                >
                  <option value="XAUUSD">XAUUSD (Gold Spot)</option>
                  <option value="XAGUSD">XAGUSD (Silver Spot)</option>
                  <option value="BTCUSD">BTCUSD (Bitcoin)</option>
                  {Object.keys(configs).filter(s => s !== 'XAUUSD' && s !== 'XAGUSD' && s !== 'BTCUSD').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <hr className="border-tv-border my-8" />

              {/* Config Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Description */}
                <div className="space-y-2">
                  <label htmlFor="description" className="block text-sm font-semibold text-tv-text-muted">
                    Custom Description
                  </label>
                  <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Gold Spot / U.S. Dollar"
                    required
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                  />
                </div>

                {/* Asset Type */}
                <div className="space-y-2">
                  <label htmlFor="type" className="block text-sm font-semibold text-tv-text-muted">
                    Asset Type
                  </label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                  >
                    <option value="forex">Forex</option>
                    <option value="commodity">Commodity</option>
                    <option value="crypto">Cryptocurrency</option>
                    <option value="stock">Stock</option>
                    <option value="index">Index</option>
                  </select>
                </div>

                {/* Exchange */}
                <div className="space-y-2">
                  <label htmlFor="exchange" className="block text-sm font-semibold text-tv-text-muted">
                    Exchange Name
                  </label>
                  <input
                    id="exchange"
                    type="text"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value.toUpperCase())}
                    placeholder="e.g. FOREX or COMEX"
                    required
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                  />
                </div>

                {/* Price Scale */}
                <div className="space-y-2">
                  <label htmlFor="pricescale" className="block text-sm font-semibold text-tv-text-muted">
                    Price Scale / Precision
                  </label>
                  <select
                    id="pricescale"
                    value={priceScale}
                    onChange={(e) => setPriceScale(Number(e.target.value))}
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                  >
                    <option value={100}>100 (2 decimals - e.g. Cryptos / Commodities)</option>
                    <option value={1000}>1000 (3 decimals - e.g. indices / pairs)</option>
                    <option value={100000}>100000 (5 decimals - e.g. Forex spot)</option>
                  </select>
                </div>

                {/* Session */}
                <div className="space-y-2">
                  <label htmlFor="session" className="block text-sm font-semibold text-tv-text-muted">
                    Market Session Hours
                  </label>
                  <input
                    id="session"
                    type="text"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    placeholder="e.g. 24x7 or 0900-1600"
                    required
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                  />
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <label htmlFor="timezone" className="block text-sm font-semibold text-tv-text-muted">
                    Timezone
                  </label>
                  <input
                    id="timezone"
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="e.g. Etc/UTC or America/New_York"
                    required
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                  />
                </div>

                {/* Logo URL */}
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="logourl" className="block text-sm font-semibold text-tv-text-muted">
                    Symbol Logo Path
                  </label>
                  <div className="flex gap-4 items-center">
                    <input
                      id="logourl"
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="e.g. /logos/gold.svg"
                      required
                      className="flex-1 bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                    />
                    <div className="w-12 h-12 bg-tv-bg-primary border border-tv-border rounded-tv-md flex items-center justify-center overflow-hidden p-2">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" onError={(e) => {
                        (e.target as HTMLImageElement).src = '/logos/default.png'
                      }} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Save Button */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 max-w-xs bg-tv-brand hover:bg-tv-brand-hover text-tv-text-primary font-bold py-4 rounded-tv-sm transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-tv-brand/10 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Symbol Configuration
                    </>
                  )}
                </button>

                {/* Status Banner */}
                {saveStatus === 'success' && (
                  <div className="flex items-center gap-2 text-tv-green bg-tv-green/10 border border-tv-green/25 px-4 py-3.5 rounded-tv-md text-sm font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Symbol Configuration updated!</span>
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center gap-2 text-tv-red bg-tv-red/10 border border-tv-red/25 px-4 py-3.5 rounded-tv-md text-sm font-semibold">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Failed to save configurations.</span>
                  </div>
                )}
              </div>

            </form>
          </div>
        )}

        {/* TAB 2: APPLICATION SETTINGS */}
        {activeTab === 'app' && (
          <div className="bg-tv-bg-secondary border border-tv-border rounded-tv-xl p-8 backdrop-blur-xl shadow-2xl">
            <form onSubmit={handleSaveAppSettings} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Storage path */}
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="data-folder-path" className="block text-sm font-semibold text-tv-text-muted">
                    DuckDB Database Storage Folder Path
                  </label>
                  <input
                    id="data-folder-path"
                    type="text"
                    value={dataFolderPath}
                    onChange={(e) => setDataFolderPath(e.target.value)}
                    placeholder="e.g. /home/ajinkya/projects/TestsGithub/16_july/db"
                    required
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                  />
                </div>

                {/* Default timeframe */}
                <div className="space-y-2">
                  <label htmlFor="default-timeframe" className="block text-sm font-semibold text-tv-text-muted">
                    Default Active Timeframe
                  </label>
                  <select
                    id="default-timeframe"
                    value={defaultTimeframe}
                    onChange={(e) => setDefaultTimeframe(e.target.value)}
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
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

                {/* Default risk % */}
                <div className="space-y-2">
                  <label htmlFor="default-risk-pct" className="block text-sm font-semibold text-tv-text-muted">
                    Default Backtesting Risk Percentage (%)
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
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                  />
                </div>

                {/* UI theme toggle */}
                <div className="space-y-2">
                  <label htmlFor="app-theme" className="block text-sm font-semibold text-tv-text-muted">
                    Default UI Theme
                  </label>
                  <select
                    id="app-theme"
                    value={appTheme}
                    onChange={(e) => setAppTheme(e.target.value)}
                    className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                  >
                    <option value="dark">Dark Slate Mode</option>
                    <option value="light">Light Gray Mode</option>
                  </select>
                </div>

              </div>

              {/* Save Button */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <button
                  type="submit"
                  disabled={isSavingApp}
                  className="flex-1 max-w-xs bg-tv-brand hover:bg-tv-brand-hover text-tv-text-primary font-bold py-4 rounded-tv-sm transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-tv-brand/10 disabled:opacity-50"
                >
                  {isSavingApp ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Application Settings
                    </>
                  )}
                </button>

                {/* Status Banner */}
                {saveAppStatus === 'success' && (
                  <div className="flex items-center gap-2 text-tv-green bg-tv-green/10 border border-tv-green/25 px-4 py-3.5 rounded-tv-md text-sm font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Application settings updated!</span>
                  </div>
                )}
                {saveAppStatus === 'error' && (
                  <div className="flex items-center gap-2 text-tv-red bg-tv-red/10 border border-tv-red/25 px-4 py-3.5 rounded-tv-md text-sm font-semibold">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Failed to save settings.</span>
                  </div>
                )}
              </div>

            </form>
          </div>
        )}

      </main>
    </div>
  )
}
