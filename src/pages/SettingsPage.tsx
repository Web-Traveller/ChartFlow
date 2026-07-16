import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CandlestickChart, ArrowLeft, Save, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'

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

  useEffect(() => {
    // Fetch current settings
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

  const handleSave = (e: React.FormEvent) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white font-sans">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <CandlestickChart className="w-8 h-8 text-emerald-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              ChartFlow
            </span>
          </Link>
          <Link to="/chart" className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold px-4 py-2 rounded-lg transition-all text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Chart
          </Link>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent leading-tight">
            Symbol Configurations
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Configure dynamic descriptions, exchanges, precision multipliers, and logo urls served by the backend database.
          </p>
        </div>

        {/* Setting Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Symbol Select Option */}
            <div className="space-y-2">
              <label htmlFor="symbol" className="block text-sm font-semibold text-slate-300">
                Select Active Symbol
              </label>
              <select
                id="symbol"
                value={selectedSymbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="XAUUSD">XAUUSD (Gold Spot)</option>
                <option value="XAGUSD">XAGUSD (Silver Spot)</option>
                <option value="BTCUSD">BTCUSD (Bitcoin)</option>
              </select>
            </div>

            <hr className="border-slate-800 my-8" />

            {/* Config Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="description" className="block text-sm font-semibold text-slate-300">
                  Custom Description
                </label>
                <input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Gold Spot / U.S. Dollar"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Asset Type */}
              <div className="space-y-2">
                <label htmlFor="type" className="block text-sm font-semibold text-slate-300">
                  Asset Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
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
                <label htmlFor="exchange" className="block text-sm font-semibold text-slate-300">
                  Exchange Name
                </label>
                <input
                  id="exchange"
                  type="text"
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value.toUpperCase())}
                  placeholder="e.g. FOREX or COMEX"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Price Scale */}
              <div className="space-y-2">
                <label htmlFor="pricescale" className="block text-sm font-semibold text-slate-300">
                  Price Scale / Precision
                </label>
                <select
                  id="pricescale"
                  value={priceScale}
                  onChange={(e) => setPriceScale(Number(e.target.value))}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value={100}>100 (2 decimals - e.g. Cryptos)</option>
                  <option value={1000}>1000 (3 decimals - e.g. commodities)</option>
                  <option value={100000}>100000 (5 decimals - e.g. Forex spot)</option>
                </select>
              </div>

              {/* Session */}
              <div className="space-y-2">
                <label htmlFor="session" className="block text-sm font-semibold text-slate-300">
                  Market Session Hours
                </label>
                <input
                  id="session"
                  type="text"
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="e.g. 24x7 or 0900-1600"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <label htmlFor="timezone" className="block text-sm font-semibold text-slate-300">
                  Timezone
                </label>
                <input
                  id="timezone"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. Etc/UTC or America/New_York"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Logo URL */}
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="logourl" className="block text-sm font-semibold text-slate-300">
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
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden p-2">
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
                className="flex-1 max-w-xs bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold py-4 rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Settings
                  </>
                )}
              </button>

              {/* Status Banner */}
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/25 px-4 py-3.5 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Settings updated!</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/25 px-4 py-3.5 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Failed to save.</span>
                </div>
              )}
            </div>

          </form>
        </div>
      </main>
    </div>
  )
}
