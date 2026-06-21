/* =========================================================
   Gallinero — lógica de la aplicación
   Todo el dato vive en localStorage. El clima usa Open-Meteo
   (gratuito, sin API key) para Filadelfia, Chaco, Paraguay.
   ========================================================= */

const STORAGE_KEY = 'gallinero_v1';
const LAT = -22.3666, LON = -60.0333; // Filadelfia, Boquerón, Paraguay

const WEEKDAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const WEEKDAYS_LONG  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

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
    const showLabel = (dayNum===1 || dayNum===totalDays || dayNum%5===0);
    return `<div class="bar-col"><div class="bar" style="height:${Math.max(h,2)}%"></div><div class="bar-label">${showLabel?dayNum:'&nbsp;'}</div></div>`;
  }).join('');

  const recent = Object.entries(state.eggs).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,30);
  const listHtml = recent.length ? recent.map(([date,count])=>{
    const d = new Date(date+'T12:00:00');
    return `<div class="list-row">
      <span>${weekdayShort(d)} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</span>
      <span class="right">${count} 🥚 <button class="del-btn" data-action="egg-delete" data-date="${date}">✕</button></span>
    </div>`;
  }).join('') : `<div class="empty">Todavía no registraste huevos.</div>`;

  document.getElementById('view-huevos').innerHTML = `
    <h2 class="section-title">Registrar huevos</h2>
    <div class="card">
      <label>Fecha</label>
      <input type="date" id="eggDate" value="${isoDate(new Date())}" max="${isoDate(new Date())}">
      <label>Cantidad de huevos</label>
      <input type="number" id="eggCount" min="0" step="1" placeholder="0">
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
      <p class="muted">${Object.keys(state.eggs).length} días de huevos registrados · ${state.purchases.length} compras · ${state.chickens.length} gallinas.<br>
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
  renderInicio(); renderHuevos(); renderComida(); renderGallinas(); renderClima(); renderAjustes();
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
      state.eggs[date] = count; saveState(); showToast('Registrado');
      renderInicio(); renderHuevos();
      break;
    }
    case 'egg-delete':
      delete state.eggs[el.dataset.date]; saveState(); renderHuevos(); renderInicio();
      break;
    case 'huevos-prev-month': shiftHuevosMonth(-1); renderHuevos(); break;
    case 'huevos-next-month': shiftHuevosMonth(1); renderHuevos(); break;

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
      if(wb.SheetNames.includes('Config')){
        const rows = XLSX.utils.sheet_to_json(wb.Sheets['Config']);
        if(rows[0]){
          state.settings.eggPrice = Number(rows[0].PrecioHuevo)||state.settings.eggPrice;
          state.settings.dozenPrice = Number(rows[0].PrecioDocena)||state.settings.dozenPrice;
          state.settings.moneda = rows[0].Moneda || state.settings.moneda;
        }
      }
      saveState(); showToast('Datos importados correctamente'); renderAll();
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
fetchWeather(false).then(()=>{ renderInicio(); renderClima(); });
