import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CandlestickChart, Compass, Terminal, RefreshCw, Database, UploadCloud, CheckCircle2, AlertTriangle, FileText, Calendar, ArrowRight } from 'lucide-react'
import { logger } from '../lib/logger'

interface FileValidation {
  formatType: 'mt4' | 'standard' | 'invalid'
  lineCount: number
  startDateStr: string
  endDateStr: string
  suggestedSymbol: string
  headers: string[]
  error?: string
}

export default function ImportPage() {
  const [csvSymbol, setCsvSymbol] = useState('XAUUSD')
  const [csvResolution, setCsvResolution] = useState('1m')
  const [csvFormat, setCsvFormat] = useState('mt4')
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<FileValidation | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  
  // Upload and import state
  const [isImporting, setIsImporting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')

  // Trigger file analysis on selection
  useEffect(() => {
    if (!selectedFile) {
      setValidation(null)
      return
    }

    setIsValidating(true)
    setImportStatus('idle')
    setImportMessage('')

    const analyzeFile = async () => {
      try {
        const file = selectedFile
        const startText = await file.slice(0, 50 * 1024).text() // first 50KB
        const lines = startText.split(/\r?\n/)
        const headersLine = lines[0] || ''
        const firstDataLine = lines[1] || ''

        // Get end block to extract last date
        const endOffset = Math.max(0, file.size - 50 * 1024)
        const endText = await file.slice(endOffset, file.size).text()
        const endLines = endText.split(/\r?\n/)
        const lastDataLine = endLines.filter(l => l.trim()).pop() || ''

        // Format detection
        const isTab = headersLine.includes('\t')
        const delimiter = isTab ? '\t' : ','
        const formatType = isTab ? 'mt4' : 'standard'
        const headers = headersLine.split(delimiter).map(h => h.trim().toLowerCase())

        // Header column validation checks
        let format: 'mt4' | 'standard' | 'invalid' = formatType
        let validationError = ''
        
        if (formatType === 'mt4') {
          const req = ['<date>', '<time>', '<open>', '<high>', '<low>', '<close>']
          const missing = req.filter(col => !headers.includes(col))
          if (missing.length > 0) {
            format = 'invalid'
            validationError = `Invalid MT4 columns. Missing: ${missing.join(', ')}`
          }
        } else {
          // Standard columns mapping
          const timeCol = headers.find(h => h.includes('time') || h.includes('timestamp') || h.includes('date') || h.includes('ts'))
          const openCol = headers.find(h => h === 'open' || h === 'o')
          const highCol = headers.find(h => h === 'high' || h === 'h')
          const lowCol = headers.find(h => h === 'low' || h === 'l')
          const closeCol = headers.find(h => h === 'close' || h === 'c')

          if (!timeCol || !openCol || !highCol || !lowCol || !closeCol) {
            format = 'invalid'
            validationError = 'Missing required columns (time/date, open, high, low, close)'
          }
        }

        // Count lines in chunks (memory-efficient)
        let lineCount = 0
        const chunkSize = 2 * 1024 * 1024 // 2MB
        let offset = 0
        while (offset < file.size) {
          const chunk = file.slice(offset, offset + chunkSize)
          const text = await chunk.text()
          for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') lineCount++
          }
          offset += chunkSize
        }

        // Extract dates
        let startDateStr = 'Unknown'
        let endDateStr = 'Unknown'

        if (format !== 'invalid') {
          if (format === 'mt4') {
            const firstCols = firstDataLine.split('\t')
            const lastCols = lastDataLine.split('\t')
            
            // Find index of <DATE> and <TIME>
            const rawHeaders = headersLine.split('\t').map(h => h.trim().toUpperCase())
            const dIdx = rawHeaders.indexOf('<DATE>')
            const tIdx = rawHeaders.indexOf('<TIME>')

            if (dIdx !== -1 && tIdx !== -1) {
              if (firstCols[dIdx]) startDateStr = `${firstCols[dIdx]} ${firstCols[tIdx] || ''}`.trim()
              if (lastCols[dIdx]) endDateStr = `${lastCols[dIdx]} ${lastCols[tIdx] || ''}`.trim()
            }
          } else {
            const rawHeaders = headersLine.split(',').map(h => h.trim().toLowerCase())
            const timeColName = rawHeaders.find(h => h.includes('time') || h.includes('timestamp') || h.includes('date') || h.includes('ts'))
            if (timeColName) {
              const tIdx = rawHeaders.indexOf(timeColName)
              const firstCols = firstDataLine.split(',')
              const lastCols = lastDataLine.split(',')
              if (tIdx !== -1) {
                if (firstCols[tIdx]) startDateStr = firstCols[tIdx]
                if (lastCols[tIdx]) endDateStr = lastCols[tIdx]
              }
            }
          }
        }

        // Suggest symbol from filename (strip extension and map to upper)
        const suggestedSymbol = file.name.split('.')[0].toUpperCase().replace(/[^A-Z0-9]/gi, '')

        setValidation({
          formatType: format,
          lineCount: Math.max(0, lineCount - 1),
          startDateStr,
          endDateStr,
          suggestedSymbol,
          headers: headersLine.split(delimiter),
          error: validationError
        })

        // Sync suggested states
        if (suggestedSymbol) {
          setCsvSymbol(suggestedSymbol)
        }
        setCsvFormat(format === 'invalid' ? 'standard' : format)

      } catch (err: any) {
        console.error('File pre-validation error:', err)
        setValidation({
          formatType: 'invalid',
          lineCount: 0,
          startDateStr: 'N/A',
          endDateStr: 'N/A',
          suggestedSymbol: '',
          headers: [],
          error: `Pre-validation failed: ${err.message}`
        })
      } finally {
        setIsValidating(false)
      }
    }

    analyzeFile()
  }, [selectedFile])

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setImportStatus('error')
      setImportMessage('Please select a file to import')
      return
    }

    setIsImporting(true)
    setUploadProgress(0)
    setImportStatus('idle')
    setImportMessage('')

    const formData = new FormData()
    formData.append('symbol', csvSymbol)
    formData.append('resolution', csvResolution)
    formData.append('format_type', csvFormat)
    formData.append('file', selectedFile)

    // Using XMLHttpRequest to support upload progress tracking
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://localhost:8000/1.1/import_csv', true)

    // Listen to upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        // Keep it under 95% until backend actually returns status
        setUploadProgress(Math.min(95, percent))
      }
    }

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status === 200 && response.status === 'ok') {
          setUploadProgress(100)
          setImportStatus('success')
          setImportMessage(response.message || 'Data imported successfully!')
          setSelectedFile(null)
          
          // Clear inputs
          const fileInput = document.getElementById('csv-file-input') as HTMLInputElement
          if (fileInput) fileInput.value = ''
        } else {
          const errMsg = response.message || `Import failed with status ${xhr.status}`
          setImportStatus('error')
          setImportMessage(errMsg)
          
          // Log error to centralized logging
          logger.error(`CSV Import Failure: ${errMsg}`, {
            symbol: csvSymbol,
            resolution: csvResolution,
            format: csvFormat,
            fileName: selectedFile.name,
            fileSize: selectedFile.size
          })
        }
      } catch (err: any) {
        const errMsg = `JSON parsing failed: ${err.message}`
        setImportStatus('error')
        setImportMessage(errMsg)
        logger.error(`CSV Import JSON error: ${errMsg}`, {
          statusText: xhr.statusText,
          status: xhr.status
        })
      } finally {
        setIsImporting(false)
      }
    }

    xhr.onerror = () => {
      const errMsg = 'Network error occurred during file upload.'
      setImportStatus('error')
      setImportMessage(errMsg)
      logger.error(errMsg, { symbol: csvSymbol, fileName: selectedFile.name })
      setIsImporting(false)
    }

    xhr.send(formData)
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
          <Link to="/import" className="flex items-center gap-3 bg-tv-bg-tertiary border border-tv-border text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Database className="w-5 h-5 text-tv-brand" />
            Historical Importer
          </Link>
          <Link to="/logs" className="flex items-center gap-3 text-tv-text-muted hover:text-tv-text-primary px-4 py-3 rounded-tv-md font-medium transition-colors">
            <Terminal className="w-5 h-5" />
            App Logs
          </Link>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-4xl">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-tv-text-primary leading-tight">
            Historical Data Importer
          </h1>
          <p className="text-tv-text-muted text-lg max-w-2xl">
            Import MT4 tab-separated or standard comma-separated historical candlestick records directly into the local DuckDB database.
          </p>
        </div>

        <div className="bg-tv-bg-secondary border border-tv-border rounded-tv-xl p-8 backdrop-blur-xl shadow-2xl space-y-8">
          <form onSubmit={handleImportSubmit} className="space-y-6">
            
            {/* File Drop Area */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-tv-text-muted">Select Market Data File</label>
              <div className="border-2 border-dashed border-tv-border hover:border-tv-text-muted/30 bg-tv-bg-primary/40 rounded-tv-lg p-8 text-center transition-all relative flex flex-col items-center justify-center min-h-[180px]">
                <UploadCloud className="w-12 h-12 text-tv-text-muted mb-3" />
                {selectedFile ? (
                  <div>
                    <p className="text-tv-green font-semibold">{selectedFile.name}</p>
                    <p className="text-xs text-tv-text-muted font-mono mt-1">
                      Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-tv-text-primary font-semibold">Click to browse or drop file here</p>
                    <p className="text-xs text-tv-text-muted mt-1">Supports MT4 exports (.txt, .tab) or Standard CSV (.csv)</p>
                  </div>
                )}
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,.txt,.tab"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Validation Feedback Loader */}
            {isValidating && (
              <div className="flex items-center gap-3 text-tv-text-muted bg-tv-bg-primary/60 p-4 rounded-tv-md border border-tv-border">
                <RefreshCw className="w-5 h-5 animate-spin text-tv-brand" />
                <span className="text-sm font-medium">Analyzing file structure and validating headers...</span>
              </div>
            )}

            {/* File Validation Info Card */}
            {validation && (
              <div className={`p-6 rounded-tv-lg border backdrop-blur-md space-y-4 ${
                validation.formatType === 'invalid' 
                  ? 'bg-tv-red/5 border-tv-red/20 text-tv-red' 
                  : 'bg-tv-green/5 border-tv-green/15 text-tv-text-primary'
              }`}>
                <div className="flex items-center justify-between border-b border-tv-border/60 pb-3">
                  <h3 className="font-bold text-tv-text-primary flex items-center gap-2">
                    <FileText className="w-5 h-5 text-tv-brand" />
                    Pre-validation Report
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-tv-full text-xs font-semibold uppercase tracking-wider ${
                    validation.formatType === 'invalid'
                      ? 'bg-tv-red/20 text-tv-red border border-tv-red/30'
                      : 'bg-tv-green/20 text-tv-green border border-tv-green/30'
                  }`}>
                    {validation.formatType === 'mt4' ? 'MT4 Tab Format' : validation.formatType === 'standard' ? 'Standard CSV' : 'Incompatible Format'}
                  </span>
                </div>

                {validation.error ? (
                  <div className="flex items-center gap-2 text-tv-red text-sm font-medium">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{validation.error}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-xs text-tv-text-muted font-semibold uppercase tracking-wider">Suggested Symbol</div>
                      <div className="font-bold text-tv-text-primary">{validation.suggestedSymbol}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-tv-text-muted font-semibold uppercase tracking-wider">Record Count (Rows)</div>
                      <div className="font-mono text-tv-text-primary font-bold">{validation.lineCount.toLocaleString()} candles</div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <div className="text-xs text-tv-text-muted font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-tv-text-muted" />
                        Date range detected
                      </div>
                      <div className="font-mono text-tv-text-muted flex items-center gap-2">
                        <span className="bg-tv-bg-primary px-2.5 py-1 rounded-tv-sm border border-tv-border text-xs text-tv-text-primary">{validation.startDateStr}</span>
                        <ArrowRight className="w-4 h-4 text-tv-text-muted/65" />
                        <span className="bg-tv-bg-primary px-2.5 py-1 rounded-tv-sm border border-tv-border text-xs text-tv-text-primary">{validation.endDateStr}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Config inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Symbol */}
              <div className="space-y-2">
                <label htmlFor="csv-symbol" className="block text-sm font-semibold text-tv-text-muted">
                  Target Symbol Ticker
                </label>
                <input
                  id="csv-symbol"
                  type="text"
                  value={csvSymbol}
                  onChange={(e) => setCsvSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. XAUUSD"
                  required
                  className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary placeholder-tv-text-muted focus:outline-none focus:border-tv-brand transition-colors"
                />
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <label htmlFor="csv-resolution" className="block text-sm font-semibold text-tv-text-muted">
                  Target Timeframe
                </label>
                <select
                  id="csv-resolution"
                  value={csvResolution}
                  onChange={(e) => setCsvResolution(e.target.value)}
                  className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                >
                  <option value="1m">1 Minute (Intraday)</option>
                  <option value="1D">Daily (1D)</option>
                  <option value="1W">Weekly (1W)</option>
                </select>
              </div>

              {/* Format schema */}
              <div className="space-y-2">
                <label htmlFor="csv-format" className="block text-sm font-semibold text-tv-text-muted">
                  CSV Columns Schema
                </label>
                <select
                  id="csv-format"
                  value={csvFormat}
                  onChange={(e) => setCsvFormat(e.target.value)}
                  className="w-full bg-tv-bg-primary border border-tv-border rounded-tv-md px-4 py-3 text-tv-text-primary focus:outline-none focus:border-tv-brand transition-colors"
                >
                  <option value="mt4">MT4 format (&lt;DATE&gt; &lt;TIME&gt;)</option>
                  <option value="standard">Standard CSV (time,open,high,low,close)</option>
                </select>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-tv-text-muted font-semibold uppercase tracking-wider">
                  <span>Uploading to DuckDB...</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-tv-bg-primary rounded-tv-full h-3 border border-tv-border overflow-hidden relative p-0.5">
                  <div 
                    className="bg-tv-brand h-full rounded-tv-full transition-all duration-300 relative shadow shadow-tv-brand/20"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* Submit & Status Banners */}
            <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <button
                type="submit"
                disabled={isImporting || !selectedFile || validation?.formatType === 'invalid'}
                className="w-full md:w-fit bg-tv-brand hover:bg-tv-brand-hover text-tv-text-primary font-bold px-8 py-4 rounded-tv-sm transition-all hover:scale-105 flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processing Candles...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    Run CSV Data Import
                  </>
                )}
              </button>

              {importStatus === 'success' && (
                <div className="flex-1 flex items-center gap-2.5 text-tv-green font-semibold bg-tv-green/10 border border-tv-green/25 px-4 py-3.5 rounded-tv-md text-sm leading-snug">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>{importMessage}</span>
                </div>
              )}

              {importStatus === 'error' && (
                <div className="flex-1 flex items-center gap-2.5 text-tv-red font-semibold bg-tv-red/10 border border-tv-red/25 px-4 py-3.5 rounded-tv-md text-sm leading-snug">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span>{importMessage}</span>
                </div>
              )}
            </div>

          </form>
        </div>
      </main>
    </div>
  )
}
