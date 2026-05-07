# Monitoramento Ambiental Dashboard

Aplicação web para visualização de dados de sensores (temperatura, umidade, gases e partículas) armazenados em um banco de dados Neon PostgreSQL.

## Tecnologias
- **Backend:** FastAPI (Python)
- **Frontend:** React + TypeScript + Recharts
- **Banco de Dados:** PostgreSQL (Neon)

## Como Executar

### 1. Backend
Navegue até a pasta `backend` e execute:
```bash
# Recomendado usar um ambiente virtual
pip install -r requirements.txt
python main.py
```
O servidor estará rodando em `http://localhost:8000`.

### 2. Frontend
Navegue até a pasta `frontend` e execute:
```bash
npm install
npm run dev
```
O dashboard estará disponível em `http://localhost:5173`.

## Funcionalidades
- **Visualização em Tempo Real:** Os dados são atualizados automaticamente a cada 5 segundos.
- **Gráficos de Tendência:** Acompanhamento histórico de todos os parâmetros.
- **Interface Responsiva:** Otimizado para desktop e tablets.
