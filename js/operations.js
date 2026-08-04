'use strict';

const operationsState={calendarMode:'month',calendarAnchor:new Date(),statisticsPeriod:'month'};
const opDateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const opStartOfWeek=d=>{const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(12,0,0,0);return x};
const opAddDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const opMonthLabel=d=>d.toLocaleDateString('it-IT',{month:'long',year:'numeric'});
const opDayLabel=d=>d.toLocaleDateString('it-IT',{weekday:'short',day:'2-digit',month:'short'});
const opServiceAmount=s=>Number(s.customer_amount||0);
const opEmployeeAmount=s=>Number(s.employee_compensation||0);
const opIsMatured=s=>['da_verificare','chiuso'].includes(s.status);
const opStatusClass=s=>`calendar-status-${String(s.status||'programmato').replaceAll('_','-')}`;
const opServiceTitle=s=>`${dname(s.dog_id)} · ${s.service_type||'Servizio'}`;
const opServicesOn=date=>state.services.filter(s=>s.status!=='annullato'&&serviceOccursOn(s,date));
const opFirstPeriodStart=s=>serviceFirstDate(s)||'';

function operationalMetrics(){
  const today=localDate();const weekStart=opDateKey(opStartOfWeek(new Date()));const weekEnd=opDateKey(opAddDays(opStartOfWeek(new Date()),6));
  const activeServices=state.services.filter(s=>s.status!=='annullato');
  return {
    customers:state.customers.filter(c=>c.status==='attivo').length,
    dogs:state.dogs.filter(d=>d.active!==false).length,
    today:opServicesOn(today).length,
    week:activeServices.filter(s=>normalizePeriods(s).some(p=>(p.end_date||p.start_date)>=weekStart&&p.start_date<=weekEnd)).length,
    inProgress:activeServices.filter(s=>s.status==='in_corso').length,
    toVerify:activeServices.filter(s=>s.status==='da_verificare').length,
    quotesPending:state.quotes.filter(q=>['bozza','inviato'].includes(String(q.status||'').toLowerCase())&&!q.deleted_at).length,
    unread:unreadNotificationCount()+unreadCommunicationCount(),
    toCollect:activeServices.filter(s=>s.customer_payment_status==='da_incassare'&&opIsMatured(s)).reduce((a,s)=>a+opServiceAmount(s),0),
    toPay:activeServices.filter(s=>s.employee_payment_status==='da_liquidare'&&opIsMatured(s)).reduce((a,s)=>a+opEmployeeAmount(s),0),
    documents:(state.documents||[]).length
  }
}

function renderOperationalDashboard(){
  const host=$('#dashboard');if(!host)return;
  const m=operationalMetrics(),today=localDate();
  const todays=opServicesOn(today).sort((a,b)=>String(a.service_time||'').localeCompare(String(b.service_time||'')));
  const upcoming=state.services.filter(s=>s.status!=='annullato'&&normalizePeriods(s).some(p=>(p.end_date||p.start_date)>=today)).sort((a,b)=>String(opFirstPeriodStart(a)+(a.service_time||'')).localeCompare(String(opFirstPeriodStart(b)+(b.service_time||'')))).slice(0,6);
  host.innerHTML=`<div class="page-title operations-title"><div><span class="eyebrow">GESTIONE OPERATIVA</span><h2>Dashboard</h2><p class="muted">Attività, scadenze e dati economici essenziali.</p></div><span class="today-chip">${new Date().toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'})}</span></div>
  <div class="operations-kpi-grid">
    ${opKpi('Clienti attivi',m.customers,'customers','Anagrafiche disponibili')}
    ${opKpi('Cani attivi',m.dogs,'dogs','Schede operative')}
    ${opKpi('Servizi oggi',m.today,'services',`${m.week} questa settimana`)}
    ${opKpi('In corso',m.inProgress,'services','Attività operative')}
    ${opKpi('Da verificare',m.toVerify,'services','Rapporti da controllare')}
    ${opKpi('Preventivi in attesa',m.quotesPending,'quotes','Bozze o inviati')}
    ${opKpi('Notifiche',m.unread,'notifications','Comunicazioni non lette')}
    ${opKpi('Documenti',m.documents,'documents','PDF archiviati')}
  </div>
  <div class="operations-money-grid">
    <button class="operations-money-card" onclick="show('payments')"><span>Da incassare</span><strong>${money(m.toCollect)}</strong><small>Importi cliente maturati</small></button>
    <button class="operations-money-card" onclick="show('payments')"><span>Da liquidare</span><strong>${money(m.toPay)}</strong><small>Compensi dipendenti</small></button>
    <button class="operations-money-card" onclick="show('statistics')"><span>Margine potenziale</span><strong>${money(m.toCollect-m.toPay)}</strong><small>Su importi ancora aperti</small></button>
  </div>
  <div class="operations-two-columns"><section><div class="section-title-row"><div><h3>Servizi di oggi</h3><p class="muted">${todays.reduce((a,s)=>a+visitsOnDate(s,today),0)} uscite complessive.</p></div><button onclick="show('calendar')">Apri calendario</button></div><div class="operations-agenda">${todays.map(opAgendaRow).join('')||'<div class="card empty-state"><strong>Nessun servizio oggi</strong><span>Non risultano attività programmate.</span></div>'}</div></section>
  <section><div class="section-title-row"><div><h3>Prossime attività</h3><p class="muted">I prossimi servizi pianificati.</p></div><button onclick="show('services')">Tutti i servizi</button></div><div class="operations-agenda">${upcoming.map(opAgendaRow).join('')||'<div class="card empty-state"><strong>Nessuna attività futura</strong></div>'}</div></section></div>`;
}
function opKpi(label,value,screen,small){return `<button class="operations-kpi" onclick="show('${screen}')"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(small)}</small></button>`}
function opAgendaRow(s){const first=serviceFirstDate(s);return `<button class="operations-agenda-row" onclick="show('services');setTimeout(()=>openService('${s.id}'),60)"><span class="operations-agenda-time">${esc((s.service_time||'—').slice(0,5))}</span><span><strong>${esc(opServiceTitle(s))}</strong><small>${esc(cname(s.customer_id))} · ${dateIT(first)} · ${esc(statusLabels[s.status]||s.status)}</small></span><span class="status ${opStatusClass(s)}">${esc(statusLabels[s.status]||s.status)}</span></button>`}

function renderCalendar(){
  const host=$('#calendarPanel');if(!host)return;
  const a=operationsState.calendarAnchor,mode=operationsState.calendarMode;
  host.innerHTML=`<div class="page-title"><div><span class="eyebrow">PIANIFICAZIONE</span><h2>Calendario operativo</h2><p class="muted">Visualizza i servizi per giorno, settimana o mese.</p></div></div>
  <div class="calendar-toolbar"><div class="calendar-nav"><button onclick="moveOperationsCalendar(-1)">‹</button><button onclick="goOperationsToday()">Oggi</button><button onclick="moveOperationsCalendar(1)">›</button></div><strong>${mode==='month'?opMonthLabel(a):mode==='week'?`${opDayLabel(opStartOfWeek(a))} – ${opDayLabel(opAddDays(opStartOfWeek(a),6))}`:a.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</strong><div class="calendar-modes"><button class="${mode==='day'?'active':''}" onclick="setOperationsCalendarMode('day')">Giorno</button><button class="${mode==='week'?'active':''}" onclick="setOperationsCalendarMode('week')">Settimana</button><button class="${mode==='month'?'active':''}" onclick="setOperationsCalendarMode('month')">Mese</button></div></div>
  ${mode==='month'?opMonthCalendar(a):mode==='week'?opWeekCalendar(a):opDayCalendar(a)}`;
}
function opCalendarEvent(s,date){return `<button class="calendar-event ${opStatusClass(s)}" onclick="show('services');setTimeout(()=>openService('${s.id}'),60)" title="${esc(opServiceTitle(s))}"><span>${esc((s.service_time||'').slice(0,5)||'—')}</span><strong>${esc(dname(s.dog_id))}</strong><small>${esc(s.service_type||'Servizio')}</small></button>`}
function opMonthCalendar(anchor){const first=new Date(anchor.getFullYear(),anchor.getMonth(),1,12),start=opStartOfWeek(first);let cells='';for(let i=0;i<42;i++){const d=opAddDays(start,i),key=opDateKey(d),same=d.getMonth()===anchor.getMonth(),events=opServicesOn(key);cells+=`<div class="calendar-day ${same?'':'outside'} ${key===localDate()?'today':''}"><div class="calendar-day-number"><span>${d.getDate()}</span>${events.length?`<b>${events.length}</b>`:''}</div><div class="calendar-day-events">${events.slice(0,3).map(s=>opCalendarEvent(s,key)).join('')}${events.length>3?`<button class="calendar-more" onclick="openCalendarDay('${key}')">+${events.length-3} altri</button>`:''}</div></div>`}return `<div class="calendar-weekdays">${['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-month-grid">${cells}</div>`}
function opWeekCalendar(anchor){const start=opStartOfWeek(anchor);return `<div class="calendar-week-grid">${Array.from({length:7},(_,i)=>{const d=opAddDays(start,i),key=opDateKey(d),events=opServicesOn(key);return `<section class="calendar-week-day ${key===localDate()?'today':''}"><header><strong>${opDayLabel(d)}</strong><span>${events.length} servizi</span></header><div>${events.map(s=>opCalendarEvent(s,key)).join('')||'<small class="muted">Nessun servizio</small>'}</div></section>`}).join('')}</div>`}
function opDayCalendar(anchor){const key=opDateKey(anchor),events=opServicesOn(key).sort((a,b)=>String(a.service_time||'').localeCompare(String(b.service_time||'')));return `<div class="calendar-day-list">${events.map(s=>`<article class="calendar-day-card ${opStatusClass(s)}"><div><span>${esc((s.service_time||'—').slice(0,5))}</span><strong>${esc(opServiceTitle(s))}</strong><small>${esc(cname(s.customer_id))} · ${visitsOnDate(s,key)} uscite</small></div><button onclick="show('services');setTimeout(()=>openService('${s.id}'),60)">Apri</button></article>`).join('')||'<div class="card empty-state"><strong>Nessun servizio</strong><span>La giornata selezionata è libera.</span></div>'}</div>`}
window.setOperationsCalendarMode=mode=>{operationsState.calendarMode=mode;renderCalendar()};
window.moveOperationsCalendar=direction=>{const a=operationsState.calendarAnchor,m=operationsState.calendarMode;if(m==='month')a.setMonth(a.getMonth()+direction);else if(m==='week')a.setDate(a.getDate()+7*direction);else a.setDate(a.getDate()+direction);renderCalendar()};
window.goOperationsToday=()=>{operationsState.calendarAnchor=new Date();renderCalendar()};
window.openCalendarDay=date=>{operationsState.calendarAnchor=parseLocalDate(date)||new Date();operationsState.calendarMode='day';renderCalendar()};

function statsRange(){const now=new Date(),period=operationsState.statisticsPeriod;if(period==='year')return {from:`${now.getFullYear()}-01-01`,to:`${now.getFullYear()}-12-31`,label:String(now.getFullYear())};if(period==='all')return {from:'0000-01-01',to:'9999-12-31',label:'Tutto lo storico'};const from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,to=localDate(new Date(now.getFullYear(),now.getMonth()+1,0));return {from,to,label:now.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}}
function recordInRange(record,from,to){return normalizePeriods(record).some(p=>(p.end_date||p.start_date)>=from&&p.start_date<=to)}
function renderStatistics(){
  const host=$('#statisticsPanel');if(!host)return;const r=statsRange(),services=state.services.filter(s=>s.status!=='annullato'&&recordInRange(s,r.from,r.to));const maturedRows=services.filter(opIsMatured);const revenue=maturedRows.reduce((a,s)=>a+opServiceAmount(s),0),comp=maturedRows.reduce((a,s)=>a+opEmployeeAmount(s),0),margin=revenue-comp,visits=services.reduce((a,s)=>a+periodsTotals(normalizePeriods(s)).visits,0);
  const byMonth=Array.from({length:operationsState.statisticsPeriod==='year'?12:6},(_,i)=>{const base=new Date();const d=operationsState.statisticsPeriod==='year'?new Date(base.getFullYear(),i,1):new Date(base.getFullYear(),base.getMonth()-(5-i),1);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,rows=state.services.filter(s=>s.status!=='annullato'&&normalizePeriods(s).some(p=>String(p.start_date||'').startsWith(key)));return {label:d.toLocaleDateString('it-IT',{month:'short'}),services:rows.length,revenue:rows.filter(opIsMatured).reduce((a,s)=>a+opServiceAmount(s),0)}});
  const maxRevenue=Math.max(1,...byMonth.map(x=>x.revenue));const customerCounts=new Map(),dogCounts=new Map();services.forEach(s=>{customerCounts.set(s.customer_id,(customerCounts.get(s.customer_id)||0)+1);dogCounts.set(s.dog_id,(dogCounts.get(s.dog_id)||0)+1)});const topCustomers=[...customerCounts].sort((a,b)=>b[1]-a[1]).slice(0,5),topDogs=[...dogCounts].sort((a,b)=>b[1]-a[1]).slice(0,5);
  host.innerHTML=`<div class="page-title"><div><span class="eyebrow">ANALISI</span><h2>Statistiche</h2><p class="muted">Dati calcolati sui servizi presenti nel gestionale.</p></div><div class="statistics-period"><button class="${operationsState.statisticsPeriod==='month'?'active':''}" onclick="setStatisticsPeriod('month')">Mese</button><button class="${operationsState.statisticsPeriod==='year'?'active':''}" onclick="setStatisticsPeriod('year')">Anno</button><button class="${operationsState.statisticsPeriod==='all'?'active':''}" onclick="setStatisticsPeriod('all')">Tutto</button></div></div><div class="statistics-label">Periodo: <strong>${esc(r.label)}</strong></div>
  <div class="operations-kpi-grid statistics-kpis">${opKpiStatic('Servizi',services.length,'Nel periodo')}${opKpiStatic('Uscite',visits,'Complessive')}${opKpiStatic('Importi cliente',money(revenue),'Servizi maturati')}${opKpiStatic('Compensi',money(comp),'Dipendenti')}${opKpiStatic('Margine',money(margin),'Differenza lorda')}</div>
  <div class="statistics-grid"><section class="statistics-panel"><h3>Andamento mensile</h3><div class="statistics-bars">${byMonth.map(x=>`<div class="statistics-bar-item"><div class="statistics-bar-track"><span style="height:${Math.max(4,(x.revenue/maxRevenue)*100)}%"></span></div><strong>${esc(x.label)}</strong><small>${money(x.revenue)}</small></div>`).join('')}</div></section><section class="statistics-panel"><h3>Stati dei servizi</h3>${opStatusRows(services)}</section><section class="statistics-panel"><h3>Clienti più attivi</h3>${topCustomers.map(([id,n])=>`<div class="statistics-ranking"><span>${esc(cname(id))}</span><strong>${n}</strong></div>`).join('')||'<p class="muted">Nessun dato.</p>'}</section><section class="statistics-panel"><h3>Cani più seguiti</h3>${topDogs.map(([id,n])=>`<div class="statistics-ranking"><span>${esc(dname(id))}</span><strong>${n}</strong></div>`).join('')||'<p class="muted">Nessun dato.</p>'}</section></div>`;
}
function opKpiStatic(label,value,small){return `<div class="operations-kpi static"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(small)}</small></div>`}
function opStatusRows(services){const keys=['programmato','in_corso','da_verificare','chiuso','annullato'];return keys.map(k=>{const n=services.filter(s=>s.status===k).length,p=services.length?Math.round(n/services.length*100):0;return `<div class="statistics-status-row"><div><span>${esc(statusLabels[k]||k)}</span><strong>${n}</strong></div><div class="statistics-progress"><i style="width:${p}%"></i></div></div>`}).join('')}
window.setStatisticsPeriod=period=>{operationsState.statisticsPeriod=period;renderStatistics()};
