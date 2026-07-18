interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  context?: any;
  stack?: string;
}

let logQueue: LogEntry[] = [];
let isSending = false;

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

export const logger = {
  log: (level: 'info' | 'warning' | 'error', message: string, context?: any, stack?: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack,
    };
    logQueue.push(entry);
  },
  info: (message: string, context?: any) => {
    logger.log('info', message, context);
  },
  warn: (message: string, context?: any, stack?: string) => {
    logger.log('warning', message, context, stack);
  },
  error: (message: string, context?: any, stack?: string) => {
    logger.log('error', message, context, stack);
  }
};

// Set up interval for batching and POSTing
const BATCH_INTERVAL_MS = 3000;

const sendLogsBatch = async () => {
  if (logQueue.length === 0 || isSending) return;

  isSending = true;
  const batch = [...logQueue];
  logQueue = logQueue.slice(batch.length);

  try {
    const response = await fetch('http://localhost:8000/1.1/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      originalConsoleError('Failed to send logs to backend:', response.statusText);
      // Re-queue logs if failed
      logQueue = [...batch, ...logQueue];
    }
  } catch (error) {
    originalConsoleError('Network error sending logs to backend:', error);
    // Re-queue logs if failed
    logQueue = [...batch, ...logQueue];
  } finally {
    isSending = false;
  }
};

// Start periodic flush
setInterval(sendLogsBatch, BATCH_INTERVAL_MS);

// Also send logs before unload
window.addEventListener('beforeunload', () => {
  if (logQueue.length === 0) return;
  const payload = JSON.stringify(logQueue);
  logQueue = [];
  try {
    navigator.sendBeacon('http://localhost:8000/1.1/logs', payload);
  } catch (e) {
    fetch('http://localhost:8000/1.1/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
    }).catch(originalConsoleError);
  }
});

// Hook global window errors
window.onerror = (message, source, lineno, colno, error) => {
  const msg = typeof message === 'string' ? message : (message as ErrorEvent).message || 'Unknown window error';
  const stack = error?.stack || `${source || 'unknown'}:${lineno || 0}:${colno || 0}`;
  logger.error(msg, { source, lineno, colno }, stack);
};

// Hook unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason?.message || String(reason) || 'Unhandled promise rejection';
  const stack = reason?.stack || undefined;
  logger.error(message, { reason }, stack);
});

// Wrap console.warn
console.warn = (...args: any[]) => {
  originalConsoleWarn.apply(console, args);
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  // To avoid logging our own logging failures
  if (message.includes('/1.1/logs') || message.includes('Failed to send logs')) {
    return;
  }
  logger.warn(message);
};

// Wrap console.error
console.error = (...args: any[]) => {
  originalConsoleError.apply(console, args);
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  // To avoid loop on logging failure
  if (message.includes('/1.1/logs') || message.includes('Failed to send logs') || message.includes('Network error sending logs')) {
    return;
  }
  
  // Look for an Error argument to extract stack trace
  const errArg = args.find(arg => arg instanceof Error);
  const stack = errArg?.stack || undefined;
  
  logger.error(message, undefined, stack);
};
