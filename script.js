// ======================= MQTT SETUP =======================
const mqttHost = "wss://5c198e003ef24474bbec3b3d471414cc.s1.eu.hivemq.cloud:8884/mqtt";
const mqttUser = "Fermentasi_Tempe";
const mqttPass = "Tempepastijadi@26";

const client = mqtt.connect(mqttHost, {
  username: mqttUser,
  password: mqttPass,
  protocol: 'wss',
  reconnectPeriod: 3000
});

// Variabel untuk menyimpan data
let currentSuhu = 35.0;
let currentHum = 51.0;
let currentDimmer = 0;
let currentRelay = "OFF";

// Variabel untuk countdown dari ESP32
let useESP32Countdown = false;
let esp32RemainingSeconds = 0;
let esp32TotalDuration = 1800 * 60; // Default 15 menit (900 detik)

// Data untuk grafik
let timeLabels = [];
let temperatureData = [];
let dataTimestamps = [];
let currentTimeRange = 60;

// Countdown timer variables (local fallback)
let fermentasiStartTime = null;
let fermentasiDuration = 1800 * 60 * 1000; // 15 menit dalam milliseconds
let countdownInterval = null;

// Chart instance
let temperatureChart = null;

// Elemen DOM
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
const maxTempSpan = document.getElementById("maxTemp");
const minTempSpan = document.getElementById("minTemp");
const avgTempSpan = document.getElementById("avgTemp");

// Inisialisasi grafik
function initChart() {
  const ctx = document.getElementById('temperatureChart').getContext('2d');
  
  temperatureChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Suhu (°C)',
        data: [],
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        borderWidth: 3,
        pointRadius: 4,
        pointBackgroundColor: '#facc15',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#eef2ff',
            font: { size: 12 }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#1e293b',
          titleColor: '#facc15',
          bodyColor: '#eef2ff'
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Waktu',
            color: '#94a3b8'
          },
          ticks: {
            color: '#94a3b8',
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10
          },
          grid: {
            color: '#334155'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Suhu (°C)',
            color: '#94a3b8'
          },
          ticks: {
            color: '#94a3b8'
          },
          grid: {
            color: '#334155'
          },
          min: 20,
          max: 45
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
}

// Update statistik suhu
function updateTemperatureStats() {
  if (temperatureData.length === 0) {
    maxTempSpan.innerText = '--';
    minTempSpan.innerText = '--';
    avgTempSpan.innerText = '--';
    return;
  }
  
  const maxTemp = Math.max(...temperatureData);
  const minTemp = Math.min(...temperatureData);
  const avgTemp = temperatureData.reduce((a, b) => a + b, 0) / temperatureData.length;
  
  maxTempSpan.innerText = `${maxTemp.toFixed(1)}°C`;
  minTempSpan.innerText = `${minTemp.toFixed(1)}°C`;
  avgTempSpan.innerText = `${avgTemp.toFixed(1)}°C`;
}

// Tambah data ke grafik
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
  
  updateTemperatureStats();
}

// Ubah range waktu
function changeTimeRange(minutes) {
  currentTimeRange = minutes;
  
  const buttons = document.querySelectorAll('.chart-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  }
  
  const now = Date.now();
  const cutoffTime = now - (currentTimeRange * 60 * 1000);
  
  const newTimeLabels = [];
  const newTemperatureData = [];
  const newTimestamps = [];
  
  for (let i = 0; i < dataTimestamps.length; i++) {
    if (dataTimestamps[i] >= cutoffTime) {
      newTimeLabels.push(timeLabels[i]);
      newTemperatureData.push(temperatureData[i]);
      newTimestamps.push(dataTimestamps[i]);
    }
  }
  
  timeLabels = newTimeLabels;
  temperatureData = newTemperatureData;
  dataTimestamps = newTimestamps;
  
  temperatureChart.data.labels = timeLabels;
  temperatureChart.data.datasets[0].data = temperatureData;
  temperatureChart.update();
  
  updateTemperatureStats();
}

// Update countdown dari ESP32
function updateCountdownFromESP32(remainingSeconds, totalDurationSeconds = null) {
  useESP32Countdown = true;
  esp32RemainingSeconds = remainingSeconds;
  
  if (totalDurationSeconds) {
    esp32TotalDuration = totalDurationSeconds;
  }
  
  if (remainingSeconds <= 0) {
    if (countdownInterval) clearInterval(countdownInterval);
    faseTextSpan.innerHTML = `Fermentasi Selesai <i class="fas fa-check-circle"></i>`;
    faseTextSpan.style.color = "#4ade80";
    countdownTimerSpan.innerHTML = "00:00:00";
    return;
  }
  
  // Hitung jam, menit, detik
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  
  if (hours > 0) {
    countdownTimerSpan.innerHTML = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    // Tampilkan menit:detik jika kurang dari 1 jam
    countdownTimerSpan.innerHTML = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  faseTextSpan.innerHTML = `Fermentasi (Aktif) <i class="fas fa-seedling"></i>`;
}

// Start local countdown (fallback jika tidak ada data dari ESP32)
function startLocalCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  
  countdownInterval = setInterval(() => {
    if (!useESP32Countdown) {
      const now = Date.now();
      const elapsed = now - fermentasiStartTime;
      let remaining = fermentasiDuration - elapsed;
      
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(countdownInterval);
        faseTextSpan.innerHTML = `Fermentasi Selesai <i class="fas fa-check-circle"></i>`;
        faseTextSpan.style.color = "#4ade80";
        countdownTimerSpan.innerHTML = "00:00";
      } else {
        faseTextSpan.innerHTML = `Fermentasi (Aktif) <i class="fas fa-seedling"></i>`;
        faseTextSpan.style.color = "";
        
        const remainingSeconds = Math.floor(remaining / 1000);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        countdownTimerSpan.innerHTML = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
  }, 1000);
}

// Fungsi update tampilan
function updateDashboard(suhu, hum, dimmer, relay) {
  suhuSpan.innerText = suhu.toFixed(1);
  humSpan.innerText = Math.floor(hum);
  dimmerSpan.innerText = Math.floor(dimmer);
  
  const dimmerPercent = Math.min(100, Math.max(0, dimmer));
  dimmerBar.style.width = `${dimmerPercent}%`;
  
  if (dimmerPercent === 0) {
    dimmerStatusSpan.innerText = "Mati";
    dimmerStatusSpan.style.color = "#f87171";
  } else if (dimmerPercent <= 30) {
    dimmerStatusSpan.innerText = "Rendah";
    dimmerStatusSpan.style.color = "#facc15";
  } else if (dimmerPercent <= 70) {
    dimmerStatusSpan.innerText = "Sedang";
    dimmerStatusSpan.style.color = "#facc15";
  } else {
    dimmerStatusSpan.innerText = "Tinggi";
    dimmerStatusSpan.style.color = "#f97316";
  }

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

  if (relay === "ON" || relay === true || relay === 1) {
    humidifierStateSpan.innerText = "ON";
    humidifierStateSpan.classList.add("relay-on");
    humidifierStateSpan.classList.remove("relay-off");
  } else {
    humidifierStateSpan.innerText = "OFF";
    humidifierStateSpan.classList.add("relay-off");
    humidifierStateSpan.classList.remove("relay-on");
  }
  
  addDataToChart(suhu);
}

// Update jam real-time
function updateRealTimeClock() {
  const now = new Date();
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[now.getDay()];
  const tanggal = now.getDate();
  const bulan = now.toLocaleString('id-ID', { month: 'short' }).toUpperCase();
  const tahun = now.getFullYear();
  let jam = now.getHours().toString().padStart(2, '0');
  let menit = now.getMinutes().toString().padStart(2, '0');
  let detik = now.getSeconds().toString().padStart(2, '0');
  const dateTimeString = `${dayName}, ${tanggal} ${bulan} ${tahun} - ${jam}:${menit}:${detik}`;
  document.getElementById("liveDateTime").innerText = dateTimeString;
}

// MQTT Event handler
client.on("connect", () => {
  console.log("MQTT Connected ke HiveMQ Cloud");
  mqttStatusSpan.innerHTML = '<i class="fas fa-circle"></i> ONLINE';
  mqttStatusSpan.style.background = "#15803d";
  
  client.subscribe("oven/data", (err) => {
    if (!err) console.log("Subscribe ke oven/data");
  });
  
  client.subscribe("oven/countdown", (err) => {
    if (!err) console.log("Subscribe ke oven/countdown");
  });
  
  // Subscribe untuk menerima durasi total fermentasi
  client.subscribe("oven/duration", (err) => {
    if (!err) console.log("Subscribe ke oven/duration");
  });
});

client.on("error", (err) => {
  console.error("MQTT error", err);
  mqttStatusSpan.innerHTML = '<i class="fas fa-circle"></i> OFFLINE';
  mqttStatusSpan.style.background = "#b91c1c";
});

client.on("message", (topic, message) => {
  try {
    let payloadStr = message.toString();
    
    // Handle durasi total fermentasi dari ESP32
    if (topic === "oven/duration") {
      let durationSeconds = parseInt(payloadStr);
      if (!isNaN(durationSeconds) && durationSeconds > 0) {
        console.log("Durasi fermentasi dari ESP32:", durationSeconds, "detik");
        esp32TotalDuration = durationSeconds;
        fermentasiDuration = durationSeconds * 1000;
      }
      return;
    }
    
    // Handle countdown data dari ESP32
    if (topic === "oven/countdown") {
      let remainingSeconds = parseInt(payloadStr);
      if (!isNaN(remainingSeconds)) {
        console.log("Countdown dari ESP32:", remainingSeconds, "detik");
        updateCountdownFromESP32(remainingSeconds);
      }
      return;
    }
    
    // Handle sensor data
    let data = JSON.parse(payloadStr);
    
    let suhu = parseFloat(data.suhu || data.temperature || data.temp);
    let hum = parseFloat(data.hum || data.humidity);
    let dimmer = parseFloat(data.dimmer || data.output || data.pwm);
    let relay = data.relay || currentRelay;

    if (!isNaN(suhu) && suhu >= 0 && suhu <= 60) currentSuhu = suhu;
    if (!isNaN(hum) && hum >= 0 && hum <= 100) currentHum = hum;
    if (!isNaN(dimmer) && dimmer >= 0 && dimmer <= 100) currentDimmer = dimmer;
    if (relay) currentRelay = relay;

    updateDashboard(currentSuhu, currentHum, currentDimmer, currentRelay);
  } catch (e) {
    console.warn("Parse error:", e);
  }
});

// Relay Control
function relayOn() {
  client.publish("oven/relay", "ON");
  console.log("Relay ON command sent - Humidifier Aktif");
}

function relayOff() {
  client.publish("oven/relay", "OFF");
  console.log("Relay OFF command sent - Humidifier Mati");
}

// Fallback simulasi
function fallbackSimulation() {
  let simulasiRemaining = 15 * 60; // 15 menit simulasi
  setInterval(() => {
    if (!client.connected) {
      // Simulasi countdown
      if (simulasiRemaining > 0) {
        simulasiRemaining--;
        updateCountdownFromESP32(simulasiRemaining);
      }
      
      // Simulasi sensor
      let perubahanSuhu = (Math.random() - 0.5) * 0.3;
      let perubahanHum = (Math.random() - 0.5) * 2;
      let perubahanDimmer = (Math.random() - 0.5) * 8;
      
      let newSuhu = currentSuhu + perubahanSuhu;
      let newHum = currentHum + perubahanHum;
      let newDimmer = currentDimmer + perubahanDimmer;
      
      newSuhu = Math.min(38, Math.max(32, newSuhu));
      newHum = Math.min(80, Math.max(40, newHum));
      newDimmer = Math.min(100, Math.max(0, newDimmer));
      
      currentSuhu = newSuhu;
      currentHum = newHum;
      currentDimmer = newDimmer;
      
      updateDashboard(currentSuhu, currentHum, currentDimmer, currentRelay);
    }
  }, 1000);
}

// Inisialisasi
initChart();
setInterval(updateRealTimeClock, 1000);
updateRealTimeClock();

// Start local countdown sebagai fallback
fermentasiStartTime = Date.now();
startLocalCountdown();

updateDashboard(35.0, 51.0, 0, "OFF");

setTimeout(() => {
  if (!client.connected) {
    fallbackSimulation();
  }
}, 4000);
