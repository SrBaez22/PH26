import psycopg2
import json
import os
from datetime import datetime
from dotenv import load_dotenv
import paho.mqtt.client as mqtt

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
MQTT_BROKER  = "broker.hivemq.com"
MQTT_PORT    = 1883
MQTT_TOPIC   = "projeto/monitorador_ambiente/dados"

def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"[MQTT] Conectado ao broker! Assinando '{MQTT_TOPIC}'...")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"[MQTT] Falha na conexão. Código: {reason_code}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode("utf-8")
        dados = json.loads(payload)
        print(f"\n[MQTT] Novo dado recebido do ESP32: {dados}")

        temp = dados.get("temperatura")
        umid = dados.get("umidade")
        part = dados.get("particulas")
        gas  = dados.get("gas")

        now = datetime.now()
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO monitorador_ambiente
                   (temperatura, umidade, particulas, gas, data, hora, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (temp, umid, part, gas, now.date(), now.time(), now)
            )
            conn.commit()
            print(f"[Banco Neon] Dados salvos com sucesso! ({now.strftime('%d/%m/%Y %H:%M:%S')})")
        conn.close()

    except Exception as e:
        print(f"[ERRO] {e}")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

print("[Python Worker] Conectando ao Broker MQTT...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)

print(f"[Python Worker] Aguardando dados no tópico '{MQTT_TOPIC}'...")
client.loop_forever()
