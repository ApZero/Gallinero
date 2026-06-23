/* =========================================================
   Gallinero — lógica de la aplicación
   Todo el dato vive en localStorage. El clima usa Open-Meteo
   (gratuito, sin API key) para Filadelfia, Chaco, Paraguay.
   ========================================================= */

const STORAGE_KEY = 'gallinero_v2';
const LAT = -22.3666, LON = -60.0333; // Filadelfia, Boquerón, Paraguay

const WEEKDAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const WEEKDAYS_LONG  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const EVENT_TYPES = {
  'Limpieza': '🧹',
  'Mantenimiento': '🛠️',
  'Sanidad': '💉',
  'Plagas/Depredadores': '🐍',
  'Otro': '📝'
};

const GENERAL_TIPS = [
  {icon:'💧', text:'Limpiá los bebederos cada 2-3 días para evitar algas y bacterias.'},
  {icon:'🥚', text:'Una cama de nidal limpia y seca ayuda a evitar huevos sucios o rotos.'},
  {icon:'🪱', text:'Conviene desparasitar al plantel aproximadamente cada 3 meses.'},
  {icon:'🌿', text:'El exceso de maíz engorda sin aportar mucha proteína: cuidá el balance de la dieta.'},
  {icon:'🦟', text:'Evitá el agua estancada cerca del gallinero, atrae mosquitos y enfermedades.'},
  {icon:'🐣', text:'Si llegan pollitas nuevas, mantenelas separadas del plantel adulto las primeras semanas.'},
  {icon:'🧹', text:'Renovar la cama del gallinero cada 1-2 semanas ayuda a controlar el olor y los parásitos.'},
  {icon:'🥗', text:'Las cáscaras de huevo trituradas son una buena fuente extra de calcio para ellas mismas.'},
];

let state = loadState();
let huevosMonth = isoDate(new Date()).slice(0,7); // 'YYYY-MM'
let editingChickenId = null;

/* ---------------- Estado / almacenamiento ---------------- */
function defaultState(){
  return {
    eggs:{},
    purchases:[],
    chickens:[],
    temps:{},
    events:[],
    settings:{eggPrice:0, dozenPrice:0, moneda:'Gs.'},
    weatherCache:null
  };
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){ return defaultState(); }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- Utilidades ---------------- */
function isoDate(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function weekdayShort(d){ return WEEKDAYS_SHORT[d.getDay()]; }
function fullDateLabel(d){ return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`; }
function monthLabel(ym){ const [y,m]=ym.split('-').map(Number); return `${MONTHS[m-1]} ${y}`; }
function daysInMonth(ym){ const [y,m]=ym.split('-').map(Number); return new Date(y,m,0).getDate(); }
function last6Months(){
  const arr=[]; const now=new Date();
  for(let i=5;i>=0;i--){ const dt=new Date(now.getFullYear(), now.getMonth()-i, 1); arr.push(isoDate(dt).slice(0,7)); }
  return arr;
}
function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function fmtGs(n){
  n = Math.round(n||0);
  const neg = n<0; n = Math.abs(n);
  const str = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg?'-':'') + str;
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), 2200);
}
function generalTip(){
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(),0,0)) / 86400000);
  return GENERAL_TIPS[doy % GENERAL_TIPS.length];
}

/* ---------------- Estadísticas ---------------- */
function eggStats(){
  const today = isoDate(new Date());
  const now = new Date();
  const ym = today.slice(0,7), y = today.slice(0,4);
  let monthTotal=0, yearTotal=0, allTotal=0, best=0, bestDate=null;
  for(const [date,count] of Object.entries(state.eggs)){
    allTotal += count;
    if(count>best){ best=count; bestDate=date; }
    if(date.slice(0,7)===ym) monthTotal += count;
    if(date.slice(0,4)===y) yearTotal += count;
  }
  const daysInMonthSoFar = now.getDate();
  const dayOfYearSoFar = Math.ceil((now - new Date(now.getFullYear(),0,0)) / 86400000);
  return {
    today: state.eggs[today]||0,
    monthTotal, monthAvg: daysInMonthSoFar ? +(monthTotal/daysInMonthSoFar).toFixed(1) : 0,
    yearTotal, yearAvg: dayOfYearSoFar ? +(yearTotal/dayOfYearSoFar).toFixed(1) : 0,
    allTotal, best, bestDate
  };
}
function foodStats(){
  const today = isoDate(new Date());
  const ym = today.slice(0,7), y = today.slice(0,4);
  let monthTotal=0, yearTotal=0, allTotal=0;
  for(const p of state.purchases){
    allTotal += p.total;
    if(p.date.slice(0,7)===ym) monthTotal += p.total;
    if(p.date.slice(0,4)===y) yearTotal += p.total;
  }
  return {monthTotal, yearTotal, allTotal};
}
function pricePerEgg(){
  const s = state.settings;
  if(s.dozenPrice && s.dozenPrice>0) return s.dozenPrice/12;
  return s.eggPrice||0;
}
function savings(){
  const e = eggStats(), f = foodStats(), pe = pricePerEgg();
  const valorAll=e.allTotal*pe, valorMonth=e.monthTotal*pe, valorYear=e.yearTotal*pe;
  return {
    all: valorAll-f.allTotal, allValor: valorAll, allCosto: f.allTotal,
    month: valorMonth-f.monthTotal, monthValor: valorMonth, monthCosto: f.monthTotal,
    year: valorYear-f.yearTotal, yearValor: valorYear, yearCosto: f.yearTotal,
    pricePerEgg: pe
  };
}

/* ---------------- Clima (Open-Meteo) ---------------- */
function wmoInfo(code){
  const map = {
    0:['☀️','Despejado'],1:['🌤️','Mayormente despejado'],2:['⛅','Parcialmente nublado'],3:['☁️','Nublado'],
    45:['🌫️','Niebla'],48:['🌫️','Niebla escarchada'],
    51:['🌦️','Llovizna débil'],53:['🌦️','Llovizna'],55:['🌦️','Llovizna intensa'],
    56:['🌧️','Llovizna helada'],57:['🌧️','Llovizna helada intensa'],
    61:['🌧️','Lluvia débil'],63:['🌧️','Lluvia'],65:['🌧️','Lluvia intensa'],
    66:['🌧️','Lluvia helada'],67:['🌧️','Lluvia helada intensa'],
    71:['🌨️','Nieve débil'],73:['🌨️','Nieve'],75:['🌨️','Nieve intensa'],77:['🌨️','Granos de nieve'],
    80:['🌦️','Chubascos débiles'],81:['🌧️','Chubascos'],82:['⛈️','Chubascos fuertes'],
    85:['🌨️','Chubascos de nieve débiles'],86:['🌨️','Chubascos de nieve'],
    95:['⛈️','Tormenta'],96:['⛈️','Tormenta con granizo'],99:['⛈️','Tormenta fuerte con granizo']
  };
  return map[code] || ['🌡️','Sin datos'];
}
function buildTips(w){
  const tips=[];
  if(!w || !w.daily) return [generalTip()];
  const tmax = w.daily.temperature_2m_max[0];
  const tmin = w.daily.temperature_2m_min[0];
  const pprob = w.daily.precipitation_probability_max ? w.daily.precipitation_probability_max[0] : 0;
  if(tmax>=38) tips.push({alerta:true, icon:'🥵', text:`Calor extremo hoy (máx. ${Math.round(tmax)}°C): sombra abundante, agua fresca renovada varias veces al día y evitá el manejo en horas pico.`});
  else if(tmax>=33) tips.push({alerta:false, icon:'☀️', text:`Calor fuerte (máx. ${Math.round(tmax)}°C): asegurá agua fresca y sombra disponible todo el día.`});
  if(pprob>=60) tips.push({alerta:false, icon:'🌧️', text:'Buena probabilidad de lluvia: revisá el drenaje del gallinero y mantené la cama seca para evitar hongos y parásitos.'});
  if(tmin<=8) tips.push({alerta:false, icon:'❄️', text:`Madrugada fría (mín. ${Math.round(tmin)}°C): cerrá bien el gallinero por la noche para conservar el calor.`});
  if(tips.length===0) tips.push(generalTip());
  return tips;
}
async function fetchWeather(force){
  const cache = state.weatherCache;
  const now = Date.now();
  if(!force && cache && (now-cache.fetchedAt) < 1000*60*60*3) return cache;
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=America%2FAsuncion&forecast_days=7`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('respuesta no válida');
    const data = await res.json();
    const fresh = {fetchedAt: now, current: data.current, daily: data.daily};
    state.weatherCache = fresh;
    saveState();
    return fresh;
  }catch(e){
    return cache || null;
  }
}

/* ---------------- Temperaturas diarias (mín./máx.) ---------------- */
// Usa el pronóstico ya descargado para hoy/próximos días, y la API histórica
// de Open-Meteo (gratuita, sin API key) para completar días pasados que
// tengan huevos registrados pero todavía no tengan temperatura guardada.
async function backfillTemps(){
  const today = isoDate(new Date());

  const w = state.weatherCache;
  if(w && w.daily && w.daily.time){
    w.daily.time.forEach((dateStr,i)=>{
      const tmax = w.daily.temperature_2m_max[i], tmin = w.daily.temperature_2m_min[i];
      if(tmax==null || tmin==null) return;
      const ex = state.temps[dateStr];
      if(!ex || ex.source==='forecast') state.temps[dateStr] = {min:tmin, max:tmax, source:'forecast'};
    });
    saveState();
  }

  const eggDates = Object.keys(state.eggs);
  const needing = eggDates.filter(d=>{
    if(d>=today) return false;
    const ex = state.temps[d];
    return !ex || ex.source==='forecast';
  });
  if(!needing.length) return;
  const minDate = needing.reduce((a,b)=> a<b?a:b);
  const maxDate = needing.reduce((a,b)=> a>b?a:b);
  try{
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${minDate}&end_date=${maxDate}&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FAsuncion`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('respuesta no válida');
    const data = await res.json();
    if(data.daily && data.daily.time){
      data.daily.time.forEach((dateStr,i)=>{
        const tmax = data.daily.temperature_2m_max[i], tmin = data.daily.temperature_2m_min[i];
        if(tmax==null || tmin==null) return;
        const ex = state.temps[dateStr];
        if(!ex || ex.source!=='manual') state.temps[dateStr] = {min:tmin, max:tmax, source:'archive'};
      });
      saveState();
    }
  }catch(e){ /* sin conexión: se reintenta en la próxima carga */ }
}
function eggTempCorrelation(){
  const pairs = [];
  for(const [date,count] of Object.entries(state.eggs)){
    const t = state.temps[date];
    if(t && typeof t.max === 'number') pairs.push([count, t.max]);
  }
  const n = pairs.length;
  if(n < 8) return {n, r:null};
  const xs = pairs.map(p=>p[0]), ys = pairs.map(p=>p[1]);
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for(let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
  const denom = Math.sqrt(dx2*dy2);
  const r = denom ? num/denom : 0;
  return {n, r: +r.toFixed(2)};
}
function interpretCorr(r){
  const a = Math.abs(r);
  let fuerza = 'muy débil o nula';
  if(a>=0.8) fuerza='muy fuerte';
  else if(a>=0.6) fuerza='fuerte';
  else if(a>=0.4) fuerza='moderada';
  else if(a>=0.2) fuerza='débil';
  if(a<0.2) return `Relación ${fuerza} entre temperatura máxima y huevos puestos.`;
  const sentido = r>0 ? 'más calor coincide con más huevos' : 'más calor coincide con menos huevos';
  return `Relación ${fuerza} (${sentido}).`;
}
function tempChartSvg(ym, totalDays){
  const pts=[];
  for(let d=1; d<=totalDays; d++) pts.push(state.temps[`${ym}-${String(d).padStart(2,'0')}`] || null);
  const have = pts.filter(Boolean);
  if(!have.length){
    return `<div class="muted temp-empty">Sin datos de temperatura para este mes. <button class="btn-ghost" data-action="temps-refresh">Buscar</button></div>`;
  }
  let lo = Math.min(...have.map(p=>p.min)), hi = Math.max(...have.map(p=>p.max));
  if(hi===lo){ hi+=1; lo-=1; }
  const W=300,H=64,pad=4;
  const stepX = pts.length>1 ? (W-2*pad)/(pts.length-1) : 0;
  const y = v => (H-pad) - ((v-lo)/(hi-lo))*(H-2*pad);
  let maxPath='', minPath='';
  pts.forEach((p,i)=>{
    if(!p) return;
    const x = (pad + i*stepX).toFixed(1);
    maxPath += (maxPath?' L':'M') + x + ',' + y(p.max).toFixed(1);
    minPath += (minPath?' L':'M') + x + ',' + y(p.min).toFixed(1);
  });
  return `
    <div class="temp-chart">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <path d="${maxPath}" fill="none" stroke="var(--quebracho)" stroke-width="2"/>
        <path d="${minPath}" fill="none" stroke="var(--algarrobo)" stroke-width="2" stroke-dasharray="3,2"/>
      </svg>
      <div class="temp-legend">
        <span class="lg"><i class="sw max"></i>máx.</span>
        <span class="lg"><i class="sw min"></i>mín.</span>
        <span class="muted">${Math.round(lo)}°–${Math.round(hi)}°C</span>
      </div>
    </div>`;
}

/* ---------------- Render: Inicio ---------------- */
function renderInicio(){
  const e = eggStats();
  const sv = savings();
  document.getElementById('view-inicio').innerHTML = `
    <div class="card today-block">
      <div class="today-date">${fullDateLabel(new Date())}</div>
      <div class="counter-row">
        <button class="counter-btn" data-action="egg-dec">−</button>
        <div class="counter-num">${e.today}</div>
        <button class="counter-btn plus" data-action="egg-inc">+</button>
      </div>
      <div class="counter-label">huevos de hoy</div>
    </div>

    <div class="card">
      <h2 class="section-title">Producción</h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${e.monthAvg}</div><div class="l">Prom./día (mes)</div></div>
        <div class="stat"><div class="v">${e.yearAvg}</div><div class="l">Prom./día (año)</div></div>
        <div class="stat"><div class="v">${e.allTotal}</div><div class="l">Total histórico</div></div>
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">Ahorro acumulado</h2>
      <div class="savings-amount ${sv.all<0?'negativo':''}">${state.settings.moneda} ${fmtGs(sv.all)}</div>
      <div class="savings-breakdown">
        Valor de huevos producidos: ${state.settings.moneda} ${fmtGs(sv.allValor)}<br>
        − Gasto en comida: ${state.settings.moneda} ${fmtGs(sv.allCosto)}
      </div>
      ${sv.pricePerEgg ? '' : '<p class="muted" style="margin-top:8px;">Definí un precio en Ajustes para calcular el ahorro real.</p>'}
    </div>

    ${renderWeatherMini()}
  `;
}
function renderWeatherMini(){
  const w = state.weatherCache;
  if(!w){
    return `<div class="card"><h2 class="section-title">Clima</h2><p class="muted">Buscando el pronóstico de Filadelfia…</p></div>`;
  }
  const [icon, desc] = wmoInfo(w.current.weather_code);
  const tip = buildTips(w)[0];
  return `
    <div class="card">
      <h2 class="section-title">Clima ahora</h2>
      <div class="weather-now">
        <span class="weather-icon">${icon}</span>
        <div>
          <div class="weather-temp">${Math.round(w.current.temperature_2m)}°C</div>
          <div class="muted">${desc} · Humedad ${w.current.relative_humidity_2m}%</div>
        </div>
      </div>
      <hr class="dash">
      <div class="tip ${tip.alerta?'alerta':''}"><span class="ico">${tip.icon}</span><span>${tip.text}</span></div>
    </div>
  `;
}

/* ---------------- Render: Huevos ---------------- */
function renderHuevos(){
  const totalDays = daysInMonth(huevosMonth);
  const isCurrentMonth = huevosMonth === isoDate(new Date()).slice(0,7);
  const divisor = isCurrentMonth ? new Date().getDate() : totalDays;
  let monthSum=0, maxVal=1;
  const dayVals=[];
  for(let d=1; d<=totalDays; d++){
    const ds = `${huevosMonth}-${String(d).padStart(2,'0')}`;
    const v = state.eggs[ds]||0;
    dayVals.push(v); monthSum+=v; if(v>maxVal) maxVal=v;
  }
  const viewedAvg = divisor ? +(monthSum/divisor).toFixed(1) : 0;
  const bars = dayVals.map((v,i)=>{
    const h = Math.round((v/maxVal)*100);
    const dayNum = i+1;
    const ds = `${huevosMonth}-${String(dayNum).padStart(2,'0')}`;
    const hasEvent = state.events.some(ev=>ev.date===ds);
    const showLabel = (dayNum===1 || dayNum===totalDays || dayNum%5===0);
    return `<div class="bar-col"><div class="bar" style="height:${Math.max(h,2)}%"></div><div class="bar-label">${showLabel?dayNum:'&nbsp;'}</div>${hasEvent?'<div class="bar-dot" title="Hay un evento registrado este día"></div>':''}</div>`;
  }).join('');

  const todayIso = isoDate(new Date());
  const todayTemp = state.temps[todayIso];

  const corr = eggTempCorrelation();
  const corrHtml = corr.r===null
    ? `<p class="muted">Todavía no hay suficientes días con huevos y temperatura guardados (mínimo 8) para calcular una relación confiable. Se va completando solo a medida que registrás huevos.</p>`
    : `<div class="corr-value">r = ${corr.r}</div><p class="muted">${interpretCorr(corr.r)} Calculado sobre ${corr.n} días con datos de huevos y temperatura máxima.</p>`;

  const recent = Object.entries(state.eggs).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
  const listHtml = recent.length ? recent.map(([date,count])=>{
    const d = new Date(date+'T12:00:00');
    const t = state.temps[date];
    const tempPill = t ? `<span class="meta">${Math.round(t.min)}°↔${Math.round(t.max)}°</span>` : '';
    const dayEvents = state.events.filter(ev=>ev.date===date);
    const evIcons = dayEvents.length ? ' '+dayEvents.map(ev=>EVENT_TYPES[ev.tipo]||'📝').join('') : '';
    return `<div class="list-row">
      <span>${weekdayShort(d)} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}${evIcons}<br>${tempPill}</span>
      <span class="right">${count} 🥚 <button class="del-btn" data-action="egg-delete" data-date="${date}">✕</button></span>
    </div>`;
  }).join('') : `<div class="empty">Todavía no registraste huevos.</div>`;

  document.getElementById('view-huevos').innerHTML = `
    <h2 class="section-title">Registrar huevos</h2>
    <div class="card">
      <label>Fecha</label>
      <input type="date" id="eggDate" value="${todayIso}" max="${todayIso}">
      <label>Cantidad de huevos</label>
      <input type="number" id="eggCount" min="0" step="1" placeholder="0">
      <div class="grid-2">
        <div><label>Temp. mínima (°C)</label><input type="number" id="eggTempMin" step="0.1" placeholder="auto" value="${todayTemp?todayTemp.min:''}"></div>
        <div><label>Temp. máxima (°C)</label><input type="number" id="eggTempMax" step="0.1" placeholder="auto" value="${todayTemp?todayTemp.max:''}"></div>
      </div>
      <p class="muted" style="margin-top:6px;">Las temperaturas se completan solas con el pronóstico/histórico de Filadelfia. Dejalas vacías para mantener el valor automático, o corregilas si tenés un dato más preciso.</p>
      <button class="btn" data-action="egg-set">Guardar</button>
    </div>

    <div class="card">
      <div class="card-row">
        <h2 class="section-title" style="margin-bottom:0">${monthLabel(huevosMonth)}</h2>
        <div class="btn-row" style="margin-top:0">
          <button class="btn-ghost" data-action="huevos-prev-month">‹</button>
          <button class="btn-ghost" data-action="huevos-next-month">›</button>
        </div>
      </div>
      <div class="bars">${bars}</div>
      <div class="muted">Total del mes: ${monthSum} huevos · Promedio diario: ${viewedAvg}</div>
      <hr class="dash">
      ${tempChartSvg(huevosMonth, totalDays)}
    </div>

    <div class="card">
      <h2 class="section-title">Huevos y temperatura</h2>
      ${corrHtml}
    </div>

    <div class="card">
      <h2 class="section-title">Historial reciente</h2>
      ${listHtml}
    </div>
  `;
}

/* ---------------- Render: Comida ---------------- */
function renderComida(){
  const f = foodStats();
  const sorted = [...state.purchases].sort((a,b)=>b.date.localeCompare(a.date));
  const listHtml = sorted.length ? sorted.map(p=>{
    const d = new Date(p.date+'T12:00:00');
    return `<div class="list-row">
      <span>${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} · ${escapeHtml(p.tipo)}<br><span class="meta">${p.cantidad} ${escapeHtml(p.unidad)}</span></span>
      <span class="right">${state.settings.moneda} ${fmtGs(p.total)}<br><button class="del-btn" data-action="purchase-delete" data-id="${p.id}">✕ quitar</button></span>
    </div>`;
  }).join('') : `<div class="empty">Todavía no registraste compras de comida.</div>`;

  const months = last6Months();
  let maxC=1;
  const vals = months.map(ym=>{
    const t = state.purchases.filter(p=>p.date.slice(0,7)===ym).reduce((s,p)=>s+p.total,0);
    if(t>maxC) maxC=t;
    return t;
  });
  const bars = months.map((ym,i)=>{
    const h = Math.round((vals[i]/maxC)*100);
    const m = Number(ym.split('-')[1]);
    return `<div class="bar-col"><div class="bar" style="height:${Math.max(h,2)}%;background:var(--algarrobo)"></div><div class="bar-label">${MONTHS[m-1].slice(0,3)}</div></div>`;
  }).join('');

  document.getElementById('view-comida').innerHTML = `
    <h2 class="section-title">Registrar compra de comida</h2>
    <div class="card">
      <label>Fecha</label>
      <input type="date" id="purchaseDate" value="${isoDate(new Date())}" max="${isoDate(new Date())}">
      <label>Tipo de alimento</label>
      <input type="text" id="purchaseTipo" list="tiposComida" placeholder="Balanceado, maíz, afrechillo...">
      <datalist id="tiposComida">
        <option value="Balanceado / concentrado">
        <option value="Maíz">
        <option value="Afrechillo">
        <option value="Conchilla / calcio">
        <option value="Vitaminas">
        <option value="Otro">
      </datalist>
      <div class="grid-2">
        <div><label>Cantidad</label><input type="number" id="purchaseCantidad" min="0" step="0.1" placeholder="0"></div>
        <div><label>Unidad</label>
          <select id="purchaseUnidad">
            <option value="kg">kg</option>
            <option value="bolsa">bolsa</option>
            <option value="otro">otro</option>
          </select>
        </div>
      </div>
      <label>Precio total pagado</label>
      <input type="number" id="purchaseTotal" min="0" step="100" placeholder="0">
      <button class="btn" data-action="purchase-add">Guardar compra</button>
    </div>

    <div class="card">
      <h2 class="section-title">Gasto en comida</h2>
      <div class="stat-grid">
        <div class="stat"><div class="v">${fmtGs(f.monthTotal)}</div><div class="l">${state.settings.moneda} este mes</div></div>
        <div class="stat"><div class="v">${fmtGs(f.yearTotal)}</div><div class="l">${state.settings.moneda} este año</div></div>
        <div class="stat"><div class="v">${fmtGs(f.allTotal)}</div><div class="l">${state.settings.moneda} total</div></div>
      </div>
      <div class="bars" style="margin-top:14px;">${bars}</div>
      <div class="muted">Gasto mensual, últimos 6 meses</div>
    </div>

    <div class="card">
      <h2 class="section-title">Historial de compras</h2>
      ${listHtml}
    </div>
  `;
}

/* ---------------- Render: Gallinas ---------------- */
function renderGallinas(){
  const editing = editingChickenId ? state.chickens.find(c=>c.id===editingChickenId) : null;
  const cardsHtml = state.chickens.length ? state.chickens.map(c=>{
    const fecha = c.fecha ? new Date(c.fecha+'T12:00:00').toLocaleDateString('es-PY') : '—';
    return `<div class="chicken-card">
      <div class="chicken-head">
        <div>
          <div class="chicken-name">${escapeHtml(c.nombre)}</div>
          <div class="chicken-meta">${escapeHtml(c.raza||'Raza no especificada')} · desde ${fecha}</div>
        </div>
        <span class="badge ${c.estado==='Retirada'?'pausa':''}">${escapeHtml(c.estado||'Poniendo')}</span>
      </div>
      ${c.notas ? `<div class="chicken-notes">${escapeHtml(c.notas)}</div>` : ''}
      <div class="btn-row">
        <button class="btn secundario" data-action="chicken-edit" data-id="${c.id}">Editar</button>
        <button class="btn peligro" data-action="chicken-delete" data-id="${c.id}">Eliminar</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty">Todavía no agregaste gallinas.</div>`;

  document.getElementById('view-gallinas').innerHTML = `
    <h2 class="section-title">${editing?'Editar gallina':'Agregar gallina'}</h2>
    <div class="card">
      <label>Nombre</label>
      <input type="text" id="chickenNombre" placeholder="Ej: Pinta" value="${editing?escapeHtml(editing.nombre):''}">
      <label>Raza</label>
      <input type="text" id="chickenRaza" placeholder="Ej: Criolla, Rhode Island..." value="${editing?escapeHtml(editing.raza||''):''}">
      <label>Fecha en que la conseguiste</label>
      <input type="date" id="chickenFecha" value="${editing?(editing.fecha||''):''}" max="${isoDate(new Date())}">
      <label>Estado</label>
      <select id="chickenEstado">
        ${['Poniendo','Cluequa/Criando','Pollita/Joven','Retirada'].map(op=>`<option ${editing&&editing.estado===op?'selected':''}>${op}</option>`).join('')}
      </select>
      <label>Notas</label>
      <textarea id="chickenNotas" rows="2" placeholder="Color, personalidad, vacunas...">${editing?escapeHtml(editing.notas||''):''}</textarea>
      <div class="btn-row">
        <button class="btn" data-action="chicken-save">${editing?'Guardar cambios':'Agregar gallina'}</button>
        ${editing?'<button class="btn secundario" data-action="chicken-cancel">Cancelar</button>':''}
      </div>
    </div>

    <h2 class="section-title">Tu plantel <span class="n">${state.chickens.length}</span></h2>
    ${cardsHtml}
  `;
}

/* ---------------- Render: Eventos ---------------- */
function renderEventos(){
  const sorted = [...state.events].sort((a,b)=>b.date.localeCompare(a.date));
  const listHtml = sorted.length ? sorted.map(ev=>{
    const d = new Date(ev.date+'T12:00:00');
    return `<div class="event-card">
      <div class="event-head">
        <span class="event-icon">${EVENT_TYPES[ev.tipo]||'📝'}</span>
        <div class="event-info">
          <div class="event-tipo">${escapeHtml(ev.tipo)}</div>
          <div class="event-fecha">${weekdayShort(d)} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</div>
        </div>
        <button class="del-btn" data-action="event-delete" data-id="${ev.id}">✕</button>
      </div>
      ${ev.nota ? `<div class="event-nota">${escapeHtml(ev.nota)}</div>` : ''}
    </div>`;
  }).join('') : `<div class="empty">Todavía no registraste eventos.</div>`;

  document.getElementById('view-eventos').innerHTML = `
    <h2 class="section-title">Registrar evento</h2>
    <div class="card">
      <label>Fecha</label>
      <input type="date" id="eventDate" value="${isoDate(new Date())}" max="${isoDate(new Date())}">
      <label>Tipo</label>
      <select id="eventTipo">
        ${Object.keys(EVENT_TYPES).map(t=>`<option>${escapeHtml(t)}</option>`).join('')}
      </select>
      <label>Nota</label>
      <textarea id="eventNota" rows="2" placeholder="Ej: limpieza general y cambio de cama. Puse cebo para serpientes en la esquina sur..."></textarea>
      <button class="btn" data-action="event-add">Guardar evento</button>
    </div>

    <h2 class="section-title">Bitácora <span class="n">${state.events.length}</span></h2>
    ${listHtml}
  `;
}

/* ---------------- Render: Clima ---------------- */
function renderClima(){
  const w = state.weatherCache;
  const container = document.getElementById('view-clima');
  if(!w){
    container.innerHTML = `
      <h2 class="section-title">Clima · Filadelfia</h2>
      <div class="card empty">
        No hay datos de clima todavía.<br><br>
        <button class="btn" data-action="weather-refresh">Buscar pronóstico</button>
      </div>`;
    return;
  }
  const [icon, desc] = wmoInfo(w.current.weather_code);
  const updated = new Date(w.fetchedAt);
  const tips = buildTips(w).concat([generalTip()]);
  const days = w.daily.time.map((dateStr, i)=>{
    const [ic] = wmoInfo(w.daily.weather_code[i]);
    const d = new Date(dateStr+'T12:00:00');
    return `<div class="fday">
      <div class="d">${i===0?'Hoy':weekdayShort(d)}</div>
      <div class="i">${ic}</div>
      <div class="t">${Math.round(w.daily.temperature_2m_max[i])}°/${Math.round(w.daily.temperature_2m_min[i])}°</div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <h2 class="section-title">Clima · Filadelfia <span class="n">7 días</span></h2>
    <div class="card">
      <div class="weather-now">
        <span class="weather-icon">${icon}</span>
        <div>
          <div class="weather-temp">${Math.round(w.current.temperature_2m)}°C</div>
          <div class="muted">${desc} · Humedad ${w.current.relative_humidity_2m}% · Viento ${Math.round(w.current.wind_speed_10m)} km/h</div>
        </div>
      </div>
      <div class="muted" style="margin-top:8px;font-size:0.72rem;">Actualizado ${updated.toLocaleString('es-PY')}</div>
      <button class="btn secundario" data-action="weather-refresh">Actualizar pronóstico</button>
    </div>

    <div class="card">
      <h2 class="section-title">Próximos días</h2>
      <div class="forecast-strip">${days}</div>
    </div>

    <div class="card">
      <h2 class="section-title">Consejos para tus gallinas</h2>
      ${tips.map(t=>`<div class="tip ${t.alerta?'alerta':''}"><span class="ico">${t.icon}</span><span>${t.text}</span></div>`).join('')}
    </div>
  `;
}

/* ---------------- Render: Ajustes ---------------- */
function renderAjustes(){
  const s = state.settings;
  document.getElementById('view-ajustes').innerHTML = `
    <h2 class="section-title">Precio de referencia</h2>
    <div class="card">
      <p class="muted">Definí el precio del huevo suelto o por docena para calcular cuánto ahorrás al producir tus propios huevos. Si completás los dos, se usa el precio por docena.</p>
      <label>Precio por huevo suelto</label>
      <input type="number" id="cfgEggPrice" min="0" step="100" value="${s.eggPrice||''}">
      <label>Precio por docena</label>
      <input type="number" id="cfgDozenPrice" min="0" step="100" value="${s.dozenPrice||''}">
      <label>Moneda (símbolo)</label>
      <input type="text" id="cfgMoneda" value="${escapeHtml(s.moneda||'Gs.')}">
      <button class="btn" data-action="settings-save">Guardar</button>
    </div>

    <h2 class="section-title">Copia de seguridad (Excel)</h2>
    <div class="card">
      <p class="muted">Exportá todos tus datos a un archivo Excel, o importá un backup anterior. Útil para cambiar de celular o tener un respaldo aparte.</p>
      <button class="btn" data-action="export-excel">Exportar a Excel</button>
      <button class="btn secundario" data-action="import-trigger">Importar desde Excel</button>
      <input type="file" id="importFile" accept=".xlsx,.xls" hidden>
    </div>

    <h2 class="section-title">Datos guardados</h2>
    <div class="card">
      <p class="muted">${Object.keys(state.eggs).length} días de huevos registrados · ${state.purchases.length} compras · ${state.chickens.length} gallinas · ${state.events.length} eventos en la bitácora.<br>
      Todo se guarda localmente en este dispositivo; nada se sube a internet (excepto la consulta del clima).</p>
      <button class="btn peligro" data-action="reset-data">Borrar todos los datos</button>
    </div>

    <h2 class="section-title">Acerca de</h2>
    <div class="card">
      <p class="muted">Gallinero — registro de huevos, comida y ahorro, con clima de Filadelfia, Chaco. Instalable como app y funciona sin conexión (el clima necesita internet para actualizarse).</p>
    </div>
  `;
}

function renderAll(){
  renderInicio(); renderHuevos(); renderComida(); renderGallinas(); renderEventos(); renderClima(); renderAjustes();
}

/* ---------------- Acciones ---------------- */
function adjustEgg(date, delta){
  state.eggs[date] = Math.max(0, (state.eggs[date]||0)+delta);
  saveState();
  renderInicio();
  if(document.querySelector('.tab.active')?.dataset.tab === 'huevos') renderHuevos();
}
function shiftHuevosMonth(delta){
  const [y,m] = huevosMonth.split('-').map(Number);
  huevosMonth = isoDate(new Date(y, m-1+delta, 1)).slice(0,7);
}
function addPurchase(){
  const date = document.getElementById('purchaseDate').value || isoDate(new Date());
  const tipo = document.getElementById('purchaseTipo').value.trim() || 'Otro';
  const cantidad = parseFloat(document.getElementById('purchaseCantidad').value) || 0;
  const unidad = document.getElementById('purchaseUnidad').value;
  const total = parseFloat(document.getElementById('purchaseTotal').value) || 0;
  if(total<=0){ showToast('Ingresá el precio total pagado'); return; }
  state.purchases.push({id:genId(), date, tipo, cantidad, unidad, total});
  saveState(); showToast('Compra registrada'); renderComida(); renderInicio();
}
function addEvent(){
  const date = document.getElementById('eventDate').value || isoDate(new Date());
  const tipo = document.getElementById('eventTipo').value;
  const nota = document.getElementById('eventNota').value.trim();
  state.events.push({id:genId(), date, tipo, nota});
  saveState(); showToast('Evento registrado'); renderEventos(); renderHuevos();
}
function saveChicken(){
  const nombre = document.getElementById('chickenNombre').value.trim();
  if(!nombre){ showToast('Ingresá un nombre'); return; }
  const raza = document.getElementById('chickenRaza').value.trim();
  const fecha = document.getElementById('chickenFecha').value;
  const estado = document.getElementById('chickenEstado').value;
  const notas = document.getElementById('chickenNotas').value.trim();
  if(editingChickenId){
    const c = state.chickens.find(c=>c.id===editingChickenId);
    Object.assign(c, {nombre, raza, fecha, estado, notas});
    editingChickenId = null;
    showToast('Gallina actualizada');
  }else{
    state.chickens.push({id:genId(), nombre, raza, fecha, estado, notas});
    showToast('Gallina agregada');
  }
  saveState(); renderGallinas();
}
function saveSettings(){
  state.settings.eggPrice = parseFloat(document.getElementById('cfgEggPrice').value) || 0;
  state.settings.dozenPrice = parseFloat(document.getElementById('cfgDozenPrice').value) || 0;
  state.settings.moneda = document.getElementById('cfgMoneda').value.trim() || 'Gs.';
  saveState(); showToast('Ajustes guardados');
  renderInicio(); renderComida(); renderAjustes();
}

function handleAction(action, el){
  switch(action){
    case 'egg-inc': adjustEgg(isoDate(new Date()), 1); break;
    case 'egg-dec': adjustEgg(isoDate(new Date()), -1); break;
    case 'egg-set': {
      const date = document.getElementById('eggDate').value || isoDate(new Date());
      const count = Math.max(0, parseInt(document.getElementById('eggCount').value,10)||0);
      state.eggs[date] = count;
      const tMinRaw = document.getElementById('eggTempMin').value;
      const tMaxRaw = document.getElementById('eggTempMax').value;
      if(tMinRaw!=='' && tMaxRaw!==''){
        state.temps[date] = {min:parseFloat(tMinRaw), max:parseFloat(tMaxRaw), source:'manual'};
      }
      saveState(); showToast('Registrado');
      renderInicio(); renderHuevos();
      backfillTemps().then(()=>{ if(document.querySelector('.tab.active')?.dataset.tab==='huevos') renderHuevos(); });
      break;
    }
    case 'egg-delete':
      delete state.eggs[el.dataset.date]; saveState(); renderHuevos(); renderInicio();
      break;
    case 'huevos-prev-month': shiftHuevosMonth(-1); renderHuevos(); break;
    case 'huevos-next-month': shiftHuevosMonth(1); renderHuevos(); break;
    case 'temps-refresh':
      showToast('Buscando temperaturas…');
      backfillTemps().then(()=>{ renderHuevos(); });
      break;

    case 'event-add': addEvent(); break;
    case 'event-delete':
      state.events = state.events.filter(ev=>ev.id!==el.dataset.id);
      saveState(); renderEventos(); renderHuevos();
      break;

    case 'purchase-add': addPurchase(); break;
    case 'purchase-delete':
      state.purchases = state.purchases.filter(p=>p.id!==el.dataset.id);
      saveState(); renderComida(); renderInicio();
      break;

    case 'chicken-save': saveChicken(); break;
    case 'chicken-edit':
      editingChickenId = el.dataset.id; renderGallinas();
      window.scrollTo({top:0, behavior:'smooth'});
      break;
    case 'chicken-cancel': editingChickenId = null; renderGallinas(); break;
    case 'chicken-delete':
      if(confirm('¿Eliminar esta gallina del registro?')){
        state.chickens = state.chickens.filter(c=>c.id!==el.dataset.id);
        saveState(); renderGallinas();
      }
      break;

    case 'settings-save': saveSettings(); break;
    case 'export-excel': exportExcel(); break;
    case 'import-trigger': document.getElementById('importFile').click(); break;
    case 'reset-data':
      if(confirm('Esto borrará todos los datos guardados en este dispositivo. ¿Continuar?')){
        state = defaultState(); saveState(); showToast('Datos borrados'); renderAll();
      }
      break;
    case 'weather-refresh':
      showToast('Actualizando clima…');
      fetchWeather(true).then(()=>{ renderClima(); renderInicio(); });
      break;
  }
}

/* ---------------- Excel: exportar / importar ---------------- */
function exportExcel(){
  const wb = XLSX.utils.book_new();
  const eggsRows = Object.entries(state.eggs).sort((a,b)=>a[0].localeCompare(b[0])).map(([Fecha,Huevos])=>({Fecha, Huevos}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eggsRows), 'Huevos');

  const purchaseRows = state.purchases.map(p=>({Fecha:p.date, Tipo:p.tipo, Cantidad:p.cantidad, Unidad:p.unidad, Total:p.total}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseRows), 'Comida');

  const chickenRows = state.chickens.map(c=>({Nombre:c.nombre, Raza:c.raza, FechaLlegada:c.fecha, Estado:c.estado, Notas:c.notas}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chickenRows), 'Gallinas');

  const tempRows = Object.entries(state.temps).sort((a,b)=>a[0].localeCompare(b[0])).map(([Fecha,t])=>({Fecha, Min:t.min, Max:t.max, Fuente:t.source||''}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tempRows), 'Temperaturas');

  const eventRows = [...state.events].sort((a,b)=>a.date.localeCompare(b.date)).map(ev=>({Fecha:ev.date, Tipo:ev.tipo, Nota:ev.nota}));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eventRows), 'Eventos');

  const configRows = [{PrecioHuevo:state.settings.eggPrice, PrecioDocena:state.settings.dozenPrice, Moneda:state.settings.moneda}];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configRows), 'Config');

  XLSX.writeFile(wb, `gallinero_backup_${isoDate(new Date())}.xlsx`);
  showToast('Excel exportado');
}
function normalizeDate(val){
  if(!val) return null;
  if(val instanceof Date) return isoDate(val);
  if(typeof val === 'number'){
    if(window.XLSX && XLSX.SSF){
      const d = XLSX.SSF.parse_date_code(val);
      if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    return null;
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Formato DD/MM/AAAA (como se usa en Paraguay)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  return null;
}
function importExcel(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});
      if(wb.SheetNames.includes('Huevos')){
        XLSX.utils.sheet_to_json(wb.Sheets['Huevos']).forEach(r=>{
          const fecha = normalizeDate(r.Fecha);
          if(fecha) state.eggs[fecha] = Number(r.Huevos)||0;
        });
      }
      if(wb.SheetNames.includes('Comida')){
        XLSX.utils.sheet_to_json(wb.Sheets['Comida']).forEach(r=>{
          state.purchases.push({
            id:genId(),
            date: normalizeDate(r.Fecha) || isoDate(new Date()),
            tipo: r.Tipo || 'Otro',
            cantidad: Number(r.Cantidad)||0,
            unidad: r.Unidad || 'kg',
            total: Number(r.Total)||0
          });
        });
      }
      if(wb.SheetNames.includes('Gallinas')){
        XLSX.utils.sheet_to_json(wb.Sheets['Gallinas']).forEach(r=>{
          state.chickens.push({
            id:genId(), nombre:r.Nombre||'Sin nombre', raza:r.Raza||'',
            fecha: normalizeDate(r.FechaLlegada)||'', estado:r.Estado||'Poniendo', notas:r.Notas||''
          });
        });
      }
      if(wb.SheetNames.includes('Temperaturas')){
        XLSX.utils.sheet_to_json(wb.Sheets['Temperaturas']).forEach(r=>{
          const fecha = normalizeDate(r.Fecha);
          if(fecha && r.Min!=null && r.Max!=null){
            state.temps[fecha] = {min:Number(r.Min), max:Number(r.Max), source: r.Fuente||'manual'};
          }
        });
      }
      if(wb.SheetNames.includes('Eventos')){
        XLSX.utils.sheet_to_json(wb.Sheets['Eventos']).forEach(r=>{
          const fecha = normalizeDate(r.Fecha);
          if(fecha) state.events.push({id:genId(), date:fecha, tipo:r.Tipo||'Otro', nota:r.Nota||''});
        });
      }
      if(wb.SheetNames.includes('Config')){
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Config']);
        if(rows[0]){
          state.settings.eggPrice = Number(rows[0].PrecioHuevo)||state.settings.eggPrice;
          state.settings.dozenPrice = Number(rows[0].PrecioDocena)||state.settings.dozenPrice;
          state.settings.moneda = rows[0].Moneda || state.settings.moneda;
        }
      }
      saveState(); showToast('Datos importados correctamente'); renderAll();
      backfillTemps().then(()=>{ renderHuevos(); });
    }catch(err){
      console.error(err);
      showToast('Error al importar el archivo');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ---------------- Navegación ---------------- */
function switchTab(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
}

/* ---------------- Eventos globales ---------------- */
document.addEventListener('click', (e)=>{
  const tabBtn = e.target.closest('.tab');
  if(tabBtn){ switchTab(tabBtn.dataset.tab); return; }
  const actionEl = e.target.closest('[data-action]');
  if(actionEl){ handleAction(actionEl.dataset.action, actionEl); }
});
document.addEventListener('change', (e)=>{
  if(e.target.id === 'importFile'){
    const file = e.target.files[0];
    if(file) importExcel(file);
    e.target.value = '';
  }
  if(e.target.id === 'eggDate'){
    const t = state.temps[e.target.value];
    const minEl = document.getElementById('eggTempMin'), maxEl = document.getElementById('eggTempMax');
    if(minEl) minEl.value = t ? t.min : '';
    if(maxEl) maxEl.value = t ? t.max : '';
    const countEl = document.getElementById('eggCount');
    if(countEl) countEl.value = state.eggs[e.target.value] || '';
  }
});

/* ---------------- Instalación PWA ---------------- */
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  window.__deferredInstall = e;
  const btn = document.getElementById('installBtn');
  if(btn) btn.hidden = false;
});
document.getElementById('installBtn')?.addEventListener('click', async ()=>{
  const evt = window.__deferredInstall;
  if(!evt) return;
  evt.prompt();
  document.getElementById('installBtn').hidden = true;
});
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  });
}

/* ---------------- Inicio ---------------- */
renderAll();
fetchWeather(false).then(()=>{ renderInicio(); renderClima(); backfillTemps().then(()=>{ renderHuevos(); }); });
