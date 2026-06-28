import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    for tentativa in range(1, 4):
        try:
            return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, connect_timeout=30)
        except Exception as e:
            print(f"Erro ao conectar ao banco (tentativa {tentativa}/3): {e}")
            if tentativa < 3:
                import time
                time.sleep(5)
    return None

@app.get("/api/status")
def get_status():
    conn = get_db_connection()
    if conn:
        conn.close()
        return {"status": "online", "database": "connected"}
    return {"status": "online", "database": "disconnected"}

@app.get("/api/latest")
def get_latest():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM monitorador_ambiente ORDER BY id DESC LIMIT 1")
            row = cur.fetchone()
            if not row:
                return {}
            return row
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/history")
def get_history(limit: int = 20, hours: int = None, date_from: str = None, date_to: str = None):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        with conn.cursor() as cur:
            if date_from or date_to:
                conditions = []
                params = []
                if date_from:
                    conditions.append("data >= %s")
                    params.append(date_from)
                if date_to:
                    conditions.append("data <= %s")
                    params.append(date_to)
                where = " AND ".join(conditions)
                cur.execute(
                    f"SELECT * FROM monitorador_ambiente WHERE {where} ORDER BY id DESC LIMIT 1000",
                    params
                )
            elif hours:
                cutoff = datetime.now() - timedelta(hours=hours)
                cur.execute(
                    "SELECT * FROM monitorador_ambiente WHERE created_at >= %s ORDER BY id DESC LIMIT 500",
                    (cutoff,)
                )
            else:
                cur.execute(
                    "SELECT * FROM monitorador_ambiente ORDER BY id DESC LIMIT %s",
                    (limit,)
                )
            rows = cur.fetchall()
            return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
