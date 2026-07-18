import { useState, useEffect } from 'react';
import { RefreshCw, Database, UploadCloud, CheckCircle2, AlertTriangle, FileText, Calendar, ArrowRight } from 'lucide-react';
import { logger } from '../lib/logger';

interface FileValidation {
  formatType: 'mt4' | 'standard' | 'invalid';
  lineCount: number;
  startDateStr: string;
  endDateStr: string;
  suggestedSymbol: string;
  headers: string[];
  error?: string;
}

export default function ImportPage() {
  const [csvSymbol, setCsvSymbol] = useState('XAUUSD');
  const [csvResolution, setCsvResolution] = useState('1m');
  const [csvFormat, setCsvFormat] = useState('mt4');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<FileValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  // Upload and import state
  const [isImporting, setIsImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  // Trigger file analysis on selection
  useEffect(() => {
    if (!selectedFile) {
      setValidation(null);
      return;
    }

    setIsValidating(true);
    setImportStatus('idle');
    setImportMessage('');

    const analyzeFile = async () => {
      try {
        const file = selectedFile;
        const startText = await file.slice(0, 50 * 1024).text(); // first 50KB
        const lines = startText.split(/\r?\n/);
        const headersLine = lines[0] || '';
        const firstDataLine = lines[1] || '';

        // Get end block to extract last date
        const endOffset = Math.max(0, file.size - 50 * 1024);
        const endText = await file.slice(endOffset, file.size).text();
        const endLines = endText.split(/\r?\n/);
        const lastDataLine = endLines.filter(l => l.trim()).pop() || '';

        // Format detection
        const isTab = headersLine.includes('\t');
        const delimiter = isTab ? '\t' : ',';
        const formatType = isTab ? 'mt4' : 'standard';
        const headers = headersLine.split(delimiter).map(h => h.trim().toLowerCase());

        // Header column validation checks
        let format: 'mt4' | 'standard' | 'invalid' = formatType;
        let validationError = '';
        
        if (formatType === 'mt4') {
          const req = ['<date>', '<time>', '<open>', '<high>', '<low>', '<close>'];
          const missing = req.filter(col => !headers.includes(col));
          if (missing.length > 0) {
            format = 'invalid';
            validationError = `Invalid MT4 columns. Missing: ${missing.join(', ')}`;
          }
        } else {
          // Standard columns mapping
          const timeCol = headers.find(h => h.includes('time') || h.includes('timestamp') || h.includes('date') || h.includes('ts'));
          const openCol = headers.find(h => h === 'open' || h === 'o');
          const highCol = headers.find(h => h === 'high' || h === 'h');
          const lowCol = headers.find(h => h === 'low' || h === 'l');
          const closeCol = headers.find(h => h === 'close' || h === 'c');

          if (!timeCol || !openCol || !highCol || !lowCol || !closeCol) {
            format = 'invalid';
            validationError = 'Missing required columns (time/date, open, high, low, close)';
          }
        }

        // Count lines in chunks (memory-efficient)
        let lineCount = 0;
        const chunkSize = 2 * 1024 * 1024; // 2MB
        let offset = 0;
        while (offset < file.size) {
          const chunk = file.slice(offset, offset + chunkSize);
          const text = await chunk.text();
          for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') lineCount++;
          }
          offset += chunkSize;
        }

        // Extract dates
        let startDateStr = 'Unknown';
        let endDateStr = 'Unknown';

        if (format !== 'invalid') {
          if (format === 'mt4') {
            const firstCols = firstDataLine.split('\t');
            const lastCols = lastDataLine.split('\t');
            
            // Find index of <DATE> and <TIME>
            const rawHeaders = headersLine.split('\t').map(h => h.trim().toUpperCase());
            const dIdx = rawHeaders.indexOf('<DATE>');
            const tIdx = rawHeaders.indexOf('<TIME>');

            if (dIdx !== -1 && tIdx !== -1) {
              if (firstCols[dIdx]) startDateStr = `${firstCols[dIdx]} ${firstCols[tIdx] || ''}`.trim();
              if (lastCols[dIdx]) endDateStr = `${lastCols[dIdx]} ${lastCols[tIdx] || ''}`.trim();
            }
          } else {
            const rawHeaders = headersLine.split(',').map(h => h.trim().toLowerCase());
            const timeColName = rawHeaders.find(h => h.includes('time') || h.includes('timestamp') || h.includes('date') || h.includes('ts'));
            if (timeColName) {
              const tIdx = rawHeaders.indexOf(timeColName);
              const firstCols = firstDataLine.split(',');
              const lastCols = lastDataLine.split(',');
              if (tIdx !== -1) {
                if (firstCols[tIdx]) startDateStr = firstCols[tIdx];
                if (lastCols[tIdx]) endDateStr = lastCols[tIdx];
              }
            }
          }
        }

        // Suggest symbol from filename (strip extension and map to upper)
        const suggestedSymbol = file.name.split('.')[0].toUpperCase().replace(/[^A-Z0-9]/gi, '');

        setValidation({
          formatType: format,
          lineCount: Math.max(0, lineCount - 1),
          startDateStr,
          endDateStr,
          suggestedSymbol,
          headers: headersLine.split(delimiter),
          error: validationError
        });

        // Sync suggested states
        if (suggestedSymbol) {
          setCsvSymbol(suggestedSymbol);
        }
        setCsvFormat(format === 'invalid' ? 'standard' : format);

      } catch (err: any) {
        console.error('File pre-validation error:', err);
        setValidation({
          formatType: 'invalid',
          lineCount: 0,
          startDateStr: 'N/A',
          endDateStr: 'N/A',
          suggestedSymbol: '',
          headers: [],
          error: `Pre-validation failed: ${err.message}`
        });
      } finally {
        setIsValidating(false);
      }
    };

    analyzeFile();
  }, [selectedFile]);

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setImportStatus('error');
      setImportMessage('Please select a file to import');
      return;
    }

    setIsImporting(true);
    setUploadProgress(0);
    setImportStatus('idle');
    setImportMessage('');

    const formData = new FormData();
    formData.append('symbol', csvSymbol);
    formData.append('resolution', csvResolution);
    formData.append('format_type', csvFormat);
    formData.append('file', selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:8000/1.1/import_csv', true);

    // Listen to upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(Math.min(95, percent));
      }
    };

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && response.status === 'ok') {
          setUploadProgress(100);
          setImportStatus('success');
          setImportMessage(response.message || 'Data imported successfully!');
          setSelectedFile(null);
          
          // Clear inputs
          const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
        } else {
          const errMsg = response.message || `Import failed with status ${xhr.status}`;
          setImportStatus('error');
          setImportMessage(errMsg);
          
          logger.error(`CSV Import Failure: ${errMsg}`, {
            symbol: csvSymbol,
            resolution: csvResolution,
            format: csvFormat,
            fileName: selectedFile.name,
            fileSize: selectedFile.size
          });
        }
      } catch (err: any) {
        const errMsg = `JSON parsing failed: ${err.message}`;
        setImportStatus('error');
        setImportMessage(errMsg);
        logger.error(`CSV Import JSON error: ${errMsg}`, {
          statusText: xhr.statusText,
          status: xhr.status
        });
      } finally {
        setIsImporting(false);
      }
    };

    xhr.onerror = () => {
      const errMsg = 'Network error occurred during file upload.';
      setImportStatus('error');
      setImportMessage(errMsg);
      logger.error(errMsg, { symbol: csvSymbol, fileName: selectedFile.name });
      setIsImporting(false);
    };

    xhr.send(formData);
  };

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto font-sans">
      
      {/* Page Header */}
      <div className="pb-1 border-b border-border-subtle/50">
        <h1 className="page-title">Historical Data Importer</h1>
        <p className="meta-text mt-0.5">
          Import MT4 tab-separated or standard comma-separated historical candlestick records directly into the local DuckDB database.
        </p>
      </div>

      {/* Main Workspace Frame */}
      <div className="panel space-y-4">
        <form onSubmit={handleImportSubmit} className="space-y-4">
          
          {/* File Drop zone */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              Select Market Data File
            </label>
            <div className="border-2 border-dashed border-border-subtle hover:border-text-secondary/30 bg-bg-base/30 rounded-lg p-6 text-center transition-all relative flex flex-col items-center justify-center min-h-[140px] group cursor-pointer">
              <UploadCloud className="w-8 h-8 text-text-secondary group-hover:text-accent transition-colors mb-2" />
              {selectedFile ? (
                <div>
                  <p className="text-bull text-xs font-bold font-mono">{selectedFile.name}</p>
                  <p className="text-[10px] text-text-muted font-mono mt-0.5">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-text-primary text-xs font-semibold">Click to select or drop candlestick file here</p>
                  <p className="text-[11px] text-text-muted mt-0.5">Supports MT4 exports (.txt, .tab) or Standard CSV (.csv)</p>
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
            <div className="flex items-center gap-2 text-text-secondary bg-bg-base/60 p-2.5 rounded border border-border-subtle text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
              <span>Analyzing file layout structure and headers...</span>
            </div>
          )}

          {/* File Validation Info Card */}
          {validation && (
            <div className={`p-4 rounded-lg border backdrop-blur-md space-y-3 ${
              validation.formatType === 'invalid' 
                ? 'bg-bear-soft border-bear/20 text-bear' 
                : 'bg-bull-soft border-bull/15 text-text-primary'
            }`}>
              <div className="flex items-center justify-between border-b border-border-subtle/50 pb-2">
                <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-accent" />
                  Pre-validation Report
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  validation.formatType === 'invalid'
                    ? 'bg-bear/20 text-bear border border-bear/30'
                    : 'bg-bull/20 text-bull border border-bull/30'
                }`}>
                  {validation.formatType === 'mt4' ? 'MT4 Tab Format' : validation.formatType === 'standard' ? 'Standard CSV' : 'Incompatible Format'}
                </span>
              </div>

              {validation.error ? (
                <div className="flex items-center gap-2 text-bear text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{validation.error}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Suggested Symbol</div>
                    <div className="font-bold text-text-primary">{validation.suggestedSymbol}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Record Count</div>
                    <div className="font-mono text-text-primary font-bold">{validation.lineCount.toLocaleString()} rows</div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-text-secondary" />
                      Date Range Boundaries
                    </div>
                    <div className="font-mono text-text-secondary flex items-center gap-2 mt-0.5">
                      <span className="bg-bg-base px-2 py-0.5 rounded border border-border-subtle text-[10px] text-text-primary">{validation.startDateStr}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
                      <span className="bg-bg-base px-2 py-0.5 rounded border border-border-subtle text-[10px] text-text-primary">{validation.endDateStr}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Config inputs in columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Symbol */}
            <div className="space-y-1">
              <label htmlFor="csv-symbol" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Ticker Symbol
              </label>
              <input
                id="csv-symbol"
                type="text"
                value={csvSymbol}
                onChange={(e) => setCsvSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. XAUUSD"
                required
                className="w-full"
              />
            </div>

            {/* Timeframe */}
            <div className="space-y-1">
              <label htmlFor="csv-resolution" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                Target Timeframe
              </label>
              <select
                id="csv-resolution"
                value={csvResolution}
                onChange={(e) => setCsvResolution(e.target.value)}
                className="w-full"
              >
                <option value="1m">1 Minute (1m)</option>
                <option value="1D">Daily (1D)</option>
                <option value="1W">Weekly (1W)</option>
              </select>
            </div>

            {/* Format schema */}
            <div className="space-y-1">
              <label htmlFor="csv-format" className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                CSV Layout Schema
              </label>
              <select
                id="csv-format"
                value={csvFormat}
                onChange={(e) => setCsvFormat(e.target.value)}
                className="w-full"
              >
                <option value="mt4">MT4 format (&lt;DATE&gt; &lt;TIME&gt;)</option>
                <option value="standard">Standard CSV (time,open,high,low,close)</option>
              </select>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isImporting && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[10px] text-text-secondary font-semibold uppercase tracking-wider">
                <span>Injecting records into local DuckDB...</span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-bg-base rounded h-2.5 border border-border-subtle overflow-hidden relative p-0.5">
                <div 
                  className="bg-accent h-full rounded transition-all duration-200 relative"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/10 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Submit Action & Status Banners */}
          <div className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <button
              type="submit"
              disabled={isImporting || !selectedFile || validation?.formatType === 'invalid'}
              className="h-8 min-w-[180px] w-full md:w-auto bg-accent hover:bg-accent-hover text-black font-bold text-xs rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  Run CSV Data Import
                </>
              )}
            </button>

            {importStatus === 'success' && (
              <div className="flex-1 flex items-center gap-2 text-bull bg-bull-soft border border-bull/20 px-3 py-1.5 rounded text-xs leading-normal">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{importMessage}</span>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="flex-1 flex items-center gap-2 text-bear bg-bear-soft border border-bear/20 px-3 py-1.5 rounded text-xs leading-normal">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{importMessage}</span>
              </div>
            )}
          </div>

        </form>
      </div>

    </div>
  );
}
