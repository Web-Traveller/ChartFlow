// Minimal Mock Datafeed for TradingView Charting Library
const mockDatafeed = {
  onReady: (callback) => {
    // console.log("Datafeed: onReady called");s
    setTimeout(() => {
      callback({
        supported_resolutions: ["1D", "1W", "1M"],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      });
    }, 0);
  },

  searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
    // console.log("Datafeed: searchSymbols called");
    onResultReadyCallback([]);
  },

  resolveSymbol: (
    symbolName,
    onSymbolResolvedCallback,
    onResolveErrorCallback,
  ) => {
    // console.log("Datafeed: resolveSymbol called for", symbolName);
    setTimeout(() => {
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
      });
    }, 0);
  },

  getBars: (
    symbolInfo,
    resolution,
    periodParams,
    onHistoryCallback,
    onErrorCallback,
  ) => {
    // console.log("Datafeed: getBars called", periodParams);
    const { from, to, countBackwards, firstDataRequest } = periodParams;

    // Generate mock bars
    const bars = [];
    let time = from * 1000;
    let basePrice = 50000.0;

    // Let's generate a bar for each day between from and to
    const oneDay = 24 * 60 * 60 * 1000;

    // Limit bars generated to prevent overflow
    const days = Math.min(
      Math.floor((to - from) / 86400),
      countBackwards || 300,
    );

    // Start time is adjusted
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

    console.log(`Datafeed: Returned ${bars.length} bars`);
    setTimeout(() => {
      onHistoryCallback(bars, { noData: bars.length === 0 });
    }, 0);
  },

  subscribeBars: (
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscribeUID,
    onResetCacheNeededCallback,
  ) => {
    console.log("Datafeed: subscribeBars called for UID", subscribeUID);
    let lastPrice = 50000.0;

    // Start interval simulation for real-time ticks
    mockDatafeed._intervalId = setInterval(() => {
      const time = new Date().setUTCHours(0, 0, 0, 0); // Today's date
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

  unsubscribeBars: (subscribeUID) => {
    console.log("Datafeed: unsubscribeBars called for UID", subscribeUID);
    if (mockDatafeed._intervalId) {
      clearInterval(mockDatafeed._intervalId);
    }
  },
};
