#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
// #include <Adafruit_Sensor.h>
// #include <Adafruit_BME280.h>
#include "DHT.h"

// -------- WI-FI / MQTT --------
// troque pelas credenciais da sua rede:
const char* WIFI_SSID     = "S25 FE de Isabel";
const char* WIFI_PASSWORD = "toroinoue";
// const char* WIFI_SSID     = "Hipolito";
// const char* WIFI_PASSWORD = "Gajv2024#$";
// const char* WIFI_SSID     = "iPhone de Luandria";
// const char* WIFI_PASSWORD = "12345678";
// const char* WIFI_SSID     = "UEA-EST_WIFI"; //UEA
// const char* WIFI_PASSWORD = "somosumasoest"; //UEA
// const char* WIFI_SSID     = "CLARO_ABA429";
// const char* WIFI_PASSWORD = "C7Ht#At$NG";
// const char* WIFI_SSID     = "SistemasEmbargados"; //lab A40
// const char* WIFI_PASSWORD = "geargear"; //lab A40

// const char* WIFI_SSID     = "Wokwi-GUEST";
// const char* WIFI_PASSWORD = "";

const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "projeto/monitorador_ambiente/dados";

WiFiClient   espClient;
PubSubClient mqttClient(espClient);

// -------- PINOS (conforme o esquema corrigido) --------
#define PIN_LED_AR_PURO     15  // strapping pin
#define PIN_LED_AR_BOA      2   // strapping pin
#define PIN_LED_AR_RUIM     4
#define PIN_LED_AR_PERIGOSO 5   // strapping pin
#define PIN_BUZZER          19
#define PIN_SDA             21
#define PIN_SCL             22
#define PIN_MQ135_AO        32  // entrada do divisor de tensao (1k/2k)
#define PIN_PPD42_P1        16  // entrada do divisor de tensao (1k/2k)
#define DHTPIN              17  // dados do DHT22 (livre desde a troca do PMS5003)
#define DHTTYPE             DHT11

// -------- SENSORES --------
// Adafruit_BME280 bme;   // I2C, endereco 0x76 (troque para 0x77 se necessario)
DHT dht(DHTPIN, DHTTYPE);

// -------- LCD I2C --------
LiquidCrystal_I2C lcd(0x27, 16, 2);

// -------- PPD42NS: leitura por interrupcao (tempo em nivel baixo) --------
volatile unsigned long ppdPulseStart        = 0;
volatile unsigned long ppdLowPulseOccupancy = 0;
volatile bool          ppdPulseActive       = false;
unsigned long ppdJanelaInicio = 0;

void IRAM_ATTR ppdInterrupt() {
  if (digitalRead(PIN_PPD42_P1) == LOW) {
    ppdPulseStart  = micros();
    ppdPulseActive = true;
  } else if (ppdPulseActive) {
    ppdLowPulseOccupancy += (micros() - ppdPulseStart);
    ppdPulseActive = false;
  }
}

// -------- CONEXAO WI-FI + MQTT --------
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

// -------- CLASSIFICACAO DE QUALIDADE DO AR --------
// Os limiares abaixo sao um ponto de partida - calibre com leituras
// reais do MQ-135 e do PPD42NS no seu ambiente antes de confiar neles.
int nivelGas(int leitura) {
  if (leitura < 2450) return 0;   // puro
  if (leitura < 2800) return 1;   // boa
  if (leitura < 3300) return 2;   // ruim
  return 3;                       // perigoso
}

int nivelPoeira(float concentracao) {
  if (concentracao < 2000)  return 0;  // puro
  if (concentracao < 5000)  return 1;  // boa
  if (concentracao < 10000) return 2;  // ruim
  return 3;                            // perigoso
}

const char* NOMES_NIVEL[] = {"PURO", "BOA", "RUIM", "PERIGOSO"};

void atualizarLEDsEBuzzer(int nivel) {
  digitalWrite(PIN_LED_AR_PURO,     nivel == 0);
  digitalWrite(PIN_LED_AR_BOA,      nivel == 1);
  digitalWrite(PIN_LED_AR_RUIM,     nivel == 2);
  digitalWrite(PIN_LED_AR_PERIGOSO, nivel == 3);
  digitalWrite(PIN_BUZZER,          nivel == 3);
}

void setup() {
  Serial.begin(115200);

  pinMode(PIN_LED_AR_PURO,     OUTPUT);
  pinMode(PIN_LED_AR_BOA,      OUTPUT);
  pinMode(PIN_LED_AR_RUIM,     OUTPUT);
  pinMode(PIN_LED_AR_PERIGOSO, OUTPUT);
  pinMode(PIN_BUZZER,          OUTPUT);
  pinMode(PIN_MQ135_AO,        INPUT);
  pinMode(PIN_PPD42_P1,        INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_PPD42_P1), ppdInterrupt, CHANGE);
  ppdJanelaInicio = millis();

  Wire.begin(PIN_SDA, PIN_SCL);

  // if (!bme.begin(0x76)) {
  //   Serial.println("BME280 nao encontrado no endereco 0x76. Tente 0x77 se persistir.");
  // }
  dht.begin();

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

  // ----- Leitura dos sensores -----
  // float temp = bme.readTemperature();
  // float hum  = bme.readHumidity();
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  int   gas  = analogRead(PIN_MQ135_AO);

  // Janela de amostragem do PPD42NS alinhada ao ciclo de 5s do loop.
  // A Shinyei recomenda 30s para maior estabilidade da leitura; se quiser
  // seguir o padrao do fabricante, aumente o delay() no fim do loop.
  unsigned long agora         = millis();
  unsigned long duracaoJanela = agora - ppdJanelaInicio;
  float ratioPoeira = ppdLowPulseOccupancy / (duracaoJanela * 10.0);
  float poeira = 1.1 * pow(ratioPoeira, 3) - 3.8 * pow(ratioPoeira, 2) + 520 * ratioPoeira + 0.62;
  ppdLowPulseOccupancy = 0;
  ppdJanelaInicio = agora;

  if (isnan(temp) || isnan(hum)) {
    Serial.println("Falha ao ler o DHT22!");
    temp = 0.0;
    hum  = 0.0;
  }

  int nivel = max(nivelGas(gas), nivelPoeira(poeira));
  atualizarLEDsEBuzzer(nivel);

  // ----- Serial Monitor -----
  Serial.print("Temp: "); Serial.print(temp, 1);
  Serial.print(" C | Hum: "); Serial.print(hum, 1);
  Serial.print(" % | Gas: "); Serial.print(gas);
  Serial.print(" | Poeira: "); Serial.print(poeira, 0);
  Serial.print(" pcs/0.01cf | Nivel: "); Serial.println(NOMES_NIVEL[nivel]);

  // ----- LCD -----
  lcd.setCursor(0, 0);
  lcd.print("T:"); lcd.print(temp, 1); lcd.print("C H:"); lcd.print(hum, 1); lcd.print("%  ");
  lcd.setCursor(0, 1);
  lcd.print("Ar:"); lcd.print(NOMES_NIVEL[nivel]); lcd.print("        ");

  // ----- MQTT (JSON manual) -----
  String jsonPayload = "{\"temperatura\":" + String(temp, 1) +
                       ",\"umidade\":"     + String(hum, 1)  +
                       ",\"particulas\":"  + String(poeira / 1000.0, 2) +
                       ",\"gas\":"         + String(gas)     +
                       ",\"nivel\":\""     + String(NOMES_NIVEL[nivel]) + "\"}";

  Serial.print("Enviando: "); Serial.println(jsonPayload);

  if (mqttClient.publish(MQTT_TOPIC, jsonPayload.c_str())) {
    Serial.println("Enviado com sucesso!");
  } else {
    Serial.println("Falha no envio MQTT.");
  }

  delay(5000);
}
