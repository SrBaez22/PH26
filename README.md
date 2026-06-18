# Monitoramento Ambiental — Sala Limpa IoT

Sistema de monitoramento ambiental em tempo real para sala limpa, utilizando ESP32 (simulado no Wokwi), protocolo MQTT, banco de dados PostgreSQL na nuvem e dashboard web com alertas baseados em limites ISO.

---

## Arquitetura do Sistema

```
Wokwi (ESP32 simulado)
  └─ publica JSON via MQTT a cada 5s
       └─ broker.hivemq.com:1883
            └─ tópico: projeto/monitorador_ambiente/dados
                 ├─ connection.py  →  salva no banco Neon (PostgreSQL)
                 └─ mqtt-dashboard.com  →  monitoramento visual opcional

Banco Neon (PostgreSQL cloud)
  └─ backend/main.py (FastAPI :8000)
       └─ frontend React (:5173)  →  dashboard atualizado a cada 5s
```

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Hardware simulado | ESP32 no [Wokwi](https://wokwi.com/projects/465306576952814593) |
| Sensores simulados | DHT22 (temp/umidade), MQ-2 pino 34 (gás) |
| Protocolo IoT | MQTT — broker público HiveMQ |
| Worker Python | paho-mqtt 2.x + psycopg2 |
| Backend | FastAPI + uvicorn |
| Banco de dados | PostgreSQL (Neon cloud) |
| Frontend | React + TypeScript + Recharts + Lucide Icons |
| Build tool | Vite |

---

## Estrutura de Arquivos

```
PH26/
├── esp_32.ino          # Código do ESP32 (copiar no Wokwi)
├── connection.py       # Worker MQTT: recebe dados e salva no banco
├── limpar_banco.py     # Script interativo para limpeza do banco de dados
├── iniciar.bat         # Inicia os 3 serviços de uma vez (Windows)
├── parar.bat           # Para os 3 serviços de uma vez (Windows)
├── requirements.txt    # Dependências Python
├── .env                # Variáveis de ambiente (NÃO versionar)
├── .gitignore          # Ignora .env, .venv, dist, logs
├── backend/
│   └── main.py         # API FastAPI (porta 8000)
└── frontend/
    ├── .env            # VITE_API_URL (URL da API para o frontend)
    └── src/
        ├── App.tsx     # Dashboard React
        └── App.css
```

---

## Tabela no Banco de Dados

```sql
CREATE TABLE monitorador_ambiente (
    id          SERIAL PRIMARY KEY,
    data        DATE,
    hora        TIME,
    temperatura DOUBLE PRECISION,
    umidade     DOUBLE PRECISION,
    particulas  DOUBLE PRECISION,
    gas         DOUBLE PRECISION,
    created_at  TIMESTAMP
);
```

---

## Variáveis de Ambiente

O arquivo **`.env`** na raiz do projeto deve conter:

```env
DATABASE_URL=postgresql://usuario:senha@host/banco?sslmode=require
```

> Este arquivo **não é versionado** (está no `.gitignore`). Nunca commitar credenciais no código.

---

## Como Executar

### Pré-requisitos

- Python 3.10+ com `.venv` na raiz (já configurado)
- Node.js instalado
- Arquivo `.env` configurado na raiz
- Navegador com acesso à internet (Wokwi + broker MQTT)

---

### Opção A — Script automático (recomendado)

| Ação | Script |
|------|--------|
| Iniciar tudo | Clique duas vezes em **`iniciar.bat`** |
| Parar tudo | Clique duas vezes em **`parar.bat`** |

O `iniciar.bat` abre 3 janelas de terminal nomeadas:
- **MQTT Worker** — `connection.py`
- **Backend API** — `backend/main.py`
- **Frontend** — `npm run dev` dentro de `frontend/`

---

### Opção B — Manual (3 terminais separados)

**Terminal 1 — Worker MQTT:**
```bash
.venv\Scripts\python.exe connection.py
```

**Terminal 2 — Backend FastAPI:**
```bash
.venv\Scripts\python.exe backend\main.py
```

**Terminal 3 — Frontend React:**
```bash
cd frontend
npm run dev
```

---

### Simulador ESP32 (Wokwi)

1. Acesse: https://wokwi.com/projects/465306576952814593
2. Abra o arquivo do sketch, selecione tudo (`Ctrl+A`) e substitua pelo conteúdo de `esp_32.ino`
3. Clique em **Play ▶**

> O simulador roda enquanto a aba do navegador estiver aberta com o Play ativo.  
> Fechar a aba ou clicar em Stop interrompe o envio de dados.

---

### Monitoramento MQTT (opcional)

Para inspecionar as mensagens sem precisar do Python:

1. Acesse https://www.mqtt-dashboard.com/
2. Conecte ao broker: `broker.hivemq.com` porta `1883`
3. Assine o tópico: `projeto/monitorador_ambiente/dados`

---

## Acessar o Sistema

| Serviço | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API REST | http://localhost:8000 |
| Status da API | http://localhost:8000/api/status |
| Último registro | http://localhost:8000/api/latest |
| Histórico (últimos N) | http://localhost:8000/api/history?limit=20 |
| Histórico por horas | http://localhost:8000/api/history?hours=1 |
| Histórico por faixa de datas | http://localhost:8000/api/history?date_from=2026-06-01&date_to=2026-06-15 |

### URL da API (frontend)

A URL da API é configurada via variável de ambiente no arquivo **`frontend/.env`**:

```env
VITE_API_URL=http://localhost:8000
```

Para apontar para outro host (ex: deploy em servidor), basta alterar esse arquivo. O código-fonte não contém URLs hardcoded.

---

## Funcionalidades do Dashboard

- **Cards em tempo real** — Temperatura, Umidade, Partículas e Gás com atualização a cada 5s
- **Status por threshold ISO** — cada card indica Normal / Atenção / Alerta com barra de progresso
- **Banner de alertas** — aparece automaticamente quando qualquer sensor ultrapassa o limite
- **Estatísticas do histórico** — Mínimo, Média e Máximo por sensor
- **Gráficos de área** — Temperatura + Umidade (lado esquerdo) e Gás (lado direito) com gradiente
- **Seletor de período** — botões para filtrar o histórico: Últimos 20 / Últimos 50 / 1 hora / 3 horas / 24 horas
- **Filtro por faixa de datas** — campos De/Até para consultar qualquer intervalo histórico (até 1.000 registros)
- **Exportar CSV** — botão que baixa o histórico atual como `.csv` compatível com Excel (PT-BR)
- **Tabela de histórico** — registros com status por linha e formatação de data/hora

### Limites ISO configurados

| Sensor | Atenção | Alerta |
|--------|---------|--------|
| Temperatura | > 22 °C | > 25 °C |
| Umidade | > 60 % | > 70 % |
| Gás | > 1000 ppm | > 2000 ppm |
| Partículas | > 20 µg/m³ | > 50 µg/m³ |

> Os limites são ajustáveis em `frontend/src/App.tsx` na constante `THRESHOLDS`.

---

## Formato do JSON enviado pelo ESP32

```json
{
  "temperatura": 25.3,
  "umidade": 60.1,
  "particulas": 0,
  "gas": 1842
}
```

---

## Hardware Real (ESP32 físico)

### 1. Alterar credenciais Wi-Fi no `esp_32.ino`

```cpp
// Trocar isto (Wokwi):
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// Por isto (rede real):
const char* WIFI_SSID     = "NomeDaSuaRede";
const char* WIFI_PASSWORD = "SenhaDaRede";
```

### 2. Instalar o Arduino IDE e configurar ESP32

1. Baixe o [Arduino IDE](https://www.arduino.cc/en/software)
2. Em **File → Preferences → Additional Boards Manager URLs**, adicione:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Em **Tools → Board → Boards Manager**, instale **esp32 by Espressif Systems**
4. Selecione a placa: **Tools → Board → ESP32 Dev Module** (ou o modelo exato do seu ESP32)

### 3. Instalar bibliotecas necessárias

No Arduino IDE, vá em **Sketch → Include Library → Manage Libraries** e instale:

| Biblioteca | Autor |
|-----------|-------|
| `PubSubClient` | Nick O'Leary |
| `DHT sensor library` | Adafruit |
| `LiquidCrystal I2C` | Frank de Brabander |

> A biblioteca `Wire` já vem incluída com o suporte ESP32.

### 4. Gravar no ESP32

1. Conecte o ESP32 via USB
2. Selecione a porta em **Tools → Port**
3. Clique em **Upload ▶**
4. Abra o **Serial Monitor** (115200 baud) para confirmar que conectou ao Wi-Fi e está enviando dados

### 5. O que não muda

`connection.py`, `backend/main.py` e o frontend **não precisam de nenhuma alteração** — o ESP32 físico publica no mesmo broker MQTT e tópico que o simulador.

### Fiação dos sensores

| Sensor | Pino ESP32 |
|--------|-----------|
| DHT22 (data) | Definido em `esp_32.ino` como `DHTPIN` |
| MQ-2 (analógico) | Pino 34 |
| LCD 16x2 I2C (SDA) | GPIO 21 |
| LCD 16x2 I2C (SCL) | GPIO 22 |

---

## Limpeza do Banco de Dados

O banco cresce indefinidamente com o tempo. Para fazer limpeza manual, execute:

```bash
.venv\Scripts\python.exe limpar_banco.py
```

O script mostra o total de registros e oferece um menu interativo:

| Opção | Ação |
|-------|------|
| 1 | Deletar registros com mais de 7 dias |
| 2 | Deletar registros com mais de 30 dias |
| 3 | Manter apenas os últimos 1.000 registros |
| 4 | Manter apenas os últimos 500 registros |
| 5 | Apagar **todos** os registros (requer digitar `CONFIRMAR`) |
| 0 | Cancelar |

---

## Como saber que está funcionando

| Indicador | Onde ver |
|-----------|----------|
| ESP32 publicando | Serial Monitor do Wokwi: `Enviado com sucesso!` |
| Worker recebendo | Terminal MQTT Worker: `[MQTT] Novo dado recebido` |
| Banco sendo salvo | Terminal MQTT Worker: `[Banco Neon] Dados salvos com sucesso!` |
| API respondendo | http://localhost:8000/api/status → `{"database":"connected"}` |
| Dashboard ativo | http://localhost:5173 — cards atualizam a cada 5s |
