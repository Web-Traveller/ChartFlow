"""
UDF-Compatible Backend for TradingView datafeed.js
====================================================
Serves the standard TradingView UDF (Universal Data Feed) protocol so that
`new Datafeeds.UDFCompatibleDatafeed("http://localhost:8000")` works directly
with the official datafeed.js library — no adapter script needed.

UDF endpoints:
    GET  /config
    GET  /time
    GET  /symbols?symbol=XAUUSD
    GET  /search?query=XAU&limit=30&type=&exchange=
    GET  /history?symbol=XAUUSD&resolution=1D&from=<unix>&to=<unix>&countback=300
    GET  /quotes?symbols=XAUUSD,EURUSD
    GET  /marks        (stub)
    GET  /timescale_marks   (stub)

Charts-storage endpoints (layout save/load for multi-layout):
    GET  /charts?client=&user=
    GET  /charts?client=&user=&chart=<id>
    POST /charts   (save/update)
    DEL  /charts?client=&user=&chart=<id>

Drawing-template endpoints (Fib / TrendLine / etc. presets):
    GET  /drawing_templates?client=&user=&tool=
    GET  /drawing_templates?client=&user=&tool=&templateName=
    POST /drawing_templates   (save template)
    DEL  /drawing_templates?client=&user=&tool=&templateName=

Run:
    uvicorn main:app --reload --port 8000
"""

import json
import time as _time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import duckdb
from fastapi import FastAPI, Form, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

DB_PATH = Path(__file__).resolve().parent.parent / "db" / "market_data.duckdb"

# TradingView resolution string  →  DuckDB table suffix
RESOLUTION_MAP: dict[str, str] = {
    "1":   "1m",
    "5":   "5m",
    "15":  "15m",
    "30":  "30m",
    "60":  "1h",
    "240": "4h",
    "D":   "1d",
    "1D":  "1d",
    "W":   "1w",
    "1W":  "1w",
}

SUPPORTED_RESOLUTIONS = ["1", "5", "15", "30", "60", "240", "1D", "1W"]

# Static frontend origins (python3 -m http.server 8005)
CORS_ORIGINS = [
    "http://localhost:8005",
    "http://127.0.0.1:8005",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="TradingView UDF Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
    max_age=600,
)


def get_con() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(DB_PATH), read_only=True)


def _ts_to_unix(ts) -> int:
    if isinstance(ts, datetime):
        return int(ts.replace(tzinfo=timezone.utc).timestamp())
    return int(datetime.fromisoformat(str(ts)).replace(tzinfo=timezone.utc).timestamp())


def _resolve_table(resolution: str) -> str:
    tf = RESOLUTION_MAP.get(resolution)
    if tf is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported resolution '{resolution}'. Valid: {sorted(RESOLUTION_MAP)}",
        )
    return f"candles_{tf}"


def _all_symbols(con: duckdb.DuckDBPyConnection) -> list[str]:
    return [r[0] for r in con.execute(
        "SELECT DISTINCT symbol FROM candles_1m ORDER BY symbol"
    ).fetchall()]


# ---------------------------------------------------------------------------
# UDF: /config
# ---------------------------------------------------------------------------

@app.get("/config")
def udf_config():
    """
    Called first by datafeed.js on initialisation.

    Key choices:
      supports_search=true, supports_group_request=false
        → datafeed.js uses /symbols?symbol= for resolving and /search for
          typeahead.  It will NEVER request /symbol_info?group=... which
          avoids the NYSE/FOREX/AMEX group-fetch errors seen in the console.
    """
    return {
        "supports_search":         True,
        "supports_group_request":  False,
        "supported_resolutions":   SUPPORTED_RESOLUTIONS,
        "supports_marks":          False,
        "supports_timescale_marks": False,
        "supports_time":           True,
        "exchanges": [
            {"value": "",      "name": "All Exchanges", "desc": ""},
            {"value": "FOREX", "name": "FOREX",         "desc": "Foreign Exchange"},
            {"value": "COMEX", "name": "COMEX",         "desc": "Commodities"},
        ],
        "symbols_types": [
            {"name": "All types", "value": ""},
            {"name": "Forex",     "value": "forex"},
            {"name": "Commodity", "value": "commodity"},
        ],
    }


# ---------------------------------------------------------------------------
# UDF: /time
# ---------------------------------------------------------------------------

@app.get("/time", response_class=PlainTextResponse)
def udf_time():
    """Returns current UTC unix timestamp as plain text (what datafeed.js expects)."""
    return str(int(_time.time()))


# ---------------------------------------------------------------------------
# UDF: /symbols   – single-symbol resolve
# ---------------------------------------------------------------------------

@app.get("/symbols")
def udf_symbols(symbol: str = Query(...)):
    """
    Called by datafeed.js resolveSymbol() when supports_group_request=false.
    Strip optional exchange prefix ("FOREX:XAUUSD" → "XAUUSD"), look up the
    symbol in the DB, and return a SymbolInfo object.
    """
    clean = symbol.split(":")[-1].upper()

    con = get_con()
    row = con.execute(
        "SELECT min(ts), max(ts), count(*) FROM candles_1m WHERE symbol = ?",
        [clean],
    ).fetchone()
    con.close()

    if row is None or row[2] == 0:
        # UDF error signal for resolveSymbol
        return {"s": "error", "errmsg": f"Unknown symbol '{clean}'"}

    return {
        "name":            clean,
        "ticker":          clean,
        "description":     f"{clean} – Local DuckDB",
        "type":            "forex",
        "exchange":        "FOREX",
        "listed_exchange": "FOREX",
        "session":         "24x7",
        "timezone":        "Etc/UTC",
        "format":          "price",
        "minmov":          1,
        "pricescale":      100000,   # 5 decimal places (standard forex)
        "minmove2":        0,
        "fractional":      False,
        "has_intraday":          True,
        "has_daily":             True,
        "has_weekly_and_monthly": True,
        "has_empty_bars":        False,
        "supported_resolutions": SUPPORTED_RESOLUTIONS,
        "intraday_multipliers":  ["1", "5", "15", "30", "60", "240"],
        "volume_precision":      2,
        "data_status":           "streaming",
    }


# ---------------------------------------------------------------------------
# UDF: /search   – symbol typeahead
# ---------------------------------------------------------------------------

@app.get("/search")
def udf_search(
    query:    str = Query(""),
    limit:    int = Query(30, ge=1, le=100),
    type:     str = Query(""),
    exchange: str = Query(""),
):
    """
    Called by datafeed.js searchSymbols().
    Returns a plain JSON array (no {s} wrapper).
    """
    con = get_con()
    symbols = _all_symbols(con)
    con.close()

    q = query.strip().upper()
    results = []
    for sym in symbols:
        if q and q not in sym.upper():
            continue
        results.append({
            "symbol":      sym,
            "full_name":   f"FOREX:{sym}",
            "description": f"{sym} – Local DuckDB",
            "exchange":    "FOREX",
            "type":        "forex",
            "ticker":      sym,
        })
        if len(results) >= limit:
            break

    return results


# ---------------------------------------------------------------------------
# UDF: /history   – OHLCV bars (the most critical endpoint)
# ---------------------------------------------------------------------------

@app.get("/history")
def udf_history(
    symbol:     str           = Query(...),
    resolution: str           = Query(...),
    from_ts:    int           = Query(..., alias="from"),
    to_ts:      int           = Query(..., alias="to"),
    countback:  Optional[int] = Query(None),
    # Extra params the library may send – accepted to avoid 422 errors
    currencyCode: Optional[str] = Query(None),
    unitId:       Optional[str] = Query(None),
):
    """
    datafeed.js calls this for every visible range and every scroll event.

    DB contains data from 2021-01-01 to 2025-12-31 UTC (historical only).
    When the requested range extends into the future we silently clamp to the
    latest available bar so the chart always shows data.

    Response format (UDF columnar arrays):
        { "s":"ok", "t":[...unix], "o":[...], "h":[...], "l":[...], "c":[...], "v":[...] }
    or  { "s":"no_data" }
    or  { "s":"no_data", "nextTime":<unix> }   ← tells library where next bar is
    """
    try:
        table = _resolve_table(resolution)

        # IMPORTANT: DuckDB stores TIMESTAMP as timezone-naive UTC.
        # Use datetime.utcfromtimestamp() (naive) – NOT fromtimestamp(tz=utc).
        # A timezone-aware object causes a ConversionException inside DuckDB.
        from_dt = datetime.utcfromtimestamp(from_ts)
        to_dt   = datetime.utcfromtimestamp(to_ts)

        con = get_con()

        # --- Clamp to_dt to the latest bar in the DB -----------------------
        # The charting library often requests ranges beyond our data window
        # (e.g. today / future).  Without clamping, countback queries are
        # technically correct but may confuse the library when nextTime can't
        # be provided.  We clamp so the most-recent available data always shows.
        last_row = con.execute(
            f"SELECT max(ts) FROM {table} WHERE symbol = ?", [symbol]
        ).fetchone()

        db_last_dt = last_row[0] if (last_row and last_row[0]) else None

        if db_last_dt and to_dt > db_last_dt:
            to_dt = db_last_dt   # clamp: never ask beyond what we have

        if countback and countback > 0:
            # Return exactly `countback` bars ending at (and including) to_dt.
            rows = con.execute(
                f"""
                SELECT ts, open, high, low, close, volume
                FROM   {table}
                WHERE  symbol = ? AND ts <= ?
                ORDER  BY ts DESC
                LIMIT  ?
                """,
                [symbol, to_dt, countback],
            ).fetchall()
            rows.reverse()   # oldest → newest
        else:
            rows = con.execute(
                f"""
                SELECT ts, open, high, low, close, volume
                FROM   {table}
                WHERE  symbol = ? AND ts >= ? AND ts <= ?
                ORDER  BY ts ASC
                """,
                [symbol, from_dt, to_dt],
            ).fetchall()

        if not rows:
            # Look for the nearest future bar so the library knows where to jump
            next_row = con.execute(
                f"""
                SELECT ts FROM {table}
                WHERE  symbol = ? AND ts > ?
                ORDER  BY ts ASC LIMIT 1
                """,
                [symbol, to_dt],
            ).fetchone()
            con.close()

            resp: dict = {"s": "no_data"}
            if next_row:
                resp["nextTime"] = _ts_to_unix(next_row[0])
            return resp

        con.close()

        return {
            "s": "ok",
            "t": [_ts_to_unix(r[0]) for r in rows],
            "o": [float(r[1])       for r in rows],
            "h": [float(r[2])       for r in rows],
            "l": [float(r[3])       for r in rows],
            "c": [float(r[4])       for r in rows],
            "v": [float(r[5]) if r[5] is not None else 0.0 for r in rows],
        }

    except HTTPException:
        raise
    except Exception as exc:
        # Log the real error server-side but return a UDF-safe "no_data"
        # so the chart degrades gracefully instead of showing a crash.
        import traceback, logging
        logging.error("udf_history error: %s\n%s", exc, traceback.format_exc())
        return {"s": "no_data"}



# ---------------------------------------------------------------------------
# UDF: /quotes   – last-price snapshot
# ---------------------------------------------------------------------------

@app.get("/quotes")
def udf_quotes(symbols: str = Query(...)):
    """
    Called by datafeed.js for the real-time quotes panel.
    `symbols` is a comma-separated list.
    """
    sym_list = [s.strip() for s in symbols.split(",") if s.strip()]
    con = get_con()
    data = []
    for sym in sym_list:
        row = con.execute(
            """
            SELECT ts, open, high, low, close, volume
            FROM   candles_1m
            WHERE  symbol = ?
            ORDER  BY ts DESC LIMIT 1
            """,
            [sym],
        ).fetchone()
        if row:
            data.append({
                "s": "ok",
                "n": sym,
                "v": {
                    "ch":               0.0,
                    "chp":              0.0,
                    "short_name":       sym,
                    "exchange":         "FOREX",
                    "description":      f"{sym} – Local DuckDB",
                    "lp":               float(row[4]),   # last price = close
                    "open_price":       float(row[1]),
                    "high_price":       float(row[2]),
                    "low_price":        float(row[3]),
                    "prev_close_price": float(row[4]),
                    "volume":           float(row[5]) if row[5] is not None else 0.0,
                },
            })
        else:
            data.append({"s": "error", "n": sym, "v": {}})
    con.close()
    return {"s": "ok", "d": data}


# ---------------------------------------------------------------------------
# UDF: /marks  and  /timescale_marks   – empty stubs
# ---------------------------------------------------------------------------

@app.get("/marks")
def udf_marks(
    symbol:     str = Query(...),
    from_ts:    int = Query(..., alias="from"),
    to_ts:      int = Query(..., alias="to"),
    resolution: str = Query(...),
):
    """No custom marks — return empty list."""
    return []


@app.get("/timescale_marks")
def udf_timescale_marks(
    symbol:     str = Query(...),
    from_ts:    int = Query(..., alias="from"),
    to_ts:      int = Query(..., alias="to"),
    resolution: str = Query(...),
):
    """No timescale marks — return empty list."""
    return []


# ===========================================================================
# ── CHARTS STORAGE  (layout save / load / list / delete) ────────────────────
# charts_storage_api_version="1.1" → library calls /1.1/charts
# Storage: JSON files in  backend/storage/charts/<id>.json
# ===========================================================================

STORAGE_DIR = Path(__file__).resolve().parent / "storage"
CHARTS_DIR  = STORAGE_DIR / "charts"
TMPL_DIR    = STORAGE_DIR / "drawing_templates"
CHARTS_DIR.mkdir(parents=True, exist_ok=True)
TMPL_DIR.mkdir(parents=True, exist_ok=True)


def _chart_path(chart_id: str) -> Path:
    return CHARTS_DIR / f"{chart_id}.json"


def _tmpl_path(client: str, user: str, tool: str) -> Path:
    safe = lambda s: s.replace("/", "_").replace("..", "_")
    d = TMPL_DIR / safe(client) / safe(user) / safe(tool)
    d.mkdir(parents=True, exist_ok=True)
    return d


@app.get("/1.1/charts")
def charts_get(
    client:  str           = Query(...),
    user:    str           = Query(...),
    chart:   Optional[str] = Query(None),
):
    """
    GET /1.1/charts?client=&user=            → list all charts for this user
    GET /1.1/charts?client=&user=&chart=<id> → load a specific chart
    """
    if chart:
        p = _chart_path(chart)
        if not p.exists():
            return {"status": "error", "message": "Chart not found"}
        data = json.loads(p.read_text())
        if data.get("clientId") != client or data.get("userId") != user:
            return {"status": "error", "message": "Chart not found"}
        return {"status": "ok", "data": data}

    # List all charts for this user
    results = []
    for f in CHARTS_DIR.glob("*.json"):
        try:
            d = json.loads(f.read_text())
            if d.get("clientId") == client and d.get("userId") == user:
                results.append({"id": d["id"], "name": d["name"], "timestamp": d["timestamp"]})
        except Exception:
            pass
    return {"status": "ok", "data": results}


@app.post("/1.1/charts")
async def charts_save(request: Request):
    """
    POST /1.1/charts
    Body (form or JSON): client, user, chart (optional id), name, content
    """
    ct = request.headers.get("content-type", "")
    if "application/json" in ct:
        body: dict = await request.json()
    else:
        form = await request.form()
        body = dict(form)

    client   = body.get("client", "")
    user     = body.get("user", "")
    name     = body.get("name", "Unnamed")
    content  = body.get("content", "")
    chart_id = body.get("chart")

    if chart_id:
        p = _chart_path(str(chart_id))
        if p.exists():
            data = json.loads(p.read_text())
            data.update({"name": name, "content": content, "timestamp": int(_time.time())})
            p.write_text(json.dumps(data))
            return {"status": "ok", "id": chart_id}

    # New chart
    chart_id = str(uuid.uuid4())[:8]
    data = {
        "id":        chart_id,
        "name":      name,
        "content":   content,
        "timestamp": int(_time.time()),
        "clientId":  client,
        "userId":    user,
    }
    _chart_path(chart_id).write_text(json.dumps(data))
    return {"status": "ok", "id": chart_id}


@app.delete("/1.1/charts")
def charts_delete(
    client: str = Query(...),
    user:   str = Query(...),
    chart:  str = Query(...),
):
    """DELETE /1.1/charts?client=&user=&chart=<id>"""
    p = _chart_path(chart)
    if not p.exists():
        return {"status": "error", "message": "Chart not found"}
    data = json.loads(p.read_text())
    if data.get("clientId") != client or data.get("userId") != user:
        return {"status": "error", "message": "Not authorised"}
    p.unlink()
    return {"status": "ok"}


# ===========================================================================
# ── DRAWING TEMPLATES  (Fib / TrendLine / etc. per-tool style presets) ──────
# charts_storage_api_version="1.1" → library calls /1.1/drawing_templates
# Storage: JSON files in  backend/storage/drawing_templates/<client>/<user>/<tool>/<name>.json
# ===========================================================================

@app.get("/1.1/drawing_templates")
def drawing_templates_get(
    client:       str           = Query(...),
    user:         str           = Query(...),
    tool:         str           = Query(...),
    templateName: Optional[str] = Query(None),
):
    """
    GET /1.1/drawing_templates?client=&user=&tool=
        → returns list of template names
    GET /1.1/drawing_templates?client=&user=&tool=&templateName=
        → returns template content
    """
    d = _tmpl_path(client, user, tool)

    if templateName:
        p = d / f"{templateName}.json"
        if not p.exists():
            return {"status": "error", "message": f"Template '{templateName}' not found"}
        return {"status": "ok", "data": {"content": p.read_text()}}

    names = [f.stem for f in d.glob("*.json")]
    return {"status": "ok", "data": names}


@app.post("/1.1/drawing_templates")
async def drawing_templates_save(request: Request):
    """
    POST /1.1/drawing_templates
    Body: client, user, tool, templateName, content
    """
    ct = request.headers.get("content-type", "")
    if "application/json" in ct:
        body: dict = await request.json()
    else:
        form = await request.form()
        body = dict(form)

    client        = body.get("client", "")
    user          = body.get("user", "")
    tool          = body.get("tool", "")
    template_name = body.get("templateName", "")
    content       = body.get("content", "")

    if not (client and user and tool and template_name):
        return {"status": "error", "message": "Missing required fields"}

    p = _tmpl_path(client, user, tool) / f"{template_name}.json"
    p.write_text(content)
    return {"status": "ok"}


@app.delete("/1.1/drawing_templates")
def drawing_templates_delete(
    client:       str = Query(...),
    user:         str = Query(...),
    tool:         str = Query(...),
    templateName: str = Query(...),
):
    """DELETE /1.1/drawing_templates?client=&user=&tool=&templateName="""
    p = _tmpl_path(client, user, tool) / f"{templateName}.json"
    if not p.exists():
        return {"status": "error", "message": f"Template '{templateName}' not found"}
    p.unlink()
    return {"status": "ok"}

