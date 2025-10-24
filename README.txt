FaceDoor PWA - instruções

Resumo:
- PWA usa face-api.js (TensorFlow.js) para reconhecimento facial local (no navegador).
- Quando reconhecido, o app envia um HTTP GET para o ESP8266: http://IP:PORT/led_on?token=...
- Browsers não suportam TCP puro; por isso usamos HTTP GET (ESP precisa rodar servidor web).

ESP8266 sketch (exemplo - Arduino IDE):
--------------------------------------------------
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

const char* ssid = "SEU_SSID";
const char* password = "SUA_SENHA";
const int LED_PIN = D2;
const char* TOKEN = "seu_token_aqui";

ESP8266WebServer server(80);

void handleLedOn(){
  String token = server.arg("token");
  if(strlen(TOKEN)>0 && token != String(TOKEN)){
    server.send(403, "text/plain", "INVALID_TOKEN");
    return;
  }
  digitalWrite(LED_PIN, HIGH);
  server.send(200, "text/plain", "OK");
  delay(5000);
  digitalWrite(LED_PIN, LOW);
}

void setup(){
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW);
  WiFi.begin(ssid, password);
  while(WiFi.status()!=WL_CONNECTED){ delay(500); Serial.print('.'); }
  Serial.println(WiFi.localIP());
  server.on("/led_on", HTTP_GET, handleLedOn);
  server.begin();
}

void loop(){ server.handleClient(); }

--------------------------------------------------

Como usar:
1) Rode: ./download_models.sh para baixar os modelos (pasta 'models').
2) Sirva o projeto por um servidor HTTP (ex: python3 -m http.server 8000) e abra no navegador: http://localhost:8000
3) Enrole usuário (Enroll), depois clique Recognize. Configure IP/Port/Token e o comando (/led_on).
4) Para empacotar em APK: acesse https://www.pwabuilder.com/ e forneça a URL pública do site (ou use ngrok). PWABuilder gerará o APK.
