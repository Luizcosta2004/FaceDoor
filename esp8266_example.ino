#include <ESP8266WiFi.h>
#include <WebSocketsServer.h>
#include <ESP8266WebServer.h>

const char* ssid = "SEU_SSID";
const char* password = "SUA_SENHA";

ESP8266WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

const int relayPin = 5; // D1

void setup(){
  Serial.begin(115200);
  pinMode(relayPin, OUTPUT); digitalWrite(relayPin, LOW);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Conectando WiFi...");
  while(WiFi.status()!=WL_CONNECTED){ delay(500); Serial.print('.'); }
  Serial.println();
  Serial.print("IP: "); Serial.println(WiFi.localIP());

  server.on("/", [](){
    if(server.hasArg("cmd")){
      String cmd = server.arg("cmd");
      if(cmd == "OPEN"){
        digitalWrite(relayPin, HIGH);
        delay(5000);
        digitalWrite(relayPin, LOW);
        server.send(200, "text/plain", "OPEN_OK");
        return;
      }
      server.send(200, "text/plain", "CMD_UNKNOWN");
    } else {
      server.send(200, "text/plain", "Hello from FaceDoor ESP");
    }
  });

  server.begin();

  webSocket.begin();
  webSocket.onEvent([](uint8_t num, WStype_t type, uint8_t * payload, size_t length){
    if(type == WStype_TEXT){
      String msg = String((char*)payload);
      Serial.println("WS msg: " + msg);
      if(msg == "OPEN"){
        digitalWrite(relayPin, HIGH);
        delay(5000);
        digitalWrite(relayPin, LOW);
        webSocket.sendTXT(num, "OPEN_OK");
      }
    }
  });
}

void loop(){
  server.handleClient();
  webSocket.loop();
}
