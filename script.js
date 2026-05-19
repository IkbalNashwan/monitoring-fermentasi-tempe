const client = mqtt.connect(
"wss://5c198e003ef24474bbec3b3d471414cc.s1.eu.hivemq.cloud:8884/mqtt",
{
username:"Fermentasi_Tempe",
password:"Tempepastijadi@26"
});

client.on("connect",function(){

console.log("MQTT Connected");

client.subscribe("oven/data");

});

client.on("message",function(topic,message){

let data =
JSON.parse(message.toString());

document.getElementById("suhu")
.innerHTML =
data.suhu.toFixed(1);

document.getElementById("hum")
.innerHTML =
data.hum.toFixed(1);

document.getElementById("output")
.innerHTML =
data.output;

document.getElementById("relay")
.innerHTML =
data.relay;

});

// ================= RELAY CONTROL =================

function relayOn()
{
client.publish(
"oven/relay",
"ON"
);
}

function relayOff()
{
client.publish(
"oven/relay",
"OFF"
);
}