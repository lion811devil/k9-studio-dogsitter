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
    unread:unreadNotificationCount(),
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
    ${opKpi('Animali attivi',m.dogs,'dogs','Schede operative')}
    ${opKpi('Servizi oggi',m.today,'services',`${m.week} questa settimana`)}
    ${opKpi('In corso',m.inProgress,'services','Attività operative')}
    ${opKpi('Da verificare',m.toVerify,'services','Rapporti da controllare')}
    ${opKpi('Preventivi in attesa',m.quotesPending,'quotes','Bozze o inviati')}
    ${opKpi('Notifiche',m.unread,'notifications','Avvisi non letti')}
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

function statsDate(d){return opDateKey(d)}
function statsToday(){return parseLocalDate(localDate())||new Date()}
function statsRange(){
  const now=statsToday(),period=operationsState.statisticsPeriod;
  if(period==='year')return {from:`${now.getFullYear()}-01-01`,to:statsDate(now),label:`${now.getFullYear()} · fino a oggi`};
  if(period==='all'){
    const dates=state.services.flatMap(s=>normalizePeriods(s).flatMap(p=>[p.start_date,p.end_date||p.start_date])).filter(Boolean).sort();
    return {from:dates[0]||statsDate(now),to:statsDate(now),label:dates.length?`${dateIT(dates[0])} – ${dateIT(statsDate(now))}`:'Tutto lo storico'};
  }
  if(period==='custom'){
    const fallbackFrom=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    let from=operationsState.statisticsFrom||fallbackFrom,to=operationsState.statisticsTo||statsDate(now);
    if(from>to)[from,to]=[to,from];
    return {from,to,label:`${dateIT(from)} – ${dateIT(to)}`};
  }
  const from=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  return {from,to:statsDate(now),label:now.toLocaleDateString('it-IT',{month:'long',year:'numeric'})+' · fino a oggi'};
}
function statsPreviousRange(r){
  if(operationsState.statisticsPeriod==='all')return null;
  const from=parseLocalDate(r.from),to=parseLocalDate(r.to);if(!from||!to)return null;
  if(operationsState.statisticsPeriod==='month'){
    const pf=new Date(from.getFullYear(),from.getMonth()-1,1,12),last=new Date(from.getFullYear(),from.getMonth(),0,12),elapsed=to.getDate();
    const pt=new Date(pf.getFullYear(),pf.getMonth(),Math.min(elapsed,last.getDate()),12);
    return {from:statsDate(pf),to:statsDate(pt)};
  }
  if(operationsState.statisticsPeriod==='year'){
    const pf=new Date(from.getFullYear()-1,0,1,12),pt=new Date(to.getFullYear()-1,to.getMonth(),to.getDate(),12);
    if(pt.getMonth()!==to.getMonth())pt.setDate(0);
    return {from:statsDate(pf),to:statsDate(pt)};
  }
  const days=daysInclusive(r.from,r.to),pt=opAddDays(from,-1),pf=opAddDays(pt,-(days-1));
  return {from:statsDate(pf),to:statsDate(pt)};
}
function recordInRange(record,from,to){return normalizePeriods(record).some(p=>(p.end_date||p.start_date)>=from&&p.start_date<=to)}
function periodOverlapDays(period,from,to){const start=period.start_date>from?period.start_date:from,end=(period.end_date||period.start_date)<to?(period.end_date||period.start_date):to;return start&&end&&start<=end?daysInclusive(start,end):0}
function proratedServiceAmount(service,from,to,kind='customer'){const periods=normalizePeriods(service),totalDays=periods.reduce((n,p)=>n+Math.max(1,periodDays(p)),0),overlap=periods.reduce((n,p)=>n+periodOverlapDays(p,from,to),0),amount=kind==='employee'?opEmployeeAmount(service):opServiceAmount(service);return totalDays?amount*(overlap/totalDays):0}
function visitsInRange(service,from,to){return normalizePeriods(service).reduce((sum,p)=>sum+periodOverlapDays(p,from,to)*Math.max(1,Number(p.daily_visits||1)),0)}
function statsSnapshot(from,to){
  const allRows=state.services.filter(s=>recordInRange(s,from,to)),active=allRows.filter(s=>s.status!=='annullato'),matured=active.filter(opIsMatured);
  const revenue=matured.reduce((a,s)=>a+proratedServiceAmount(s,from,to,'customer'),0),comp=matured.reduce((a,s)=>a+proratedServiceAmount(s,from,to,'employee'),0);
  return {allRows,active,matured,services:active.length,visits:active.reduce((a,s)=>a+visitsInRange(s,from,to),0),revenue,comp,margin:revenue-comp};
}
function statsDelta(current,previous,{moneyValue=false}={}){
  if(previous===null||previous===undefined)return '';
  const c=Number(current||0),p=Number(previous||0);
  if(Math.abs(p)<0.000001){if(Math.abs(c)<0.000001)return '<small class="statistics-delta neutral">= periodo precedente</small>';return `<small class="statistics-delta up">Nuovo rispetto al precedente</small>`}
  const pct=((c-p)/Math.abs(p))*100,cls=pct>0.05?'up':pct<-0.05?'down':'neutral',sign=pct>0?'+':'';
  return `<small class="statistics-delta ${cls}">${sign}${pct.toFixed(1).replace('.',',')}% vs precedente${moneyValue?'':''}</small>`;
}
function statKpi(label,value,small,current,previous,opts={}){return `<div class="operations-kpi static"><span>${esc(label)}</span><strong>${value}</strong><small>${esc(small)}</small>${statsDelta(current,previous,opts)}</div>`}
function statsAddMonths(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1,12)}
function statsTrendBuckets(r){
  const start=parseLocalDate(r.from),end=parseLocalDate(r.to);if(!start||!end)return [];
  const span=daysInclusive(r.from,r.to),out=[];
  if(span<=62){let cursor=new Date(start);while(cursor<=end){const a=new Date(cursor),b=opAddDays(a,6);if(b>end)b.setTime(end.getTime());const from=statsDate(a),to=statsDate(b);out.push({from,to,label:`${String(a.getDate()).padStart(2,'0')}/${String(a.getMonth()+1).padStart(2,'0')}`});cursor=opAddDays(b,1)}return out}
  const monthSpan=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth())+1;
  if(monthSpan<=36){let cursor=new Date(start.getFullYear(),start.getMonth(),1,12);while(cursor<=end){const a=new Date(cursor),b=new Date(cursor.getFullYear(),cursor.getMonth()+1,0,12),from=statsDate(a<start?start:a),to=statsDate(b>end?end:b);out.push({from,to,label:cursor.toLocaleDateString('it-IT',{month:'short',year:monthSpan>12?'2-digit':undefined})});cursor=statsAddMonths(cursor,1)}return out}
  for(let y=start.getFullYear();y<=end.getFullYear();y++){const a=new Date(y,0,1,12),b=new Date(y,11,31,12),from=statsDate(a<start?start:a),to=statsDate(b>end?end:b);out.push({from,to,label:String(y)})}return out;
}
function statsRankMap(rows,r,keyFn){const m=new Map();rows.forEach(s=>{const key=keyFn(s);if(!key)return;const visits=visitsInRange(s,r.from,r.to),old=m.get(key)||{services:0,visits:0,revenue:0};old.services+=1;old.visits+=visits;if(opIsMatured(s))old.revenue+=proratedServiceAmount(s,r.from,r.to,'customer');m.set(key,old)});return [...m.entries()].sort((a,b)=>b[1].visits-a[1].visits||b[1].services-a[1].services)}
function statsRankingHtml(rows,labelFn,{showRevenue=false}={}){return rows.slice(0,6).map(([id,v])=>`<div class="statistics-ranking"><span>${esc(labelFn(id))}<small>${v.services} ${v.services===1?'servizio':'servizi'}</small></span><strong>${v.visits} uscite${showRevenue?`<small>${money(v.revenue)}</small>`:''}</strong></div>`).join('')||'<p class="muted">Nessun dato nel periodo.</p>'}
function statsServiceTypeHtml(rows,r){const ranked=statsRankMap(rows,r,s=>String(s.service_type||'Altro').trim()||'Altro');return statsRankingHtml(ranked,id=>id,{showRevenue:true})}
function statsEmployeeHtml(rows,r){const m=new Map();rows.forEach(s=>{const key=s.employee_id||'__none__',old=m.get(key)||{services:0,visits:0,comp:0};old.services+=1;old.visits+=visitsInRange(s,r.from,r.to);if(opIsMatured(s))old.comp+=proratedServiceAmount(s,r.from,r.to,'employee');m.set(key,old)});return [...m.entries()].sort((a,b)=>b[1].visits-a[1].visits).slice(0,8).map(([id,v])=>`<div class="statistics-ranking"><span>${esc(id==='__none__'?'Non assegnato':pname(id))}<small>${v.services} ${v.services===1?'servizio':'servizi'}</small></span><strong>${v.visits} uscite<small>${money(v.comp)} compensi</small></strong></div>`).join('')||'<p class="muted">Nessun dato nel periodo.</p>'}
function statsAnimalTypeHtml(rows,r){const ranked=statsRankMap(rows,r,s=>state.dogs.find(d=>d.id===s.dog_id)?.animal_type||'Animale');return statsRankingHtml(ranked,id=>id)}
function renderStatistics(){
  const host=$('#statisticsPanel');if(!host)return;if(!isAdmin()){host.innerHTML='<div class="card empty-state"><strong>Sezione riservata</strong></div>';return}
  const r=statsRange(),snap=statsSnapshot(r.from,r.to),pr=statsPreviousRange(r),prev=pr?statsSnapshot(pr.from,pr.to):null;
  const trend=statsTrendBuckets(r).map(b=>{const x=statsSnapshot(b.from,b.to);return {...b,revenue:x.revenue,services:x.services,visits:x.visits}}),maxRevenue=Math.max(0,...trend.map(x=>x.revenue));
  const customerRank=statsRankMap(snap.active,r,s=>s.customer_id),animalRank=statsRankMap(snap.active,r,s=>s.dog_id);
  const custom=operationsState.statisticsPeriod==='custom';
  host.innerHTML=`<div class="page-title"><div><span class="eyebrow">ANALISI ATTIVITÀ</span><h2>Statistiche</h2><p class="muted">Andamento del lavoro, carico operativo e risultati maturati. Per incassi, acconti e residui usa Economia.</p></div><div class="statistics-period"><button class="${operationsState.statisticsPeriod==='month'?'active':''}" onclick="setStatisticsPeriod('month')">Mese</button><button class="${operationsState.statisticsPeriod==='year'?'active':''}" onclick="setStatisticsPeriod('year')">Anno</button><button class="${operationsState.statisticsPeriod==='custom'?'active':''}" onclick="setStatisticsPeriod('custom')">Intervallo</button><button class="${operationsState.statisticsPeriod==='all'?'active':''}" onclick="setStatisticsPeriod('all')">Tutto</button></div></div>
  ${custom?`<div class="statistics-custom-range"><label>Dal<input type="date" id="statisticsFrom" value="${esc(r.from)}" max="${esc(r.to)}"></label><label>Al<input type="date" id="statisticsTo" value="${esc(r.to)}" min="${esc(r.from)}" max="${localDate()}"></label><button class="primary" onclick="applyStatisticsRange()">Applica</button></div>`:''}
  <div class="statistics-label">Periodo analizzato: <strong>${esc(r.label)}</strong>${pr?`<span> · confronto con ${dateIT(pr.from)} – ${dateIT(pr.to)}</span>`:''}</div>
  <div class="operations-kpi-grid statistics-kpis">${statKpi('Servizi',snap.services,'Coinvolti nel periodo',snap.services,prev?.services)}${statKpi('Uscite',snap.visits,'Complessive',snap.visits,prev?.visits)}${statKpi('Importi maturati',money(snap.revenue),'Servizi da verificare o chiusi',snap.revenue,prev?.revenue,{moneyValue:true})}${statKpi('Margine lordo',money(snap.margin),'Importi meno compensi',snap.margin,prev?.margin,{moneyValue:true})}</div>
  <div class="statistics-grid"><section class="statistics-panel statistics-wide"><div class="section-title-row"><div><h3>Andamento importi maturati</h3><p class="muted">Trend temporale del periodo selezionato.</p></div></div><div class="statistics-bars">${trend.map(x=>{const h=maxRevenue>0?(x.revenue/maxRevenue)*100:0;return `<div class="statistics-bar-item"><div class="statistics-bar-track" title="${esc(x.label)} · ${money(x.revenue)}"><span style="height:${h}%"></span></div><strong>${esc(x.label)}</strong><small>${money(x.revenue)}</small></div>`}).join('')||'<p class="muted">Nessun dato.</p>'}</div></section>
  <section class="statistics-panel"><h3>Stati dei servizi</h3><p class="muted">Comprende anche gli annullati per dare il quadro reale del periodo.</p>${opStatusRows(snap.allRows)}</section>
  <section class="statistics-panel"><h3>Clienti e animali più attivi</h3><h4>Clienti · per uscite</h4>${statsRankingHtml(customerRank,cname)}<h4 class="statistics-subheading">Animali · per uscite</h4>${statsRankingHtml(animalRank,dname)}</section>
  <section class="statistics-panel"><h3>Tipi di servizio</h3><p class="muted">Ordinati per numero di uscite.</p>${statsServiceTypeHtml(snap.active,r)}</section>
  <section class="statistics-panel"><h3>Carico per dipendente</h3><p class="muted">Servizi, uscite e compensi maturati.</p>${statsEmployeeHtml(snap.active,r)}</section>
  <section class="statistics-panel"><h3>Tipi di animale</h3><p class="muted">Distribuzione delle attività per specie/tipologia.</p>${statsAnimalTypeHtml(snap.active,r)}</section></div>`;
}
function opStatusRows(services){const keys=['programmato','in_corso','da_verificare','chiuso','annullato'];return keys.map(k=>{const n=services.filter(s=>s.status===k).length,p=services.length?Math.round(n/services.length*100):0;return `<div class="statistics-status-row"><div><span>${esc(statusLabels[k]||k)}</span><strong>${n}</strong></div><div class="statistics-progress"><i style="width:${p}%"></i></div></div>`}).join('')}
window.setStatisticsPeriod=period=>{operationsState.statisticsPeriod=period;if(period==='custom'&&!operationsState.statisticsFrom){const now=statsToday();operationsState.statisticsFrom=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;operationsState.statisticsTo=statsDate(now)}renderStatistics()};
window.applyStatisticsRange=()=>{let from=$('#statisticsFrom')?.value,to=$('#statisticsTo')?.value;if(!from||!to)return toast('Seleziona entrambe le date');if(from>to)[from,to]=[to,from];const today=localDate();if(to>today)to=today;operationsState.statisticsFrom=from;operationsState.statisticsTo=to;renderStatistics()};
