import { useState, useEffect } from 'react';
import { Play, Trash2, Calendar, ShieldCheck, AlertCircle, Plus, Sparkles, Activity } from 'lucide-react';

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

interface SymbolSetting {
  name: string;
  description: string;
  exchange: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<{ [key: string]: Session }>({});
  const [symbols, setSymbols] = useState<{ [key: string]: SymbolSetting }>({});
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');
  
  // Form fields
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('XAUUSD');
  const [allInstruments, setAllInstruments] = useState(false);
  const [allTime, setAllTime] = useState(true);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Load sessions
    fetch('http://localhost:8000/1.1/sessions')
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(err => console.error('Failed to load sessions:', err));

    // Load active symbols (only symbols present in database)
    fetch('http://localhost:8000/1.1/active_symbols')
      .then(res => res.json())
      .then(data => {
        setActiveSymbols(data);
        if (data.length > 0) {
          setSymbol(data[0]);
        }
      })
      .catch(err => console.error('Failed to load active symbols:', err));

    // Load symbol settings to resolve descriptions/exchanges for labels
    fetch('http://localhost:8000/1.1/symbol_settings')
      .then(res => res.json())
      .then(data => setSymbols(data))
      .catch(err => console.error('Failed to load symbols settings:', err));
  }, []);

  useEffect(() => {
    if (!symbol) return;
    fetch(`http://localhost:8000/1.1/symbols_metadata/${symbol}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load symbol bounds');
        return res.json();
      })
      .then(data => {
        setMinDate(data.min_date);
        setMaxDate(data.max_date);
        setTimeStart(data.min_date);
        setTimeEnd(data.max_date);
      })
      .catch(err => console.error('Failed to load symbol metadata:', err));
  }, [symbol]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    // Form validation
    if (!name.trim()) {
      setStatus('error');
      setMessage('Session name is required');
      return;
    }

    const payload = {
      name: name.trim(),
      symbol,
      all_instruments: allInstruments,
      all_time: allTime,
      time_start: allTime ? '' : timeStart,
      time_end: allTime ? '' : timeEnd
    };

    fetch('http://localhost:8000/1.1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setSessions(prev => ({ ...prev, [data.session.id]: data.session }));
          setStatus('success');
          setMessage('Session created successfully!');
          setName('');
        } else {
          setStatus('error');
          setMessage(data.message || 'Validation failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error while creating session.');
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    fetch(`http://localhost:8000/1.1/sessions/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'ok') {
          setSessions(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      })
      .catch(err => console.error('Error deleting session:', err));
  };

  // Symbol helper formatting
  const getSymbolLabel = (symName: string) => {
    const s = symbols[symName];
    return s ? `${symName} - ${s.description} (${s.exchange})` : symName;
  };

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto font-sans">
      
      {/* Page Header */}
      <div className="pb-1 border-b border-border-subtle/50">
        <h1 className="page-title">Sessions Manager</h1>
        <p className="meta-text mt-0.5">
          Configure custom viewing scopes, constrain backtesting periods, and initialize standalone market sessions.
        </p>
      </div>

      {/* Grid Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Create Session Form */}
        <div className="lg:col-span-1 panel flex flex-col h-fit">
          <h2 className="section-title mb-3 flex items-center gap-1.5 pb-2 border-b border-border-subtle/50">
            <Plus className="w-4 h-4 text-accent" />
            New Backtest Session
          </h2>
          
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Session Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gold Jan-July 2021"
                required
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Select Symbol
              </label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                disabled={allInstruments}
                className="w-full disabled:opacity-50"
              >
                {activeSymbols.map(s => (
                  <option key={s} value={s}>{getSymbolLabel(s)}</option>
                ))}
              </select>
            </div>

            {/* Checkbox Scopes */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary font-medium">
                <input
                  type="checkbox"
                  checked={allInstruments}
                  onChange={(e) => setAllInstruments(e.target.checked)}
                  className="w-4 h-4 bg-bg-base border-border-subtle rounded text-accent focus:ring-accent"
                />
                <span>Include All Instruments</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-secondary font-medium">
                <input
                  type="checkbox"
                  checked={allTime}
                  onChange={(e) => setAllTime(e.target.checked)}
                  className="w-4 h-4 bg-bg-base border-border-subtle rounded text-accent focus:ring-accent"
                />
                <span>All Available Timeframes</span>
              </label>
            </div>

            {/* Date pickers (only shown if not allTime) */}
            {!allTime && (
              <div className="space-y-2 pt-2 border-t border-border-subtle/50">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    min={minDate}
                    max={maxDate}
                    required
                    className="w-full text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    min={minDate}
                    max={maxDate}
                    required
                    className="w-full text-xs"
                  />
                </div>
              </div>
            )}

            {/* Banners */}
            {status === 'success' && (
              <div className="flex items-center gap-2 text-bull bg-bull-soft border border-bull/20 p-2.5 rounded text-xs">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-bear bg-bear-soft border border-bear/20 p-2.5 rounded text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-8 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Create Session
            </button>
          </form>
        </div>

        {/* Active Sessions List */}
        <div className="lg:col-span-2 panel flex flex-col min-h-[400px]">
          <h2 className="section-title mb-3 flex items-center gap-1.5 pb-2 border-b border-border-subtle/50">
            <Activity className="w-4 h-4 text-accent" />
            Configured Viewing Sessions
          </h2>
          
          {Object.keys(sessions).length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-text-muted border border-dashed border-border-subtle rounded-md bg-bg-base/10">
              <Calendar className="w-8 h-8 mb-2 text-text-muted/50" />
              <p className="text-xs font-semibold">No viewing sessions found.</p>
              <p className="text-[11px] text-text-muted mt-0.5">Use the configuration form on the left to start a new session.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary text-[11px] uppercase font-semibold">
                    <th className="py-2 px-3">Session Information</th>
                    <th className="py-2 px-3">Instrument Scope</th>
                    <th className="py-2 px-3">Date Boundaries</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/30">
                  {Object.values(sessions)
                    .sort((a, b) => b.created_at - a.created_at)
                    .map((sess) => (
                      <tr key={sess.id} className="compact-row text-xs hover:bg-bg-surface-elevated/45 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-text-primary">{sess.name}</div>
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">ID: {sess.id}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent/10 text-accent border border-accent/15 font-mono">
                            {sess.all_instruments ? 'ALL_INSTRUMENTS' : sess.symbol}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary">
                          {sess.all_time ? (
                            <span className="text-text-muted/65 italic">All Available Candlesticks</span>
                          ) : (
                            `${sess.time_start} - ${sess.time_end}`
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/chart?session=${sess.id}`}
                              className="h-7 px-3 bg-accent hover:bg-accent-hover text-black font-semibold text-xs rounded transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-black text-black" />
                              Launch
                            </a>
                            <button
                              onClick={() => handleDelete(sess.id)}
                              className="h-7 w-7 flex items-center justify-center bg-bg-base border border-border-subtle hover:border-bear/30 text-text-secondary hover:text-bear rounded transition-all cursor-pointer"
                              title="Delete Session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
