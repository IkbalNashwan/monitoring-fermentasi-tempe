// MQTT Configuration
const mqttHost = "wss://5c198e003ef24474bbec3b3d471414cc.s1.eu.hivemq.cloud:8884/mqtt";
const mqttUser = "Fermentasi_Tempe";
const mqttPass = "Tempepastijadi@26";

const client = mqtt.connect(mqttHost, {
  username: mqttUser,
  password: mqttPass,
  protocol: 'wss',
  reconnectPeriod: 3000
});

// Variables
let currentSuhu = 35.0;
let currentHum = 51.0;
let currentDimmer = 0;
let currentRelay = "OFF";

// Chart data
let timeLabels = [];
let temperatureData = [];
let dataTimestamps = [];
let currentTimeRange = 360;
let temperatureChart = null;

// DOM Elements
const suhuSpan = document.getElementById("suhuValue");
const humSpan = document.getElementById("humValue");
const dimmerSpan = document.getElementById("dimmerValue");
const dimmerBar = document.getElementById("dimmerBar");
const dimmerStatusSpan = document.getElementById("dimmerStatus");
const suhuStatusSpan = document.getElementById("suhuStatus");
const humStatusSpan = document.getElementById("humStatus");
const humidifierStateSpan = document.getElementById("humidifierState");
const mqttStatusSpan = document.getElementById("mqttStatus");
const faseTextSpan = document.getElementById("faseText");
const countdownTimerSpan = document.getElementById("countdownTimer");
const waktuProsesSpan = document.getElementById("waktuProses");
const maxTempSpan = document.getElementById("maxTemp");
const minTempSpan = document.getElementById("minTemp");
const avgTempSpan = document.getElementById("avgTemp");

// Initialize Chart
function initChart() {
  const ctx = document.getElementById('temperatureChart').getContext('2d');
  temperatureChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Suhu (°C)', data: [], borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#eef2ff' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { min: 20, max: 45, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}

// Add data to chart
function addDataToChart(suhu) {
  const now = new Date();
  const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  timeLabels.push(timeString);
  temperatureData.push(suhu);
  dataTimestamps.push(now.getTime());
  
  const cutoffTime = now.getTime() - (currentTimeRange * 60 * 1000);
  while (dataTimestamps.length > 0 && dataTimestamps[0] < cutoffTime) {
    timeLabels.shift();
    temperatureData.shift();
    dataTimestamps.shift();
  }
  
  temperatureChart.data.labels = timeLabels;
  temperatureChart.data.datasets[0].data = temperatureData;
  temperatureChart.update();
  updateStats();
}

// Update statistics
function updateStats() {
  if (temperatureData.length === 0) return;
  const maxTemp = Math.max(...temperatureData);
  const minTemp = Math.min(...temperatureData);
  const avgTemp = temperatureData.reduce((a, b) => a + b, 0) / temperatureData.length;
  maxTempSpan.innerText = `${maxTemp.toFixed(1)}°C`;
  minTempSpan.innerText = `${minTemp.toFixed(1)}°C`;
  avgTempSpan.innerText = `${avgTemp.toFixed(1)}°C`;
}

// Change time range
function changeTimeRange(minutes) {
  currentTimeRange = minutes;
  document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
  if (event && event.target) event.target.classList.add('active');
  
  const now = Date.now();
  const cutoffTime = now - (currentTimeRange * 60 * 1000);
  const newLabels = [], newData = [], newTimestamps = [];
  
  for (let i = 0; i < dataTimestamps.length; i++) {
    if (dataTimestamps[i] >= cutoffTime) {
      newLabels.push(timeLabels[i]);
      newData.push(temperatureData[i]);
      newTimestamps.push(dataTimestamps[i]);
    }
  }
  
  timeLabels = newLabels;
  temperatureData = newData;
  dataTimestamps = newTimestamps;
  temperatureChart.data.labels = timeLabels;
  temperatureChart.data.datasets[0].data = temperatureData;
  temperatureChart.update();
  updateStats();
}

// Format time HH:MM:SS
function formatTime(h, m, s) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Update dashboard
function updateDashboard(suhu, hum, dimmer, relay, sisaH, sisaM, sisaD, prosesH, prosesM, prosesD, prosesStatus) {
  suhuSpan.innerText = suhu.toFixed(1);
  humSpan.innerText = Math.floor(hum);
  dimmerSpan.innerText = Math.floor(dimmer);
  dimmerBar.style.width = `${Math.min(100, Math.max(0, dimmer))}%`;
  
  // Dimmer status
  if (dimmer === 0) dimmerStatusSpan.innerText = "Mati";
  else if (dimmer <= 30) dimmerStatusSpan.innerText = "Rendah";
  else if (dimmer <= 70) dimmerStatusSpan.innerText = "Sedang";
  else dimmerStatusSpan.innerText = "Tinggi";
  
  // Temperature status
  if (suhu >= 34.8 && suhu <= 35.2) {
    suhuStatusSpan.innerText = "Sesuai Setpoint";
    suhuStatusSpan.style.color = "#4ade80";
  } else if (suhu < 34.8) {
    suhuStatusSpan.innerText = "Di Bawah Setpoint";
    suhuStatusSpan.style.color = "#38bdf8";
  } else {
    suhuStatusSpan.innerText = "Di Atas Setpoint";
    suhuStatusSpan.style.color = "#f97316";
  }
  
  // Humidity status
  if (hum >= 60 && hum <= 75) {
    humStatusSpan.innerText = "Optimal";
    humStatusSpan.style.color = "#4ade80";
  } else if (hum < 60) {
    humStatusSpan.innerText = "Kering";
    humStatusSpan.style.color = "#facc15";
  } else {
    humStatusSpan.innerText = "Terlalu Lembab";
    humStatusSpan.style.color = "#f87171";
  }
  
  // Relay status
  if (relay === "ON") {
    humidifierStateSpan.innerText = "ON";
    humidifierStateSpan.className = "relay-state relay-on";
  } else {
    humidifierStateSpan.innerText = "OFF";
    humidifierStateSpan.className = "relay-state relay-off";
  }
  
  // Countdown and elapsed time
  if (prosesStatus === "SELESAI" || (sisaH === 0 && sisaM === 0 && sisaD === 0)) {
    faseTextSpan.innerHTML = `Fermentasi Selesai <i class="fas fa-check-circle"></i>`;
    countdownTimerSpan.innerHTML = "00:00:00";
  } else {
    faseTextSpan.innerHTML = `Fermentasi (Aktif) <i class="fas fa-seedling"></i>`;
    countdownTimerSpan.innerHTML = formatTime(sisaH, sisaM, sisaD);
  }
  
  waktuProsesSpan.innerHTML = formatTime(prosesH, prosesM, prosesD);
  addDataToChart(suhu);
}

// Real time clock
function updateRealTimeClock() {
  const now = new Date();
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${now.toLocaleString('id-ID', { month: 'short' }).toUpperCase()} ${now.getFullYear()} - ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  document.getElementById("liveDateTime").innerText = dateStr;
}

// MQTT Events
client.on("connect", () => {
  console.log("MQTT Connected");
  mqttStatusSpan.innerHTML = '<i class="fas fa-circle"></i> ONLINE';
  mqttStatusSpan.style.background = "#15803d";
  client.subscribe("oven/data");
});

client.on("error", () => {
  mqttStatusSpan.innerHTML = '<i class="fas fa-circle"></i> OFFLINE';
  mqttStatusSpan.style.background = "#b91c1c";
});

client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    updateDashboard(
      parseFloat(data.suhu) || 35,
      parseFloat(data.hum) || 51,
      parseFloat(data.output) || 0,
      data.relay || "OFF",
      parseInt(data.sisaJam) || 0,
      parseInt(data.sisaMenit) || 0,
      parseInt(data.sisaDetik) || 0,
      parseInt(data.prosesJam) || 0,
      parseInt(data.prosesMenit) || 0,
      parseInt(data.prosesDetik) || 0,
      data.proses || "AKTIF"
    );
  } catch(e) { console.log("Error:", e); }
});

// Relay control
function relayOn() { client.publish("oven/relay", "ON"); }
function relayOff() { client.publish("oven/relay", "OFF"); }

// Initialize
initChart();
setInterval(updateRealTimeClock, 1000);
updateRealTimeClock();
