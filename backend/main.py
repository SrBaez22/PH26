from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor
import os

app = FastAPI()

# Configuração de CORS para permitir que o frontend acesse a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = 'postgresql://neondb_owner:npg_M3vNHcLF0Yew@ep-weathered-morning-aqyrfz91-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"Erro ao conectar ao banco de dados: {e}")
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
            # Busca o último registro. Se não houver ID ou TIMESTAMP, pegamos o último inserido se possível.
            # Aqui assumimos que se houver uma coluna 'id', ordenamos por ela.
            # Caso contrário, pegamos tudo e retornamos o último elemento.
            cur.execute("SELECT * FROM monitorador_ambiente")
            rows = cur.fetchall()
            if not rows:
                return {}
            return rows[-1]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/history")
def get_history(limit: int = 20):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM monitorador_ambiente")
            rows = cur.fetchall()
            # Retorna os últimos 'limit' registros
            return rows[-limit:] if len(rows) > limit else rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
