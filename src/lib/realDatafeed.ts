const API_BASE = 'http://localhost:8000';

const realDatafeed: any = {
  _intervals: {} as { [key: string]: any },

  onReady: (callback: any) => {
    fetch(`${API_BASE}/config`)
      .then(res => res.json())
      .then(config => {
        setTimeout(() => {
          callback(config);
        }, 0);
      })
      .catch(err => {
        console.error('Datafeed onReady error, using defaults:', err);
        setTimeout(() => {
          callback({
            supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
            supports_marks: false,
            supports_timescale_marks: false,
            supports_time: true,
          });
        }, 0);
      });
  },

  searchSymbols: (userInput: string, exchange: string, symbolType: string, onResultReadyCallback: any) => {
    const url = `${API_BASE}/search?query=${encodeURIComponent(userInput)}&exchange=${encodeURIComponent(exchange)}&type=${encodeURIComponent(symbolType)}`;
    fetch(url)
      .then(res => res.json())
      .then(results => {
        onResultReadyCallback(results);
      })
      .catch(err => {
        console.error('Datafeed searchSymbols error:', err);
        onResultReadyCallback([]);
      });
  },

  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: any,
    onResolveErrorCallback: any,
  ) => {
    const cleanSymbolName = symbolName.split(':').pop() || symbolName;
    fetch(`${API_BASE}/symbols?symbol=${encodeURIComponent(cleanSymbolName)}`)
      .then(res => res.json())
      .then(symbolInfo => {
        if (symbolInfo.s === 'error') {
          onResolveErrorCallback(symbolInfo.errmsg);
          return;
        }

        // Map logo URL if not provided by backend settings
        if (!symbolInfo.symbol_logo || symbolInfo.symbol_logo === '/logos/default.png') {
          const logoMap: { [key: string]: string } = {
            'XAUUSD': '/logos/gold.svg',
            'XAGUSD': '/logos/silver.svg',
            'BTCUSD': '/logos/XTVCBTC.svg',
          };
          symbolInfo.symbol_logo = logoMap[cleanSymbolName.toUpperCase()] || symbolInfo.symbol_logo || '/logos/default.png';
        }

        setTimeout(() => {
          onSymbolResolvedCallback(symbolInfo);
        }, 0);
      })
      .catch(err => {
        console.error('Datafeed resolveSymbol error:', err);
        onResolveErrorCallback(err);
      });
  },

  getBars: (
    symbolInfo: any,
    resolution: string,
    periodParams: any,
    onHistoryCallback: any,
    onErrorCallback: any,
  ) => {
    const { from, to, countBackwards } = periodParams;
    const session = new URLSearchParams(window.location.search).get('session');
    let url = `${API_BASE}/history?symbol=${encodeURIComponent(symbolInfo.name)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}`;
    if (countBackwards) {
      url += `&countback=${countBackwards}`;
    }
    if (session) {
      url += `&session=${encodeURIComponent(session)}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.s === 'error') {
          onErrorCallback(data.errmsg);
          return;
        }
        if (data.s === 'no_data') {
          onHistoryCallback([], { noData: true, nextTime: data.nextTime });
          return;
        }

        const bars = [];
        const volumePresent = data.v && data.v.length > 0;
        for (let i = 0; i < data.t.length; i++) {
          bars.push({
            time: data.t[i] * 1000, // convert seconds to milliseconds
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
            volume: volumePresent ? data.v[i] : 0.0,
          });
        }

        onHistoryCallback(bars, { noData: bars.length === 0 });
      })
      .catch(err => {
        console.error('Datafeed getBars error:', err);
        onErrorCallback(err);
      });
  },

  subscribeBars: (
    symbolInfo: any,
    _resolution: string,
    onRealtimeCallback: any,
    subscribeUID: string,
    _onResetCacheNeededCallback: any,
  ) => {
    if (realDatafeed._intervals[subscribeUID]) {
      clearInterval(realDatafeed._intervals[subscribeUID]);
    }

    // Seed the simulation with the latest closed price from the /quotes API
    fetch(`${API_BASE}/quotes?symbols=${encodeURIComponent(symbolInfo.name)}`)
      .then(res => res.json())
      .then(data => {
        let lastPrice = 2000.0; // fallback
        if (data.s === 'ok' && data.d && data.d[0] && data.d[0].v) {
          lastPrice = data.d[0].v.lp;
        }

        realDatafeed._intervals[subscribeUID] = setInterval(() => {
          const time = new Date().getTime(); // current system time
          const change = (Math.random() - 0.5) * (lastPrice * 0.0005); // max 0.05% fluctuation
          const open = lastPrice;
          const close = lastPrice + change;
          const high = Math.max(open, close) + Math.random() * (lastPrice * 0.0002);
          const low = Math.min(open, close) - Math.random() * (lastPrice * 0.0002);
          const volume = Math.random() * 100;

          onRealtimeCallback({
            time: time,
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume,
          });

          lastPrice = close;
        }, 2000);
      })
      .catch(err => {
        console.error('Datafeed subscribeBars error:', err);
      });
  },

  unsubscribeBars: (subscribeUID: string) => {
    if (realDatafeed._intervals[subscribeUID]) {
      clearInterval(realDatafeed._intervals[subscribeUID]);
      delete realDatafeed._intervals[subscribeUID];
    }
  },
};

export default realDatafeed;
