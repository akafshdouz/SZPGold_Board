let currentSizes = { lgTitle: 7.0, lgPrice: 10.5, mqTitle: 6.0, mqPrice: 9.0, smTitle: 3.2, smPrice: 5.0 };

let lastUpdateTs = 0;

let serverConnected = false;

let socket = null;

let pingInterval = null;

let githubConnected = true;



// اضافه شدن مثقال ۱۸ عیار (m_buy و m_sell) به لیست کمیسیون‌ها با مقادیر پیش‌فرض

let commissions = { 

  g_buy: 0,          // طلا سبز: بدون تغییر (0 ریال)

  g_sell: -1500000,  // طلا قرمز: کسر ۱,۵۰۰,۰۰۰ ریال

  m_buy: 0,          // مثقال سبز: بدون تغییر (0 ریال)

  m_sell: -6500000,  // مثقال قرمز: کسر ۶,۵۰۰,۰۰۰ ریال (جدید)

  f_buy: 15000000,   // تمام سبز: اضافه شدن ۱۵,۰۰۰,۰۰۰ ریال

  f_sell: -15000000, // تمام قرمز: کسر ۱۵,۰۰۰,۰۰۰ ریال

  h_buy: 10000000,   // نیم سبز: اضافه شدن ۱۰,۰۰۰,۰۰۰ ریال

  h_sell: -10000000, // نیم قرمز: کسر ۱۰,۰۰۰,۰۰۰ ریال

  q_buy: 10000000,   // ربع سبز: اضافه شدن ۱۰,۰۰۰,۰۰۰ ریال

  q_sell: -10000000  // ربع قرمز: کسر ۱۰,۰۰۰,۰۰۰ ریال

};



// اضافه شدن کلیدهای مثقال به آرایه‌های وضعیت و قیمت خام

let rawPrices = { g_buy: 0, g_sell: 0, m_buy: 0, m_sell: 0, f_buy: 0, f_sell: 0, h_buy: 0, h_sell: 0, q_buy: 0, q_sell: 0 };

let itemStatuses = { g_buy: 1, g_sell: 1, m_buy: 1, m_sell: 1, f_buy: 1, f_sell: 1, h_buy: 1, h_sell: 1, q_buy: 1, q_sell: 1 };



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

  if (num === undefined || num === null || num === '---' || String(num).includes('---')) return '---';

  let val = Math.round(parseFloat(num.toString().replace(/,/g, '')));

  if (isNaN(val)) return '---';

  

  return new Intl.NumberFormat('fa-IR', { useGrouping: true }).format(val);

}



function toPersianDigits(str) {

  const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  return str.replace(/[0-9]/g, d => farsi[parseInt(d)]);

}



setInterval(async () => {

  if (!socket || socket.readyState !== WebSocket.OPEN) {

    serverConnected = false;

    const sDot = document.getElementById('server-dot');

    if (sDot) sDot.style.backgroundColor = '#ff4757';

  }



  try {

    const response = await fetch('index.html', { cache: 'no-store', method: 'HEAD' });

    githubConnected = response.ok;

  } catch (e) {

    githubConnected = false;

  }



  const ghDot = document.getElementById('github-dot');

  if (ghDot) {

    ghDot.style.backgroundColor = githubConnected ? '#2ed573' : '#ff4757';

    ghDot.style.boxShadow = githubConnected ? '0 0 14px #2ed573' : '0 0 14px #ff4757';

  }



  const gOverlay = document.getElementById('gold-status-overlay');

  const cOverlay = document.getElementById('coin-status-overlay-1');

  renderCalculatedPrices(

    gOverlay ? gOverlay.style.opacity === "1" : false,

    cOverlay ? cOverlay.style.opacity === "1" : false

  );

  calculatePassedTime();

}, 5000); 



function connectPusherSocket() {

  if (pingInterval) {

    clearTimeout(pingInterval);

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

    

    const setupFixedPing = () => {

      const fixedDelay = 30000; // تنظیم پینگ روی ۳۰ ثانیه ثابت

      pingInterval = setTimeout(() => {

        if (socket && socket.readyState === WebSocket.OPEN) {

          socket.send(JSON.stringify({"event": "pusher:ping", "data": {}}));

          setupFixedPing();

        }

      }, fixedDelay);

    };

    setupFixedPing();

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



            let b_stat = item.buy_status !== undefined ? item.buy_status : 1;

            let s_stat = item.sell_status !== undefined ? item.sell_status : 1;



            const updateRaw = (keyBuy, keySell, bVal, sVal, currentBuyStatus, currentSellStatus) => {

              let buyRound = Math.ceil(bVal / 1000.0) * 1000;

              let sellRound = Math.floor(sVal / 1000.0) * 1000;

              

              if (rawPrices[keyBuy] !== buyRound || rawPrices[keySell] !== sellRound || 

                  itemStatuses[keyBuy] !== currentBuyStatus || itemStatuses[keySell] !== currentSellStatus) {

                

                rawPrices[keyBuy] = buyRound;

                rawPrices[keySell] = sellRound;

                itemStatuses[keyBuy] = currentBuyStatus;

                itemStatuses[keySell] = currentSellStatus;

                priceChanged = true;

              }

            };



            if ((item.title || "").includes("آبشده نقد") && (item.title || "").includes("24")) {

              // ۱. محاسبه گرم ۱۸ عیار

              updateRaw('g_buy', 'g_sell', p_sell / 4.3318, p_buy / 4.3318, b_stat, s_stat);

              // ۲. محاسبه مثقال ۱۸ عیار (مستقیماً از قیمت آبشده ۲۴ بدون تقسیم)

              updateRaw('m_buy', 'm_sell', p_sell, p_buy, b_stat, s_stat);

            } else if (title.includes("تمامامامی86")) {

              updateRaw('f_buy', 'f_sell', p_sell, p_buy, b_stat, s_stat);

            } else if (title.includes("نیمسکه86")) {

              updateRaw('h_buy', 'h_sell', p_sell, p_buy, b_stat, s_stat);

            } else if (title.includes("ربعسکه86")) {

              updateRaw('q_buy', 'q_sell', p_sell, p_buy, b_stat, s_stat);

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

  const overlays = ['gold-status-overlay', 'mithqal-status-overlay'];

  overlays.forEach(id => {

    const el = document.getElementById(id);

    if (el) {

      el.style.opacity = goldClosed ? "1" : "0";

      el.style.pointerEvents = goldClosed ? "auto" : "none";

    }

  });



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



  const isAnyNetworkDown = !navigator.onLine || !serverConnected;



  const getFinalPrice = (rawPrice, commission, isClosed, itemStatus) => {

    if (isAnyNetworkDown || isClosed || itemStatus !== 1 || !firstRealDataReceived || rawPrice === 0) {

      return "---";

    }

    return formatAndPersianize(rawPrice + commission);

  };



  // گرم ۱۸ عیار

  update('gold_buy', getFinalPrice(rawPrices.g_buy, commissions.g_buy, goldClosed, itemStatuses.g_buy));

  update('gold_sell', getFinalPrice(rawPrices.g_sell, commissions.g_sell, goldClosed, itemStatuses.g_sell));



  // مثقال ۱۸ عیار (جدید)

  update('mithqal_buy', getFinalPrice(rawPrices.m_buy, commissions.m_buy, goldClosed, itemStatuses.m_buy));

  update('mithqal_sell', getFinalPrice(rawPrices.m_sell, commissions.m_sell, goldClosed, itemStatuses.m_sell));



  // سکه تمام امامی

  update('full_buy', getFinalPrice(rawPrices.f_buy, commissions.f_buy, coinClosed, itemStatuses.f_buy));

  update('full_sell', getFinalPrice(rawPrices.f_sell, commissions.f_sell, coinClosed, itemStatuses.f_sell));



  // نیم سکه امامی

  update('half_buy', getFinalPrice(rawPrices.h_buy, commissions.h_buy, coinClosed, itemStatuses.h_buy));

  update('half_sell', getFinalPrice(rawPrices.h_sell, commissions.h_sell, coinClosed, itemStatuses.h_sell));



  // ربع سکه امامی

  update('quarter_buy', getFinalPrice(rawPrices.q_buy, commissions.q_buy, coinClosed, itemStatuses.q_buy));

  update('quarter_sell', getFinalPrice(rawPrices.q_sell, commissions.q_sell, coinClosed, itemStatuses.q_sell));



  if (priceChanged) playChangeSound();

}



function calculatePassedTime() {

  const timerElement = document.getElementById('update-timer');

  if (!timerElement) return;

  

  if (!navigator.onLine) {

    timerElement.innerHTML = `آخرین بروزرسانی قیمت‌ها: <span style="color: #ff471a !important; text-shadow: 0 0 10px rgba(255, 71, 26, 0.5);">قطعی اینترنت</span>`;

    return;

  }

  

  if (!serverConnected || !socket || socket.readyState !== WebSocket.OPEN) {

    timerElement.innerHTML = `آخرین بروزرسانی قیمت‌ها: <span style="color: #ff471a !important; text-shadow: 0 0 10px rgba(255, 71, 26, 0.5);">قطعی سرور سوکت</span>`;

    return;

  }

  

  if (!firstRealDataReceived || lastUpdateTs === 0) {

    timerElement.innerHTML = `آخرین بروزرسانی قیمت‌ها: <span id="timer-status-text" style="color: #dfb76c;">در حال بررسی...</span>`;

    return;

  }

  

  const diffSec = Math.floor((Date.now() - lastUpdateTs) / 1000);

  let timeText = "";

  

  if (diffSec < 1) {

    timeText = "هم اکنون";

  } else if (diffSec < 60) {

    timeText = `${formatAndPersianize(diffSec)} ثانیه پیش`;

  } else {

    const minutes = Math.floor(diffSec / 60);

    timeText = `${formatAndPersianize(minutes)} دقیقه پیش`;

  }

  

  timerElement.innerHTML = `آخرین بروزرسانی قیمت‌ها: <span style="color: #dfb76c;">${timeText}</span>`;

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

  

  // تبدیل نام‌ها به فرمت استاندارد استایل

  let cssKey = '';

  if (key === 'lgTitle') cssKey = '--lg-title-size';

  if (key === 'lgPrice') cssKey = '--lg-price-size';

  if (key === 'mqTitle') cssKey = '--mq-title-size';

  if (key === 'mqPrice') cssKey = '--mq-price-size';

  if (key === 'smTitle') cssKey = '--sm-title-size';

  if (key === 'smPrice') cssKey = '--sm-price-size';

  

  document.documentElement.style.setProperty(cssKey, currentSizes[key] + 'vh');

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

    document.getElementById('cfg-m-buy').value = commissions.m_buy; // جدید

    document.getElementById('cfg-m-sell').value = commissions.m_sell; // جدید

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

      commissions.m_buy = parseInt(document.getElementById('cfg-m-buy').value) || 0; // جدید

      commissions.m_sell = parseInt(document.getElementById('cfg-m-sell').value) || 0; // جدید

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



  const setups = ['lgTitle', 'lgPrice', 'mqTitle', 'mqPrice', 'smTitle', 'smPrice'];

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

  

  if (savedComm) { 

    const parsedComm = JSON.parse(savedComm);

    

    // لایه ضد کش کروم با پشتیبانی از فیلدهای جدید مثقال

    if (parsedComm.g_sell === 0 || parsedComm.f_buy === 0 || parsedComm.m_sell === undefined) {

      localStorage.setItem('szp_commissions', JSON.stringify(commissions));

      console.log("🛠️ کش دیتای صفر کروم پاکسازی و به همراه ساختار مثقال نوسازی شد.");

    } else {

      commissions = parsedComm; 

    }

  } else {

    localStorage.setItem('szp_commissions', JSON.stringify(commissions));

  }

  

  const savedSizes = localStorage.getItem('szp_sizes');

  if (savedSizes) { 

    currentSizes = JSON.parse(savedSizes); 

  } else {

    localStorage.setItem('szp_sizes', JSON.stringify(currentSizes));

  }

  Object.keys(currentSizes).forEach(k => applySizeToUi(k, 0));

}



loadSavedConfig();

initSettingsSystem();



renderCalculatedPrices(false, false);



connectPusherSocket();

setInterval(calculatePassedTime, 1000);

setInterval(updateClock, 1000);

updateClock();
