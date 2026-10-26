#include <WiFiS3.h>
#include <LiquidCrystal_I2C.h>

// --- WiFi & Webhook Configuration ---
const char WIFI_SSID[] = "E";
const char WIFI_PASSWORD[] = "eeeeeeee";
const char WEBHOOK_URL[]   = "https://discord.com/api/webhooks/1563768173864558753/7iUTrccgbqkqACapFC9nSzgte-_LDga7LmoKxU7euSujUtp9yriVKFMB7OtOrJixxTz2";

// --- Hardware & Calibration ---
const int SENSOR_PIN = A0;
LiquidCrystal_I2C lcd(0x27, 16, 2);

const int AIR_VALUE = 1023;
const int WATER_VALUE = 320;

// --- Timers & Thresholds ---
const unsigned long SEND_INTERVAL = 60UL * 1000UL;
const unsigned long LCD_INTERVAL = 500UL;
const int DRY_BELOW = 30;
const int WET_ABOVE = 85;

// --- State Variables ---
WiFiSSLClient client;
unsigned long lastSend = 0;
unsigned long lastLcdUpdate = 0;
String webhookHost;
String webhookPath;
int prevStage = -1;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to WiFi");
  while (WiFi.begin(WIFI_SSID, WIFI_PASSWORD) != WL_CONNECTED) {
    Serial.print(".");
    delay(3000);
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

void parseWebhookUrl() {
  String url = String(WEBHOOK_URL);
  url.replace("https://", "");
  int slash = url.indexOf('/');
  webhookHost = url.substring(0, slash);
  webhookPath = url.substring(slash);
}

int readMoisturePercent() {
  long total = 0;
  for (int i = 0; i < 10; i++) {
    total += analogRead(SENSOR_PIN);
    delay(5);
  }
  int raw = total / 10;
  int percent = map(raw, AIR_VALUE, WATER_VALUE, 0, 100);
  return constrain(percent, 0, 100);
}

String makeBar(int percent) {
  const int segments = 10;
  int filled = (percent + 5) / 10;
  String bar = "";
  for (int i = 0; i < segments; i++) {
    bar += (i < filled) ? "🟦" : "⬛";
  }
  return bar;
}

void updateLcdEmoticon(int percent) {
  int currentStage;

  if (percent < 15) {
    currentStage = 0;
  } else if (percent < DRY_BELOW) {
    currentStage = 1;
  } else if (percent <= WET_ABOVE) {
    currentStage = 2;
  } else {
    currentStage = 3;
  }

  if (currentStage != prevStage) {
    lcd.clear();
    
    switch (currentStage) {
      case 0:
        lcd.setCursor(3, 0);
        lcd.print("( X _ X )");
        lcd.setCursor(1, 1);
        lcd.print("Water me, PLZ!");
        break;

      case 1:
        lcd.setCursor(3, 0);
        lcd.print("( . _ . )");
        lcd.setCursor(2, 1);
        lcd.print("Getting dry..");
        break;

      case 2:
        lcd.setCursor(3, 0);
        lcd.print("( O v O )");
        lcd.setCursor(1, 1);
        lcd.print("I'm refreshed!");
        break;

      case 3:
        lcd.setCursor(3, 0);
        lcd.print("( > o < )");
        lcd.setCursor(1, 1);
        lcd.print("Too much water!");
        break;
    }
    prevStage = currentStage;
  }
}

void sendToDiscord(int percent, int raw) {
  String status, emoji, advice;
  int color;

  if (percent < DRY_BELOW) {
    status = "Dry";   emoji = "🏜️"; color = 15158332;
    advice = "Your plant is thirsty. Time to water it!";
  } else if (percent > WET_ABOVE) {
    status = "Wet";   emoji = "🌊"; color = 3447003;
    advice = "Plenty of water. No need to water for now.";
  } else {
    status = "Happy"; emoji = "🌱"; color = 3066993;
    advice = "Moisture level is just right.";
  }

  String json = "{";
  json += "\"username\":\"Plant Monitor\",";
  json += "\"embeds\":[{";
  json += "\"title\":\"" + emoji + " Soil Moisture Report\",";
  json += "\"description\":\"" + makeBar(percent) + "  **" + String(percent) + "%**\\n" + advice + "\",";
  json += "\"color\":" + String(color) + ",";
  json += "\"fields\":[";
  json += "{\"name\":\"💧 Moisture\",\"value\":\"" + String(percent) + "%\",\"inline\":true},";
  json += "{\"name\":\"📊 Status\",\"value\":\"" + status + "\",\"inline\":true},";
  json += "{\"name\":\"🔧 Raw Value\",\"value\":\"" + String(raw) + "\",\"inline\":true}";
  json += "],";
  json += "\"footer\":{\"text\":\"Arduino UNO R4 WiFi • Updates every " + String(SEND_INTERVAL / 1000) + "s\"}";
  json += "}]}";

  Serial.println("Sending to Discord...");

  if (!client.connect(webhookHost.c_str(), 443)) {
    Serial.println("Connection to Discord failed.");
    return;
  }

  client.println("POST " + webhookPath + " HTTP/1.1");
  client.println("Host: " + webhookHost);
  client.println("User-Agent: ArduinoUnoR4");
  client.println("Content-Type: application/json");
  client.println("Connection: close");
  client.println("Content-Length: " + String(json.length()));
  client.println();
  client.print(json);

  unsigned long start = millis();
  while (!client.available() && millis() - start < 5000) delay(10);
  String statusLine = client.readStringUntil('\n');
  Serial.println("Response: " + statusLine);

  client.stop();
}

void setup() {
  Serial.begin(9600);
  
  lcd.init();
  lcd.backlight();
  lcd.setCursor(2, 0);
  lcd.print("Plant Monitor");
  lcd.setCursor(3, 1);
  lcd.print("Starting...");

  analogReadResolution(10);
  parseWebhookUrl();
  connectWiFi();

  int initialPercent = readMoisturePercent();
  int initialRaw = analogRead(SENSOR_PIN);
  
  updateLcdEmoticon(initialPercent);
  sendToDiscord(initialPercent, initialRaw);
  
  lastSend = millis();
  lastLcdUpdate = millis();
}

void loop() {
  connectWiFi();

  unsigned long currentMillis = millis();

  if (currentMillis - lastLcdUpdate >= LCD_INTERVAL) {
    int percent = readMoisturePercent();
    updateLcdEmoticon(percent);
    lastLcdUpdate = currentMillis;
  }

  if (currentMillis - lastSend >= SEND_INTERVAL) {
    int raw = analogRead(SENSOR_PIN);
    int percent = readMoisturePercent();
    
    Serial.print("Moisture: ");
    Serial.print(percent);
    Serial.print("% (Raw: ");
    Serial.print(raw);
    Serial.println(")");

    sendToDiscord(percent, raw);
    lastSend = currentMillis;
  }
}