export const ultrasonicDistanceColor = {
  name: 'Ultrasonic Distance-to-Color',
  description: 'RGB LED changes color based on distance: green=far, yellow=medium, red=close',
  code: `#define trigPin 12
#define echoPin 11
#define MAX_DISTANCE 200

int ledPinR = 3;
int ledPinG = 5;
int ledPinB = 6;

float timeOut = MAX_DISTANCE * 60;
int soundVelocity = 340;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(ledPinR, OUTPUT);
  pinMode(ledPinG, OUTPUT);
  pinMode(ledPinB, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  float distance = getSonar();
  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  if (distance < 30) {
    // Close - Red
    setColor(0, 255, 255);
  } else if (distance < 100) {
    // Medium - Yellow
    setColor(0, 0, 255);
  } else {
    // Far - Green
    setColor(255, 0, 255);
  }
  delay(200);
}

float getSonar() {
  unsigned long pingTime;
  float distance;
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  pingTime = pulseIn(echoPin, HIGH, timeOut);
  distance = (float)pingTime * soundVelocity / 2 / 10000;
  return distance;
}

void setColor(int red, int green, int blue) {
  analogWrite(ledPinR, red);
  analogWrite(ledPinG, green);
  analogWrite(ledPinB, blue);
}`,
  components: [
    { type: 'ultrasonic-sensor', id: 'us1', x: 200, y: 280 },
    { type: 'resistor', id: 'r1', x: 400, y: 280 },
    { type: 'resistor', id: 'r2', x: 450, y: 280 },
    { type: 'resistor', id: 'r3', x: 500, y: 280 },
    { type: 'rgb-led', id: 'rgb1', x: 450, y: 340 },
  ],
  wires: [
    { from: 'arduino:5V', to: 'component:us1:vcc', color: '#cc2222' },
    { from: 'arduino:pin12', to: 'component:us1:trig', color: '#22cc22' },
    { from: 'arduino:pin11', to: 'component:us1:echo', color: '#cccc22' },
    { from: 'component:us1:gnd', to: 'arduino:GND', color: '#222222' },
    { from: 'arduino:5V', to: 'component:rgb1:common', color: '#cc2222' },
    { from: 'arduino:pin3', to: 'component:r1:pin1', color: '#cc2222' },
    { from: 'component:r1:pin2', to: 'component:rgb1:red', color: '#cc2222' },
    { from: 'arduino:pin5', to: 'component:r2:pin1', color: '#22cc22' },
    { from: 'component:r2:pin2', to: 'component:rgb1:green', color: '#22cc22' },
    { from: 'arduino:pin6', to: 'component:r3:pin1', color: '#2222cc' },
    { from: 'component:r3:pin2', to: 'component:rgb1:blue', color: '#2222cc' },
  ],
};
