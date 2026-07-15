import { useState, useEffect, useRef } from 'react'
import mockDatafeed from '../lib/mockDatafeed'

declare global {
  interface Window {
    TradingView: any
  }
}

export default function ChartPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const tvWidgetRef = useRef<any>(null)

  useEffect(() => {
    // Suppress TradingView library logging
    const originalConsoleLog = console.log
    const originalConsoleDebug = console.debug
    const originalConsoleInfo = console.info
    
    console.log = (...args: any[]) => {
      // Filter out TradingView library logs
      const message = args[0]
      if (typeof message === 'string' && 
          (message.includes('Last bar update') || 
           message.includes('Event "onTick"') ||
           message.includes('Datafeed:') ||
           message.includes('library.'))) {
        return
      }
      originalConsoleLog.apply(console, args)
    }
    
    console.debug = () => {}
    console.info = (...args: any[]) => {
      const message = args[0]
      if (typeof message === 'string' && 
          (message.includes('Last bar update') || 
           message.includes('Event "onTick"') ||
           message.includes('Datafeed:') ||
           message.includes('library.'))) {
        return
      }
      originalConsoleInfo.apply(console, args)
    }

    // Load TradingView library
    const script = document.createElement('script')
    script.src = '/charting_library/charting_library.standalone.js'
    script.async = true
    script.onload = () => {
      setIsLibraryLoaded(true)
    }
    document.head.appendChild(script)

    return () => {
      // Restore console methods
      console.log = originalConsoleLog
      console.debug = originalConsoleDebug
      console.info = originalConsoleInfo
      
      document.head.removeChild(script)
      if (mockDatafeed._intervalId) {
        clearInterval(mockDatafeed._intervalId)
      }
    }
  }, [])

  useEffect(() => {
    if (!isLibraryLoaded || !chartContainerRef.current || tvWidgetRef.current) {
      return
    }

    const initWidget = () => {
      if (tvWidgetRef.current) {
        try {
          tvWidgetRef.current.remove()
        } catch (e) {
          console.error("Error removing widget:", e)
        }
      }

      tvWidgetRef.current = new window.TradingView.widget({
        symbol: 'XAUUSD',
        interval: '1D',
        container: chartContainerRef.current,
        datafeed: mockDatafeed,
        library_path: '/charting_library/',
        locale: 'en',
        theme: 'dark',
        autosize: true,
        disabled_features: [
        ],
        enabled_features: [
          'side_toolbar_in_fullscreen_mode',
          'header_in_fullscreen_mode'
        ],
        fullscreen: false,
        debug: false
      })

      tvWidgetRef.current.onChartReady(() => {
        // Add custom buttons to TradingView header
        const widget = tvWidgetRef.current
        
        // Add button before symbol search (left side)
        const leftButton = widget.createButton({
          align: 'left',
        })
        leftButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
        leftButton.title = 'Back to Home'
        leftButton.addEventListener('click', () => {
          window.location.href = '/'
        })
        
        // Add theme toggle button (right side)
        const themeButton = widget.createButton({
          align: 'right',
        })
        const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
        const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        themeButton.innerHTML = moonIcon
        themeButton.title = 'Toggle Theme'
        themeButton.addEventListener('click', () => {
          // Use TradingView's applyOptions method to change theme
          const currentTheme = widget._options.theme
          const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
          widget.applyOptions({ theme: newTheme })
          themeButton.innerHTML = newTheme === 'dark' ? moonIcon : sunIcon
        })
        
        setIsLoading(false)
      })
    }

    initWidget()
  }, [isLibraryLoaded])

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col">
      {/* Chart Container */}
      <div className="flex-1 relative min-h-0">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400">Loading chart...</p>
            </div>
          </div>
        )}
        <div 
          ref={chartContainerRef}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
