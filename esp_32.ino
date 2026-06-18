#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "DHT.h"

// -------- WI-FI / MQTT --------
// Para usar hardware real, troque pelas credenciais da sua rede:
// const char* WIFI_SSID     = "SistemasEmbarcados";
// const char* WIFI_PASSWORD = "geargear";

const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "projeto/monitorador_ambiente/dados";

WiFiClient   espClient;
PubSubClient mqttClient(espClient);

// -------- SENSORES --------
#define DHTPIN  4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define MQ2_PIN 34

// -------- LCD I2C --------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// -------- CONEXÃO WI-FI + MQTT --------
void conectarRede() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.print("Conectando ao Wi-Fi...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\nWi-Fi conectado!");
  }

  while (!mqttClient.connected()) {
    Serial.print("Conectando ao Broker MQTT...");
    String clientId = "ESP32Client-" + String(random(0, 10000));
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("MQTT conectado!");
    } else {
      Serial.print("Falha. Estado: ");
      Serial.print(mqttClient.state());
      Serial.println(" | Tentando novamente em 5s...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  dht.begin();
  pinMode(MQ2_PIN, INPUT);

  Wire.begin();
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("IoT clean room");
  lcd.setCursor(0, 1);
  lcd.print("System Start...");

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);

  delay(2000);
  lcd.clear();
}

void loop() {
  if (!mqttClient.connected() || WiFi.status() != WL_CONNECTED) {
    conectarRede();
  }
  mqttClient.loop();

  // ----- Leitura dos Sensores -----
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  int   gas  = analogRead(MQ2_PIN);

  if (isnan(temp) || isnan(hum)) {
    Serial.println("Falha ao ler o DHT22!");
    temp = 0.0;
    hum  = 0.0;
  }

  // ----- Serial Monitor -----
  Serial.print("Temp: "); Serial.print(temp, 1);
  Serial.print(" C | Hum: "); Serial.print(hum, 1);
  Serial.print(" % | Gas: "); Serial.println(gas);

  if      (gas < 1000) Serial.println("Ar limpo");
  else if (gas < 2000) Serial.println("Qualidade media");
  else                 Serial.println("PERIGO - POLUICAO!");

  // ----- LCD -----
  lcd.setCursor(0, 0);
  lcd.print("T:"); lcd.print(temp, 1); lcd.print("C H:"); lcd.print(hum, 1); lcd.print("%  ");
  lcd.setCursor(0, 1);
  lcd.print("Gas:"); lcd.print(gas); lcd.print("       ");

  // ----- MQTT (JSON manual) -----
  String jsonPayload = "{\"temperatura\":" + String(temp, 1) +
                       ",\"umidade\":"     + String(hum, 1)  +
                       ",\"particulas\":0"                   +
                       ",\"gas\":"         + String(gas)     + "}";

  Serial.print("Enviando: "); Serial.println(jsonPayload);

  if (mqttClient.publish(MQTT_TOPIC, jsonPayload.c_str())) {
    Serial.println("Enviado com sucesso!");
  } else {
    Serial.println("Falha no envio MQTT.");
  }

  delay(5000);
}
