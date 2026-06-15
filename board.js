let currentSizes = { lgTitle: 7.0, lgPrice: 10.5, smTitle: 3.2, smPrice: 5.0 };
let lastUpdateTs = 0;
let serverConnected = false;
let socket = null;
let pingInterval = null;

let commissions = { g_buy: 0, g_sell: 0, f_buy: 0, f_sell: 0, h_buy: 0, h_sell: 0, q_buy: 0, q_sell: 0 };
let rawPrices = { g_buy: 0, g_sell: 0, f_buy: 0, f_sell: 0, h_buy: 0, h_sell: 0, q_buy: 0, q_sell: 0 };

let firstMessageReceived = false;   
let firstRealDataReceived = false;  

const priceAudio = new Audio('notification.mp3');

function playChangeSound() {
    try {
        priceAudio.currentTime = 0;
        priceAudio.volume = 0.5; 
        priceAudio.play().catch(err => { console.log("مانع پخش صدا توسط مرورگر:", err); });
    } catch (e) { console.log("خطا در پخش صدا:", e); }
}

function formatAndPersianize(num) {
  if (num === undefined || num === null || num === '---') return '---';
  let val = Math.round(parseFloat(num.toString().replace(/,/g, '')));
  if (isNaN(val)) return '---';
  
  return new Intl.NumberFormat('fa-IR', { useGrouping: true }).format(val);
}

function toPersianDigits(str) {
  const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, d => farsi[parseInt(d)]);
}

setInterval(() => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    serverConnected = false;
    const sDot = document.getElementById('server-dot');
    if (sDot) sDot.style.backgroundColor = '#ff4757';
  }
}, 115000);

function connectPusherSocket() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onmessage = null;
    try { socket.close(); } catch(e) {}
    socket = null;
  }

  socket = new WebSocket("wss://pusher.goldab.ir:443/app/app-key?protocol=7&client=js&version=8.4.0&flash=false");

  socket.onopen = () => {
    serverConnected = true;
    const sDot = document.getElementById('server-dot');
    if (sDot) sDot.style.backgroundColor = '#2ed573';
    socket.send(JSON.stringify({"event": "pusher:subscribe", "data": {"auth": "", "channel": "deniz"}}));
    
    const setupRandomPing = () => {
      const randomDelay = Math.floor(Math.random() * (110000 - 80000 + 1)) + 80000;
      pingInterval = setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({"event": "pusher:ping", "data": {}}));
          setupRandomPing();
        }
      }, randomDelay);
    };
    setupRandomPing();
  };

  socket.onclose = () => {
    serverConnected = false;
    const sDot = document.getElementById('server-dot');
    if (sDot) sDot.style.backgroundColor = '#ff4757';
    if (pingInterval) clearTimeout(pingInterval);
    setTimeout(connectPusherSocket, 3000);
  };

  socket.onmessage = (event) => {
    window.lastIncomingEvent = event;
    const packet = JSON.parse(event.data);
    
    if (!firstMessageReceived) {
      firstMessageReceived = true;
      const shutter = document.getElementById('first-load-shutter');
      if (shutter) {
        shutter.style.opacity = '0';
        setTimeout(() => shutter.remove(), 600);
      }
    }

    if (packet.event === "app" || packet.event === "new-panel") {
      const payload = JSON.parse(packet.data || "{}");
      const msg = payload.message || {};
      const p_type = msg.type;

      if (p_type === "homepage_data_updated") {
        const inner = msg.data || {};
        const goldClosed = inner.molten_trade_status !== 1;
        const coinClosed = inner.coin_trade_status !== 1;
        processMarketStatus(goldClosed, coinClosed);
      }

      if (p_type === "all_systems_pricing_updated") {
        const pricing = msg.data?.pricing || [];
        if (pricing.length > 0) {
          const currencies = pricing[0].currencies || [];
          let priceChanged = false;

          currencies.forEach(item => {
            const title = (item.title || "").replace(/ /g, "");
            let p_sell = (item.sell_price || 0) * 10000;
            let p_buy = (item.buy_price || 0) * 10000;
            if (p_sell === 0 || p_buy === 0) return;

            const updateRaw = (keyBuy, keySell, bVal, sVal) => {
              let buyRound = Math.ceil(bVal / 1000.0) * 1000;
              let sellRound = Math.floor(sVal / 1000.0) * 1000;
              if (rawPrices[keyBuy] !== buyRound || rawPrices[keySell] !== sellRound) {
                rawPrices[keyBuy] = buyRound;
                rawPrices[keySell] = sellRound;
                priceChanged = true;
              }
            };

            if ((item.title || "").includes("آبشده نقد") && (item.title || "").includes("24")) {
              updateRaw('g_buy', 'g_sell', p_sell / 4.3318, p_buy / 4.3318);
            } else if (title.includes("تمامامامی86")) {
              updateRaw('f_buy', 'f_sell', p_sell, p_buy);
            } else if (title.includes("نیمسکه86")) {
              updateRaw('h_buy', 'h_sell', p_sell, p_buy);
            } else if (title.includes("ربعسکه86")) {
              updateRaw('q_buy', 'q_sell', p_sell, p_buy);
            }
          });

          if (priceChanged) {
            if (!firstRealDataReceived) firstRealDataReceived = true;
            lastUpdateTs = Date.now();
            calculatePassedTime();
            
            const gOverlay = document.getElementById('gold-status-overlay');
            const cOverlay = document.getElementById('coin-status-overlay-1');
            const goldClosed = gOverlay ? gOverlay.style.opacity === "1" : false;
            const coinClosed = cOverlay ? cOverlay.style.opacity === "1" : false;
            renderCalculatedPrices(goldClosed, coinClosed);
          }
        }
      }
    }
  };
}

function processMarketStatus(goldClosed, coinClosed) {
  const gOverlay = document.getElementById('gold-status-overlay');
  if (gOverlay) {
    gOverlay.style.opacity = goldClosed ? "1" : "0";
    gOverlay.style.pointerEvents = goldClosed ? "auto" : "none";
  }

  for (let i = 1; i <= 3; i++) {
    const cOverlay = document.getElementById(`coin-status-overlay-${i}`);
    if (cOverlay) {
      cOverlay.style.opacity = coinClosed ? "1" : "0";
      cOverlay.style.pointerEvents = coinClosed ? "auto" : "none";
    }
  }
  renderCalculatedPrices(goldClosed, coinClosed);
}

function renderCalculatedPrices(goldClosed, coinClosed) {
  let priceChanged = false;
  const update = (id, val) => {
    const el = document.getElementById(id);
    if (el && el.innerText !== val) {
      if (el.innerText !== "---" && val !== "---") priceChanged = true;
      el.innerText = val;
    }
  };

  update('gold_buy', goldClosed ? "---" : formatAndPersianize(rawPrices.g_buy + commissions.g_buy));
  update('gold_sell', goldClosed ? "---" : formatAndPersianize(rawPrices.g_sell + commissions.g_sell));
  update('full_buy', coinClosed ? "---" : formatAndPersianize(rawPrices.f_buy + commissions.f_buy));
  update('full_sell', coinClosed ? "---" : formatAndPersianize(rawPrices.f_sell + commissions.f_sell));
  update('half_buy', coinClosed ? "---" : formatAndPersianize(rawPrices.h_buy + commissions.h_buy));
  update('half_sell', coinClosed ? "---" : formatAndPersianize(rawPrices.h_sell + commissions.h_sell));
  update('quarter_buy', coinClosed ? "---" : formatAndPersianize(rawPrices.q_buy + commissions.q_buy));
  update('quarter_sell', coinClosed ? "---" : formatAndPersianize(rawPrices.q_sell + commissions.q_sell));

  if (priceChanged) playChangeSound();
}

function calculatePassedTime() {
  const timerElement = document.getElementById('update-timer');
  if (!timerElement) return;
  
  if (!firstRealDataReceived || lastUpdateTs === 0) {
    timerElement.innerText = "آخرین بروزرسانی قیمت‌ها: در حال بررسی...";
    return;
  }
  
  const diffSec = Math.floor((Date.now() - lastUpdateTs) / 1000);
  let text = "آخرین بروزرسانی قیمت‌ها: ";
  
  if (diffSec < 1) {
    text += "هم اکنون";
  } else if (diffSec < 60) {
    text += `${formatAndPersianize(diffSec)} ثانیه پیش`;
  } else {
    const minutes = Math.floor(diffSec / 60);
    text += `${formatAndPersianize(minutes)} دقیقه پیش`;
  }
  
  timerElement.innerText = text;
}

function updateClock() {
  const now = new Date();
  let h = now.getHours().toString().padStart(2, '0');
  let m = now.getMinutes().toString().padStart(2, '0');
  let s = now.getSeconds().toString().padStart(2, '0');
  
  const timeEl = document.getElementById('live-time');
  const dateEl = document.getElementById('live-date');
  const netDot = document.getElementById('internet-dot');

  if (timeEl) timeEl.innerText = `${toPersianDigits(h)}:${toPersianDigits(m)}:${toPersianDigits(s)}`;
  if (dateEl) dateEl.innerText = now.toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  if (netDot) {
    netDot.style.backgroundColor = navigator.onLine ? '#2ed573' : '#ff4757';
  }
}

function applySizeToUi(key, val) {
  currentSizes[key] = Math.max(1, Math.min(25, parseFloat((currentSizes[key] + val).toFixed(1))));
  document.documentElement.style.setProperty(`--${key.slice(0,2).toLowerCase()}-${key.slice(2).toLowerCase()}-size`, currentSizes[key] + 'vh');
  const indicator = document.getElementById(`v-${key}`);
  if (indicator) indicator.innerText = currentSizes[key] + ' vh';
}

function initSettingsSystem() {
  const panel = document.getElementById('inline-settings-panel');
  const btnToggle = document.getElementById('btn-toggle-config');
  const btnClose = document.getElementById('btn-close-config');
  const btnSave = document.getElementById('btn-save-config');
  const btnFs = document.getElementById('btn-toggle-fullscreen');

  if (!panel || !btnToggle) return;

  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('cfg-g-buy').value = commissions.g_buy;
    document.getElementById('cfg-g-sell').value = commissions.g_sell;
    document.getElementById('cfg-f-buy').value = commissions.f_buy;
    document.getElementById('cfg-f-sell').value = commissions.f_sell;
    document.getElementById('cfg-h-buy').value = commissions.h_buy;
    document.getElementById('cfg-h-sell').value = commissions.h_sell;
    document.getElementById('cfg-q-buy').value = commissions.q_buy;
    document.getElementById('cfg-q-sell').value = commissions.q_sell;
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => { panel.style.display = 'none'; });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      commissions.g_buy = parseInt(document.getElementById('cfg-g-buy').value) || 0;
      commissions.g_sell = parseInt(document.getElementById('cfg-g-sell').value) || 0;
      commissions.f_buy = parseInt(document.getElementById('cfg-f-buy').value) || 0;
      commissions.f_sell = parseInt(document.getElementById('cfg-f-sell').value) || 0;
      commissions.h_buy = parseInt(document.getElementById('cfg-h-buy').value) || 0;
      commissions.h_sell = parseInt(document.getElementById('cfg-h-sell').value) || 0;
      commissions.q_buy = parseInt(document.getElementById('cfg-q-buy').value) || 0;
      commissions.q_sell = parseInt(document.getElementById('cfg-q-sell').value) || 0;
      
      localStorage.setItem('szp_commissions', JSON.stringify(commissions));
      localStorage.setItem('szp_sizes', JSON.stringify(currentSizes));
      
      panel.style.display = 'none';
      
      const gOverlay = document.getElementById('gold-status-overlay');
      const cOverlay = document.getElementById('coin-status-overlay-1');
      renderCalculatedPrices(
        gOverlay ? gOverlay.style.opacity === "1" : false,
        cOverlay ? cOverlay.style.opacity === "1" : false
      );

      const toast = document.getElementById('toast-notif');
      if (toast) {
        toast.style.opacity = '1'; toast.style.transform = 'translateY(0)';
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; }, 2500);
      }
    });
  }

  const setups = ['lgTitle', 'lgPrice', 'smTitle', 'smPrice'];
  setups.forEach(key => {
    const btnMinus = document.getElementById(`btn-${key}-minus`);
    const btnPlus = document.getElementById(`btn-${key}-plus`);
    if (btnMinus) btnMinus.addEventListener('click', (e) => { e.stopPropagation(); applySizeToUi(key, -0.2); });
    if (btnPlus) btnPlus.addEventListener('click', (e) => { e.stopPropagation(); applySizeToUi(key, 0.2); });
  });

  if (btnFs) {
    btnFs.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    });
  }
}

function loadSavedConfig() {
  const savedComm = localStorage.getItem('szp_commissions');
  if (savedComm) { commissions = JSON.parse(savedComm); }
  const savedSizes = localStorage.getItem('szp_sizes');
  if (savedSizes) { currentSizes = JSON.parse(savedSizes); }
  Object.keys(currentSizes).forEach(k => applySizeToUi(k, 0));
}

document.body.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
}, { once: true });

loadSavedConfig();
connectPusherSocket();
initSettingsSystem();
setInterval(calculatePassedTime, 1000);
setInterval(updateClock, 1000);
updateClock();
