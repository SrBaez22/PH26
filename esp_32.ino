
const int POT_1_PIN = 32; // Potenciômetro 1 (Simulando MQ-135)
const int POT_2_PIN = 33; // Potenciômetro 2 (Simulando BME280)
const int LED_PIN = 15;   // Pino do LED
const int BUZZER_PIN = 19;// Pino do Buzzer

const int LIMITE_POT_1 = 2000; // Limite imaginário
const int LIMITE_POT_2 = 2500; // Limite imaginário

void setup() {
  Serial.begin(115200);

  // Configuração dos pinos como entrada/saída
  pinMode(POT_1_PIN, INPUT);
  pinMode(POT_2_PIN, INPUT);
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Garante que o alarme comece desligado
  digitalWrite(LED_PIN, LOW);
  noTone(BUZZER_PIN);
}

void loop() {
  // Lê os valores dos potenciômetros
  int valorPot1 = analogRead(POT_1_PIN);
  int valorPot2 = analogRead(POT_2_PIN);

  Serial.print("Sensor MQ-135 ");
  Serial.print(valorPot1);
  Serial.print(" | Sensor BME280: ");
  Serial.println(valorPot2);

  //se o POT 1 OU o POT 2 passarem do limite
  if (valorPot1 > LIMITE_POT_1 || valorPot2 > LIMITE_POT_2) {
    digitalWrite(LED_PIN, HIGH);  // Liga o LED
    tone(BUZZER_PIN, 523);        // Toca o buzzer
  } else {
    digitalWrite(LED_PIN, LOW);   // Desliga o LED
    noTone(BUZZER_PIN);           // Desliga o buzzer
  }

  delay(500);
}