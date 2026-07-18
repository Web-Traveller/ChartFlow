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
import logging
import traceback
from fastapi import FastAPI, Form, HTTPException, Query, Request, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel
from typing import Any, List, Dict, Optional

# ---------------------------------------------------------------------------
# Path Configuration (Dynamic for Electron/Tauri compatibility)
# ---------------------------------------------------------------------------
import os
USER_DATA_PATH = os.environ.get("CHARTFLOW_USER_DATA_PATH")

if USER_DATA_PATH:
    STORAGE_DIR = Path(USER_DATA_PATH) / "storage"
    DB_PATH = Path(USER_DATA_PATH) / "db" / "market_data.duckdb"
else:
    STORAGE_DIR = Path(__file__).resolve().parent / "storage"
    DB_PATH = Path(__file__).resolve().parent.parent / "db" / "market_data.duckdb"

CHARTS_DIR  = STORAGE_DIR / "charts"
TMPL_DIR    = STORAGE_DIR / "drawing_templates"
SETTINGS_FILE = STORAGE_DIR / "symbol_settings.json"
APP_SETTINGS_FILE = STORAGE_DIR / "app_settings.json"
SESSIONS_FILE = STORAGE_DIR / "sessions.json"
log_file = STORAGE_DIR / "logs" / "app.log"

# Ensure runtime directories exist
CHARTS_DIR.mkdir(parents=True, exist_ok=True)
TMPL_DIR.mkdir(parents=True, exist_ok=True)
log_file.parent.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Logging Setup
# ---------------------------------------------------------------------------
class JSONLinesHandler(logging.Handler):
    def __init__(self, filename: Path):
        super().__init__()
        self.filename = filename
        self.filename.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, record):
        try:
            self.acquire()
            level_name = record.levelname.lower()
            if level_name in ("warning", "warn"):
                level = "warning"
            elif level_name in ("error", "critical"):
                level = "error"
            else:
                level = "info"

            message = self.format(record)
            
            # Skip logging for our own logs endpoint queries/posts to avoid loop
            if "/1.1/logs" in message:
                return

            stack = None
            if record.exc_info:
                stack = "".join(traceback.format_exception(*record.exc_info))

            standard_attrs = {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                'module', 'exc_info', 'exc_text', 'stack_info', 'lineno', 'funcName',
                'created', 'msecs', 'relativeCreated', 'thread', 'threadName',
                'processName', 'process', 'message'
            }
            context = {}
            for k, v in record.__dict__.items():
                if k not in standard_attrs:
                    try:
                        json.dumps(v)
                        context[k] = v
                    except Exception:
                        context[k] = str(v)

            log_entry = {
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
                "source": "backend",
                "level": level,
                "message": message,
                "context": context,
                "stack": stack
            }

            with open(self.filename, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception:
            self.handleError(record)
        finally:
            self.release()

# Setup logging
# log_file resolved dynamically at path configuration block
logger = logging.getLogger()
logger.setLevel(logging.INFO)
# Clear other handlers or prevent duplicates
if not any(isinstance(h, JSONLinesHandler) for h in logger.handlers):
    json_handler = JSONLinesHandler(log_file)
    json_handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(json_handler)

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

# DB_PATH resolved dynamically at path configuration block

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


@app.on_event("startup")
def startup_db_cleanup():
    """Runs database cleanup on startup to ensure no legacy test data exists"""
    logging.info("Checking database for legacy test data...")
    try:
        con = duckdb.connect(str(DB_PATH), read_only=False)
        tables = ["candles_1m", "candles_5m", "candles_15m", "candles_30m", "candles_1h", "candles_4h", "candles_1d", "candles_1w"]
        deleted_any = False
        for t in tables:
            # Check if table exists
            exists = con.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = '{t}'").fetchone()
            if exists:
                con.execute(f"DELETE FROM {t} WHERE symbol = '5YESES'")
                deleted_any = True
        if deleted_any:
            con.execute("VACUUM")
            logging.info("Database vacuumed and cleaned from legacy test symbols.")
        con.close()
    except Exception as e:
        logging.error("Failed to run startup database cleanup: %s", str(e))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": exc.errors()}
        )
    
    # Log the traceback and exception using standard logging module
    logging.error("Unhandled exception: %s", str(exc), exc_info=exc)
    
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error"}
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

    # Load settings from file if exists
    settings_path = Path(__file__).resolve().parent / "storage" / "symbol_settings.json"
    symbol_config = {}
    if settings_path.exists():
        try:
            symbol_config = json.loads(settings_path.read_text()).get(clean, {})
        except Exception:
            pass

    return {
        "name":            symbol_config.get("name", clean),
        "ticker":          symbol_config.get("ticker", clean),
        "description":     symbol_config.get("description", f"{clean} – Local DuckDB"),
        "type":            symbol_config.get("type", "forex"),
        "exchange":        symbol_config.get("exchange", "FOREX"),
        "listed_exchange": symbol_config.get("exchange", "FOREX"),
        "session":         symbol_config.get("session", "24x7"),
        "timezone":        symbol_config.get("timezone", "Etc/UTC"),
        "format":          "price",
        "minmov":          1,
        "pricescale":      int(symbol_config.get("pricescale", 100000)),
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
        "symbol_logo":           symbol_config.get("symbol_logo", "./logos/default.png")
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
    
    settings_path = Path(__file__).resolve().parent / "storage" / "symbol_settings.json"
    symbol_settings = {}
    if settings_path.exists():
        try:
            symbol_settings = json.loads(settings_path.read_text())
        except Exception:
            pass

    for sym in symbols:
        if q and q not in sym.upper():
            continue
        cfg = symbol_settings.get(sym, {})
        results.append({
            "symbol":      sym,
            "full_name":   f"{cfg.get('exchange', 'FOREX')}:{sym}",
            "description": cfg.get("description", f"{sym} – Local DuckDB"),
            "exchange":    cfg.get("exchange", "FOREX"),
            "type":        cfg.get("type", "forex"),
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
    session:    Optional[str] = Query(None),
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
        sess_start_dt = None
        sess_end_dt = None
        
        # --- Handle session limits clamping -----------------------
        if session:
            if SESSIONS_FILE.exists():
                try:
                    sessions_data = json.loads(SESSIONS_FILE.read_text())
                    sess = sessions_data.get(session)
                    if sess and not sess.get("all_time"):
                        time_start_str = sess.get("time_start")
                        time_end_str = sess.get("time_end")
                        if time_start_str and time_end_str:
                            sess_start_dt = datetime.strptime(time_start_str, "%Y-%m-%d")
                            sess_end_dt = datetime.strptime(time_end_str, "%Y-%m-%d")
                except Exception as e:
                    print("Error clamping session range:", e)

        table = _resolve_table(resolution)
        con = get_con()

        # --- Get the latest bar in the DB ----------------------------------
        last_row = con.execute(
            f"SELECT max(ts) FROM {table} WHERE symbol = ?", [symbol]
        ).fetchone()
        db_last_dt = last_row[0] if (last_row and last_row[0]) else None

        # --- Determine effective max allowed datetime ----------------------
        max_allowed_dt = db_last_dt
        if sess_end_dt:
            if max_allowed_dt:
                max_allowed_dt = min(max_allowed_dt, sess_end_dt)
            else:
                max_allowed_dt = sess_end_dt

        # Convert timezone-naive request times to datetime objects
        from_dt = datetime.utcfromtimestamp(from_ts)
        to_dt   = datetime.utcfromtimestamp(to_ts)

        # --- Shift window if requesting beyond maximum allowed date --------
        if max_allowed_dt and to_dt > max_allowed_dt:
            duration = to_dt - from_dt
            to_dt = max_allowed_dt
            from_dt = to_dt - duration

        # --- Clamp start date to session start -----------------------------
        if sess_start_dt and from_dt < sess_start_dt:
            from_dt = sess_start_dt

        # If range becomes invalid, return no_data
        if from_dt > to_dt:
            con.close()
            return {"s": "no_data"}

        if countback and countback > 0:
            # Return exactly `countback` bars ending at (and including) to_dt.
            query_str = f"""
                SELECT ts, open, high, low, close, volume
                FROM   {table}
                WHERE  symbol = ? AND ts <= ?
            """
            params = [symbol, to_dt]
            if sess_start_dt:
                query_str += " AND ts >= ?"
                params.append(sess_start_dt)
            query_str += """
                ORDER  BY ts DESC
                LIMIT  ?
            """
            params.append(countback)
            rows = con.execute(query_str, params).fetchall()
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
            query_str = f"""
                SELECT ts FROM {table}
                WHERE  symbol = ? AND ts > ?
            """
            params = [symbol, to_dt]
            if max_allowed_dt:
                query_str += " AND ts <= ?"
                params.append(max_allowed_dt)
            query_str += " ORDER BY ts ASC LIMIT 1"
            
            next_row = con.execute(query_str, params).fetchone()
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
        settings_path = Path(__file__).resolve().parent / "storage" / "symbol_settings.json"
        symbol_settings = {}
        if settings_path.exists():
            try:
                symbol_settings = json.loads(settings_path.read_text())
            except Exception:
                pass

        if row:
            cfg = symbol_settings.get(sym, {})
            data.append({
                "s": "ok",
                "n": sym,
                "v": {
                    "ch":               0.0,
                    "chp":              0.0,
                    "short_name":       sym,
                    "exchange":         cfg.get("exchange", "FOREX"),
                    "description":      cfg.get("description", f"{sym} – Local DuckDB"),
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

# STORAGE_DIR, CHARTS_DIR, and TMPL_DIR resolved dynamically at path configuration block


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
        db_client = data.get("clientId", "")
        db_user = data.get("userId", "")
        if (db_client and db_client != client) or (db_user and db_user != user):
            return {"status": "error", "message": "Chart not found"}
        return {"status": "ok", "data": data}

    # List all charts for this user
    results = []
    for f in CHARTS_DIR.glob("*.json"):
        try:
            d = json.loads(f.read_text())
            db_client = d.get("clientId", "")
            db_user = d.get("userId", "")
            if (not db_client or db_client == client) and (not db_user or db_user == user):
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

    # Check query params first, then fallback to request body
    client   = request.query_params.get("client") or body.get("client") or ""
    user     = request.query_params.get("user") or body.get("user") or ""
    name     = body.get("name", "Unnamed")
    content  = body.get("content", "")
    chart_id = body.get("chart")

    if chart_id:
        p = _chart_path(str(chart_id))
        if p.exists():
            data = json.loads(p.read_text())
            data.update({
                "name": name,
                "content": content,
                "timestamp": int(_time.time()),
                "clientId": client,
                "userId": user
            })
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
    request:      Request,
    client:       str           = Query(...),
    user:         str           = Query(...),
    tool:         str           = Query(...),
    templateName: Optional[str] = Query(None),
    template:     Optional[str] = Query(None),
):
    """
    GET /1.1/drawing_templates?client=&user=&tool=
        → returns list of template names
    GET /1.1/drawing_templates?client=&user=&tool=&name=templateName
        → returns template content
    """
    d = _tmpl_path(client, user, tool)
    name = request.query_params.get("name") or templateName or template

    if name:
        p = d / f"{name}.json"
        if not p.exists():
            return {"status": "error", "message": f"Template '{name}' not found"}
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

    client        = request.query_params.get("client") or body.get("client") or ""
    user          = request.query_params.get("user") or body.get("user") or ""
    tool          = body.get("tool") or request.query_params.get("tool") or ""
    template_name = body.get("name") or body.get("templateName") or request.query_params.get("name") or request.query_params.get("templateName") or ""
    content       = body.get("content", "")

    if not (client and user and tool and template_name):
        return {"status": "error", "message": "Missing required fields"}

    p = _tmpl_path(client, user, tool) / f"{template_name}.json"
    p.write_text(content)
    return {"status": "ok"}


@app.delete("/1.1/drawing_templates")
def drawing_templates_delete(
    request:      Request,
    client:       str = Query(...),
    user:         str = Query(...),
    tool:         str = Query(...),
    templateName: Optional[str] = Query(None),
    template:     Optional[str] = Query(None),
):
    """DELETE /1.1/drawing_templates?client=&user=&tool=&name="""
    name = request.query_params.get("name") or templateName or template
    if not name:
        return {"status": "error", "message": "Missing template parameter"}

    p = _tmpl_path(client, user, tool) / f"{name}.json"
    if not p.exists():
        return {"status": "error", "message": f"Template '{name}' not found"}
    p.unlink()
    return {"status": "ok"}


# ===========================================================================
# ── LOGGING SYSTEM ENDPOINTS
# ===========================================================================

class FrontendLogEntry(BaseModel):
    timestamp: str
    level: str
    message: str
    context: Optional[Dict[str, Any]] = None
    stack: Optional[str] = None


@app.post("/1.1/logs")
async def post_frontend_logs(logs: List[FrontendLogEntry]):
    log_file_path = Path(__file__).resolve().parent / "storage" / "logs" / "app.log"
    log_file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file_path, "a", encoding="utf-8") as f:
        for entry in logs:
            level = entry.level.lower()
            if level not in ("info", "warning", "error"):
                if level in ("warn",):
                    level = "warning"
                elif level in ("error", "critical", "err"):
                    level = "error"
                else:
                    level = "info"
            
            log_obj = {
                "timestamp": entry.timestamp,
                "source": "frontend",
                "level": level,
                "message": entry.message,
                "context": entry.context or {},
                "stack": entry.stack
            }
            f.write(json.dumps(log_obj) + "\n")
    return {"status": "ok"}


@app.get("/1.1/logs")
def get_logs(
    level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000)
):
    log_file_path = Path(__file__).resolve().parent / "storage" / "logs" / "app.log"
    if not log_file_path.exists():
        return []

    entries = []
    with open(log_file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if level and entry.get("level") != level:
                    continue
                if source and entry.get("source") != source:
                    continue
                entries.append(entry)
            except Exception:
                pass

    recent_entries = entries[-limit:]
    recent_entries.reverse()
    return recent_entries


@app.get("/1.1/trigger_error_test")
def trigger_error_test():
    raise ValueError("This is a deliberately triggered backend test error!")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ===========================================================================
# ── SYMBOL CONFIGURATION & SETTINGS
# ===========================================================================

SETTINGS_FILE = STORAGE_DIR / "symbol_settings.json"

@app.get("/1.1/symbol_settings")
def symbol_settings_get():
    """GET /1.1/symbol_settings -> returns current symbol configs"""
    if not SETTINGS_FILE.exists():
        return {}
    try:
        return json.loads(SETTINGS_FILE.read_text())
    except Exception:
        return {}


@app.post("/1.1/symbol_settings")
async def symbol_settings_save(request: Request):
    """POST /1.1/symbol_settings -> saves/updates symbol configs"""
    body: dict = await request.json()
    
    # Read existing
    data = {}
    if SETTINGS_FILE.exists():
        try:
            data = json.loads(SETTINGS_FILE.read_text())
        except Exception:
            pass
            
    # Update
    data.update(body)
    
    SETTINGS_FILE.write_text(json.dumps(data, indent=2))
    return {"status": "ok"}


@app.get("/1.1/symbols_overview")
def get_symbols_overview():
    """GET /1.1/symbols_overview -> returns aggregated metrics and configuration info for symbols"""
    try:
        con = get_con()
        symbols = _all_symbols(con)
        
        # Load symbol settings
        settings_path = Path(__file__).resolve().parent / "storage" / "symbol_settings.json"
        symbol_settings = {}
        if settings_path.exists():
            try:
                symbol_settings = json.loads(settings_path.read_text())
            except Exception:
                pass
        
        overview = []
        timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]
        
        for symbol in symbols:
            # Get date range from candles_1m
            range_row = con.execute(
                "SELECT min(ts), max(ts) FROM candles_1m WHERE symbol = ?",
                [symbol]
            ).fetchone()
            
            min_date = range_row[0].strftime("%Y-%m-%d %H:%M:%S") if range_row and range_row[0] else "N/A"
            max_date = range_row[1].strftime("%Y-%m-%d %H:%M:%S") if range_row and range_row[1] else "N/A"
            
            # Get counts for each timeframe
            counts = {}
            for tf in timeframes:
                table = f"candles_{tf}"
                count_row = con.execute(
                    f"SELECT count(*) FROM {table} WHERE symbol = ?",
                    [symbol]
                ).fetchone()
                counts[tf] = count_row[0] if count_row else 0
                
            config = symbol_settings.get(symbol, {})
            
            overview.append({
                "symbol": symbol,
                "description": config.get("description", f"{symbol} - Local DuckDB"),
                "type": config.get("type", "forex"),
                "exchange": config.get("exchange", "FOREX"),
                "pricescale": config.get("pricescale", 100000),
                "session": config.get("session", "24x7"),
                "timezone": config.get("timezone", "Etc/UTC"),
                "symbol_logo": config.get("symbol_logo", "./logos/default.png"),
                "first_ts": min_date,
                "last_ts": max_date,
                "timeframe_counts": counts
            })
            
        con.close()
        return overview
    except Exception as e:
        logging.error("Failed to query symbols overview: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/1.1/active_symbols")
def get_active_symbols():
    """GET /1.1/active_symbols -> returns list of unique symbols present in candles_1m"""
    try:
        con = get_con()
        symbols = _all_symbols(con)
        con.close()
        return symbols
    except Exception as e:
        logging.error("Failed to query active symbols: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/1.1/symbols_metadata/{symbol}")
def get_symbol_metadata(symbol: str):
    """GET /1.1/symbols_metadata/{symbol} -> returns min(ts) and max(ts) from candles_1m for a symbol"""
    try:
        con = get_con()
        row = con.execute(
            "SELECT min(ts), max(ts), count(*) FROM candles_1m WHERE symbol = ?",
            [symbol.upper()]
        ).fetchone()
        con.close()
        if not row or not row[0] or not row[1]:
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
        return {
            "symbol": symbol.upper(),
            "min_date": row[0].strftime("%Y-%m-%d"),
            "max_date": row[1].strftime("%Y-%m-%d"),
            "count": row[2]
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error("Failed to query metadata for symbol %s: %s", symbol, str(e))
        raise HTTPException(status_code=500, detail=str(e))


APP_SETTINGS_FILE = STORAGE_DIR / "app_settings.json"

@app.get("/1.1/app_settings")
def app_settings_get():
    """GET /1.1/app_settings -> returns current app-level settings"""
    if not APP_SETTINGS_FILE.exists():
        return {
            "data_folder_path": "/home/ajinkya/projects/TestsGithub/16_july/db",
            "default_risk_pct": 1.0,
            "default_timeframe": "1D",
            "theme": "dark"
        }
    try:
        return json.loads(APP_SETTINGS_FILE.read_text())
    except Exception:
        return {
            "data_folder_path": "/home/ajinkya/projects/TestsGithub/16_july/db",
            "default_risk_pct": 1.0,
            "default_timeframe": "1D",
            "theme": "dark"
        }


@app.post("/1.1/app_settings")
async def app_settings_save(request: Request):
    """POST /1.1/app_settings -> saves/updates app-level settings"""
    body: dict = await request.json()
    
    # Read existing
    data = {
        "data_folder_path": "/home/ajinkya/projects/TestsGithub/16_july/db",
        "default_risk_pct": 1.0,
        "default_timeframe": "1D",
        "theme": "dark"
    }
    if APP_SETTINGS_FILE.exists():
        try:
            data = json.loads(APP_SETTINGS_FILE.read_text())
        except Exception:
            pass
            
    # Update fields with basic type validation/coercion
    if "data_folder_path" in body:
        data["data_folder_path"] = str(body["data_folder_path"])
    if "default_risk_pct" in body:
        try:
            data["default_risk_pct"] = float(body["default_risk_pct"])
        except ValueError:
            pass
    if "default_timeframe" in body:
        data["default_timeframe"] = str(body["default_timeframe"])
    if "theme" in body:
        data["theme"] = str(body["theme"])
        
    APP_SETTINGS_FILE.write_text(json.dumps(data, indent=2))
    return {"status": "ok", "settings": data}



# ===========================================================================
# ── BACKTESTING SESSIONS & CSV IMPORTING
# ===========================================================================

import csv
import io

SESSIONS_FILE = STORAGE_DIR / "sessions.json"

@app.get("/1.1/sessions")
def sessions_get():
    """GET /1.1/sessions -> returns all active viewing/backtesting sessions"""
    if not SESSIONS_FILE.exists():
        return {}
    try:
        return json.loads(SESSIONS_FILE.read_text())
    except Exception:
        return {}


@app.post("/1.1/sessions")
async def sessions_save(request: Request):
    """POST /1.1/sessions -> creates a new backtesting/viewing session after validation"""
    body = await request.json()
    symbol = body.get("symbol", "XAUUSD").upper()
    all_instruments = body.get("all_instruments", False)
    all_time = body.get("all_time", False)
    time_start_str = body.get("time_start", "")
    time_end_str = body.get("time_end", "")
    name = body.get("name", "Unnamed Session")

    # If not all time range, check dates and verify data in DB
    if not all_time and not all_instruments:
        try:
            ts_start = datetime.strptime(time_start_str, "%Y-%m-%d")
            ts_end = datetime.strptime(time_end_str, "%Y-%m-%d")
        except Exception:
            return {"status": "error", "message": "Invalid start or end date format. Use YYYY-MM-DD"}

        if ts_start >= ts_end:
            return {"status": "error", "message": "Start date must be strictly before end date"}

        # Validate that database table contains data for the chosen timeframe range
        con = get_con()
        try:
            # Check 1m table
            count = con.execute(
                "SELECT count(*) FROM candles_1m WHERE symbol = ? AND ts >= ? AND ts <= ?",
                [symbol, ts_start, ts_end]
            ).fetchone()[0]
        except Exception as e:
            count = 0
        con.close()

        if count == 0:
            return {
                "status": "error",
                "message": f"No market data found in the database for {symbol} between {time_start_str} and {time_end_str}."
            }

    # Save session
    session_id = str(uuid.uuid4())[:8]
    sess = {
        "id": session_id,
        "name": name,
        "symbol": symbol,
        "all_instruments": all_instruments,
        "all_time": all_time,
        "time_start": time_start_str,
        "time_end": time_end_str,
        "created_at": int(_time.time())
    }

    # Read existing sessions
    sessions_dict = {}
    if SESSIONS_FILE.exists():
        try:
            sessions_dict = json.loads(SESSIONS_FILE.read_text())
        except Exception:
            pass

    sessions_dict[session_id] = sess
    SESSIONS_FILE.write_text(json.dumps(sessions_dict, indent=2))
    return {"status": "ok", "session": sess}


@app.delete("/1.1/sessions/{session_id}")
def sessions_delete(session_id: str):
    """DELETE /1.1/sessions/{id} -> deletes a session"""
    if not SESSIONS_FILE.exists():
        return {"status": "error", "message": "No sessions found"}
    
    try:
        sessions_dict = json.loads(SESSIONS_FILE.read_text())
    except Exception:
        sessions_dict = {}

    if session_id in sessions_dict:
        del sessions_dict[session_id]
        SESSIONS_FILE.write_text(json.dumps(sessions_dict, indent=2))
        return {"status": "ok"}
    return {"status": "error", "message": "Session not found"}


@app.post("/1.1/import_csv")
async def import_csv(
    symbol: str = Form(...),
    resolution: str = Form(...),
    format_type: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Imports standard or MT4 formatted CSV files into the DuckDB database tables.
    Resolutions: 1m, 1D, 1W
    """
    clean_symbol = symbol.strip().upper()
    table = "candles_1m"
    if resolution == "1D":
        table = "candles_1d"
    elif resolution == "1W":
        table = "candles_1w"

    try:
        content = await file.read()
        csv_text = content.decode("utf-8")
    except Exception as e:
        return {"status": "error", "message": f"Failed to read file content: {str(e)}"}

    # Determine delimiter based on format type
    if format_type == "mt4":
        delimiter = "\t" # Tab separated
    else:
        delimiter = ","

    reader = csv.DictReader(io.StringIO(csv_text), delimiter=delimiter)
    
    # Map headers case-insensitively to detect headers dynamically
    fieldnames = reader.fieldnames or []
    headers = {k.lower().strip(): k for k in fieldnames}

    if format_type == "mt4":
        date_col = "<DATE>"
        time_col = "<TIME>"
        open_col = "<OPEN>"
        high_col = "<HIGH>"
        low_col = "<LOW>"
        close_col = "<CLOSE>"
        volume_col = "<VOL>" if "<VOL>" in fieldnames else "<TICKVOL>"
        
        # Verify required headers
        if not all(col in fieldnames for col in [date_col, time_col, open_col, high_col, low_col, close_col]):
            return {
                "status": "error",
                "message": f"Missing required MT4 columns. Expected: {date_col}, {time_col}, {open_col}, {high_col}, {low_col}, {close_col}"
            }
    else:
        # Standard columns mapping
        time_col = headers.get("time") or headers.get("timestamp") or headers.get("date") or headers.get("datetime") or headers.get("ts")
        open_col = headers.get("open") or headers.get("o")
        high_col = headers.get("high") or headers.get("h")
        low_col = headers.get("low") or headers.get("l")
        close_col = headers.get("close") or headers.get("c")
        volume_col = headers.get("volume") or headers.get("v") or headers.get("vol")

        if not all([time_col, open_col, high_col, low_col, close_col]):
            return {
                "status": "error",
                "message": "Missing required CSV columns (time/date, open, high, low, close)"
            }

    con = duckdb.connect(str(DB_PATH), read_only=False)
    
    # Clean previous rows for this instrument in the selected timeframe table to avoid duplicates
    try:
        con.execute(f"DELETE FROM {table} WHERE symbol = ?", [clean_symbol])
    except Exception as e:
        con.close()
        return {"status": "error", "message": f"Failed to clean old DB records: {str(e)}"}

    inserted = 0
    batch = []

    for row in reader:
        # 1. Parse Datetime
        try:
            if format_type == "mt4":
                date_val = row[date_col].strip()
                time_val = row[time_col].strip()
                combined_ts = f"{date_val} {time_val}"
                # MT4 date format: YYYY.MM.DD HH:MM:SS
                ts = datetime.strptime(combined_ts, "%Y.%m.%d %H:%M:%S")
            else:
                raw_ts = row[time_col].strip()
                if raw_ts.isdigit():
                    val = int(raw_ts)
                    if val > 9999999999: # milliseconds
                        ts = datetime.utcfromtimestamp(val / 1000.0)
                    else:
                        ts = datetime.utcfromtimestamp(val)
                else:
                    cleaned_ts = raw_ts.replace("T", " ").replace("Z", "")
                    if "." in cleaned_ts:
                        cleaned_ts = cleaned_ts.split(".")[0]
                    # Try datetime format or date fallback
                    try:
                        ts = datetime.strptime(cleaned_ts, "%Y-%m-%d %H:%M:%S")
                    except Exception:
                        ts = datetime.strptime(cleaned_ts.split(" ")[0].strip(), "%Y-%m-%d")
        except Exception:
            continue # skip invalid timestamp rows

        # 2. Parse numbers
        try:
            o = float(row[open_col])
            h = float(row[high_col])
            l = float(row[low_col])
            c = float(row[close_col])
            v = float(row[volume_col]) if (volume_col and row.get(volume_col)) else 0.0
        except Exception:
            continue # skip row with conversion error

        batch.append((clean_symbol, ts, o, h, l, c, v))
        if len(batch) >= 1000:
            con.executemany(
                f"INSERT INTO {table} (symbol, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
                batch
            )
            inserted += len(batch)
            batch = []

    if batch:
        con.executemany(
            f"INSERT INTO {table} (symbol, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
            batch
        )
        inserted += len(batch)

    con.close()

    return {
        "status": "ok",
        "message": f"Successfully imported {inserted} candles into {table} for {clean_symbol}."
    }


