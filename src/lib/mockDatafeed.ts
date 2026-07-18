const mockDatafeed: any = {
  _intervalId: null as number | null,
  
  onReady: (callback: any) => {
    setTimeout(() => {
      callback({
        supported_resolutions: ["1D", "1W", "1M"],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      });
    }, 0);
  },

  searchSymbols: (_userInput: string, _exchange: string, _symbolType: string, onResultReadyCallback: any) => {
    onResultReadyCallback([]);
  },

  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: any,
    _onResolveErrorCallback: any,
  ) => {
    setTimeout(() => {
      // Map symbols to logo URLs
      const logoMap: { [key: string]: string } = {
        'XAUUSD': './logos/gold.svg',
        'XAGUSD': './logos/silver.svg',
        'BTCUSD': './logos/XTVCBTC.svg',
      };

      const logoUrl = logoMap[symbolName] || './logos/default.png';

      onSymbolResolvedCallback({
        name: symbolName,
        ticker: symbolName,
        description: symbolName + " Mock Asset",
        type: "crypto",
        session: "24x7",
        timezone: "Etc/UTC",
        exchange: "MOCK",
        minmov: 1,
        pricescale: 100,
        has_intraday: false,
        supported_resolutions: ["1D", "1W", "1M"],
        volume_precision: 2,
        data_status: "streaming",
        symbol_logo: logoUrl,
      });
    }, 0);
  },

  getBars: (
    _symbolInfo: any,
    _resolution: string,
    periodParams: any,
    onHistoryCallback: any,
    _onErrorCallback: any,
  ) => {
    const { from, to, countBackwards } = periodParams;

    const bars: any[] = [];
    let time = from * 1000;
    let basePrice = 50000.0;

    const oneDay = 24 * 60 * 60 * 1000;

    const days = Math.min(
      Math.floor((to - from) / 86400),
      countBackwards || 300,
    );

    time = (to - days * 86400) * 1000;

    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.5) * 500.0;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * 200.0;
      const low = Math.min(open, close) - Math.random() * 200.0;
      const volume = 100 + Math.random() * 900;

      bars.push({
        time: time,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume,
      });

      basePrice = close;
      time += oneDay;
    }

    setTimeout(() => {
      onHistoryCallback(bars, { noData: bars.length === 0 });
    }, 0);
  },

  subscribeBars: (
    _symbolInfo: any,
    _resolution: string,
    onRealtimeCallback: any,
    _subscribeUID: string,
    _onResetCacheNeededCallback: any,
  ) => {
    let lastPrice = 50000.0;

    mockDatafeed._intervalId = setInterval(() => {
      const time = new Date().setUTCHours(0, 0, 0, 0);
      const change = (Math.random() - 0.5) * 100.0;
      const open = lastPrice;
      const close = lastPrice + change;
      const high = Math.max(open, close) + Math.random() * 50.0;
      const low = Math.min(open, close) - Math.random() * 50.0;
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
    }, 1000);
  },

  unsubscribeBars: (_subscribeUID: string) => {
    if (mockDatafeed._intervalId) {
      clearInterval(mockDatafeed._intervalId);
    }
  },
};

export default mockDatafeed;
