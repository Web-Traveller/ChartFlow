#!/usr/bin/env python3
import sys
import os
import json
import random
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import duckdb

def main():
    parser = argparse.ArgumentParser(description="Seed a market symbol with mock candlestick data and aggregate it.")
    parser.add_argument("--symbol", type=str, default="BTCUSD", help="Symbol name (e.g., BTCUSD, EURUSD)")
    parser.add_argument("--price", type=float, default=50000.0, help="Initial price of the symbol")
    parser.add_argument("--days", type=int, default=30, help="Number of days of historical data to generate")
    parser.add_argument("--volatility", type=float, default=0.0005, help="Standard deviation of minute returns")
    args = parser.parse_args()

    symbol = args.symbol.strip().upper()
    initial_price = args.price
    days = args.days
    volatility = args.volatility

    # Determine paths (similar to main.py)
    backend_dir = Path(__file__).resolve().parent.parent
    db_path = backend_dir.parent / "db" / "market_data.duckdb"
    storage_dir = backend_dir / "storage"
    settings_file = storage_dir / "symbol_settings.json"

    print(f"Database Path: {db_path}")
    print(f"Settings Path: {settings_file}")

    if not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)
    if not storage_dir.exists():
        storage_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n1. Generating mock 1m data for {symbol} ({days} days)...")
    
    # Generate 1m timestamps
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)
    
    current_time = start_time
    current_price = initial_price

    records = []
    
    # Determine step interval
    total_minutes = days * 24 * 60
    print(f"Total minutes to generate: {total_minutes:,}")
    
    # Generate path using a simple random walk
    for i in range(total_minutes):
        # Weekly market pause (e.g., Forex closes on weekends)
        # For BTCUSD we can keep it 24/7. Let's make it 24/7 for BTC, or just keep it simple.
        # Simple continuous generation
        current_time += timedelta(minutes=1)
        
        # GBM-like step: price * exp(volatility * Z)
        change_pct = random.normalvariate(0, volatility)
        open_p = current_price
        close_p = open_p * (1.0 + change_pct)
        
        # Ensure price stays positive
        if close_p < 0.01:
            close_p = 0.01
            
        high_p = max(open_p, close_p) * (1.0 + abs(random.normalvariate(0, volatility * 0.5)))
        low_p = min(open_p, close_p) * (1.0 - abs(random.normalvariate(0, volatility * 0.5)))
        
        # Volume
        volume = float(random.randint(10, 500))
        
        # Keep track of last close
        current_price = close_p
        
        records.append((
            symbol,
            current_time.replace(tzinfo=None), # Naive timestamp for DuckDB
            open_p,
            high_p,
            low_p,
            close_p,
            volume
        ))

    print(f"Generated {len(records):,} rows.")

    # Connect to DuckDB
    con = duckdb.connect(str(db_path), read_only=False)
    
    # Ensure tables exist
    timeframes = {
        "1m": "1 minute",
        "5m": "5 minutes",
        "15m": "15 minutes",
        "30m": "30 minutes",
        "1h": "1 hour",
        "4h": "4 hours",
        "1d": "1 day",
        "1w": "1 week"
    }

    for tf in timeframes.keys():
        con.execute(f"""
            CREATE TABLE IF NOT EXISTS candles_{tf} (
                symbol VARCHAR,
                ts TIMESTAMP,
                open DOUBLE,
                high DOUBLE,
                low DOUBLE,
                close DOUBLE,
                volume DOUBLE
            )
        """)

    # Clean old records for this symbol
    print(f"\n2. Cleaning existing database records for {symbol} across all timeframes...")
    for tf in timeframes.keys():
        deleted = con.execute(f"DELETE FROM candles_{tf} WHERE symbol = ?", [symbol]).rowcount
        if deleted > 0:
            print(f" - Deleted {deleted:,} rows from candles_{tf}")

    # Insert 1m records
    print(f"\n3. Inserting new 1m data into candles_1m...")
    # Using executemany for high performance
    con.executemany(
        "INSERT INTO candles_1m (symbol, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
        records
    )
    print(" - Insertion complete!")

    # Aggregate to other timeframes
    print(f"\n4. Aggregating 1m data to higher timeframes...")
    for tf, interval in timeframes.items():
        if tf == "1m":
            continue
            
        print(f" - Building candles_{tf} (using time_bucket interval '{interval}')...")
        con.execute(f"""
            INSERT INTO candles_{tf} (symbol, ts, open, high, low, close, volume)
            SELECT 
                symbol,
                time_bucket(INTERVAL '{interval}', ts) as bucket_ts,
                first(open ORDER BY ts) as o,
                max(high) as h,
                min(low) as l,
                last(close ORDER BY ts) as c,
                sum(volume) as v
            FROM candles_1m
            WHERE symbol = ?
            GROUP BY symbol, bucket_ts
            ORDER BY bucket_ts ASC
        """, [symbol])
        
        count = con.execute(f"SELECT COUNT(*) FROM candles_{tf} WHERE symbol = ?", [symbol]).fetchone()[0]
        print(f"   Created {count:,} aggregated bars in candles_{tf}")

    # Vacuum database to optimize space
    print("\n5. Vacuuming DuckDB database...")
    con.execute("VACUUM")
    con.close()
    print(" - Database optimization done!")

    # Update symbol_settings.json
    print(f"\n6. Updating symbol_settings.json for {symbol}...")
    settings = {}
    if settings_file.exists():
        try:
            settings = json.loads(settings_file.read_text())
        except Exception as e:
            print(f"Warning: Could not read existing settings file ({e}). Starting fresh.")

    # Configure metadata based on symbol name
    description = f"{symbol} Mock Crypto Feed" if "USD" in symbol and symbol != "EURUSD" else f"{symbol} Mock Forex Feed"
    exchange = "CRYPTO" if "USD" in symbol and symbol != "EURUSD" and symbol != "XAUUSD" else "FOREX"
    pricescale = 100 if "JPY" in symbol or symbol in ("BTCUSD", "ETHUSD") else 100000

    settings[symbol] = {
        "name": symbol,
        "ticker": symbol,
        "description": description,
        "type": "crypto" if exchange == "CRYPTO" else "forex",
        "exchange": exchange,
        "timezone": "Etc/UTC",
        "pricescale": pricescale,
        "session": "24x7"
    }

    settings_file.write_text(json.dumps(settings, indent=2))
    print(f" - Successfully registered metadata in symbol_settings.json!")
    print(f"\nDone! Symbol '{symbol}' is now successfully seeded and ready to use in the application.")

if __name__ == "__main__":
    main()
