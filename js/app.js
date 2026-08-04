'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const C=window.K9_CONFIG||{};
const DEFAULT_SETTINGS={id:1,organization_name:C.ORGANIZATION_NAME||'K9 Napoletano Academy',app_name:C.APP_NAME||'K9 Studio Dogsitter',subtitle:'',description:'',address:'',postal_code:'',city:'',province:'',country:'Italia',phone:'',mobile:'',email:'',website:'',vat_number:'',fiscal_code:'',iban:'',social_text:'',footer_text:'',legal_text:'',primary_color:'#0f5f53',secondary_color:'#153e75',header_color:'#ffffff',card_color:'#ffffff',button_color:'#0f5f53',logo_url:'',logo_size:48,logo_position:'sinistra',show_logo_pdf:true,show_header_pdf:true,show_footer_pdf:true,show_fiscal_data_pdf:true,show_qr_pdf:false,show_photos_pdf:false,show_signatures_pdf:false,pdf_attachments:[],attach_pdfs_to_quotes:true};
const state={session:null,profile:null,customers:[],dogs:[],profiles:[],services:[],quotes:[],documents:[],communications:[],communicationReads:[],notifications:[],trash:[],settings:{...DEFAULT_SETTINGS}};
const roleLabels={owner:'Datore di lavoro',vice_admin:'Vice amministratore',dipendente:'Dipendente'};
const statusLabels={programmato:'Programmato',in_corso:'In corso',da_verificare:'Da verificare',chiuso:'Chiuso',annullato:'Annullato'};
const esc=v=>String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
const money=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(n||0));
const dateIT=v=>v?new Date(v+'T12:00:00').toLocaleDateString('it-IT'):'—';
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseLocalDate=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!match)return null;const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12,0,0,0);return Number.isNaN(date.getTime())?null:date};
const addDays=(value,days)=>{const date=parseLocalDate(value);if(!date)throw Error('Data non valida.');date.setDate(date.getDate()+Number(days||0));return localDate(date)};
const daysBetween=(from,to)=>{const start=parseLocalDate(from),end=parseLocalDate(to);if(!start||!end)return null;return Math.round((end-start)/86400000)};
const quoteValidityValue=(quoteDate,validUntil)=>{const days=daysBetween(quoteDate,validUntil);return [7,15,30,60,90].includes(days)?String(days):'custom'};
const normalizePeriods=(record={},kind='service')=>{
  let raw=record?.periods;
  if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{raw=[]}}
  if(Array.isArray(raw)&&raw.length)return raw.map((p,i)=>({
    start_date:p.start_date||p.service_date||record.service_date||record.start_date||localDate(),
    end_date:p.end_date||p.start_date||p.service_date||record.end_date||record.service_date||record.start_date||localDate(),
    daily_visits:Math.max(1,Number(p.daily_visits||1)),
    time_slot_1:p.time_slot_1||null,time_slot_2:p.time_slot_2||null,time_slot_3:p.time_slot_3||null,time_slot_4:p.time_slot_4||null,
    position:Number(p.position||i+1)
  }));
  const start=record.service_date||record.start_date||localDate(),end=record.end_date||start;
  return [{start_date:start,end_date:end,daily_visits:Math.max(1,Number(record.daily_visits||1)),time_slot_1:record.time_slot_1||record.service_time||null,time_slot_2:record.time_slot_2||null,time_slot_3:record.time_slot_3||null,time_slot_4:record.time_slot_4||null,position:1}];
};
const periodDays=p=>daysInclusive(p?.start_date,p?.end_date||p?.start_date);
const periodVisits=p=>Math.max(1,Number(p?.daily_visits||1))*periodDays(p);
const periodsTotals=periods=>({days:(periods||[]).reduce((a,p)=>a+periodDays(p),0),visits:(periods||[]).reduce((a,p)=>a+periodVisits(p),0)});
const periodClientTotal=(period,unitPrice)=>periodVisits(period)*Math.max(0,Number(unitPrice||0));
const quoteUnitPriceOf=quote=>Number((quote?.quote_items||[]).sort((a,b)=>Number(a.position||0)-Number(b.position||0))[0]?.unit_price||0);
const serviceOccursOn=(record,date)=>normalizePeriods(record).some(p=>p.start_date<=date&&(p.end_date||p.start_date)>=date);
const visitsOnDate=(record,date)=>normalizePeriods(record).filter(p=>p.start_date<=date&&(p.end_date||p.start_date)>=date).reduce((sum,p)=>sum+Math.max(1,Number(p.daily_visits||1)),0);
const serviceFirstDate=record=>normalizePeriods(record).map(p=>p.start_date).filter(Boolean).sort()[0]||record.service_date||record.start_date||'';
const periodsSummary=record=>normalizePeriods(record).map(p=>p.start_date===p.end_date?dateIT(p.start_date):`${dateIT(p.start_date)} – ${dateIT(p.end_date)}`).join(' · ');
const periodSlots=p=>[p.time_slot_1,p.time_slot_2,p.time_slot_3,p.time_slot_4].filter(Boolean).join(' · ')||'Non indicate';
function periodRow(kind,p={},index=0){
  const visits=Math.max(1,Number(p.daily_visits||1));
  const quoteEconomics=kind==='quote'?`<div class="period-economic wide"><div><span>Prezzo cliente per uscita</span><strong class="period-unit-price">0,00 €</strong></div><div><span>Totale periodo</span><strong class="period-amount">0,00 €</strong></div></div>`:'';
  return `<div class="period-row" data-period-index="${index}"><div class="period-row-head"><strong>Periodo ${index+1}</strong><button type="button" class="danger compact-button" onclick="removePeriodRow('${kind}',this)">Rimuovi</button></div><div class="form-grid"><label>Data inizio<input class="period-start" type="date" value="${esc(p.start_date||localDate())}" required></label><label>Data fine<input class="period-end" type="date" value="${esc(p.end_date||p.start_date||localDate())}" required></label><label class="period-visits-label"><span class="period-visits-caption">Uscite / visite al giorno</span><select class="period-visits">${selectOptions(visitPresets,visits)}</select></label>${[1,2,3,4].map(n=>`<label class="period-slot period-slot-${n} ${n>visits?'hidden':''}">Fascia oraria ${n}ª<select class="period-time-${n}">${selectOptions(timeSlotPresets,p[`time_slot_${n}`]||'')}</select></label>`).join('')}<div class="period-calculation wide"><span>Giorni</span><strong class="period-days">${periodDays(p)}</strong><span class="period-total-caption">Uscite del periodo</span><strong class="period-total-visits">${periodVisits(p)}</strong></div>${quoteEconomics}</div></div>`;
}
function readPeriodRows(kind){
  const host=document.getElementById(kind==='quote'?'quotePeriods':'servicePeriods');if(!host)return [];
  return [...host.querySelectorAll('.period-row')].map((row,index)=>{const start=row.querySelector('.period-start')?.value,end=row.querySelector('.period-end')?.value||start;if(!start||!end)throw Error(`Completa le date del periodo ${index+1}.`);if(daysBetween(start,end)<0)throw Error(`Nel periodo ${index+1} la data fine precede la data inizio.`);const daily=Math.max(1,Number(row.querySelector('.period-visits')?.value||1));return {start_date:start,end_date:end,daily_visits:daily,time_slot_1:row.querySelector('.period-time-1')?.value||null,time_slot_2:daily>=2?row.querySelector('.period-time-2')?.value||null:null,time_slot_3:daily>=3?row.querySelector('.period-time-3')?.value||null:null,time_slot_4:daily>=4?row.querySelector('.period-time-4')?.value||null:null,position:index+1}})
}
window.addPeriodRow=(kind,period={})=>{const host=document.getElementById(kind==='quote'?'quotePeriods':'servicePeriods');if(!host)return;host.insertAdjacentHTML('beforeend',periodRow(kind,period,host.querySelectorAll('.period-row').length));bindPeriodRows(kind);kind==='quote'?applyQuoteServiceType($('#quoteServicePreset')?.value||'Dog Walking'):recalculateServiceTotals()};
window.removePeriodRow=(kind,button)=>{const host=document.getElementById(kind==='quote'?'quotePeriods':'servicePeriods');if(!host)return;if(host.querySelectorAll('.period-row').length<=1)return toast('Deve rimanere almeno un periodo.');button.closest('.period-row')?.remove();[...host.querySelectorAll('.period-row')].forEach((r,i)=>{r.dataset.periodIndex=i;const t=r.querySelector('.period-row-head strong');if(t)t.textContent=`Periodo ${i+1}`});kind==='quote'?(recalculateQuoteTotal(),scheduleQuoteDraftSave()):recalculateServiceTotals()};
function bindPeriodRows(kind){const host=document.getElementById(kind==='quote'?'quotePeriods':'servicePeriods');if(!host)return;host.querySelectorAll('.period-row').forEach(row=>{const refresh=()=>{const visits=Math.max(1,Number(row.querySelector('.period-visits')?.value||1));const quoteRule=kind==='quote'?quoteServiceRule($('#quoteServicePreset')?.value||'Dog Walking'):null;for(let i=1;i<=4;i++)row.querySelector(`.period-slot-${i}`)?.classList.toggle('hidden',kind==='quote'?!quoteRule.showSlots||i>visits:i>visits);const start=row.querySelector('.period-start')?.value,end=row.querySelector('.period-end')?.value||start,days=start&&end?daysInclusive(start,end):0;row.querySelector('.period-days').textContent=days;row.querySelector('.period-total-visits').textContent=days*visits;kind==='quote'?recalculateQuoteTotal():recalculateServiceTotals()};row.querySelectorAll('input,select').forEach(el=>{el.oninput=refresh;el.onchange=refresh});refresh()})}
const toast=m=>{const e=$('#toast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600)};
function reportRuntimeError(error,context='Errore applicazione'){const message=error?.message||String(error||'Errore imprevisto');console.error(context,error);if(document.readyState!=='loading')toast(`${context}: ${message}`)}
window.addEventListener('error',event=>{if(event?.error)reportRuntimeError(event.error,'Errore JavaScript')});
window.addEventListener('unhandledrejection',event=>{event.preventDefault();reportRuntimeError(event.reason,'Operazione non completata')});
function verifyRuntimeDependencies(){const missing=[];if(!window.PDFLib)missing.push('motore unione PDF');if(!window.pdfjsLib)missing.push('anteprima PDF');if(missing.length)toast(`Funzioni non disponibili: ${missing.join(', ')}. Verifica la connessione e ricarica l’app.`)}
const isAdmin=()=>['owner','vice_admin'].includes(state.profile?.role), isOwner=()=>state.profile?.role==='owner', isEmployee=()=>state.profile?.role==='dipendente';
function configured(){return /^https:\/\/.+\.supabase\.co$/.test(C.SUPABASE_URL||'')&&!String(C.SUPABASE_ANON_KEY||'').startsWith('INCOLLA_')}
function authHeaders(extra={}){return {'apikey':C.SUPABASE_ANON_KEY,'Authorization':`Bearer ${state.session?.access_token||C.SUPABASE_ANON_KEY}`,'Content-Type':'application/json',...extra}}
async function refreshSession(){if(!state.session?.refresh_token)throw Error('Sessione scaduta.');const r=await fetch(`${C.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:state.session.refresh_token})});const d=await r.json();if(!r.ok)throw Error(d.error_description||d.msg||'Sessione scaduta.');state.session=d;localStorage.setItem('k9_session',JSON.stringify(d));return d}
async function request(path,opt={},retry=true){if(!configured())throw Error('Configura config.js prima della pubblicazione.');let r=await fetch(C.SUPABASE_URL+path,{...opt,headers:{...authHeaders(),...(opt.headers||{})}});if(r.status===401&&retry&&state.session?.refresh_token){await refreshSession();return request(path,opt,false)}const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw Error(data?.message||data?.error_description||data?.hint||text||`Errore ${r.status}`);return data}
async function currentAuthUser(){if(!state.session?.access_token)throw Error('Sessione non disponibile. Accedi nuovamente.');if(Date.now()/1000>(state.session.expires_at||0)-60)await refreshSession();const r=await fetch(`${C.SUPABASE_URL}/auth/v1/user`,{headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`}});const d=await r.json();if(!r.ok||!d?.id)throw Error(d?.message||d?.msg||'Sessione utente non valida.');if(state.profile?.id&&d.id!==state.profile.id)throw Error('Sessione non coerente con il profilo aperto. Esci e accedi nuovamente.');return d}
async function invokeHyperHandler(body,retry=true){await currentAuthUser();const requestId=(crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`);const r=await fetch(`${C.SUPABASE_URL}/functions/v1/hyper-handler`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':'application/json','X-Request-Id':requestId},body:JSON.stringify(body)});if(r.status===401&&retry&&state.session?.refresh_token){await refreshSession();return invokeHyperHandler(body,false)}const text=await r.text();let data;try{data=text?JSON.parse(text):{}}catch{data={message:text}}if(!r.ok)throw Error(data?.message||`Errore funzione ${r.status} · richiesta ${requestId}`);return data}
window.previewProfilePhoto=event=>{const file=event.target.files?.[0];if(!file)return;const allowed=['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type)){event.target.value='';return toast('Formato foto non supportato. Usa JPG, PNG o WEBP.')}if(file.size>5*1024*1024){event.target.value='';return toast('La foto supera il limite di 5 MB.')}const reader=new FileReader();reader.onload=()=>{const img=$('#profilePhotoPreview');if(img)img.src=String(reader.result)};reader.readAsDataURL(file)};
async function uploadProfilePhoto(userId,file){const allowed=['image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type))throw Error('Formato foto non supportato.');if(file.size>5*1024*1024)throw Error('La foto supera il limite di 5 MB.');await currentAuthUser();const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`${userId}/pass-${Date.now()}.${ext}`;const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/profile-photos/${path}`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':file.type,'x-upsert':'true'},body:file});const text=await r.text();if(!r.ok)throw Error((()=>{try{return JSON.parse(text).message}catch{return text}})()||'Caricamento foto non riuscito');return `${C.SUPABASE_URL}/storage/v1/object/public/profile-photos/${path}`}
const select=(table,q='select=*')=>request(`/rest/v1/${table}?${q}`);
const insert=(table,data)=>request(`/rest/v1/${table}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});
const update=(table,id,data)=>request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});
const rpc=(name,body={})=>request(`/rest/v1/rpc/${name}`,{method:'POST',body:JSON.stringify(body)});
async function login(email,password){const r=await fetch(`${C.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw Error(d.error_description||d.msg||'Accesso non riuscito');state.session=d;localStorage.setItem('k9_session',JSON.stringify(d));await bootstrap()}
async function logout(){try{await request('/auth/v1/logout',{method:'POST'})}catch{}localStorage.removeItem('k9_session');location.reload()}
async function restore(){try{state.session=JSON.parse(localStorage.getItem('k9_session')||'null')}catch{}if(!state.session)return false;try{if(Date.now()/1000>(state.session.expires_at||0)-60)await refreshSession();await bootstrap();return true}catch(e){localStorage.removeItem('k9_session');return false}}
async function bootstrap(){const p=await select('profiles',`select=*&id=eq.${state.session.user.id}&limit=1`);state.profile=p[0];if(!state.profile||!state.profile.active)throw Error('Account non attivo.');await loadSettings();applyIdentity();$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');$('#roleLabel').textContent=`${state.profile.full_name||state.profile.email} · ${roleLabels[state.profile.role]||state.profile.role}`;buildNav();await loadAll();buildNav();startNotificationPolling();show('dashboard')}
function communicationReadByCurrentUser(message){return state.communicationReads.some(r=>r.message_id===message.id&&r.user_id===state.profile?.id)}
function communicationReadByRecipient(message){return state.communicationReads.some(r=>r.message_id===message.id&&r.user_id!==message.author_id)}
function unreadCommunicationCount(serviceId=null){return state.communications.filter(m=>(!serviceId||m.service_id===serviceId)&&m.status==='sent'&&m.author_id!==state.profile?.id&&!communicationReadByCurrentUser(m)).length}
function unreadNotificationCount(){return state.notifications.filter(n=>!n.read_at).length}
let notificationPollTimer=null,knownNotificationIds=new Set();
function renderNotifications(){const host=$('#notificationList');if(!host)return;host.innerHTML=state.notifications.map(n=>`<details class="record-accordion notification-card ${n.read_at?'':'unread'}"><summary><div class="record-summary-main"><span class="record-title">${esc(n.title||'Nuova comunicazione')}</span><small>${new Date(n.created_at).toLocaleString('it-IT')}</small></div>${n.read_at?'':`<span class="service-message-badge">Nuova</span>`}<span class="accordion-chevron"></span></summary><article class="record-expanded"><p>${esc(n.message||'')}</p><div class="card-actions">${n.service_id?`<button class="primary" onclick="openNotification('${n.id}','${n.service_id}')">Apri servizio</button>`:`<button class="primary" onclick="markNotificationRead('${n.id}')">Segna letta</button>`}</div></article></details>`).join('')||'<div class="card">Nessuna notifica.</div>'}
window.markNotificationRead=async id=>{try{await rpc('mark_app_notification_read',{p_notification_id:id});const n=state.notifications.find(x=>x.id===id);if(n)n.read_at=new Date().toISOString();buildNav();renderNotifications()}catch(e){toast(e.message)}};
window.openNotification=async(id,serviceId)=>{await markNotificationRead(id);show('services');setTimeout(()=>openServiceCommunications(serviceId),50)};
async function refreshNotifications({system=true}={}){if(!state.session)return;try{const rows=await select('app_notifications','select=*&order=created_at.desc');const fresh=rows.filter(n=>!knownNotificationIds.has(n.id)&&!n.read_at);state.notifications=rows;rows.forEach(n=>knownNotificationIds.add(n.id));buildNav();if(!$('#notifications')?.classList.contains('hidden'))renderNotifications();if(fresh.length&&document.visibilityState==='visible')toast(fresh.length===1?fresh[0].title:`${fresh.length} nuove notifiche`);if(system&&fresh.length&&document.visibilityState!=='visible'&&'Notification'in window&&Notification.permission==='granted'){for(const n of fresh.slice(0,3))new Notification(n.title||'K9 Studio Dogsitter',{body:n.message||'Nuova comunicazione',icon:'assets/icon-192.png',tag:n.id})}}catch(e){console.warn('Notifiche:',e)}}
function startNotificationPolling(){if(notificationPollTimer)clearInterval(notificationPollTimer);knownNotificationIds=new Set(state.notifications.map(n=>n.id));notificationPollTimer=setInterval(()=>refreshNotifications(),30000)}
window.enableSystemNotifications=async()=>{if(!('Notification'in window))return toast('Notifiche di sistema non supportate.');const p=await Notification.requestPermission();toast(p==='granted'?'Notifiche attivate':'Permesso notifiche non concesso')};
function buildNav(){const a=[['dashboard','Dashboard'],['customers','Clienti'],['dogs','Cani'],['employees','Utenti'],['services','Servizi'],['quotes','Preventivi'],['payments','Economia'],['documents','Documenti'],['notifications','Notifiche'],['audit','Log'],['trash','Cestino'],['profile','Pass'],['settings','Impostazioni']];const e=[['dashboard','Oggi'],['customers','Clienti assegnati'],['dogs','Cani assegnati'],['services','I miei servizi'],['compensation','Compensi'],['notifications','Notifiche'],['profile','Il mio pass']];const unread=unreadCommunicationCount(),unreadN=unreadNotificationCount();$('#nav').innerHTML=(isAdmin()?a:e).map(([id,l])=>`<button data-screen="${id}">${l}${id==='services'&&unread?`<span class="nav-notification">${unread}</span>`:''}${id==='notifications'&&unreadN?`<span class="nav-notification">${unreadN}</span>`:''}</button>`).join('')}
async function loadDocuments(){
  let serviceDocs=[];let quoteDocs=[];
  try{serviceDocs=await select('dogsitter_document_versions','select=*&order=created_at.desc')}catch(e){console.warn('Archivio servizi versionato non ancora installato:',e.message);try{serviceDocs=await select('dogsitter_documents','select=*&order=created_at.desc')}catch{serviceDocs=[]}}
  try{quoteDocs=(await select('dogsitter_quote_document_versions','select=*&order=created_at.desc')).map(d=>({...d,source_kind:'quote',document_type:'quote'}))}catch(e){console.warn('Archivio preventivi non ancora installato:',e.message)}
  return [...quoteDocs,...serviceDocs];
}
async function loadQuotes(){try{return await select('dogsitter_quotes','select=*,quote_items:dogsitter_quote_items(*)&deleted_at=is.null&order=created_at.desc')}catch(e){console.warn('Modulo preventivi non ancora installato:',e.message);return []}}
async function loadCommunicationReads(){try{return await select('service_communication_reads','select=*&order=read_at.asc')}catch(error){console.warn('Ricevute comunicazioni non disponibili:',error?.message||error);return []}}
async function loadAll(){if(isAdmin()){[state.customers,state.dogs,state.profiles,state.services,state.quotes,state.documents,state.communications,state.communicationReads,state.notifications]=await Promise.all([select('customers','select=*&deleted_at=is.null&order=last_name.asc,first_name.asc'),select('dogs','select=*&deleted_at=is.null&order=name.asc'),select('profiles','select=*&order=full_name.asc'),select('dogsitter_services','select=*&deleted_at=is.null&order=service_date.desc,service_time.asc'),loadQuotes(),loadDocuments(),select('service_communications','select=*&order=created_at.asc'),loadCommunicationReads(),select('app_notifications','select=*&order=created_at.desc')])}else{const d=await rpc('employee_workspace');state.customers=d.customers||[];state.dogs=d.dogs||[];state.services=d.services||[];state.quotes=[];state.documents=[];state.profiles=[];[state.communications,state.communicationReads,state.notifications]=await Promise.all([select('service_communications','select=*&order=created_at.asc'),loadCommunicationReads(),select('app_notifications','select=*&order=created_at.desc')])}}
function show(id){$$('.screen').forEach(e=>e.classList.add('hidden'));$('#'+id).classList.remove('hidden');$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));render(id)}
function render(id){({dashboard:renderDashboard,customers:renderCustomers,dogs:renderDogs,employees:renderEmployees,services:renderServices,quotes:renderQuotes,compensation:renderComp,payments:renderPayments,documents:renderDocs,notifications:renderNotifications,audit:renderAudit,trash:renderTrash,profile:renderPass,settings:renderSettings}[id]||(()=>{}))()}
const cname=id=>{const c=state.customers.find(x=>x.id===id);return c?`${c.first_name} ${c.last_name}`:'—'}, dname=id=>state.dogs.find(x=>x.id===id)?.name||'—', pname=id=>state.profiles.find(x=>x.id===id)?.full_name||'—';
const firstValue=(obj,...keys)=>{for(const key of keys){const value=obj?.[key];if(value!==undefined&&value!==null&&String(value).trim()!=='')return value}return ''};
const joinedValues=(obj,keys,separator=' · ')=>keys.map(key=>firstValue(obj,key)).filter(value=>String(value).trim()!=='').join(separator);
const displayValue=(value,fallback='Non indicato')=>String(value??'').trim()||fallback;
const servicePeriod=s=>periodsSummary(s)||'—';
const serviceSlots=s=>normalizePeriods(s).map((p,i)=>`P${i+1}: ${periodSlots(p)}`).join(' · ')||'Non indicate';
const totalVisits=s=>Math.max(1,periodsTotals(normalizePeriods(s)).visits);
const matured=s=>['da_verificare','chiuso'].includes(s.status);
async function loadSettings(){try{const rows=await select('app_settings','select=*&id=eq.1&limit=1');state.settings={...DEFAULT_SETTINGS,...(rows[0]||{})}}catch(e){state.settings={...DEFAULT_SETTINGS};console.warn('Impostazioni non ancora installate:',e.message)}}
function identityLogo(){return state.settings.logo_url||'assets/logo.png'}
function applyIdentity(){const x=state.settings||DEFAULT_SETTINGS;document.documentElement.style.setProperty('--p',x.primary_color||DEFAULT_SETTINGS.primary_color);document.documentElement.style.setProperty('--p2',x.secondary_color||DEFAULT_SETTINGS.secondary_color);document.documentElement.style.setProperty('--header',x.header_color||'#ffffff');document.documentElement.style.setProperty('--card',x.card_color||'#ffffff');document.documentElement.style.setProperty('--button',x.button_color||x.primary_color||DEFAULT_SETTINGS.button_color);document.title=x.app_name||DEFAULT_SETTINGS.app_name;const logo=identityLogo();const appLogo=$('#appLogo');if(appLogo){appLogo.src=logo;appLogo.style.width=`${Number(x.logo_size||48)}px`;appLogo.style.height=`${Number(x.logo_size||48)}px`}const loginLogo=$('.auth-card .logo');if(loginLogo)loginLogo.src=logo;const brand=$('#appBrandName');if(brand)brand.textContent=x.app_name||DEFAULT_SETTINGS.app_name;const b=$('.brand');if(b){b.classList.remove('logo-left','logo-center','logo-right');b.classList.add(x.logo_position==='centro'?'logo-center':x.logo_position==='destra'?'logo-right':'logo-left')}}
function settingField(name,label,type='text',wide=false){const v=state.settings[name]??'';const attrs=name==='logo_size'?' min="28" max="160" step="1" inputmode="numeric"':'';return `<label class="${wide?'wide':''}">${label}<input name="${name}" type="${type}" value="${esc(v)}"${attrs}></label>`}
function storageObjectPath(publicUrl,bucket){try{const marker=`/storage/v1/object/public/${bucket}/`;const i=String(publicUrl||'').indexOf(marker);return i>=0?decodeURIComponent(String(publicUrl).slice(i+marker.length)):''}catch{return ''}}
async function removeStorageObject(bucket,path){if(!path)return;const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`,{method:'DELETE',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`}});if(!r.ok&&r.status!==404){const t=await r.text();throw Error(t||`Impossibile eliminare il file da ${bucket}`)}}
function cleanSettingValue(name,value){const v=String(value??'').trim();if(name==='email')return v.toLowerCase();if(name==='website'&&v&&!/^https?:\/\//i.test(v))return `https://${v}`;return v}
function settingArea(name,label){return `<label class="wide">${label}<textarea name="${name}">${esc(state.settings[name]||'')}</textarea></label>`}
function checkField(name,label){return `<label class="check-row"><input name="${name}" type="checkbox" ${state.settings[name]?'checked':''}><span>${label}</span></label>`}

function pdfAttachments(){let a=state.settings.pdf_attachments;if(typeof a==='string'){try{a=JSON.parse(a)}catch{a=[]}}return Array.isArray(a)?a:[]}
const formatFileSize=bytes=>{const n=Number(bytes||0);if(!n)return 'Dimensione non disponibile';if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`};
function attachmentSettingsBlock(){
  const attachments=pdfAttachments();
  const rows=attachments.map(a=>`<article class="pdf-attachment-card ${a.enabled===false?'is-disabled':''}">
    <div class="pdf-attachment-icon" aria-hidden="true">PDF</div>
    <div class="pdf-attachment-info"><strong title="${esc(a.name)}">${esc(a.name)}</strong><div class="pdf-attachment-meta"><span>${a.enabled===false?'Disattivato':'Attivo'}</span><span>${formatFileSize(a.size)}</span>${a.pages?`<span>${Number(a.pages)} pagine</span>`:''}</div><small>Caricato ${a.created_at?new Date(a.created_at).toLocaleString('it-IT'):'—'}</small></div>
    <div class="pdf-attachment-actions"><button type="button" onclick="previewPdfAttachment('${a.id}')">Anteprima</button><button type="button" onclick="downloadPdfAttachment('${a.id}')">Scarica</button><button type="button" onclick="preparePdfAttachmentReplace('${a.id}')">Sostituisci</button><button type="button" onclick="togglePdfAttachment('${a.id}')">${a.enabled===false?'Attiva':'Disattiva'}</button><button type="button" class="danger" onclick="removePdfAttachment('${a.id}')">Elimina</button></div>
  </article>`).join('')||'<div class="pdf-attachments-empty"><strong>Nessun allegato caricato</strong><span>Carica regolamento, privacy, condizioni o altri documenti da unire al preventivo.</span></div>';
  return `<div class="settings-info-banner"><strong>Allegati automatici al PDF cliente</strong><p>I PDF attivi vengono aggiunti in coda al preventivo cliente. Non vengono inseriti nel PDF interno e non vengono inviati automaticamente.</p><span>${attachments.length} ${attachments.length===1?'allegato':'allegati'} configurati</span></div>
  <div class="pdf-upload-control"><input id="pdfAttachmentFile" class="visually-hidden" type="file" accept="application/pdf"><button type="button" class="primary" onclick="preparePdfAttachmentUpload()">+ Carica PDF</button><span id="pdfAttachmentSelection" class="muted">Nessun file selezionato</span></div>
  <label class="checkbox-line pdf-auto-attach-toggle"><input type="checkbox" name="attach_pdfs_to_quotes" ${state.settings.attach_pdfs_to_quotes!==false?'checked':''}> Allega automaticamente i PDF attivi ai preventivi</label>
  <div class="pdf-attachment-list">${rows}</div>`}
async function saveAttachmentList(list){const rows=await request('/rest/v1/app_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({pdf_attachments:list})});if(Array.isArray(rows)&&!rows.length)throw Error('Impostazioni allegati non aggiornate');state.settings.pdf_attachments=list}
window.preparePdfAttachmentUpload=()=>{const input=$('#pdfAttachmentFile');if(!input)return;delete input.dataset.replaceId;input.click()};
window.preparePdfAttachmentReplace=id=>{const input=$('#pdfAttachmentFile');if(!input)return;input.dataset.replaceId=id;input.click()};
async function attachmentPageCount(file){try{if(!window.PDFLib?.PDFDocument)return null;const doc=await PDFLib.PDFDocument.load(await file.arrayBuffer(),{ignoreEncryption:true});return doc.getPageCount()}catch{return null}}
window.uploadPdfAttachment=async e=>{const input=e.target,file=input.files?.[0],replaceId=input.dataset.replaceId||'';if(!file)return;const selection=$('#pdfAttachmentSelection');if(selection)selection.textContent=file.name;if(file.type!=='application/pdf'){input.value='';delete input.dataset.replaceId;return toast('Seleziona un file PDF valido.')}if(file.size>10*1024*1024){input.value='';delete input.dataset.replaceId;return toast('Il PDF supera 10 MB.')}let path='';try{const current=pdfAttachments(),old=replaceId?current.find(x=>x.id===replaceId):null,id=old?.id||crypto.randomUUID(),safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),newPath=`settings/${crypto.randomUUID()}-${safe}`;path=newPath;const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/pdf-attachments/${newPath}`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':'application/pdf','x-upsert':'false'},body:file});const t=await r.text();if(!r.ok)throw Error(t||'Caricamento non riuscito');const pages=await attachmentPageCount(file),entry={id,name:file.name,path:newPath,size:file.size,pages,enabled:old?.enabled!==false,created_at:new Date().toISOString()};const list=old?current.map(x=>x.id===id?entry:x):[...current,entry];try{await saveAttachmentList(list)}catch(err){await removeStorageObject('pdf-attachments',newPath).catch(()=>{});throw err}if(old?.path&&old.path!==newPath)await removeStorageObject('pdf-attachments',old.path).catch(()=>{});renderSettings();toast(old?'PDF sostituito':'PDF allegato salvato')}catch(err){toast(err.message||'Caricamento allegato non riuscito')}finally{input.value='';delete input.dataset.replaceId}};
async function fetchPdfAttachmentBlob(path){const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/pdf-attachments/${path}`,{headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`}});if(!r.ok)throw Error('Impossibile leggere il PDF allegato.');return await r.blob()}
window.previewPdfAttachment=async id=>{
  const a=pdfAttachments().find(x=>x.id===id);
  if(!a)return toast('Allegato non trovato');
  try{
    const blob=await fetchPdfAttachmentBlob(a.path);
    const fileUrl=URL.createObjectURL(blob);
    const title=esc(a.name||'Allegato PDF');
    const meta=[a.pages?`${Number(a.pages)} ${Number(a.pages)===1?'pagina':'pagine'}`:'',formatFileSize(a.size)].filter(Boolean).join(' · ');
    modal('Anteprima PDF',`<section class="pdf-preview-shell">
      <header class="pdf-preview-header">
        <div class="pdf-preview-file-icon" aria-hidden="true">PDF</div>
        <div class="pdf-preview-file-info"><strong title="${title}">${title}</strong><span>${esc(meta||'Documento PDF')}</span></div>
      </header>
      <div id="pdfPreviewStatus" class="pdf-preview-status">Preparazione anteprima…</div>
      <div id="pdfPreviewPages" class="pdf-preview-pages" aria-live="polite"></div>
      <div class="pdf-preview-fallback hidden" id="pdfPreviewFallback"><p>Il visualizzatore integrato non è disponibile su questo dispositivo.</p><button type="button" class="primary" id="pdfPreviewOpenExternal">Apri il PDF</button></div>
      <footer class="pdf-preview-actions"><button type="button" id="pdfPreviewDownload">Scarica</button><button type="button" class="primary" id="pdfPreviewOpen">Apri a schermo intero</button></footer>
    </section>`,async()=>{});
    const save=$('#modalSave');if(save)save.classList.add('hidden');
    const cancel=$('#modalForm .modal-actions button[value=cancel]');if(cancel)cancel.textContent='Chiudi';
    const openFile=()=>{const w=window.open(fileUrl,'_blank','noopener,noreferrer');if(!w)toast('Consenti l’apertura del PDF nel browser.')};
    $('#pdfPreviewOpen')?.addEventListener('click',openFile);
    $('#pdfPreviewOpenExternal')?.addEventListener('click',openFile);
    $('#pdfPreviewDownload')?.addEventListener('click',()=>{const link=document.createElement('a');link.href=fileUrl;link.download=a.name||'allegato.pdf';document.body.appendChild(link);link.click();link.remove()});
    const status=$('#pdfPreviewStatus'),pagesHost=$('#pdfPreviewPages'),fallback=$('#pdfPreviewFallback');
    try{
      if(!window.pdfjsLib?.getDocument)throw Error('Visualizzatore PDF non caricato');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const bytes=new Uint8Array(await blob.arrayBuffer());
      const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
      if(status)status.textContent=`${pdf.numPages} ${pdf.numPages===1?'pagina':'pagine'} · scorri per visualizzare`;
      if(pagesHost)pagesHost.innerHTML='';
      for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
        const page=await pdf.getPage(pageNumber);
        const base=page.getViewport({scale:1});
        const available=Math.min(900,Math.max(280,(pagesHost?.clientWidth||600)-24));
        const scale=Math.min(2,available/base.width);
        const viewport=page.getViewport({scale});
        const wrap=document.createElement('figure');wrap.className='pdf-preview-page';
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`Pagina ${pageNumber}`);
        const caption=document.createElement('figcaption');caption.textContent=`Pagina ${pageNumber} di ${pdf.numPages}`;
        wrap.append(canvas,caption);pagesHost?.appendChild(wrap);
        await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
      }
    }catch(renderError){
      console.warn('Anteprima PDF integrata non disponibile:',renderError);
      if(status)status.textContent='Anteprima non disponibile';
      fallback?.classList.remove('hidden');
    }
    const dialog=$('#modal'),cleanup=()=>{URL.revokeObjectURL(fileUrl);dialog.removeEventListener('close',cleanup)};
    dialog.addEventListener('close',cleanup);
  }catch(e){toast(e.message||'Impossibile aprire l’anteprima')}
};
window.downloadPdfAttachment=async id=>{const a=pdfAttachments().find(x=>x.id===id);if(!a)return toast('Allegato non trovato');try{const blob=await fetchPdfAttachmentBlob(a.path),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=a.name||'allegato.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}catch(e){toast(e.message)}};
window.togglePdfAttachment=async id=>{try{const list=pdfAttachments().map(a=>a.id===id?{...a,enabled:a.enabled===false}:a);await saveAttachmentList(list);renderSettings();toast('Allegato aggiornato')}catch(e){toast(e.message)}};
window.removePdfAttachment=async id=>{const a=pdfAttachments().find(x=>x.id===id);if(!a||!confirm(`Rimuovere definitivamente ${a.name}?`))return;try{await removeStorageObject('pdf-attachments',a.path);await saveAttachmentList(pdfAttachments().filter(x=>x.id!==id));renderSettings();toast('Allegato rimosso')}catch(e){toast(e.message)}};

function settingsDetails(title,subtitle,content,open=false){return `<details class="settings-accordion" ${open?'open':''}><summary><span><strong>${title}</strong>${subtitle?`<small>${subtitle}</small>`:''}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><div class="settings-block">${content}</div></details>`}
function renderSettings(){if(!isAdmin()){show('dashboard');return}const s=state.settings;
  const logoBlock=`<div class="logo-preview"><img id="settingsLogoPreview" src="${esc(identityLogo())}" alt="Logo attivo"><div><label>Carica nuovo logo<input id="identityLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><p class="muted">Formati PNG, JPG, WEBP o SVG. Massimo 5 MB.</p><button type="button" id="restoreDefaultLogo">Ripristina logo predefinito</button></div></div><div class="settings-grid">${settingField('logo_size','Dimensione logo (28-160 px)','number')}<label>Posizione logo<select name="logo_position"><option value="sinistra" ${s.logo_position==='sinistra'?'selected':''}>Sinistra</option><option value="centro" ${s.logo_position==='centro'?'selected':''}>Centro</option><option value="destra" ${s.logo_position==='destra'?'selected':''}>Destra</option></select></label></div>`;
  const identityBlock=`<div class="settings-grid">${settingField('organization_name','Nome attività')}${settingField('app_name','Nome applicazione')}${settingField('subtitle','Sottotitolo','text',true)}${settingArea('description','Descrizione')}${settingField('address','Indirizzo')}${settingField('postal_code','CAP')}${settingField('city','Comune')}${settingField('province','Provincia')}${settingField('country','Nazione')}${settingField('phone','Telefono')}${settingField('mobile','Cellulare')}${settingField('email','Email','email')}${settingField('website','Sito web')}${settingField('vat_number','Partita IVA')}${settingField('fiscal_code','Codice fiscale')}${settingField('iban','IBAN','text',true)}${settingArea('social_text','Social e altri riferimenti')}</div>`;
  const graphicsBlock=`<div class="settings-grid">${settingField('primary_color','Colore principale','color')}${settingField('secondary_color','Colore secondario','color')}${settingField('header_color','Colore intestazione','color')}${settingField('card_color','Colore schede','color')}${settingField('button_color','Colore pulsanti','color')}</div><p class="muted">I colori vengono applicati dopo il salvataggio.</p>`;
  const pdfBlock=`<div class="settings-grid">${settingArea('footer_text','Testo piè di pagina')}${settingArea('legal_text','Note legali / privacy')}${checkField('show_logo_pdf','Mostra logo nel PDF')}${checkField('show_header_pdf','Mostra intestazione nel PDF')}${checkField('show_footer_pdf','Mostra piè di pagina e note legali')}${checkField('show_fiscal_data_pdf','Mostra dati fiscali e contatti nel PDF')}${checkField('show_signatures_pdf','Mostra firme nel PDF')}</div><p class="muted">Il QR e la fotografia sono gestiti dal Pass identificativo e non dai PDF di servizio o preventivo.</p>`;
  $('#settingsPanel').innerHTML=`<form id="identityForm">${settingsDetails('Logo','Caricamento, dimensione e posizione',logoBlock,true)}${settingsDetails('Intestazione e dati attività','Dati usati nell’app e nei PDF',identityBlock)}${settingsDetails('Grafica','Colori dell’interfaccia e dei documenti',graphicsBlock)}${settingsDetails('PDF e piè di pagina','Visibilità, dati attività e testi legali',pdfBlock)}${settingsDetails('Allegati automatici ai preventivi','Regolamento, privacy e condizioni',attachmentSettingsBlock())}<div class="settings-actions"><button id="saveSettingsButton" class="primary" type="submit">Salva impostazioni</button><button type="button" id="resetIdentity">Ripristina identità e grafica</button><button type="button" id="resetPdfSettings">Ripristina impostazioni PDF</button></div></form>`;
  $('#identityForm').onsubmit=saveSettings;$('#identityLogoFile').onchange=previewAndUploadLogo;$('#pdfAttachmentFile').onchange=uploadPdfAttachment;$('#restoreDefaultLogo').onclick=()=>setLogoUrl('');$('#resetIdentity').onclick=resetIdentitySettings;$('#resetPdfSettings').onclick=resetPdfSettings}
async function saveSettings(e){e.preventDefault();const form=e.currentTarget,button=$('#saveSettingsButton'),f=new FormData(form),data={};for(const [k,v] of f.entries())data[k]=cleanSettingValue(k,v);['show_logo_pdf','show_header_pdf','show_footer_pdf','show_fiscal_data_pdf','show_signatures_pdf','attach_pdfs_to_quotes'].forEach(k=>data[k]=f.has(k));data.logo_size=Math.max(28,Math.min(160,Number(data.logo_size||48)));if(!data.organization_name||!data.app_name)return toast('Nome attività e nome applicazione sono obbligatori.');if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return toast('Inserisci un indirizzo email valido.');try{if(button){button.disabled=true;button.textContent='Salvataggio...'}const rows=await request('/rest/v1/app_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});if(Array.isArray(rows)&&!rows.length)throw Error('La riga delle impostazioni non è stata aggiornata');state.settings={...state.settings,...data};applyIdentity();toast('Impostazioni salvate')}catch(err){toast(err.message||'Impossibile salvare le impostazioni')}finally{if(button){button.disabled=false;button.textContent='Salva impostazioni'}}}
async function previewAndUploadLogo(e){const file=e.target.files?.[0];if(!file)return;e.target.value='';const allowed=['image/png','image/jpeg','image/webp','image/svg+xml'];if(!allowed.includes(file.type))return toast('Formato logo non valido. Usa PNG, JPG, WEBP o SVG.');if(file.size>5*1024*1024)return toast('Il logo supera 5 MB');const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg'})[file.type];const path=`identity/logo-${Date.now()}.${ext}`;try{const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/app-assets/${path}`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':file.type,'x-upsert':'false'},body:file});const t=await r.text();if(!r.ok)throw Error(t||'Caricamento logo non riuscito');const url=`${C.SUPABASE_URL}/storage/v1/object/public/app-assets/${path}`;try{await setLogoUrl(url)}catch(err){await removeStorageObject('app-assets',path).catch(()=>{});throw err}}catch(err){toast(err.message||'Caricamento logo non riuscito')}}
async function setLogoUrl(url){const previous=state.settings.logo_url||'';const rows=await request('/rest/v1/app_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({logo_url:url})});if(Array.isArray(rows)&&!rows.length)throw Error('Logo non aggiornato');state.settings.logo_url=url;applyIdentity();const p=$('#settingsLogoPreview');if(p)p.src=identityLogo();const oldPath=storageObjectPath(previous,'app-assets');if(oldPath&&previous!==url)await removeStorageObject('app-assets',oldPath).catch(err=>console.warn('Logo precedente non eliminato:',err.message));toast(url?'Logo aggiornato':'Logo predefinito ripristinato')}
async function resetIdentitySettings(){if(!confirm('Ripristinare solo logo, nomi e colori iniziali? Dati fiscali, testi PDF e allegati non verranno modificati.'))return;const keys=['organization_name','app_name','subtitle','description','primary_color','secondary_color','header_color','card_color','button_color','logo_url','logo_size','logo_position'];const data=Object.fromEntries(keys.map(k=>[k,DEFAULT_SETTINGS[k]]));const previous=state.settings.logo_url||'';await request('/rest/v1/app_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});state.settings={...state.settings,...data};applyIdentity();const oldPath=storageObjectPath(previous,'app-assets');if(oldPath)await removeStorageObject('app-assets',oldPath).catch(()=>{});renderSettings();toast('Identità e grafica ripristinate')}
async function resetPdfSettings(){if(!confirm('Ripristinare solo le opzioni PDF e i testi del piè di pagina? Gli allegati caricati resteranno disponibili.'))return;const keys=['footer_text','legal_text','show_logo_pdf','show_header_pdf','show_footer_pdf','show_fiscal_data_pdf','show_signatures_pdf','attach_pdfs_to_quotes'];const data=Object.fromEntries(keys.map(k=>[k,DEFAULT_SETTINGS[k]]));await request('/rest/v1/app_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(data)});state.settings={...state.settings,...data};renderSettings();toast('Impostazioni PDF ripristinate')}

function renderDashboard(){
  const today=localDate(), todays=state.services.filter(s=>serviceOccursOn(s,today)), upcoming=state.services.filter(s=>normalizePeriods(s).some(p=>(p.end_date||p.start_date)>=today)&&s.status!=='annullato').sort((a,b)=>String(serviceFirstDate(a)+a.service_time).localeCompare(String(serviceFirstDate(b)+b.service_time))).slice(0,4);
  if(isAdmin()){
    const toVerify=state.services.filter(s=>s.status==='da_verificare').length;
    const toCollect=state.services.filter(s=>s.customer_payment_status==='da_incassare'&&matured(s)).reduce((a,s)=>a+Number(s.customer_amount||0),0);
    const toPay=state.services.filter(s=>s.employee_payment_status==='da_liquidare'&&matured(s)).reduce((a,s)=>a+Number(s.employee_compensation||0),0);
    $('#dashboard').innerHTML=`<div class="page-title"><div><span class="eyebrow">PANORAMICA OPERATIVA</span><h2>Dashboard amministrativa</h2><p class="muted">Situazione aggiornata dell’attività.</p></div><span class="today-chip">${new Date().toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'})}</span></div><div class="stats dashboard-stats"><div class="stat stat-customers"><span>Clienti attivi</span><strong>${state.customers.filter(c=>c.status==='attivo').length}</strong><small>Anagrafiche disponibili</small></div><div class="stat stat-dogs"><span>Cani</span><strong>${state.dogs.filter(d=>d.active).length}</strong><small>Profili attivi</small></div><div class="stat stat-today"><span>Servizi oggi</span><strong>${todays.length}</strong><small>${todays.reduce((a,s)=>a+visitsOnDate(s,today),0)} uscite previste</small></div><div class="stat stat-review"><span>Da verificare</span><strong>${toVerify}</strong><small>Rapporti in attesa</small></div><div class="stat stat-income"><span>Da incassare</span><strong>${money(toCollect)}</strong><small>Importi cliente maturati</small></div><div class="stat stat-pay"><span>Da liquidare</span><strong>${money(toPay)}</strong><small>Compensi dipendenti</small></div></div><div class="section-title-row"><div><h3>Servizi di oggi</h3><p class="muted">Attività programmate per la giornata.</p></div></div><div class="grid service-grid">${todays.map(serviceCard).join('')||'<div class="card empty-state"><strong>Nessun servizio oggi</strong><span>La giornata non contiene attività programmate.</span></div>'}</div>${!todays.length&&upcoming.length?`<div class="section-title-row compact"><div><h3>Prossimi servizi</h3></div></div><div class="grid service-grid">${upcoming.map(serviceCard).join('')}</div>`:''}`
  }else{
    $('#dashboard').innerHTML=`<div class="page-title"><div><span class="eyebrow">AREA DIPENDENTE</span><h2>Il mio lavoro di oggi</h2></div></div><div class="stats dashboard-stats"><div class="stat stat-today"><span>Servizi</span><strong>${todays.length}</strong><small>Assegnati oggi</small></div><div class="stat stat-dogs"><span>Uscite</span><strong>${todays.reduce((a,s)=>a+visitsOnDate(s,today),0)}</strong><small>Totale previsto</small></div><div class="stat stat-pay"><span>Compenso maturato</span><strong>${money(todays.filter(matured).reduce((a,s)=>a+Number(s.employee_compensation),0))}</strong><small>Solo servizi maturati</small></div></div><div class="grid service-grid">${todays.map(serviceCard).join('')||'<div class="card empty-state"><strong>Nessun servizio oggi</strong><span>Non risultano attività assegnate.</span></div>'}</div>`
  }
}
function linkedDocuments({customerId=null,dogId=null,serviceId=null}={}){
  return (state.documents||[]).filter(d=>{
    if(customerId&&d.customer_id!==customerId)return false;
    if(dogId&&d.dog_id!==dogId)return false;
    if(serviceId&&d.service_id!==serviceId)return false;
    return true;
  }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
function linkedDocumentsBlock(filter,title='Documenti collegati'){
  if(!isAdmin())return '';
  const rows=linkedDocuments(filter);
  if(!rows.length)return `<div class="linked-documents"><b>${esc(title)}</b><span class="muted">Nessun PDF archiviato.</span></div>`;
  return `<div class="linked-documents"><b>${esc(title)}</b><div class="linked-document-list">${rows.map(d=>`<div class="linked-document-row"><div><strong>${esc(documentTypeLabel(d))}</strong><small>${esc(d.file_name||'Documento')} · V${Number(d.version||1)} · ${esc(documentStatusLabel(d.status))}</small></div><div class="linked-document-actions"><button type="button" onclick="openDocument('${d.id}')">Apri</button><button type="button" onclick="downloadStoredDocument('${d.id}')">Scarica</button><button type="button" onclick="shareStoredDocument('${d.id}')">Condividi</button></div></div>`).join('')}</div></div>`;
}
function renderCustomers(){
  $('[data-action="new-customer"]')?.classList.toggle('hidden',!isAdmin());
  $('#customerList').innerHTML=state.customers.map(c=>{
    const dogs=state.dogs.filter(d=>d.customer_id===c.id);
    const services=state.services.filter(x=>x.customer_id===c.id&&x.status!=='annullato').sort((a,b)=>String(serviceFirstDate(a)).localeCompare(String(serviceFirstDate(b))));
    const next=services.find(x=>normalizePeriods(x).some(p=>(p.end_date||p.start_date)>=localDate()));
    const emergencyName=firstValue(c,'emergency_contact_name');
    const emergencyPhone=firstValue(c,'emergency_contact_phone');
    const emergencyType=firstValue(c,'emergency_contact_type');
    const emergency=[emergencyType,emergencyName,emergencyPhone].filter(Boolean).join(' · ')||firstValue(c,'emergency_contact')||'Non indicato';
    const address=[firstValue(c,'address'),[firstValue(c,'postal_code'),firstValue(c,'city')].filter(Boolean).join(' ')].filter(Boolean).join(' · ')||'Non indicato';
    return `<details class="entity-accordion customer-accordion"><summary><span class="accordion-name">${esc(c.first_name)} ${esc(c.last_name)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="entity-expanded"><div class="entity-card-head"><div class="entity-avatar">${esc((c.first_name||'?').slice(0,1)+(c.last_name||'').slice(0,1))}</div><div><span class="entity-kicker">CLIENTE</span><h3>${esc(c.first_name)} ${esc(c.last_name)}</h3></div></div><div class="entity-details"><p><span>Telefono</span><strong>${esc(displayValue(firstValue(c,'phone')))}</strong></p><p><span>Email</span><strong>${esc(displayValue(firstValue(c,'email')))}</strong></p><p class="wide"><span>Indirizzo</span><strong>${esc(address)}</strong></p><p><span>Cani associati</span><strong>${dogs.length}${dogs.length?` · ${esc(dogs.map(d=>d.name).join(', '))}`:''}</strong></p>${isAdmin()?`<p><span>Dipendente assegnato</span><strong>${esc(pname(c.assigned_employee_id))}</strong></p>`:''}<p class="wide"><span>Contatto emergenza</span><strong>${esc(emergency)}</strong></p><p><span>Reperibilità</span><strong>${esc(displayValue(firstValue(c,'availability'),'Non indicata'))}</strong></p>${next?`<p class="wide"><span>Prossimo servizio</span><strong>${servicePeriod(next)} · ${esc(serviceSlots(next))} · ${esc(next.service_type||'Servizio')}</strong></p>`:''}</div>${linkedDocumentsBlock({customerId:c.id},'PDF associati al cliente')}${isAdmin()?`<div class="card-actions"><button class="primary-soft" onclick="openCustomer('${c.id}')">Apri / modifica</button><button onclick="openQuote(null,'${c.id}')">Crea preventivo</button><button class="danger" onclick="archiveEntity('customers','${c.id}','cliente ${esc(c.first_name+' '+c.last_name)}')">Elimina</button></div>`:`<div class="operational-note"><b>Note operative</b><span>${esc(firstValue(c,'operational_notes')||'Nessuna nota operativa')}</span></div>`}</article></details>`
  }).join('')||`<div class="card empty-state"><strong>Nessun cliente</strong><span>${isAdmin()?'Aggiungi il primo cliente per iniziare.':'Non risultano clienti assegnati.'}</span></div>`
}
function renderDogs(){
  $('[data-action="new-dog"]')?.classList.toggle('hidden',!isAdmin());
  $('#dogList').innerHTML=state.dogs.map(d=>{
    const breed=firstValue(d,'breed_detail','breed','breed_type')||'Razza non indicata';
    const health=[firstValue(d,'health_risk'),firstValue(d,'illnesses_detail','illnesses','medical_notes'),firstValue(d,'allergies_detail','allergies'),firstValue(d,'medicines_detail','medicines')].filter(Boolean).join(' · ')||'Nessuna criticità indicata';
    const food=[firstValue(d,'food_type','feeding_notes'),firstValue(d,'food_detail'),firstValue(d,'meals'),firstValue(d,'meal_times')].filter(Boolean).join(' · ')||'Nessuna indicazione';
    const behavior=[firstValue(d,'character','behavior_notes'),firstValue(d,'adults'),firstValue(d,'children'),firstValue(d,'dogs_social'),firstValue(d,'fears_detail','fears'),firstValue(d,'bite_history_detail','bite_history'),firstValue(d,'resource_guarding_detail','resource_guarding')].filter(Boolean).join(' · ')||'Nessuna nota';
    const walk=[firstValue(d,'equipment'),firstValue(d,'equipment_detail'),firstValue(d,'dog_triggers'),firstValue(d,'moving_triggers'),firstValue(d,'avoid_areas_detail','avoid_areas'),firstValue(d,'off_leash'),firstValue(d,'walk_level')].filter(Boolean).join(' · ')||'Indicazioni non compilate';
    const vet=[firstValue(d,'vet_name','vet_status'),firstValue(d,'vet_phone')].filter(Boolean).join(' · ')||'Non indicato';
    return `<details class="entity-accordion dog-accordion"><summary><span class="accordion-name">${esc(d.name)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="entity-expanded"><div class="entity-card-head"><div class="entity-avatar dog-avatar">🐕</div><div><span class="entity-kicker">CANE</span><h3>${esc(d.name)}</h3><p class="entity-subtitle">${esc(breed)}</p></div></div><div class="entity-details"><p><span>Proprietario</span><strong>${esc(cname(d.customer_id))}</strong></p><p><span>Taglia / età</span><strong>${esc([firstValue(d,'size'),firstValue(d,'age_detail','age_range')].filter(Boolean).join(' · ')||'Non indicate')}</strong></p><p><span>Peso / sesso</span><strong>${esc([firstValue(d,'weight_detail'),firstValue(d,'sex'),firstValue(d,'sterilized')].filter(Boolean).join(' · ')||'Non indicati')}</strong></p><p><span>Microchip</span><strong>${esc(firstValue(d,'microchip_number','microchip')||'Non indicato')}</strong></p><p class="wide"><span>Veterinario</span><strong>${esc(vet)}</strong></p><p class="wide"><span>Salute e sicurezza</span><strong>${esc(health)}</strong></p><p class="wide"><span>Alimentazione e routine</span><strong>${esc(food)}</strong></p><p class="wide"><span>Comportamento</span><strong>${esc(behavior)}</strong></p><p class="wide"><span>Passeggiata</span><strong>${esc(walk)}</strong></p>${firstValue(d,'routine_notes')?`<p class="wide"><span>Routine / note operative</span><strong>${esc(firstValue(d,'routine_notes'))}</strong></p>`:''}</div>${linkedDocumentsBlock({dogId:d.id},'PDF associati al cane')}${isAdmin()?`<div class="card-actions"><button class="primary-soft" onclick="openDog('${d.id}')">Apri / modifica</button><button class="danger" onclick="archiveEntity('dogs','${d.id}','cane ${esc(d.name)}')">Elimina</button></div>`:''}</article></details>`
  }).join('')||`<div class="card empty-state"><strong>Nessun cane</strong><span>${isAdmin()?'Collega un cane a un cliente per visualizzarlo qui.':'Non risultano cani assegnati.'}</span></div>`
}
function renderEmployees(){
  const groups=[
    {key:'administrators',label:'Amministratori',rows:state.profiles.filter(p=>p.role==='owner'||p.role==='vice_admin')},
    {key:'employees',label:'Dipendenti',rows:state.profiles.filter(p=>p.role==='dipendente')}
  ];
  $('#employeeList').innerHTML=groups.map(group=>`<details class="account-group" open><summary><span>${group.label}</span><strong>${group.rows.length}</strong></summary><div class="account-group-body">${group.rows.map(p=>{const assigned=state.services.filter(s=>s.employee_id===p.id&&s.status!=='annullato').length;return `<details class="account-row" data-profile-id="${p.id}"><summary><div class="account-summary-main"><span class="entity-avatar employee-avatar">${esc((p.full_name||p.email||'?').slice(0,2).toUpperCase())}</span><div><strong>${esc(p.full_name||p.email)}</strong><small>${esc(roleLabels[p.role]||p.role)} · ${p.active?'Attivo':'Sospeso'}</small></div></div><span class="account-chevron">⌄</span></summary><div class="account-expanded"><div class="entity-details"><p><span>Codice</span><strong>${esc(p.employee_code||'Non assegnato')}</strong></p><p><span>Qualifica</span><strong>${esc(p.qualification||'Non indicata')}</strong></p><p><span>Servizi associati</span><strong>${assigned}</strong></p><p><span>Stato</span><strong class="${p.active?'text-success':'text-danger'}">${p.active?'Attivo':'Sospeso'}</strong></p></div>${p.is_owner?'<div class="protected-note">Titolare protetto</div>':''}<div class="card-actions"><button class="primary-soft" onclick="openEmployee('${p.id}')">Seleziona e gestisci</button>${!p.is_owner&&p.active?`<button class="danger" onclick="deactivateUser('${p.id}','${esc(p.full_name||p.email)}')">Disattiva</button>`:''}</div></div></details>`}).join('')||'<div class="empty-compact">Nessun account in questa categoria.</div>'}</div></details>`).join('')
}
function plannedEndTime(s){const raw=String(s.service_time||'').slice(0,5);if(!/^\d{2}:\d{2}$/.test(raw))return '—';const [h,m]=raw.split(':').map(Number),total=h*60+m+Number(s.planned_duration_minutes||0);return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function communicationLabel(m){return m.author_role==='dipendente'?'Dipendente':m.author_role==='vice_admin'?'Vice amministratore':'Datore di lavoro'}
function communicationStatusLabel(m){if(m.status==='draft')return 'Bozza';return m.author_id===state.profile?.id?(communicationReadByRecipient(m)?'Letta':'Inviata'):(communicationReadByCurrentUser(m)?'Letta':'Nuova')}
function communicationTime(v){return v?new Date(v).toLocaleString('it-IT'):'—'}
function communicationPanel(serviceId){
  const rows=state.communications.filter(m=>m.service_id===serviceId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const visible=rows.filter(m=>m.status==='sent'||m.author_id===state.profile.id);
  const latestDraft=isEmployee()?[...rows].reverse().find(m=>m.author_id===state.profile.id&&m.status==='draft'):null;
  const latestOwnSent=isEmployee()?[...rows].reverse().find(m=>m.author_id===state.profile.id&&m.status==='sent'):null;
  const history=visible.map(m=>`<article class="message-bubble ${m.author_id===state.profile.id?'is-own':'is-incoming'}"><div><strong>${esc(communicationLabel(m))}</strong><span class="message-state ${m.status}">${esc(communicationStatusLabel(m))}</span></div><p>${esc(m.message)}</p><small>${communicationTime(m.created_at)}${m.edited_from_id?' · aggiornamento':''}</small></article>`).join('')||'<div class="empty-compact">Nessuna comunicazione.</div>';
  const composer=isEmployee()?`<label>Nota operativa<textarea id="communicationText" maxlength="3000" placeholder="Scrivi una nota destinata al titolare e alla vice amministratrice">${esc(latestDraft?.message||'')}</textarea></label><div class="communication-actions"><button type="button" onclick="saveCommunication('${serviceId}','draft')">Salva bozza</button><button type="button" class="primary" onclick="saveCommunication('${serviceId}','sent')">${latestOwnSent?'Invia aggiornamento':'Conferma e invia'}</button></div>`:`<label>Risposta interna<textarea id="communicationText" maxlength="3000" placeholder="Rispondi al dipendente"></textarea></label><div class="communication-actions"><button type="button" class="primary" onclick="saveCommunication('${serviceId}','sent')">Invia risposta</button><button type="button" onclick="markCommunicationsRead('${serviceId}')">Segna come lette</button></div>`;
  return `<div class="communication-panel"><div class="communication-history">${history}</div>${composer}</div>`
}
window.openServiceCommunications=async serviceId=>{const s=state.services.find(x=>x.id===serviceId);if(!s)return toast('Servizio non trovato');modal(`Comunicazioni · ${dname(s.dog_id)}`,communicationPanel(serviceId),async()=>{});const save=$('#modalSave');if(save)save.classList.add('hidden');await markCommunicationsRead(serviceId,false)};
window.saveCommunication=async(serviceId,status)=>{const area=$('#communicationText'),message=String(area?.value||'').trim();if(!message)return toast('Scrivi prima il messaggio.');const draft=state.communications.find(m=>m.service_id===serviceId&&m.author_id===state.profile.id&&m.status==='draft');try{if(status==='draft'&&draft){await update('service_communications',draft.id,{message,updated_at:new Date().toISOString()})}else{await insert('service_communications',{service_id:serviceId,author_id:state.profile.id,author_role:state.profile.role,message,status,edited_from_id:draft?.id||null});if(draft)await request(`/rest/v1/service_communications?id=eq.${encodeURIComponent(draft.id)}`,{method:'DELETE'})}await loadAll();buildNav();$('#modalBody').innerHTML=communicationPanel(serviceId);toast(status==='draft'?'Bozza salvata':'Comunicazione inviata')}catch(e){toast(e.message)}};
window.markCommunicationsRead=async(serviceId,notify=true)=>{const unread=state.communications.filter(m=>m.service_id===serviceId&&m.status==='sent'&&m.author_id!==state.profile.id&&!communicationReadByCurrentUser(m));if(!unread.length)return;try{await rpc('mark_service_communications_read',{p_service_id:serviceId});await loadAll();buildNav();renderServices();if(notify)toast('Comunicazioni segnate come lette')}catch(e){if(notify)toast(e.message)}};
function serviceCard(s){
  const margin=Number(s.customer_amount||0)-Number(s.employee_compensation||0), status=statusLabels[s.status]||s.status, visits=Number(s.daily_visits||1), total=totalVisits(s);let actions='';
  if(isEmployee()){actions=`<button class="primary-soft" onclick="viewService('${s.id}')">Visualizza</button><button class="communication-button" onclick="openServiceCommunications('${s.id}')">Note operative${unreadCommunicationCount(s.id)?` <span>${unreadCommunicationCount(s.id)}</span>`:''}</button>`}
  else{const serviceDocs=linkedDocuments({serviceId:s.id});const hasCustomer=serviceDocs.some(d=>d.document_type==='customer'&&d.status!=='archived'&&d.is_active!==false),hasEmployee=serviceDocs.some(d=>d.document_type==='employee'&&d.status!=='archived'&&d.is_active!==false);actions=`<button class="primary-soft" onclick="viewService('${s.id}')">Apri</button><button class="communication-button" onclick="openServiceCommunications('${s.id}')">Comunicazioni${unreadCommunicationCount(s.id)?` <span>${unreadCommunicationCount(s.id)}</span>`:''}</button><button onclick="openService('${s.id}')">Modifica</button><button onclick="duplicateService('${s.id}')">Duplica</button><button onclick="openQuote(null,'${s.customer_id}','${s.dog_id}','${s.id}')">Preventivo</button>${!['chiuso','annullato'].includes(s.status)?`<button onclick="closeService('${s.id}')">Chiudi servizio</button>`:''}<button class="danger" onclick="archiveEntity('dogsitter_services','${s.id}','servizio')">Elimina</button>${s.status==='da_verificare'?`<button class="primary" onclick="approveService('${s.id}')">Approva e archivia i 2 PDF</button>`:''}${s.status==='chiuso'&&(!hasCustomer||!hasEmployee)?`<button class="primary" onclick="generateServiceDocumentPair('${s.id}')">Genera e archivia PDF cliente + interno</button>`:''}${s.status==='chiuso'&&hasCustomer?`<button onclick="createDocumentVersionFromService('${s.id}','customer')">Nuova versione PDF cliente</button>`:''}${s.status==='chiuso'&&hasEmployee?`<button onclick="createDocumentVersionFromService('${s.id}','employee')">Nuova versione PDF interno</button>`:''}`}
  const employeeUnit=Number(s.employee_unit_compensation||0)||Number(s.employee_compensation||0)/Math.max(1,total);
  const economics=isEmployee()?`<div class="employee-compensation"><span>Compenso della scheda</span><strong>${money(s.employee_compensation)}</strong><small>${money(employeeUnit)} per uscita · ${total} uscite totali</small></div>`:`<div class="economic-split"><div><span>Importo cliente</span><strong>${money(s.customer_amount)}</strong></div><div><span>Compenso per uscita</span><strong>${money(employeeUnit)}</strong></div><div><span>Compenso totale</span><strong>${money(s.employee_compensation)}</strong></div><div><span>Margine attività</span><strong>${money(margin)}</strong></div></div>`;
  const employeeFacts=isEmployee()?`<div><span>Periodo</span><strong>${esc(servicePeriod(s))}</strong></div><div><span>Frequenza</span><strong>${esc(displayValue(s.frequency,'Non indicata'))}</strong></div><div><span>Fasce orarie</span><strong>${esc(serviceSlots(s))}</strong></div><div><span>Durata</span><strong>${Number(s.planned_duration_minutes||0)} min</strong></div><div><span>Uscite/giorno</span><strong>${visits}</strong></div><div><span>Uscite totali</span><strong>${total}</strong></div>`:`<div><span>Periodo</span><strong>${esc(servicePeriod(s))}</strong></div><div><span>Fasce orarie</span><strong>${esc(serviceSlots(s))}</strong></div><div><span>Durata</span><strong>${Number(s.planned_duration_minutes||0)} min</strong></div><div><span>Uscite totali</span><strong>${total}</strong></div><div><span>Dipendente</span><strong>${esc(pname(s.employee_id))}</strong></div>`;
  return `<details class="record-accordion service-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(dname(s.dog_id))}</span><small>${esc(cname(s.customer_id))} · ${esc(servicePeriod(s))} · ${esc(s.service_type||'Servizio')}</small></div><span class="status-badge status-${esc(s.status)}">${esc(status)}</span>${unreadCommunicationCount(s.id)?`<span class="service-message-badge" title="Nuove comunicazioni">${unreadCommunicationCount(s.id)}</span>`:''}<span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded service-card"><div class="service-card-top"><div><span class="entity-kicker">${esc(s.service_type||'SERVIZIO')}</span><h3>${esc(dname(s.dog_id))}</h3><p>${esc(cname(s.customer_id))}</p></div></div><div class="service-facts">${employeeFacts}</div>${economics}${s.keys_status||s.customer_updates?`<div class="operational-note"><b>Organizzazione</b><span>${esc([s.keys_status&&`Chiavi: ${s.keys_status}`,s.customer_updates&&`Aggiornamenti: ${s.customer_updates}`].filter(Boolean).join(' · '))}</span></div>`:''}${s.operational_notes?`<div class="operational-note"><b>Note operative</b><span>${esc(s.operational_notes)}</span></div>`:''}${s.started_at?`<div class="timeline-note"><b>Orari effettivi</b><span>Inizio ${new Date(s.started_at).toLocaleString('it-IT')}${s.completed_at?` · Fine ${new Date(s.completed_at).toLocaleString('it-IT')}`:''}</span></div>`:''}${s.report_text?`<div class="operational-note"><b>Rapporto</b><span>${esc(s.report_text)}</span></div>`:''}${linkedDocumentsBlock({serviceId:s.id},'Documenti del servizio')}<div class="service-actions">${actions}</div></article></details>`
}
function renderServices(){
  $('[data-action="new-service"]')?.classList.toggle('hidden',!isAdmin());
  $('#clearFilters')?.classList.toggle('hidden',!isAdmin());
  const d=$('#serviceDateFilter').value,st=$('#serviceStatusFilter').value;
  $('#serviceList').innerHTML=state.services.filter(s=>(!d||serviceOccursOn(s,d))&&(!st||s.status===st)).map(serviceCard).join('')||'<div class="card">Nessun servizio.</div>'
}


const serviceTypePresets=['Dog Walking','Dogsitting a domicilio','Visita a domicilio','Pensione diurna','Accompagnamento veterinario','Trasporto cane','Somministrazione farmaci','Servizio emergenza','Altro servizio'];
const frequencyPresets=['Una volta','Giornaliero','Settimanale','Weekend','Occasionale','Da concordare'];
const visitPresets=[1,2,3,4];
const timeSlotPresets=['Mattina presto 6:00-8:00','Mattina 8:00-11:00','Pausa pranzo 11:00-14:00','Pomeriggio 14:00-17:00','Tardo pomeriggio 17:00-19:00','Sera 19:00-22:00','Da concordare'];
const durationPresets=[[30,'30 minuti'],[45,'45 minuti'],[60,'60 minuti'],[90,'Oltre 60 minuti'],[0,'Da concordare']];
const paymentPresets=['Contanti','Bonifico','PayPal','Satispay','Carta','Altro'];
const clientStatusPresets=['Nuovo','Attivo','Cliente abituale','Sospeso','Terminato'];
const paymentStatusPresets=[{value:'da_incassare',label:'Da incassare'},{value:'incassato',label:'Incassato'}];
const quotePaymentStatusPresets=['Da pagare','Acconto ricevuto','Pagato','Abbonamento attivo'];
const keysPresets=['Sì','No','Da concordare'];
const keysModePresets=['Consegna a mano','Ritiro presso domicilio','Cassetta sicurezza','Da concordare'];
const updatePresets=['Messaggio WhatsApp','Foto/video','Solo emergenze','Report a fine servizio','Da concordare'];
const authorizationPresets=['Autorizzo','Non autorizzo','Solo dopo contatto telefonico'];
const selectOptions=(values,current='',empty='Seleziona')=>`<option value="">${empty}</option>`+values.map(v=>{const value=Array.isArray(v)?v[0]:v,label=Array.isArray(v)?v[1]:v;return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`}).join('');
const daysInclusive=(start,end)=>{if(!start||!end)return 1;const a=new Date(start+'T00:00:00'),b=new Date(end+'T00:00:00');return Math.max(1,Math.round((b-a)/86400000)+1)};

const quoteStatusLabels={bozza:'Bozza',inviato:'Inviato',accettato:'Accettato',rifiutato:'Rifiutato',scaduto:'Scaduto'};
function quoteTotal(q){return Number(q.total_amount||0)}
function renderQuotes(){
  if(!isAdmin()){show('dashboard');return}
  const host=$('#quoteList');
  host.innerHTML=state.quotes.map(q=>{
    const items=(q.quote_items||[]).sort((a,b)=>Number(a.position||0)-Number(b.position||0));
    const itemSummary=items.length===1?items[0]?.description:`${items.length} servizi`;
    return `<details class="record-accordion quote-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(cname(q.customer_id))}</span><small>${esc(dname(q.dog_id))} · ${dateIT(q.quote_date)} · ${esc(itemSummary||'Preventivo')}</small></div><strong class="record-amount">${money(quoteTotal(q))}</strong><span class="status-badge status-${esc(q.status)}">${esc(quoteStatusLabels[q.status]||q.status)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded quote-card"><div class="service-facts"><div><span>Data</span><strong>${dateIT(q.quote_date)}</strong></div><div><span>Valido fino al</span><strong>${dateIT(q.valid_until)}</strong></div><div><span>Voci</span><strong>${items.length}</strong></div><div><span>Totale</span><strong>${money(quoteTotal(q))}</strong></div></div><div class="quote-items-preview">${items.map(i=>`<div><span>${esc(i.description)}</span><strong>${Number(i.quantity)} × ${money(i.unit_price)}</strong></div>`).join('')}</div>${normalizePeriods(q,'quote').length>=2?`<div class="quote-card-periods"><strong>Riepilogo periodi</strong>${normalizePeriods(q,'quote').map((p,i)=>`<div><span>P${i+1} · ${p.start_date===p.end_date?dateIT(p.start_date):dateIT(p.start_date)+' – '+dateIT(p.end_date)} · ${periodVisits(p)} uscite</span><b>${money(periodClientTotal(p,quoteUnitPriceOf(q)))}</b></div>`).join('')}<div class="quote-card-period-total"><span>Somma periodi</span><b>${money(normalizePeriods(q,'quote').reduce((sum,p)=>sum+periodClientTotal(p,quoteUnitPriceOf(q)),0))}</b></div></div>`:''}${q.payment_status==='Acconto ricevuto'?`<div class="quote-card-deposit"><span>Acconto ricevuto</span><strong>${money(q.deposit_amount||0)}</strong><span>Residuo</span><strong>${money(q.balance_due??Math.max(0,quoteTotal(q)-Number(q.deposit_amount||0)))}</strong></div>`:''}${q.notes?`<div class="operational-note"><b>Note</b><span>${esc(q.notes)}</span></div>`:''}<div class="service-actions"><button class="primary-soft" onclick="openQuote('${q.id}')">Modifica</button><button class="primary" onclick="generateQuoteDocument('${q.id}')">Genera PDF</button><button onclick="setQuoteStatus('${q.id}','inviato')">Segna inviato</button><button onclick="setQuoteStatus('${q.id}','accettato')">Accettato</button><button onclick="setQuoteStatus('${q.id}','rifiutato')">Rifiutato</button><button onclick="transformQuoteToService('${q.id}')">Trasforma in servizio</button>${['bozza','rifiutato','scaduto'].includes(q.status)&&!q.converted_service_id?`<button class="danger" onclick="archiveEntity('dogsitter_quotes','${q.id}','preventivo di ${esc(cname(q.customer_id))}')">Elimina</button>`:`<span class="muted quote-delete-note">${q.converted_service_id?'Collegato a un servizio: non eliminabile':q.status==='accettato'?'Preventivo accettato: non eliminabile':'Archiviazione non disponibile in questo stato'}</span>`}</div></article></details>`
  }).join('')||'<div class="card empty-state"><strong>Nessun preventivo</strong><span>Crea il primo preventivo partendo da un cliente.</span></div>';
}
const quoteServicePresets=[...serviceTypePresets.filter(v=>v!=='Altro servizio'),'Servizio personalizzato'];
const quoteServiceCards=[
  {value:'Dog Walking',icon:'🦮',title:'Passeggiata',subtitle:'Dog Walking'},
  {value:'Dogsitting a domicilio',icon:'🏠',title:'Dogsitting',subtitle:'A domicilio'},
  {value:'Visita a domicilio',icon:'🐾',title:'Visita',subtitle:'A domicilio'},
  {value:'Pensione diurna',icon:'🌞',title:'Pensione',subtitle:'Diurna'},
  {value:'Somministrazione farmaci',icon:'💊',title:'Farmaci',subtitle:'Somministrazione'},
  {value:'Trasporto cane',icon:'🚗',title:'Trasporto',subtitle:'Cane'},
  {value:'Accompagnamento veterinario',icon:'🏥',title:'Veterinario',subtitle:'Accompagnamento'},
  {value:'Servizio emergenza',icon:'⚡',title:'Emergenza',subtitle:'Intervento urgente'},
  {value:'Servizio personalizzato',icon:'➕',title:'Altro',subtitle:'Personalizzato'}
];
const quoteServiceRules={
  'Dog Walking':{visitLabel:'Uscite al giorno',totalLabel:'Uscite del periodo',priceLabel:'Prezzo cliente per uscita (€)',show:['frequency','duration','updates'],fixedDaily:false,showSlots:true},
  'Dogsitting a domicilio':{visitLabel:'Visite al giorno',totalLabel:'Visite del periodo',priceLabel:'Prezzo cliente per visita (€)',show:['frequency','duration','keys','updates','vet','transport'],fixedDaily:false,showSlots:true},
  'Visita a domicilio':{visitLabel:'Visite al giorno',totalLabel:'Visite del periodo',priceLabel:'Prezzo cliente per visita (€)',show:['frequency','duration','keys','updates','vet','transport'],fixedDaily:false,showSlots:true},
  'Pensione diurna':{visitLabel:'Giornate conteggiate',totalLabel:'Giornate del periodo',priceLabel:'Tariffa cliente giornaliera (€)',show:['duration','updates','vet','transport'],fixedDaily:true,showSlots:false},
  'Somministrazione farmaci':{visitLabel:'Somministrazioni al giorno',totalLabel:'Somministrazioni del periodo',priceLabel:'Prezzo cliente per somministrazione (€)',show:['frequency','duration','updates','vet'],fixedDaily:false,showSlots:true},
  'Trasporto cane':{visitLabel:'Trasporti al giorno',totalLabel:'Trasporti del periodo',priceLabel:'Prezzo cliente per trasporto (€)',show:['duration','updates','transport'],fixedDaily:true,showSlots:true},
  'Accompagnamento veterinario':{visitLabel:'Accompagnamenti al giorno',totalLabel:'Accompagnamenti del periodo',priceLabel:'Prezzo cliente per accompagnamento (€)',show:['duration','updates','vet','transport'],fixedDaily:true,showSlots:true},
  'Servizio emergenza':{visitLabel:'Interventi al giorno',totalLabel:'Interventi del periodo',priceLabel:'Prezzo cliente per intervento (€)',show:['duration','updates','vet','transport'],fixedDaily:true,showSlots:true},
  'Servizio personalizzato':{visitLabel:'Prestazioni al giorno',totalLabel:'Prestazioni del periodo',priceLabel:'Prezzo cliente per prestazione (€)',show:['frequency','duration','keys','updates','vet','transport'],fixedDaily:false,showSlots:true}
};
function quoteServiceRule(type){return quoteServiceRules[type]||quoteServiceRules['Servizio personalizzato']}
function quoteServiceCardHtml(current,customValue=''){return `<section class="quote-service-first"><div class="section-head quote-section-head"><div><h3>1. Seleziona il tipo di servizio</h3><p class="muted">La scelta configura automaticamente i campi e il metodo di calcolo del preventivo.</p></div></div><div class="quote-service-cards" role="radiogroup" aria-label="Tipo di servizio">${quoteServiceCards.map(card=>`<button type="button" class="quote-service-card ${card.value===current?'is-selected':''}" data-quote-service="${esc(card.value)}" role="radio" aria-checked="${card.value===current?'true':'false'}"><span class="quote-service-icon" aria-hidden="true">${card.icon}</span><span><strong>${esc(card.title)}</strong><small>${esc(card.subtitle)}</small></span></button>`).join('')}</div><select id="quoteServicePreset" class="visually-hidden" aria-hidden="true" tabindex="-1">${quoteServicePresets.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('')}</select><label id="quoteCustomServiceLabel" class="quote-custom-service ${current==='Servizio personalizzato'?'':'hidden'}">Descrizione personalizzata<input id="quoteCustomService" value="${esc(customValue)}" maxlength="120" placeholder="Descrivi il servizio"></label></section>`}
function quoteServiceHasData(){const unit=Number($('#quoteUnitPrice')?.value||0),periods=$$('#quotePeriods .period-row'),nonDefault=periods.some(row=>Number(row.querySelector('.period-visits')?.value||1)!==1||[...row.querySelectorAll('[class*="period-time-"]')].some(el=>el.value));return unit>0||nonDefault||String($('#quoteCustomService')?.value||'').trim()}
function resetQuoteFieldsForRule(rule){if(rule.fixedDaily){$$('#quotePeriods .period-visits').forEach(el=>{el.value='1';el.disabled=true})}else{$$('#quotePeriods .period-visits').forEach(el=>el.disabled=false)}if(!rule.show.includes('frequency')){const el=$('[name="frequency"]');if(el)el.value='Una volta'}if(!rule.show.includes('duration')){const el=$('[name="planned_duration_minutes"]');if(el)el.value='30'}if(!rule.show.includes('keys')){const a=$('[name="keys_status"]'),b=$('[name="keys_mode"]');if(a)a.value='';if(b)b.value=''}if(!rule.show.includes('vet')){const el=$('[name="auth_vet"]');if(el)el.value=''}if(!rule.show.includes('transport')){const el=$('[name="auth_transport"]');if(el)el.value=''}}
function applyQuoteServiceType(type,{reset=false}={}){const rule=quoteServiceRule(type),preset=$('#quoteServicePreset');if(preset)preset.value=type;$$('.quote-service-card').forEach(card=>{const selected=card.dataset.quoteService===type;card.classList.toggle('is-selected',selected);card.setAttribute('aria-checked',selected?'true':'false')});const custom=type==='Servizio personalizzato';$('#quoteCustomServiceLabel')?.classList.toggle('hidden',!custom);if($('#quoteCustomService'))$('#quoteCustomService').required=custom;const map={frequency:'#quoteFrequencyWrap',duration:'#quoteDurationWrap',keys:'#quoteKeysWrap',updates:'#quoteUpdatesWrap',vet:'#quoteVetWrap',transport:'#quoteTransportWrap'};Object.entries(map).forEach(([key,selector])=>$(selector)?.classList.toggle('hidden',!rule.show.includes(key)));$('#quoteKeysModeWrap')?.classList.toggle('hidden',!rule.show.includes('keys')||!['Sì','Da concordare'].includes($('#quoteKeys')?.value||''));if(reset)resetQuoteFieldsForRule(rule);$$('#quotePeriods .period-row').forEach(row=>{const visits=row.querySelector('.period-visits');if(visits){if(rule.fixedDaily)visits.value='1';visits.disabled=!!rule.fixedDaily}const caption=row.querySelector('.period-visits-caption');if(caption)caption.textContent=rule.visitLabel;const totalCaption=row.querySelector('.period-total-caption');if(totalCaption)totalCaption.textContent=rule.totalLabel;row.querySelectorAll('.period-slot').forEach((slot,index)=>slot.classList.toggle('hidden',!rule.showSlots||index>=Math.max(1,Number(visits?.value||1))))});const price=$('#quoteUnitPriceLabelText');if(price)price.textContent=rule.priceLabel;const hint=$('#quoteCalculationHint');if(hint)hint.textContent=`Il conteggio usa ${rule.totalLabel.toLowerCase()} e la tariffa selezionata.`;bindPeriodRows('quote');recalculateQuoteTotal();scheduleQuoteDraftSave(activeQuoteDraftId)}
function selectQuoteServiceType(type){const current=$('#quoteServicePreset')?.value||'';if(current&&current!==type&&quoteServiceHasData()&&!confirm('Cambiare tipo di servizio? I campi non compatibili verranno azzerati.'))return;applyQuoteServiceType(type,{reset:!!current&&current!==type})}

const quotePaymentPresets=[...paymentPresets];
function quoteItemRow(item={}){
  const current=item.description||'Passeggiata 30 minuti';
  const isCustom=!quoteServicePresets.includes(current)||current==='Servizio personalizzato';
  const qty=Math.max(1,Math.round(Number(item.quantity||1)));
  return `<div class="quote-item-row">
    <label class="quote-description">Servizio
      <select name="quote_item_service" onchange="handleQuoteServiceChange(this)" required>
        ${quoteServicePresets.map(v=>`<option value="${esc(v)}" ${v===current||isCustom&&v==='Servizio personalizzato'?'selected':''}>${esc(v)}</option>`).join('')}
      </select>
    </label>
    <label class="quote-custom ${isCustom?'':'hidden'}">Descrizione personalizzata
      <input name="quote_item_custom" value="${esc(isCustom&&current!=='Servizio personalizzato'?current:'')}" maxlength="120" placeholder="Descrivi il servizio">
    </label>
    <label>Uscite totali
      <input name="quote_item_quantity" type="number" min="1" value="${qty}" readonly>
    </label>
    <label>Prezzo unitario (€)
      <input name="quote_item_unit_price" inputmode="decimal" type="number" min="0" step="0.01" value="${Number(item.unit_price||0)}" oninput="recalculateQuoteTotal()" required>
    </label>
    <button type="button" class="danger quote-remove" onclick="removeQuoteItem(this)" aria-label="Rimuovi voce">Rimuovi</button>
  </div>`
}
window.handleQuoteServiceChange=select=>{
  const row=select.closest('.quote-item-row');
  const custom=row?.querySelector('.quote-custom');
  const input=row?.querySelector('[name="quote_item_custom"]');
  const enabled=select.value==='Servizio personalizzato';
  custom?.classList.toggle('hidden',!enabled);
  if(input){input.required=enabled;if(!enabled)input.value=''}
};
window.removeQuoteItem=button=>{
  const host=$('#quoteItems');
  if(!host)return;
  if(host.querySelectorAll('.quote-item-row').length<=1)return toast('Il preventivo deve contenere almeno una voce.');
  button.closest('.quote-item-row')?.remove();
  recalculateQuoteTotal();
};
window.addQuoteItem=(item={})=>{const host=$('#quoteItems');if(host){host.insertAdjacentHTML('beforeend',quoteItemRow(item));recalculateQuoteTotal()}};
window.recalculateQuoteTotal=()=>{
  let periods=[];try{periods=readPeriodRows('quote')}catch{}
  const totals=periodsTotals(periods),visits=Math.max(1,totals.visits||1),days=Math.max(1,totals.days||1);
  const unitPrice=Math.max(0,Number($('#quoteUnitPrice')?.value||0));
  const rows=[...document.querySelectorAll('#quotePeriods .period-row')];
  rows.forEach((row,index)=>{const p=periods[index];const amount=p?periodClientTotal(p,unitPrice):0;const unitEl=row.querySelector('.period-unit-price'),amountEl=row.querySelector('.period-amount');if(unitEl)unitEl.textContent=money(unitPrice);if(amountEl)amountEl.textContent=money(amount)});
  const subtotal=periods.reduce((sum,p)=>sum+periodClientTotal(p,unitPrice),0);
  const rate=Number($('#quoteDiscount')?.value||0),discount=subtotal*rate/100,total=subtotal-discount;
  if($('#quoteSubtotalPreview'))$('#quoteSubtotalPreview').textContent=money(subtotal);
  if($('#quoteDiscountPreview'))$('#quoteDiscountPreview').textContent=money(discount);
  if($('#quoteTotalPreview'))$('#quoteTotalPreview').textContent=money(total);
  const deposit=Math.max(0,Number($('#quoteDepositAmount')?.value||0));if($('#quoteBalancePreview'))$('#quoteBalancePreview').textContent=money(Math.max(0,total-deposit));
  const summary=$('#quotePeriodsSummary');if(summary)summary.textContent=`${days} giorni complessivi · ${visits} uscite totali`;
  const breakdown=$('#quotePeriodBreakdown');if(breakdown){breakdown.classList.toggle('hidden',periods.length<2);breakdown.innerHTML=periods.length>=2?`<h4>Riepilogo dei periodi</h4>${periods.map((p,i)=>`<div><span>Periodo ${i+1} · ${p.start_date===p.end_date?dateIT(p.start_date):dateIT(p.start_date)+' – '+dateIT(p.end_date)} · ${periodVisits(p)} uscite</span><strong>${money(periodClientTotal(p,unitPrice))}</strong></div>`).join('')}<div class="period-breakdown-total"><span>Somma totale dei periodi</span><strong>${money(subtotal)}</strong></div>`:''}
  return total;
};

const quoteDraftStorageKey=(id=null)=>`k9_quote_draft_${state.profile?.id||'utente'}_${id||'new'}`;
let quoteDraftSaveTimer=null;
let activeQuoteDraftId=null;
function loadQuoteDraft(id=null){
  try{return JSON.parse(localStorage.getItem(quoteDraftStorageKey(id))||'null')}catch{return null}
}
function clearQuoteDraft(id=null){localStorage.removeItem(quoteDraftStorageKey(id))}
function collectQuoteDraft(){
  const form=$('#modalForm');if(!form||!$('#quoteCustomer'))return null;
  const raw=Object.fromEntries(new FormData(form));
  let periods=[];try{periods=readPeriodRows('quote')}catch{}
  const preset=$('#quoteServicePreset')?.value||'';
  const custom=String($('#quoteCustomService')?.value||'').trim();
  const description=preset==='Servizio personalizzato'?(custom||'Servizio personalizzato'):preset;
  const unitPrice=Math.max(0,Number($('#quoteUnitPrice')?.value||0));
  const paymentPreset=$('#quotePaymentPreset')?.value||'Bonifico';
  const customPayment=String($('#quoteCustomPayment')?.value||'').trim();
  return {...raw,
    periods,
    payment_terms:paymentPreset==='Altro'?customPayment:paymentPreset,
    quote_items:[{description,unit_price:unitPrice,quantity:Math.max(0,periodsTotals(periods).visits),position:1}],
    saved_at:new Date().toISOString()
  };
}
function saveQuoteDraft(id=null){const draft=collectQuoteDraft();if(draft)localStorage.setItem(quoteDraftStorageKey(id),JSON.stringify(draft))}
function scheduleQuoteDraftSave(id=activeQuoteDraftId){clearTimeout(quoteDraftSaveTimer);quoteDraftSaveTimer=setTimeout(()=>saveQuoteDraft(id),250)}
function bindQuoteDraftAutosave(id=null){
  const form=$('#modalForm');if(!form)return;
  form.addEventListener('input',()=>scheduleQuoteDraftSave(id));
  form.addEventListener('change',()=>scheduleQuoteDraftSave(id));
  scheduleQuoteDraftSave(id);
}

window.openQuote=(id=null,customerId='',dogId='',sourceServiceId='')=>{
  activeQuoteDraftId=id;
  if(!isAdmin())return toast('Funzione disponibile solo a titolare e vice amministratore.');
  if(!state.customers.length)return toast('Prima di creare un preventivo inserisci almeno un cliente.');
  let q=state.quotes.find(x=>x.id===id)||{};
  if(!id){const draft=loadQuoteDraft(null);if(draft){if(confirm('È presente una bozza di preventivo non salvata. Vuoi riprenderla?'))q={...q,...draft};else clearQuoteDraft(null)}}
  const source=sourceServiceId?state.services.find(x=>x.id===sourceServiceId):null;
  const selectedCustomer=q.customer_id||customerId||source?.customer_id||state.customers[0]?.id||'';
  const selectedDog=q.dog_id||dogId||source?.dog_id||'';
  const today=localDate();
  const quoteDate=q.quote_date||today;
  const validUntil=q.valid_until||addDays(quoteDate,30);
  const validityPreset=quoteValidityValue(quoteDate,validUntil);
  const quotePeriods=normalizePeriods(q.periods?.length?q:source||q,'quote');
  const quoteOutings=Math.max(1,periodsTotals(quotePeriods).visits);
  const existingItem=(q.quote_items||[]).sort((a,b)=>Number(a.position||0)-Number(b.position||0))[0]||{};
  const quoteService=existingItem.description||source?.service_type||'Dog Walking';
  const quoteServiceCustom=!quoteServicePresets.includes(quoteService)||quoteService==='Servizio personalizzato';
  const quoteUnitPrice=Number(existingItem.unit_price||source?.unit_rate||0)||(source?.customer_amount?Number(source.customer_amount)/Math.max(1,quoteOutings):0);
  const currentPayment=q.payment_terms||source?.payment_method||'Bonifico';
  const paymentIsCustom=!quotePaymentPresets.includes(currentPayment);
  modal(id?'Modifica preventivo':'Nuovo preventivo',`${quoteServiceCardHtml(quoteServiceCustom?'Servizio personalizzato':quoteService,quoteServiceCustom&&quoteService!=='Servizio personalizzato'?quoteService:'')}<div class="form-grid quote-form-grid">
    <label>Cliente<select id="quoteCustomer" name="customer_id" required><option value="">Seleziona cliente</option>${state.customers.map(c=>`<option value="${c.id}" ${c.id===selectedCustomer?'selected':''}>${esc(c.first_name+' '+c.last_name)}</option>`).join('')}</select></label>
    <label>Cane<select id="quoteDog" name="dog_id"><option value="">Nessun cane / seleziona</option></select></label>
    ${field('quote_date','Data preventivo',quoteDate,'date','required')}
    <label>Validità<select id="quoteValidityPreset"><option value="7" ${validityPreset==='7'?'selected':''}>7 giorni</option><option value="15" ${validityPreset==='15'?'selected':''}>15 giorni</option><option value="30" ${validityPreset==='30'?'selected':''}>30 giorni</option><option value="60" ${validityPreset==='60'?'selected':''}>60 giorni</option><option value="90" ${validityPreset==='90'?'selected':''}>90 giorni</option><option value="custom" ${validityPreset==='custom'?'selected':''}>Data personalizzata</option></select></label>
    ${field('valid_until','Validità fino al',validUntil,'date','required')}
    <label>Stato<select name="status">${Object.entries(quoteStatusLabels).map(([v,l])=>`<option value="${v}" ${v===(q.status||'bozza')?'selected':''}>${l}</option>`).join('')}</select></label>
    <label id="quoteFrequencyWrap">Frequenza<select name="frequency">${selectOptions(frequencyPresets,q.frequency||source?.frequency||'Una volta')}</select></label>
    <label id="quoteDurationWrap">Durata prevista<select name="planned_duration_minutes">${selectOptions(durationPresets,q.planned_duration_minutes??source?.planned_duration_minutes??30)}</select></label>
    <label>Sconto<select id="quoteDiscount" name="discount_rate"><option value="0" ${Number(q.discount_rate||0)===0?'selected':''}>Nessuno sconto</option><option value="5" ${Number(q.discount_rate||0)===5?'selected':''}>Sconto 5%</option><option value="10" ${Number(q.discount_rate||0)===10?'selected':''}>Sconto 10%</option></select></label>
    <label>Modalità pagamento<select id="quotePaymentPreset">${quotePaymentPresets.map(v=>`<option value="${esc(v)}" ${v===(paymentIsCustom?'Altro':currentPayment)?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
    <label id="quoteCustomPaymentLabel" class="${paymentIsCustom?'':'hidden'}">Modalità personalizzata<input id="quoteCustomPayment" value="${esc(paymentIsCustom?currentPayment:'')}" maxlength="200"></label>
    <label>Stato cliente<select name="client_status">${clientStatusPresets.map(v=>`<option ${v===(q.client_status||'Nuovo')?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>Stato pagamento<select id="quotePaymentStatus" name="payment_status">${quotePaymentStatusPresets.map(v=>`<option ${v===(q.payment_status||'Da pagare')?'selected':''}>${v}</option>`).join('')}</select></label>
    <section id="quoteDepositSection" class="quote-deposit-section wide ${(q.payment_status||'Da pagare')==='Acconto ricevuto'?'':'hidden'}"><h3>Acconto ricevuto</h3><div class="form-grid"><label>Importo acconto (€)<input id="quoteDepositAmount" name="deposit_amount" type="number" min="0" step="0.01" value="${Number(q.deposit_amount||0)||''}"></label><label>Data ricezione<input id="quoteDepositDate" name="deposit_received_at" type="date" value="${esc(q.deposit_received_at||quoteDate)}"></label><label>Modalità acconto<select id="quoteDepositMethod" name="deposit_payment_method">${quotePaymentPresets.filter(v=>v!=='Altro').map(v=>`<option value="${esc(v)}" ${v===(q.deposit_payment_method||currentPayment)?'selected':''}>${esc(v)}</option>`).join('')}<option value="Altro" ${(q.deposit_payment_method||'')==='Altro'?'selected':''}>Altro</option></select></label><label>Riferimento / nota<input name="deposit_reference" maxlength="250" value="${esc(q.deposit_reference||'')}" placeholder="Es. CRO, contanti, ricevuta"></label></div><div class="quote-deposit-summary"><span>Residuo da pagare</span><strong id="quoteBalancePreview">${money(q.balance_due??q.total_amount??0)}</strong></div></section>
    <label id="quoteKeysWrap">Chiavi affidate?<select id="quoteKeys" name="keys_status">${selectOptions(keysPresets,q.keys_status||'')}</select></label>
    <label id="quoteKeysModeWrap">Modalità consegna chiavi<select name="keys_mode">${selectOptions(keysModePresets,q.keys_mode||'')}</select></label>
    <label id="quoteUpdatesWrap">Aggiornamenti al proprietario<select name="customer_updates">${selectOptions(updatePresets,q.customer_updates||'Messaggio WhatsApp')}</select></label>
    <label id="quoteVetWrap">Contatto veterinario in emergenza<select name="auth_vet">${selectOptions(authorizationPresets,q.auth_vet||'Solo dopo contatto telefonico')}</select></label>
    <label id="quoteTransportWrap">Trasporto in clinica veterinaria<select name="auth_transport">${selectOptions(authorizationPresets,q.auth_transport||'Solo dopo contatto telefonico')}</select></label>
    <label class="wide">Note<textarea name="notes">${esc(q.notes||source?.operational_notes||'')}</textarea></label>
  </div><section class="periods-section"><div class="section-head quote-section-head"><div><h3>Periodi e date</h3><p id="quotePeriodsSummary" class="muted"></p></div><button type="button" onclick="addPeriodRow('quote')">Aggiungi periodo</button></div><div id="quotePeriods">${quotePeriods.map((p,i)=>periodRow('quote',p,i)).join('')}</div></section><section class="quote-items-section"><div class="section-head quote-section-head"><div><h3>Tariffa e riepilogo</h3><p id="quoteCalculationHint" class="muted">Il conteggio viene configurato dal tipo di servizio selezionato.</p></div></div><div class="quote-simple-service"><label><span id="quoteUnitPriceLabelText">Prezzo cliente per uscita (€)</span><input id="quoteUnitPrice" inputmode="decimal" type="number" min="0" step="0.01" value="${quoteUnitPrice}" required></label></div><div id="quotePeriodBreakdown" class="quote-period-breakdown hidden"></div><div class="quote-calculation"><div><span>Subtotale</span><strong id="quoteSubtotalPreview">0,00 €</strong></div><div><span>Sconto</span><strong id="quoteDiscountPreview">0,00 €</strong></div></div><div class="quote-total"><span>Totale preventivo</span><strong id="quoteTotalPreview">${money(q.total_amount||0)}</strong></div></section>`,async formData=>{
    const periods=readPeriodRows('quote');const periodTotal=periodsTotals(periods);
    const preset=$('#quoteServicePreset')?.value||'';const custom=String($('#quoteCustomService')?.value||'').trim();const description=preset==='Servizio personalizzato'?custom:preset;const unitPrice=Number($('#quoteUnitPrice')?.value||0);const items=[{description,quantity:periodTotal.visits,unit_price:unitPrice,position:1}];
    if(!description)throw Error('Indica il tipo di servizio.');
    if(periodTotal.visits<=0)throw Error('Inserisci almeno un periodo valido.');
    if(unitPrice<0)throw Error('La tariffa cliente non può essere negativa.');
    const paymentPreset=$('#quotePaymentPreset')?.value||'Bonifico';const paymentCustom=String($('#quoteCustomPayment')?.value||'').trim();const paymentTerms=paymentPreset==='Altro'?paymentCustom:paymentPreset;if(!paymentTerms)throw Error('Indica la modalità di pagamento.');
    const raw=Object.fromEntries(formData);if(!parseLocalDate(raw.quote_date)||!parseLocalDate(raw.valid_until))throw Error('Controlla la data del preventivo e la validità.');if(daysBetween(raw.quote_date,raw.valid_until)<0)throw Error('La validità non può precedere la data del preventivo.');const subtotal=items.reduce((sum,i)=>sum+i.quantity*i.unit_price,0);const discount=Number(raw.discount_rate||0);const total=subtotal*(1-discount/100);
    const hasDeposit=raw.payment_status==='Acconto ricevuto';const depositAmount=hasDeposit?Number(raw.deposit_amount||0):0;if(hasDeposit&&depositAmount<=0)throw Error('Inserisci l’importo dell’acconto ricevuto.');if(hasDeposit&&depositAmount>total)throw Error('L’acconto non può superare il totale del preventivo.');if(hasDeposit&&!parseLocalDate(raw.deposit_received_at))throw Error('Indica la data di ricezione dell’acconto.');if(hasDeposit&&!String(raw.deposit_payment_method||'').trim())throw Error('Indica la modalità di pagamento dell’acconto.');const balanceDue=raw.payment_status==='Pagato'?0:Math.max(0,total-depositAmount);
    const firstPeriod=periods[0];const payload={customer_id:raw.customer_id,dog_id:raw.dog_id||null,source_service_id:sourceServiceId||q.source_service_id||null,quote_date:raw.quote_date,valid_until:raw.valid_until,status:raw.status,payment_terms:paymentTerms,notes:raw.notes||null,total_amount:total,subtotal_amount:subtotal,discount_rate:discount,frequency:raw.frequency||null,daily_visits:firstPeriod.daily_visits,start_date:firstPeriod.start_date,end_date:firstPeriod.end_date,planned_duration_minutes:Number(raw.planned_duration_minutes||0),time_slot_1:firstPeriod.time_slot_1,time_slot_2:firstPeriod.time_slot_2,time_slot_3:firstPeriod.time_slot_3,time_slot_4:firstPeriod.time_slot_4,periods,client_status:raw.client_status||null,payment_status:raw.payment_status||null,deposit_amount:depositAmount,deposit_received_at:hasDeposit?raw.deposit_received_at:null,deposit_payment_method:hasDeposit?raw.deposit_payment_method:null,deposit_reference:hasDeposit?(raw.deposit_reference||null):null,balance_due:balanceDue,keys_status:raw.keys_status||null,keys_mode:raw.keys_mode||null,customer_updates:raw.customer_updates||null,auth_vet:raw.auth_vet||null,auth_transport:raw.auth_transport||null};
    let quoteId=id;if(id){await update('dogsitter_quotes',id,payload);await request(`/rest/v1/dogsitter_quote_items?quote_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}else{const created=await insert('dogsitter_quotes',payload);quoteId=created[0]?.id;if(!quoteId)throw Error('Preventivo non creato.')}await insert('dogsitter_quote_items',items.map(i=>({...i,quote_id:quoteId})));clearQuoteDraft(id);
  });
  const customer=$('#quoteCustomer'),dog=$('#quoteDog');const fillDogs=()=>{const dogs=state.dogs.filter(d=>d.customer_id===customer.value);dog.innerHTML='<option value="">Nessun cane / seleziona</option>'+dogs.map(d=>`<option value="${d.id}" ${d.id===selectedDog?'selected':''}>${esc(d.name)}</option>`).join('');if(!id&&dogs.length===1)dog.value=dogs[0].id};customer.onchange=fillDogs;fillDogs();
  $('#quoteValidityPreset').onchange=e=>{if(e.target.value!=='custom')$('[name="valid_until"]').value=addDays($('[name="quote_date"]').value||localDate(),Number(e.target.value))};
  $('[name="quote_date"]').onchange=()=>{if($('#quoteValidityPreset').value!=='custom')$('[name="valid_until"]').value=addDays($('[name="quote_date"]').value,Number($('#quoteValidityPreset').value))};
  $('#quotePaymentPreset').onchange=e=>$('#quoteCustomPaymentLabel').classList.toggle('hidden',e.target.value!=='Altro');
  bindPeriodRows('quote');recalculateQuoteTotal();
  $$('.quote-service-card').forEach(card=>card.onclick=()=>selectQuoteServiceType(card.dataset.quoteService));applyQuoteServiceType(quoteServiceCustom?'Servizio personalizzato':quoteService);
  $('#quoteUnitPrice').oninput=recalculateQuoteTotal;
  const toggleQuoteKeys=()=>{const rule=quoteServiceRule($('#quoteServicePreset')?.value||'Dog Walking');$('#quoteKeysModeWrap').classList.toggle('hidden',!rule.show.includes('keys')||!['Sì','Da concordare'].includes($('#quoteKeys').value))};$('#quoteKeys').onchange=toggleQuoteKeys;toggleQuoteKeys();
  const toggleDepositSection=()=>{const enabled=$('#quotePaymentStatus')?.value==='Acconto ricevuto';$('#quoteDepositSection')?.classList.toggle('hidden',!enabled);['quoteDepositAmount','quoteDepositDate','quoteDepositMethod'].forEach(key=>{const el=$('#'+key);if(el)el.required=enabled});recalculateQuoteTotal();scheduleQuoteDraftSave(id)};$('#quotePaymentStatus').onchange=toggleDepositSection;$('#quoteDepositAmount').oninput=()=>{recalculateQuoteTotal();scheduleQuoteDraftSave(id)};toggleDepositSection();
  $('#quoteDiscount').onchange=recalculateQuoteTotal;recalculateQuoteTotal();bindQuoteDraftAutosave(id);
};
window.setQuoteStatus=async(id,status)=>{await update('dogsitter_quotes',id,{status});await loadAll();renderQuotes();toast(`Preventivo: ${quoteStatusLabels[status]||status}`)};
window.transformQuoteToService=id=>{
  const q=state.quotes.find(x=>x.id===id);
  if(!q)return toast('Preventivo non trovato');
  if(q.converted_service_id)return toast('Il preventivo è già stato trasformato in servizio.');
  const items=(q.quote_items||[]).sort((a,b)=>Number(a.position||0)-Number(b.position||0));
  const type=items.map(i=>i.description).filter(Boolean).join(' + ').slice(0,80)||'Servizio dogsitter';
  const periods=normalizePeriods(q,'quote');
  const firstPeriod=periods[0];const start=firstPeriod.start_date,end=firstPeriod.end_date,daily=firstPeriod.daily_visits;
  const totalVisits=Math.max(1,periodsTotals(periods).visits);
  const customerAmount=Number(q.total_amount||quoteTotal(q)||0);
  const unitRate=items.length===1?Number(items[0].unit_price||0):(totalVisits?customerAmount/totalVisits:0);
  openService(null,{
    quote_id:q.id,
    customer_id:q.customer_id,
    dog_id:q.dog_id,
    service_type:type,
    frequency:q.frequency||'Una volta',
    service_date:start,
    end_date:end,
    service_time:String(q.time_slot_1||'09:00').slice(0,5),
    planned_duration_minutes:Number(q.planned_duration_minutes||30),
    daily_visits:daily,
    periods,
    time_slot_1:q.time_slot_1||null,
    time_slot_2:q.time_slot_2||null,
    time_slot_3:q.time_slot_3||null,
    time_slot_4:q.time_slot_4||null,
    unit_rate:Number(unitRate.toFixed(2)),
    discount_rate:Number(q.discount_rate||0),
    customer_amount:customerAmount,
    employee_unit_compensation:0,
    employee_compensation:0,
    payment_method:q.payment_terms||'Bonifico',
    client_status:q.client_status||'Confermato',
    customer_payment_status:'da_incassare',
    keys_status:q.keys_status||null,
    keys_mode:q.keys_mode||null,
    customer_updates:q.customer_updates||'Messaggio WhatsApp',
    auth_vet:q.auth_vet||'Solo dopo contatto telefonico',
    auth_transport:q.auth_transport||'Solo dopo contatto telefonico',
    operational_notes:[`Servizio derivato dal preventivo del ${dateIT(q.quote_date)}.`,q.notes||''].filter(Boolean).join('\n'),
    status:'programmato'
  });
};

function periodTotals(filter){const rows=state.services.filter(s=>filter(s)&&matured(s));return {sum:rows.reduce((a,s)=>a+Number(s.employee_compensation),0),visits:rows.reduce((a,s)=>a+totalVisits(s),0)}}
function renderComp(){const now=new Date(),today=localDate(now),week=new Date(now);week.setDate(now.getDate()-((now.getDay()+6)%7));const ws=localDate(week),month=today.slice(0,7);const defs=[['Oggi',s=>serviceOccursOn(s,today)],['Settimana',s=>normalizePeriods(s).some(p=>(p.end_date||p.start_date)>=ws&&p.start_date<=today)],['Mese',s=>normalizePeriods(s).some(p=>String(p.start_date||'').startsWith(month)||String(p.end_date||'').startsWith(month))]];$('#compCards').innerHTML=defs.map(([l,f])=>{const t=periodTotals(f);return `<div class="stat"><span>${l}</span><strong>${money(t.sum)}</strong><small>${t.visits} uscite</small></div>`}).join('')+`<div class="stat"><span>Da liquidare</span><strong>${money(state.services.filter(s=>matured(s)&&s.employee_payment_status==='da_liquidare').reduce((a,s)=>a+Number(s.employee_compensation),0))}</strong></div>`;$('#compList').innerHTML=state.services.filter(matured).map(serviceCard).join('')}
function renderPayments(){
  const maturedRows=state.services.filter(matured),income=maturedRows.filter(s=>s.customer_payment_status==='incassato').reduce((a,s)=>a+Number(s.customer_amount),0),toIncome=maturedRows.filter(s=>s.customer_payment_status==='da_incassare').reduce((a,s)=>a+Number(s.customer_amount),0),toPay=maturedRows.filter(s=>s.employee_payment_status==='da_liquidare').reduce((a,s)=>a+Number(s.employee_compensation),0),margin=maturedRows.reduce((a,s)=>a+Number(s.customer_amount)-Number(s.employee_compensation),0);
  $('#paymentSummary').innerHTML=`<div class="stat"><span>Incassato</span><strong>${money(income)}</strong></div><div class="stat"><span>Da incassare</span><strong>${money(toIncome)}</strong></div><div class="stat"><span>Da liquidare</span><strong>${money(toPay)}</strong></div><div class="stat"><span>Quota attività maturata</span><strong>${money(margin)}</strong></div>`;
  $('#paymentList').innerHTML=maturedRows.map(s=>`<details class="record-accordion payment-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(cname(s.customer_id))}</span><small>${esc(dname(s.dog_id))} · ${dateIT(s.service_date)}</small></div><strong class="record-amount">${money(s.customer_amount)}</strong><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded"><div class="entity-details"><p><span>Importo cliente</span><strong>${money(s.customer_amount)}</strong></p><p><span>Stato cliente</span><strong>${esc(s.customer_payment_status)}</strong></p><p><span>Compenso dipendente</span><strong>${money(s.employee_compensation)}</strong></p><p><span>Stato dipendente</span><strong>${esc(s.employee_payment_status)}</strong></p></div><div class="service-actions"><button onclick="setCustomerPaid('${s.id}')">Segna cliente incassato</button><button onclick="setEmployeePaid('${s.id}')">Segna dipendente liquidato</button></div></article></details>`).join('')||'<div class="card">Nessun movimento maturato.</div>'
}
function documentTypeLabel(d){if((d.document_type||'customer')==='quote')return 'Preventivo';return d.document_type==='employee'?'PDF dipendente':'PDF cliente'}
function documentStatusLabel(v){return ({generating:'In generazione',generated:'Generato',inviato:'Inviato',archived:'Archiviato'}[v]||v||'Generato')}
function renderDocs(){
  const host=$('#documentList'),docs=state.documents||[],active=docs.filter(d=>d.status!=='archived').length,customers=docs.filter(d=>(d.document_type||'customer')==='customer').length,employees=docs.filter(d=>d.document_type==='employee').length,quotes=docs.filter(d=>d.document_type==='quote').length,sent=docs.filter(d=>d.status==='inviato').length;
  host.innerHTML=`<div class="document-summary"><div class="stat"><span>Documenti</span><strong>${docs.length}</strong></div><div class="stat"><span>Attivi</span><strong>${active}</strong></div><div class="stat"><span>PDF cliente</span><strong>${customers}</strong></div><div class="stat"><span>PDF dipendente</span><strong>${employees}</strong></div><div class="stat"><span>Preventivi</span><strong>${quotes}</strong></div><div class="stat"><span>Inviati</span><strong>${sent}</strong></div></div><div class="document-toolbar"><input id="documentSearch" type="search" placeholder="Cerca cliente, cane, dipendente o file"><select id="documentTypeFilter"><option value="">Tutti i documenti</option><option value="customer">PDF cliente</option><option value="employee">PDF dipendente</option><option value="quote">Preventivi</option></select><select id="documentStatusFilter"><option value="">Tutti gli stati</option><option value="generated">Generati</option><option value="inviato">Inviati</option><option value="archived">Archiviati</option></select></div><div id="documentCards" class="document-grid"></div>`;
  const draw=()=>{
    const q=$('#documentSearch').value.trim().toLowerCase(),type=$('#documentTypeFilter').value,status=$('#documentStatusFilter').value,rows=docs.filter(d=>(!type||(d.document_type||'customer')===type)&&(!status||d.status===status)&&(!q||[d.file_name,d.customer_name,d.dog_name,d.employee_name,d.title].some(v=>String(v||'').toLowerCase().includes(q))));
    $('#documentCards').innerHTML=rows.map(d=>`<details class="record-accordion document-accordion ${d.is_active===false?'is-superseded':''}"><summary><div class="record-summary-main"><span class="record-title">${esc(d.file_name||d.title||'Documento')}</span><small>${esc(d.customer_name||cname(d.customer_id))} · ${esc(d.dog_name||dname(d.dog_id))}</small></div><span class="document-kind ${d.document_type==='employee'?'internal':d.document_type==='quote'?'quote-kind':''}">${documentTypeLabel(d)}</span><span class="document-version">V${Number(d.version||1)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded document-card"><div class="document-meta"><div><span>Cliente</span><strong>${esc(d.customer_name||cname(d.customer_id))}</strong></div><div><span>Cane</span><strong>${esc(d.dog_name||dname(d.dog_id))}</strong></div><div><span>Dipendente</span><strong>${esc(d.employee_name||pname(d.employee_id))}</strong></div><div><span>${d.document_type==='quote'?'Data preventivo':'Data servizio'}</span><strong>${dateIT(d.quote_date||d.service_date)}</strong></div></div><div class="document-state"><span class="pill">${esc(documentStatusLabel(d.status))}</span>${d.is_active===false?'<span class="pill muted-pill">Versione superata</span>':'<span class="pill active-pill">Versione attiva</span>'}</div><p class="muted">Creato ${d.created_at?new Date(d.created_at).toLocaleString('it-IT'):'—'}</p><div class="service-actions"><button onclick="openDocument('${d.id}')">Apri</button><button onclick="downloadStoredDocument('${d.id}')">Scarica</button><button onclick="shareStoredDocument('${d.id}')">Condividi</button>${d.source_kind==='quote'&&d.quote_id&&d.status!=='archived'?`<button onclick="generateQuoteDocument('${d.quote_id}')">Nuova versione</button>`:d.service_id&&d.status!=='archived'?`<button onclick="regenerateDocument('${d.id}')">Nuova versione</button>`:''}${d.status!=='inviato'&&['customer','quote'].includes(d.document_type||'customer')?`<button onclick="markDocumentSent('${d.id}')">Segna inviato</button>`:''}${d.status!=='archived'?`<button class="danger" onclick="archiveDocument('${d.id}')">Archivia</button>`:''}</div></article></details>`).join('')||'<div class="card">Nessun documento corrispondente.</div>'
  };
  $('#documentSearch').oninput=draw;$('#documentTypeFilter').onchange=draw;$('#documentStatusFilter').onchange=draw;draw()
}
function auditSubject(a){const d=a.details?.new||a.details?.old||{};if(a.table_name==='customers')return [d.first_name,d.last_name].filter(Boolean).join(' ');if(a.table_name==='dogs')return d.name||'';if(a.table_name==='dogsitter_services')return d.service_type||'';if(a.table_name==='profiles')return d.full_name||d.email||'';return ''}function auditDetails(a){const d=a.details?.new||a.details?.old||{};const hidden=new Set(['id','created_by','updated_at','created_at','customer_id','employee_id','dog_id','deleted_by']);return Object.entries(d).filter(([k,v])=>!hidden.has(k)&&v!==null&&v!=='').slice(0,12).map(([k,v])=>`<div><b>${esc(k.replaceAll('_',' '))}:</b> ${esc(typeof v==='object'?JSON.stringify(v):v)}</div>`).join('')||'<div>Nessun dettaglio aggiuntivo.</div>'}async function renderAudit(){
  const clearBtn=$('#clearAuditLog');clearBtn?.classList.toggle('hidden',!isOwner());if(clearBtn)clearBtn.onclick=clearAuditLog;
  const rows=await select('audit_log','select=*&order=created_at.desc&limit=250');
  const tableNames={customers:'Cliente',dogs:'Cane',dogsitter_services:'Servizio',profiles:'Utente'},actionNames={INSERT:'Creato',UPDATE:'Modificato',DELETE:'Eliminato'};
  $('#auditList').innerHTML=rows.map((a,i)=>{const who=state.profiles.find(p=>p.id===a.user_id)?.full_name||'Sistema';const obj=tableNames[a.table_name]||a.table_name||'Elemento';const subject=auditSubject(a);const title=`${actionNames[a.action]||a.action} ${obj.toLowerCase()}${subject?`: ${subject}`:''}`;return `<details class="record-accordion audit-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(title)}</span><small>${new Date(a.created_at).toLocaleString('it-IT')}</small></div><span class="pill">${esc(who)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded"><div class="audit-friendly">${auditDetails(a)}</div></article></details>`}).join('')||'<div class="card">Nessuna attività registrata.</div>'
}
async function clearAuditLog(){if(!isOwner())return;const first=confirm('Vuoi azzerare definitivamente tutto il Registro attività? Questa operazione non può essere annullata.');if(!first)return;const typed=prompt('Per confermare scrivi AZZERA');if(typed!=='AZZERA'){toast('Operazione annullata');return}const btn=$('#clearAuditLog');try{if(btn){btn.disabled=true;btn.textContent='Azzeramento...'}const result=await rpc('clear_audit_log');const remaining=await select('audit_log','select=id&limit=1');if(remaining.length)throw Error('Il database non ha cancellato tutte le registrazioni. Riesegui la migrazione 4.1.1 in Supabase.');await renderAudit();const deleted=typeof result==='number'?result:(result?.deleted_count??null);toast(deleted===null?'Registro attività azzerato definitivamente':`Registro azzerato: ${deleted} voci eliminate`)}catch(e){console.error('Errore azzeramento registro:',e);toast(e.message||'Impossibile azzerare il Registro attività')}finally{if(btn){btn.disabled=false;btn.textContent='Azzera definitivamente'}}}
function passCode(p){if(p.employee_code)return p.employee_code;const suffix=String(p.id||'').replace(/-/g,'').slice(-6).toUpperCase();return p.is_owner||p.role==='owner'?`K9-TIT-${suffix||'000001'}`:`K9-${suffix||'000001'}`}
function passValidity(p){if(p.is_owner||p.role==='owner')return 'Illimitata';return p.pass_expires_at?dateIT(p.pass_expires_at):'Da definire'}
function passIssued(p){return p.pass_issued_at?dateIT(p.pass_issued_at):(p.created_at?new Date(p.created_at).toLocaleDateString('it-IT'):'—')}
function qrImageUrl(value){return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(value)}`}
function renderPass(){const p=state.profile;const code=passCode(p);const verifyPayload=`K9PASS|${code}|${p.active?'ATTIVO':'SOSPESO'}`;const adminActions=isAdmin()?`<div class="pass-actions"><button type="button" class="primary" onclick="downloadPassPdf()">Scarica PDF</button><button type="button" onclick="sharePassPdf()">Condividi PDF</button><button type="button" onclick="sharePass()">Condividi dati pass</button><button type="button" onclick="openCurrentProfile()">Modifica dati pass</button></div><p class="muted pass-note">Per modificare foto, codice, qualifica o scadenza usa “Modifica dati pass”.</p>`:'';$('#passCard').innerHTML=`<div class="pass-shell"><article id="printablePass" class="pass pass-professional"><div class="pass-topline"><span>PASS IDENTIFICATIVO</span><span class="pass-status ${p.active?'is-active':'is-suspended'}">${p.active?'ATTIVO':'SOSPESO'}</span></div><div class="pass-head"><div class="pass-photo"><img src="${esc(p.photo_url||identityLogo())}" alt="Foto o logo"></div><div class="pass-person"><small>${esc(state.settings.organization_name||DEFAULT_SETTINGS.organization_name)}</small><h2>${esc(p.full_name||p.email)}</h2><p>${esc(p.qualification||roleLabels[p.role]||p.role)}</p></div></div><div class="pass-data"><div><span>Codice</span><strong>${esc(code)}</strong></div><div><span>Emissione</span><strong>${esc(passIssued(p))}</strong></div><div><span>Validità</span><strong>${esc(passValidity(p))}</strong></div><div><span>Ruolo</span><strong>${esc(roleLabels[p.role]||p.role)}</strong></div></div><div class="pass-verification"><img src="${qrImageUrl(verifyPayload)}" alt="QR di verifica del pass" crossorigin="anonymous"><div><span>Codice di verifica</span><strong>${esc(code)}</strong><small>Scansiona per verificare codice e stato del pass.</small></div></div></article>${adminActions}</div>`}
window.sharePass=async()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');const p=state.profile,code=passCode(p);const text=`${state.settings.organization_name||DEFAULT_SETTINGS.organization_name}\n${p.full_name||p.email}\n${roleLabels[p.role]||p.role}\nCodice: ${code}\nStato: ${p.active?'ATTIVO':'SOSPESO'}\nValidità: ${passValidity(p)}`;try{if(navigator.share)await navigator.share({title:'Pass K9',text});else{await navigator.clipboard.writeText(text);toast('Dati del pass copiati')}}catch(e){if(e.name!=='AbortError')toast('Condivisione non disponibile')}};
window.openCurrentProfile=()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');openEmployee(state.profile.id)};
function modal(title,html,onSave){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;const errorBox=$('#modalError');if(errorBox){errorBox.textContent='';errorBox.classList.add('hidden')}$('#modal').showModal();$('#modalForm').onsubmit=async e=>{e.preventDefault();if(e.submitter?.value==='cancel')return $('#modal').close();const save=$('#modalSave');try{if(errorBox){errorBox.textContent='';errorBox.classList.add('hidden')}if(save){save.disabled=true;save.textContent='Salvataggio...'}await onSave(new FormData(e.currentTarget));$('#modal').close();await loadAll();render($$('.screen:not(.hidden)')[0]?.id||'dashboard');toast('Salvato')}catch(err){const message=err?.message||String(err)||'Operazione non riuscita';console.error('Errore modale:',err);if(errorBox){errorBox.textContent=message;errorBox.classList.remove('hidden');errorBox.scrollIntoView({behavior:'smooth',block:'center'})}toast(message)}finally{if(save){save.disabled=false;save.textContent='Salva'}}}}
const field=(n,l,v='',type='text',extra='')=>`<label>${l}<input name="${n}" type="${type}" value="${esc(v)}" ${extra}></label>`;
const areaField=(n,l,v='',wide=true)=>`<label class="${wide?'wide':''}">${l}<textarea name="${n}">${esc(v||'')}</textarea></label>`;
const selectField=(n,l,options,value='',wide=false,placeholder='Seleziona')=>`<label class="${wide?'wide':''}">${l}<select name="${n}"><option value="">${placeholder}</option>${options.map(o=>{const val=typeof o==='string'?o:o.value;const text=typeof o==='string'?o:o.label;return `<option value="${esc(val)}" ${String(val)===String(value||'')?'selected':''}>${esc(text)}</option>`}).join('')}</select></label>`;
const formSection=(title,subtitle,content,open=false)=>`<details class="data-form-section" ${open?'open':''}><summary><span>${esc(title)}</span><small>${esc(subtitle)}</small></summary><div class="form-grid">${content}</div></details>`;

const emergencyTypes=['Familiare convivente','Familiare non convivente','Amico / referente','Veterinario','Clinica veterinaria','Altro referente'];
const availabilityOptions=['Sempre reperibile','Reperibile solo mattina','Reperibile solo pomeriggio','Reperibile solo sera','Non sempre reperibile','Da concordare'];
const breedTypes=['Razza definita','Meticcio','Incrocio','Razza non conosciuta','Da verificare'];
const sizeOptions=['Piccola','Media','Grande','Gigante','Da verificare'];
const ageOptions=['Cucciolo fino a 6 mesi','Giovane 6-18 mesi','Adulto 18 mesi-7 anni','Senior oltre 7 anni','Età non conosciuta'];
const sexOptions=['Maschio','Femmina','Non indicato'];
const yesNoUnknown=['Sì','No','Non so','Da verificare'];
const vetOptions=['Veterinario indicato dal cliente','Clinica di fiducia indicata','Nessun veterinario indicato','Da comunicare successivamente'];
const vaccineOptions=['Aggiornate','Non aggiornate','Non so','Da verificare'];
const parasiteOptions=['Aggiornato','Non aggiornato','Non so','Da verificare'];
const illnessOptions=['Nessuna patologia nota','Problemi articolari','Problemi cardiaci','Problemi respiratori','Epilessia / crisi','Problemi gastrointestinali','Altro da approfondire'];
const allergyOptions=['Nessuna allergia nota','Allergia alimentare','Allergia ambientale','Allergia a farmaci','Altro da approfondire'];
const medicineOptions=['Nessuna terapia','Terapia giornaliera','Terapia occasionale','Farmaci solo al bisogno','Da verificare con veterinario'];
const riskOptions=['Basso','Medio','Alto','Da valutare'];
const foodOptions=['Crocchette','Umido','Alimentazione mista','Casalinga','BARF','Dieta veterinaria','Altro'];
const mealOptions=['1 pasto al giorno','2 pasti al giorno','3 pasti al giorno','Pasti frazionati'];
const treatOptions=['Consentiti','Non consentiti','Solo premi forniti dal proprietario','Solo previo consenso'];
const homeRuleOptions=['Può accedere a tutti gli ambienti','Non può salire su divano/letto','Accesso limitato ad alcune stanze','Resta in area dedicata','Altro'];
const characterOptions=['Socievole','Tranquillo','Vivace','Timido','Diffidente','Reattivo','Da valutare'];
const socialOptions=['Socievole','Diffidente','Selettivo','Reattivo','Da evitare','Mai testato'];
const childrenOptions=['Socievole','Diffidente','Reattivo','Da evitare','Mai testato'];
const fearOptions=['Nessuna paura nota','Rumori forti','Temporali / fuochi','Persone sconosciute','Cani sconosciuti','Traffico / mezzi','Altro da approfondire'];
const biteOptions=['Nessun episodio','Morso a persona','Morso ad altro cane','Pinzata / avviso','Da approfondire obbligatoriamente'];
const guardingOptions=['Assente','Su cibo','Su giochi','Su spazi','Su persone','Da valutare'];
const equipmentOptions=['Pettorina ad H','Pettorina norvegese','Collare fisso','Collare semistrozzo','Guinzaglio lungo','Da verificare'];
const dogTriggerOptions=['Indifferente','Vuole salutare','Abbaia','Tira','Reattivo','Da valutare'];
const movingTriggerOptions=['Indifferente','Insegue','Abbaia','Si spaventa','Reattivo','Da valutare'];
const avoidOptions=['Nessuna zona particolare','Aree cani','Strade trafficate','Luoghi affollati','Presenza bambini','Presenza altri animali'];
const offLeashOptions=['No','Sì solo in area recintata','Sì su indicazione del proprietario','Da non lasciare mai libero'];
const walkLevelOptions=['Facile gestione','Media attenzione','Gestione impegnativa','Necessaria esperienza specifica','Da valutare'];

window.openCustomer=id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const c=state.customers.find(x=>x.id===id)||{};const em=state.profiles.filter(p=>p.role==='dipendente'&&p.active);
  const html=`<div class="data-form-stack">
    ${formSection('Dati principali','Anagrafica, contatti e indirizzo',`${field('first_name','Nome',c.first_name,'text','required')}${field('last_name','Cognome',c.last_name,'text','required')}${field('phone','Telefono',c.phone,'tel')}${field('email','Email',c.email,'email')}${field('address','Indirizzo',c.address)}${field('postal_code','CAP',c.postal_code)}${field('city','Comune',c.city)}<label>Dipendente assegnato<select name="assigned_employee_id"><option value="">Non assegnato</option>${em.map(p=>`<option value="${p.id}" ${p.id===c.assigned_employee_id?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select></label>`,true)}
    ${formSection('Emergenza e reperibilità','Referente da contattare in caso di necessità',`${selectField('emergency_contact_type','Tipo contatto di emergenza',emergencyTypes,c.emergency_contact_type)}${field('emergency_contact_name','Nome contatto di emergenza',c.emergency_contact_name||c.emergency_contact)}${field('emergency_contact_phone','Telefono contatto di emergenza',c.emergency_contact_phone,'tel')}${selectField('availability','Disponibilità / reperibilità',availabilityOptions,c.availability)}`)}
    ${formSection('Note operative','Indicazioni visibili al personale autorizzato',`${areaField('operational_notes','Note operative',c.operational_notes)}`)}
  </div>`;
  modal(id?'Modifica cliente':'Nuovo cliente',html,async f=>{const d=Object.fromEntries(f);d.assigned_employee_id=d.assigned_employee_id||null;d.emergency_contact=[d.emergency_contact_name,d.emergency_contact_phone].filter(Boolean).join(' · ')||null;id?await update('customers',id,d):await insert('customers',d)})
};

window.openDog=id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const d=state.dogs.find(x=>x.id===id)||{};
  const html=`<div class="data-form-stack">
    ${formSection('Identificazione','Dati anagrafici e veterinario',`${field('name','Nome',d.name,'text','required')}<label>Proprietario<select name="customer_id" required><option value="">Seleziona proprietario</option>${state.customers.map(c=>`<option value="${c.id}" ${c.id===d.customer_id?'selected':''}>${esc(c.first_name+' '+c.last_name)}</option>`).join('')}</select></label>${selectField('breed_type','Razza / tipologia',breedTypes,d.breed_type)}${field('breed_detail','Dettaglio razza / tipologia',d.breed_detail||d.breed)}${selectField('size','Taglia',sizeOptions,d.size)}${selectField('age_range','Fascia età',ageOptions,d.age_range)}${field('age_detail','Età precisa',d.age_detail)}${field('weight_detail','Peso indicativo',d.weight_detail)}${selectField('sex','Sesso',sexOptions,d.sex)}${selectField('sterilized','Sterilizzato / castrato',yesNoUnknown,d.sterilized)}${selectField('microchip_status','Microchip',['Presente','Non presente','Non so','Da verificare'],d.microchip_status)}${field('microchip_number','Numero microchip',d.microchip_number||d.microchip)}${selectField('vet_status','Veterinario',vetOptions,d.vet_status)}${field('vet_name','Nome veterinario / clinica',d.vet_name)}${field('vet_phone','Telefono veterinario / clinica',d.vet_phone,'tel')}`,true)}
    ${formSection('Salute e sicurezza','Vaccinazioni, patologie, allergie e terapie',`${selectField('vaccines','Vaccinazioni',vaccineOptions,d.vaccines)}${selectField('parasites','Antiparassitario',parasiteOptions,d.parasites)}${selectField('illnesses','Patologie note',illnessOptions,d.illnesses)}${areaField('illnesses_detail','Dettaglio patologie',d.illnesses_detail)}${selectField('allergies','Allergie',allergyOptions,d.allergies)}${areaField('allergies_detail','Dettaglio allergie',d.allergies_detail)}${selectField('medicines','Farmaci / terapie',medicineOptions,d.medicines)}${areaField('medicines_detail','Dettaglio farmaci / dosaggio',d.medicines_detail)}${selectField('health_risk','Livello rischio sanitario',riskOptions,d.health_risk)}`)}
    ${formSection('Alimentazione e routine','Pasti, premi e regole domestiche',`${selectField('food_type','Tipo alimentazione',foodOptions,d.food_type)}${field('food_detail','Marca / alimento / note dieta',d.food_detail)}${selectField('meals','Numero pasti',mealOptions,d.meals)}${field('meal_times','Orari pasti',d.meal_times)}${selectField('treats','Premi alimentari',treatOptions,d.treats)}${areaField('treats_detail','Premi consentiti / vietati',d.treats_detail)}${selectField('home_rules','Regole domestiche',homeRuleOptions,d.home_rules)}${areaField('home_rules_detail','Dettaglio regole domestiche',d.home_rules_detail)}${areaField('routine_notes','Routine quotidiana',d.routine_notes)}`)}
    ${formSection('Comportamento','Socialità, paure e criticità',`${selectField('character','Carattere generale',characterOptions,d.character)}${selectField('adults','Con adulti',socialOptions,d.adults)}${selectField('children','Con bambini',childrenOptions,d.children)}${selectField('dogs_social','Con altri cani',socialOptions,d.dogs_social)}${selectField('fears','Paure / fobie',fearOptions,d.fears)}${areaField('fears_detail','Dettaglio paure / fobie',d.fears_detail)}${selectField('bite_history','Storico morsi',biteOptions,d.bite_history)}${areaField('bite_history_detail','Dettaglio episodio morso / pinzata',d.bite_history_detail)}${selectField('resource_guarding','Possessività',guardingOptions,d.resource_guarding)}${areaField('resource_guarding_detail','Dettaglio possessività',d.resource_guarding_detail)}${areaField('behavior_notes','Altre note comportamentali',d.behavior_notes)}`)}
    ${formSection('Passeggiata','Attrezzatura, reazioni e aree da evitare',`${selectField('equipment','Attrezzatura usata',equipmentOptions,d.equipment)}${field('equipment_detail','Dettaglio attrezzatura / taglia',d.equipment_detail)}${selectField('dog_triggers','Reazione ad altri cani',dogTriggerOptions,d.dog_triggers)}${selectField('moving_triggers','Reazione a bici / auto / runner',movingTriggerOptions,d.moving_triggers)}${selectField('avoid_areas','Zone da evitare',avoidOptions,d.avoid_areas)}${areaField('avoid_areas_detail','Dettaglio zone da evitare',d.avoid_areas_detail)}${selectField('off_leash','Libero dal guinzaglio',offLeashOptions,d.off_leash)}${selectField('walk_level','Livello gestione passeggiata',walkLevelOptions,d.walk_level)}`)}
  </div>`;
  modal(id?'Modifica cane':'Nuovo cane',html,async f=>{
    const x=Object.fromEntries(f);
    x.breed=x.breed_detail||x.breed_type||null;
    x.microchip=x.microchip_number||x.microchip_status||null;
    x.feeding_notes=[x.food_type,x.food_detail,x.meals,x.meal_times].filter(Boolean).join(' · ')||null;
    x.medical_notes=[x.illnesses,x.allergies,x.medicines].filter(Boolean).join(' · ')||null;
    id?await update('dogs',id,x):await insert('dogs',x)
  })
};
window.openService=(id,seed={})=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const service=state.services.find(item=>item.id===id)||seed||{};const employees=state.profiles.filter(p=>p.role==='dipendente'&&p.active);
  const servicePeriods=normalizePeriods(service,'service');
  const initialServiceVisits=Math.max(1,periodsTotals(servicePeriods).visits);
  const initialEmployeeUnit=Number(service.employee_unit_compensation||0)>0?Number(service.employee_unit_compensation):Number(service.employee_compensation||0)/initialServiceVisits;
  const currentType=service.service_type||'Dog Walking';const isCustomType=currentType&&!serviceTypePresets.includes(currentType)||currentType==='Altro servizio';
  const selectedCustomer=service.customer_id||state.customers[0]?.id||'';const assignedEmployee=service.employee_id||state.customers.find(c=>c.id===selectedCustomer)?.assigned_employee_id||'';
  modal(id?'Modifica servizio':'Nuovo servizio',`<div class="service-form-sections">
  <section><h3>Assegnazione</h3><div class="form-grid">
    <label>Cliente<select id="serviceCustomer" name="customer_id" required><option value="">Seleziona cliente</option>${state.customers.map(c=>`<option value="${c.id}" ${c.id===selectedCustomer?'selected':''}>${esc(c.first_name+' '+c.last_name)}</option>`).join('')}</select></label>
    <label>Cane<select id="serviceDog" name="dog_id" required><option value="">Seleziona cane</option></select></label>
    <label>Dipendente<select id="serviceEmployee" name="employee_id" required><option value="">Seleziona dipendente</option>${employees.map(p=>`<option value="${p.id}" ${p.id===assignedEmployee?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select></label>
    <label>Stato servizio<select name="status"><option value="programmato" ${(service.status||'programmato')==='programmato'?'selected':''}>Programmato</option><option value="in_corso" ${service.status==='in_corso'?'selected':''}>In corso</option><option value="da_verificare" ${service.status==='da_verificare'?'selected':''}>Da verificare</option><option value="chiuso" ${service.status==='chiuso'?'selected':''}>Chiuso</option><option value="annullato" ${service.status==='annullato'?'selected':''}>Annullato</option></select></label>
  </div></section>
  <section><h3>Servizio richiesto</h3><div class="form-grid">
    <label>Tipo servizio<select id="serviceType" name="service_type_choice" required>${serviceTypePresets.map(v=>`<option value="${esc(v)}" ${v===currentType||isCustomType&&v==='Altro servizio'?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
    <label id="customServiceTypeWrap" class="${isCustomType?'':'hidden'}">Specificare altro servizio<input id="customServiceType" name="service_type_custom" value="${esc(isCustomType&&currentType!=='Altro servizio'?currentType:'')}"></label>
    <label>Frequenza<select name="frequency">${selectOptions(frequencyPresets,service.frequency||'Una volta')}</select></label>
    <label>Ora indicativa principale<input name="service_time" type="time" value="${esc(String(service.service_time||servicePeriods[0]?.time_slot_1||'09:00').slice(0,5))}" required></label>
    <label>Durata uscita / visita<select name="planned_duration_minutes">${selectOptions(durationPresets,service.planned_duration_minutes??30)}</select></label>
  </div></section><section class="periods-section"><div class="section-head quote-section-head"><div><h3>Periodi e date</h3><p id="servicePeriodsSummary" class="muted"></p></div><button type="button" onclick="addPeriodRow('service')">Aggiungi periodo</button></div><div id="servicePeriods">${servicePeriods.map((p,i)=>periodRow('service',p,i)).join('')}</div></section>
  <section><h3>Economia</h3><div class="form-grid">
    <label>Costo singola uscita / prestazione (€)<input id="serviceUnitRate" name="unit_rate" type="number" min="0" step="0.01" value="${Number(service.unit_rate||0)}"></label>
    <label>Sconto applicato<select id="serviceDiscount" name="discount_rate"><option value="0" ${Number(service.discount_rate||0)===0?'selected':''}>Nessuno sconto</option><option value="5" ${Number(service.discount_rate||0)===5?'selected':''}>Sconto 5%</option><option value="10" ${Number(service.discount_rate||0)===10?'selected':''}>Sconto 10%</option></select></label>
    <label>Importo cliente (€)<input id="serviceCustomerAmount" name="customer_amount" type="number" min="0" step="0.01" value="${Number(service.customer_amount||0)}" required></label>
    <label>Compenso dipendente per uscita (€)<input id="serviceEmployeeUnitCompensation" name="employee_unit_compensation" type="number" min="0" step="0.01" value="${initialEmployeeUnit.toFixed(2)}" required></label>
    <label>Compenso dipendente totale (€)<input id="serviceEmployeeCompensation" name="employee_compensation" type="number" min="0" step="0.01" value="${Number(service.employee_compensation||0).toFixed(2)}" readonly required></label>
    <label>Modalità pagamento<select id="servicePayment" name="payment_method">${selectOptions(paymentPresets,service.payment_method||'Bonifico')}</select></label>
    <label id="servicePaymentOtherWrap" class="hidden">Altra modalità pagamento<input name="payment_method_other" value="${esc(service.payment_method_other||'')}"></label>
    <label>Stato cliente<select name="client_status">${clientStatusPresets.map(v=>`<option ${v===(service.client_status||'Nuovo')?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>Stato pagamento cliente<select name="customer_payment_status">${paymentStatusPresets.map(v=>`<option value="${v.value}" ${v.value===(service.customer_payment_status||'da_incassare')?'selected':''}>${v.label}</option>`).join('')}</select></label>
    <div class="service-calc wide"><span>Cliente: tariffa × uscite giornaliere × giorni, meno sconto.<br>Dipendente: compenso per uscita × numero totale uscite.</span><div class="service-calc-values"><strong id="serviceCalcPreview">Cliente 0,00 €</strong><strong id="serviceEmployeeCalcPreview">Dipendente 0,00 €</strong></div></div>
  </div></section>
  <section><h3>Organizzazione e autorizzazioni</h3><div class="form-grid">
    <label>Chiavi affidate?<select id="serviceKeys" name="keys_status">${selectOptions(keysPresets,service.keys_status||'')}</select></label>
    <label id="serviceKeysModeWrap">Modalità consegna chiavi<select name="keys_mode">${selectOptions(keysModePresets,service.keys_mode||'')}</select></label>
    <label>Aggiornamenti al proprietario<select name="customer_updates">${selectOptions(updatePresets,service.customer_updates||'Messaggio WhatsApp')}</select></label>
    <label>Contatto veterinario in emergenza<select name="auth_vet">${selectOptions(authorizationPresets,service.auth_vet||'Solo dopo contatto telefonico')}</select></label>
    <label>Trasporto in clinica veterinaria<select name="auth_transport">${selectOptions(authorizationPresets,service.auth_transport||'Solo dopo contatto telefonico')}</select></label>
    <label class="wide">Note operative<textarea name="operational_notes" maxlength="3000">${esc(service.operational_notes||'')}</textarea></label>
  </div></section></div>`,async formData=>{
    const payload=Object.fromEntries(formData);const periods=readPeriodRows('service');const firstPeriod=periods[0];const periodTotal=periodsTotals(periods);payload.periods=periods;payload.service_date=firstPeriod.start_date;payload.end_date=firstPeriod.end_date;payload.daily_visits=firstPeriod.daily_visits;payload.time_slot_1=firstPeriod.time_slot_1;payload.time_slot_2=firstPeriod.time_slot_2;payload.time_slot_3=firstPeriod.time_slot_3;payload.time_slot_4=firstPeriod.time_slot_4;payload.service_type=payload.service_type_choice==='Altro servizio'?String(payload.service_type_custom||'').trim():payload.service_type_choice;delete payload.service_type_choice;delete payload.service_type_custom;
    ['planned_duration_minutes','daily_visits','unit_rate','discount_rate','customer_amount','employee_unit_compensation','employee_compensation'].forEach(k=>payload[k]=Number(payload[k]||0));
    if(!payload.customer_id||!payload.dog_id||!payload.employee_id)throw Error('Seleziona cliente, cane e dipendente.');if(!payload.service_type)throw Error('Indica il tipo di servizio.');const dog=state.dogs.find(d=>d.id===payload.dog_id);if(!dog||dog.customer_id!==payload.customer_id)throw Error('Il cane selezionato non appartiene al cliente.');if(payload.employee_compensation>payload.customer_amount)throw Error('Il compenso dipendente non può superare l’importo cliente.');if(payload.payment_method!=='Altro')payload.payment_method_other=null;
    const sourceQuoteId=service.quote_id||null;
    if(sourceQuoteId)delete payload.quote_id;
    let savedService;
    if(id){savedService=await update('dogsitter_services',id,payload)}else{savedService=await insert('dogsitter_services',payload)}
    if(sourceQuoteId&&!id){
      const created=Array.isArray(savedService)?savedService[0]:savedService;
      const patch={status:'accettato'};
      if(created?.id)patch.converted_service_id=created.id;
      try{await update('dogsitter_quotes',sourceQuoteId,patch)}catch(err){console.warn('Servizio creato, collegamento preventivo non aggiornato:',err.message)}
    }
  });
  const customer=$('#serviceCustomer'),dog=$('#serviceDog'),employee=$('#serviceEmployee');const fillDogs=()=>{const dogs=state.dogs.filter(d=>d.customer_id===customer.value);dog.innerHTML='<option value="">Seleziona cane</option>'+dogs.map(d=>`<option value="${d.id}" ${d.id===service.dog_id?'selected':''}>${esc(d.name)}</option>`).join('');if(!id&&dogs.length===1)dog.value=dogs[0].id;const assigned=state.customers.find(c=>c.id===customer.value)?.assigned_employee_id;if(!id&&assigned&&employees.some(p=>p.id===assigned))employee.value=assigned};customer.onchange=fillDogs;fillDogs();
  const toggleCustom=()=>{const on=$('#serviceType').value==='Altro servizio';$('#customServiceTypeWrap').classList.toggle('hidden',!on);$('#customServiceType').required=on};$('#serviceType').onchange=toggleCustom;toggleCustom();
  window.recalculateServiceTotals=()=>{const periods=readPeriodRows('service'),totals=periodsTotals(periods),rate=Number($('#serviceUnitRate')?.value||0),discount=Number($('#serviceDiscount')?.value||0),customerTotal=rate*totals.visits*(1-discount/100),employeeUnit=Number($('#serviceEmployeeUnitCompensation')?.value||0),employeeTotal=employeeUnit*totals.visits;if($('#serviceCalcPreview'))$('#serviceCalcPreview').textContent=`Cliente ${money(customerTotal)}`;if($('#serviceEmployeeCalcPreview'))$('#serviceEmployeeCalcPreview').textContent=`Dipendente ${money(employeeTotal)} · ${totals.visits} ${totals.visits===1?'uscita':'uscite'}`;if($('#servicePeriodsSummary'))$('#servicePeriodsSummary').textContent=`${totals.days} giorni complessivi · ${totals.visits} uscite totali`;if(!id||Number($('#serviceCustomerAmount')?.value||0)===0)$('#serviceCustomerAmount').value=customerTotal.toFixed(2);$('#serviceEmployeeCompensation').value=employeeTotal.toFixed(2)};['serviceUnitRate','serviceEmployeeUnitCompensation','serviceDiscount'].forEach(fieldId=>{const el=$('#'+fieldId);if(el){el.oninput=recalculateServiceTotals;el.onchange=recalculateServiceTotals}});bindPeriodRows('service');recalculateServiceTotals();
  const toggleKeys=()=>$('#serviceKeysModeWrap').classList.toggle('hidden',!['Sì','Da concordare'].includes($('#serviceKeys').value));$('#serviceKeys').onchange=toggleKeys;toggleKeys();
  const togglePayment=()=>$('#servicePaymentOtherWrap').classList.toggle('hidden',$('#servicePayment').value!=='Altro');$('#servicePayment').onchange=togglePayment;togglePayment();
};
window.openEmployee=id=>{const p=state.profiles.find(x=>x.id===id);if(!p)return;const ownerLocked=p.is_owner&&!isOwner(),code=passCode(p),verifyPayload=`K9PASS|${code}|${p.active?'ATTIVO':'SOSPESO'}`,canResetPassword=!p.is_owner&&(isOwner()||(state.profile?.role==='vice_admin'&&p.role==='dipendente'));modal('Gestisci account',`<div class="account-pass-media"><div class="account-photo-box"><img id="profilePhotoPreview" src="${esc(p.photo_url||identityLogo())}" alt="Foto tesserino"><label class="photo-upload-button">Aggiungi o cambia foto<input id="profilePhotoFile" type="file" accept="image/jpeg,image/png,image/webp" onchange="previewProfilePhoto(event)"></label></div><div class="account-qr-box"><img src="${qrImageUrl(verifyPayload)}" alt="QR tesserino"><span>QR del tesserino</span></div></div><div class="form-grid">${field('full_name','Nome completo',p.full_name,'text','required')}${field('employee_code','Codice',p.employee_code)}${field('qualification','Qualifica',p.qualification)}${field('pass_expires_at','Scadenza pass',p.pass_expires_at||'','date')}<label>Ruolo<select name="role" ${ownerLocked?'disabled':''}><option value="dipendente" ${p.role==='dipendente'?'selected':''}>Dipendente</option><option value="vice_admin" ${p.role==='vice_admin'?'selected':''}>Vice amministratore</option>${p.is_owner?'<option value="owner" selected>Datore di lavoro</option>':''}</select></label><label>Stato<select name="active" ${ownerLocked?'disabled':''}><option value="true" ${p.active?'selected':''}>Attivo</option><option value="false" ${!p.active?'selected':''}>Sospeso</option></select></label></div>${canResetPassword?`<div class="settings-block"><h3>Credenziali di accesso</h3><p class="muted">Email e password sono gestite dall'amministrazione. L'utente non può modificarle dall'app.</p><button type="button" onclick="openPasswordReset('${id}')">Imposta nuova password</button></div>`:''}`,async f=>{const x=Object.fromEntries(f);x.active=x.active==='true';if(p.is_owner&&!isOwner())throw Error('Il titolare può essere modificato solo dal titolare.');await rpc('admin_update_profile',{p_user_id:id,p_full_name:x.full_name,p_employee_code:x.employee_code||null,p_qualification:x.qualification||null,p_pass_expires_at:x.pass_expires_at||null,p_role:x.role||p.role,p_active:x.active});const photoFile=$('#profilePhotoFile')?.files?.[0];if(photoFile){const photoUrl=await uploadProfilePhoto(id,photoFile);await rpc('set_profile_photo',{p_user_id:id,p_photo_url:photoUrl})}await loadAll();if(state.profile.id===id)renderPass()})};
window.openPasswordReset=id=>{const p=state.profiles.find(x=>x.id===id);if(!p)return toast('Utente non trovato');if(p.is_owner)return toast('La password del titolare non può essere modificata da questa funzione');if(state.profile?.role==='vice_admin'&&p.role!=='dipendente')return toast('Il Vice Amministratore può reimpostare solo password dei dipendenti');modal('Imposta nuova password',`<p><b>${esc(p.full_name||p.email)}</b></p><p class="muted">La nuova password sostituirà immediatamente quella precedente.</p><div class="form-grid">${field('password','Nuova password','','password','minlength="8" required')}${field('confirm_password','Conferma password','','password','minlength="8" required')}</div>`,async f=>{const x=Object.fromEntries(f);if(x.password!==x.confirm_password)throw Error('Le password non coincidono');if(String(x.password||'').length<8)throw Error('La password deve contenere almeno 8 caratteri');const r=await invokeHyperHandler({action:'reset_password',user_id:id,password:x.password});toast(r.message||'Password aggiornata')})};
window.toggleAuditDetails=(id,btn)=>{const e=document.getElementById(id);e.classList.toggle('hidden');btn.textContent=e.classList.contains('hidden')?'Mostra dettagli':'Nascondi dettagli'};
window.archiveEntity=async(table,id,label)=>{if(!isAdmin())return;if(!confirm(`Eliminare ${label}? Verrà spostato nel Cestino e potrà essere ripristinato.`))return;await rpc('archive_entity',{p_table:table,p_id:id});await loadAll();render(document.querySelector('#nav button.active')?.dataset.screen||'dashboard');toast('Elemento spostato nel Cestino')};
async function loadTrash(){state.trash=await rpc('list_trash')||[]}
async function renderTrash(){
  if(!isAdmin()){show('dashboard');return}
  await loadTrash();
  $('#trashList').innerHTML=state.trash.map(x=>`<details class="record-accordion trash-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(x.label)}</span><small>${esc(x.type_label)} · ${new Date(x.deleted_at).toLocaleString('it-IT')}</small></div><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded"><div class="card-actions"><button class="primary" onclick="restoreEntity('${x.table_name}','${x.id}')">Ripristina</button>${isOwner()?`<button class="danger" onclick="purgeEntity('${x.table_name}','${x.id}','${esc(x.label)}')">Elimina definitivamente</button>`:''}</div></article></details>`).join('')||'<div class="card">Il Cestino è vuoto.</div>'
}
window.restoreEntity=async(table,id)=>{await rpc('restore_entity',{p_table:table,p_id:id});await renderTrash();toast('Elemento ripristinato')};
window.purgeEntity=async(table,id,label)=>{
  if(!confirm(`Eliminare definitivamente ${label}? Questa operazione non può essere annullata.`))return;
  if(table==='dogsitter_quotes'){
    const quoteDocs=state.documents.filter(d=>d.source_kind==='quote'&&d.quote_id===id&&d.storage_path);
    for(const doc of quoteDocs){
      const response=await fetch(`${C.SUPABASE_URL}/storage/v1/object/service-documents/${doc.storage_path}`,{method:'DELETE',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`}});
      if(!response.ok&&response.status!==404){const text=await response.text();throw Error(text||'Impossibile eliminare il PDF del preventivo dallo Storage')}
    }
  }
  await rpc('purge_entity',{p_table:table,p_id:id});
  await loadAll();
  await renderTrash();
  toast('Elemento eliminato definitivamente');
};
window.startService=async id=>{if(isEmployee())return toast('Il servizio è disponibile in sola lettura');await rpc('start_my_service',{p_service_id:id});await loadAll();renderServices();toast('Servizio iniziato')};
window.completeService=id=>{if(isEmployee())return toast('Il servizio è disponibile in sola lettura');return modal('Concludi servizio',`<div class="form-grid"><label class="wide">Rapporto obbligatorio<textarea name="report" required></textarea></label><label class="wide">Anomalie o note<textarea name="incident"></textarea></label></div>`,async f=>rpc('complete_my_service',{p_service_id:id,p_report_text:f.get('report'),p_incident_notes:f.get('incident')||null}))};
window.viewService=id=>{const s=state.services.find(x=>x.id===id);if(!s)return toast('Servizio non trovato');const total=totalVisits(s),unit=Number(s.employee_unit_compensation||0)||Number(s.employee_compensation||0)/Math.max(1,total);const operational=`<div class="entity-details"><p><span>Cliente</span><strong>${esc(cname(s.customer_id))}</strong></p><p><span>Cane</span><strong>${esc(dname(s.dog_id))}</strong></p><p><span>Tipo servizio</span><strong>${esc(s.service_type||'—')}</strong></p><p class="wide"><span>Periodi</span><strong>${normalizePeriods(s).map((p,i)=>`P${i+1}: ${p.start_date===p.end_date?dateIT(p.start_date):dateIT(p.start_date)+' – '+dateIT(p.end_date)} · ${p.daily_visits}/giorno · ${periodVisits(p)} uscite`).join('<br>')}</strong></p><p><span>Frequenza</span><strong>${esc(displayValue(s.frequency,'Non indicata'))}</strong></p><p class="wide"><span>Fasce orarie</span><strong>${esc(serviceSlots(s))}</strong></p><p><span>Durata</span><strong>${Number(s.planned_duration_minutes||0)} minuti</strong></p><p><span>Uscite giornaliere</span><strong>${Number(s.daily_visits||1)}</strong></p><p><span>Uscite totali</span><strong>${total}</strong></p><p><span>Stato</span><strong>${esc(statusLabels[s.status]||s.status)}</strong></p><p><span>Chiavi affidate</span><strong>${esc(displayValue(s.keys_status))}</strong></p><p><span>Consegna chiavi</span><strong>${esc(displayValue(s.keys_mode))}</strong></p><p><span>Aggiornamenti proprietario</span><strong>${esc(displayValue(s.customer_updates))}</strong></p><p><span>Contatto veterinario</span><strong>${esc(displayValue(s.auth_vet))}</strong></p><p class="wide"><span>Trasporto in clinica</span><strong>${esc(displayValue(s.auth_transport))}</strong></p><p class="wide"><span>Note operative</span><strong>${esc(s.operational_notes||'Nessuna nota')}</strong></p>${s.report_text?`<p class="wide"><span>Rapporto</span><strong>${esc(s.report_text)}</strong></p>`:''}${s.incident_notes?`<p class="wide"><span>Anomalie</span><strong>${esc(s.incident_notes)}</strong></p>`:''}`;const adminPeriodEconomics=isAdmin()?`<div class="service-period-economics wide"><strong>Riepilogo economico periodi</strong>${normalizePeriods(s).map((p,i)=>`<div><span>P${i+1} · ${periodVisits(p)} uscite</span><b>${money(periodClientTotal(p,Number(s.unit_rate||0)||Number(s.customer_amount||0)/Math.max(1,total)))}</b></div>`).join('')}<div><span>Totale cliente</span><b>${money(s.customer_amount)}</b></div></div>`:'';const economics=isAdmin()?`<p><span>Dipendente</span><strong>${esc(pname(s.employee_id))}</strong></p><p><span>Importo cliente</span><strong>${money(s.customer_amount)}</strong></p><p><span>Compenso per uscita</span><strong>${money(unit)}</strong></p><p><span>Compenso totale</span><strong>${money(s.employee_compensation)}</strong></p><p><span>Margine attività</span><strong>${money(Number(s.customer_amount||0)-Number(s.employee_compensation||0))}</strong></p>`:`<p><span>Compenso per uscita</span><strong>${money(unit)}</strong></p><p><span>Compenso totale scheda</span><strong>${money(s.employee_compensation)}</strong></p>`;modal('Dettaglio servizio',operational+adminPeriodEconomics+economics+'</div>',async()=>{});const save=$('#modalSave');if(save)save.classList.add('hidden')};
window.duplicateService=async id=>{const s=state.services.find(x=>x.id===id);if(!s)return toast('Servizio non trovato');if(!confirm(`Duplicare il servizio del ${dateIT(serviceFirstDate(s))}? La copia sarà salvata come Programmato e senza rapporti o documenti.`))return;const periods=normalizePeriods(s).map((p,index)=>({...p,position:index+1}));const first=periods[0];const payload={customer_id:s.customer_id,dog_id:s.dog_id,employee_id:s.employee_id,service_type:s.service_type,service_date:first.start_date,end_date:first.end_date,service_time:String(s.service_time||first.time_slot_1||'').slice(0,5)||null,planned_duration_minutes:Number(s.planned_duration_minutes||30),daily_visits:Number(first.daily_visits||1),time_slot_1:first.time_slot_1||null,time_slot_2:first.time_slot_2||null,time_slot_3:first.time_slot_3||null,time_slot_4:first.time_slot_4||null,periods,frequency:s.frequency||null,unit_rate:Number(s.unit_rate||0),discount_rate:Number(s.discount_rate||0),customer_amount:Number(s.customer_amount||0),employee_unit_compensation:Number(s.employee_unit_compensation||0),employee_compensation:Number(s.employee_compensation||0),payment_method:s.payment_method||null,payment_method_other:s.payment_method_other||null,client_status:s.client_status||null,customer_payment_status:'da_incassare',employee_payment_status:'da_liquidare',keys_status:s.keys_status||null,keys_mode:s.keys_mode||null,customer_updates:s.customer_updates||null,auth_vet:s.auth_vet||null,auth_transport:s.auth_transport||null,operational_notes:s.operational_notes||null,status:'programmato'};try{await insert('dogsitter_services',payload);await loadAll();renderServices();toast('Servizio duplicato con tutti i dati operativi')}catch(error){toast(error?.message||'Duplicazione non riuscita')}};
window.closeService=async id=>{const s=state.services.find(x=>x.id===id);if(!s)return toast('Servizio non trovato');if(!confirm('Chiudere questo servizio? Diventerà maturato per Economia e compensi. I PDF potranno essere generati dalla scheda chiusa.'))return;await update('dogsitter_services',id,{status:'chiuso',completed_at:s.completed_at||new Date().toISOString()});await loadAll();renderServices();toast('Servizio chiuso')};
function pdfByte(code){
  const map={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};
  return code<=255?code:(map[code]||63)
}
function pdfEscape(s){let out='';for(const ch of String(s??'')){const b=pdfByte(ch.codePointAt(0));if(b===40||b===41||b===92)out+='\\'+String.fromCharCode(b);else if(b<32||b>126)out+='\\'+b.toString(8).padStart(3,'0');else out+=String.fromCharCode(b)}return out}
function pdfMoney(n){return `EUR ${Number(n||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function hexRgb(hex,fallback='#0f5f53'){const h=/^#[0-9a-f]{6}$/i.test(hex||'')?hex:fallback;return [parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]}
function tint(rgb,amount=.88){return rgb.map(v=>v+(1-v)*amount)}
function darken(rgb,amount=.25){return rgb.map(v=>Math.max(0,v*(1-amount)))}
function pdfNum(n){return Number(n).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')}
function rgbCmd(rgb,stroke=false){return `${rgb.map(pdfNum).join(' ')} ${stroke?'RG':'rg'}\n`}
function wrapPdfText(text,maxChars=66){const paragraphs=String(text||'').split(/\n+/),result=[];for(const paragraph of paragraphs){const words=paragraph.trim().split(/\s+/).filter(Boolean);if(!words.length){result.push('');continue}let line='';for(const word of words){const test=line?`${line} ${word}`:word;if(test.length>maxChars&&line){result.push(line);line=word}else line=test}if(line)result.push(line)}return result}
function buildStyledPdf(data,kind='customer'){
  const st=state.settings||DEFAULT_SETTINGS;
  const primary=hexRgb(st.primary_color),secondary=hexRgb(st.secondary_color,'#153e75');
  const primaryLight=tint(primary,.89),secondaryLight=tint(secondary,.90),gray=[.32,.36,.40],light=[.965,.972,.978],white=[1,1,1],dangerLight=[1,.94,.91],danger=[.70,.20,.08];
  const pageW=595,pageH=842,margin=38,contentW=pageW-margin*2;
  const pages=[];let ops=[],y=pageH-margin;
  const addPage=()=>{if(ops.length)pages.push(ops.join(''));ops=[];y=pageH-margin};
  const text=(value,x,yy,size=10,font='F1',color=gray)=>{ops.push(rgbCmd(color),`BT /${font} ${size} Tf 1 0 0 1 ${pdfNum(x)} ${pdfNum(yy)} Tm (${pdfEscape(value)}) Tj ET\n`)};
  const rect=(x,yy,w,h,fill,stroke=null,radius=0)=>{void radius;ops.push(rgbCmd(fill),`${pdfNum(x)} ${pdfNum(yy)} ${pdfNum(w)} ${pdfNum(h)} re f\n`);if(stroke)ops.push(rgbCmd(stroke,true),`${pdfNum(x)} ${pdfNum(yy)} ${pdfNum(w)} ${pdfNum(h)} re S\n`)};
  const line=(x1,y1,x2,y2,color=[.82,.84,.86],width=.7)=>ops.push(rgbCmd(color,true),`${width} w ${pdfNum(x1)} ${pdfNum(y1)} m ${pdfNum(x2)} ${pdfNum(y2)} l S\n`);
  const ensure=(height)=>{if(y-height<54){addPage();drawHeader(false)}};
  const blockTitle=(title,color=primary)=>{ensure(34);rect(margin,y-27,contentW,27,color);text(title.toUpperCase(),margin+12,y-18,10,'F2',white);y-=34};
  const infoGrid=(items,accent=primaryLight)=>{const rowH=44,cols=2,w=(contentW-8)/2;for(let i=0;i<items.length;i+=2){ensure(rowH+8);for(let c=0;c<2;c++){const item=items[i+c];if(!item)continue;const x=margin+c*(w+8);rect(x,y-rowH,w,rowH,accent);text(item[0],x+10,y-15,7.5,'F2',darken(primary,.1));text(String(item[1]??'—'),x+10,y-32,10,'F1',[.12,.15,.18])}y-=rowH+8}};
  const paragraphBlock=(titleText,body,accent=secondaryLight)=>{const lines=wrapPdfText(body||'Nessuna nota inserita.',76);const h=34+lines.length*13+10;ensure(h+8);rect(margin,y-h,contentW,h,accent);text(titleText.toUpperCase(),margin+12,y-18,8,'F2',darken(secondary,.12));let ty=y-37;for(const l of lines){text(l,margin+12,ty,9,'F1',[.14,.17,.20]);ty-=13}y-=h+8};
  const drawHeader=(first=true)=>{const title=kind==='employee'?'PROSPETTO COMPENSO DIPENDENTE':'RAPPORTO SERVIZIO CLIENTE';rect(0,pageH-112,pageW,112,primary);rect(0,pageH-118,pageW,6,secondary);text(st.organization_name||DEFAULT_SETTINGS.organization_name,margin,pageH-47,18,'F2',white);if(st.subtitle)text(st.subtitle,margin,pageH-66,9,'F1',primaryLight);text(title,margin,pageH-91,11,'F2',white);const badge=kind==='employee'?'USO INTERNO':'DOCUMENTO CLIENTE';rect(pageW-margin-120,pageH-94,120,27,secondary);text(badge,pageW-margin-108,pageH-84,8,'F2',white);y=pageH-140;if(!first){text('Continuazione documento',margin,y,8,'F3',gray);y-=22}};
  drawHeader(true);
  const docNo=data.document_number||`K9-${String(data.id||data.service_id||'').slice(0,8).toUpperCase()}`;
  infoGrid([['NUMERO DOCUMENTO',docNo],['DATA EMISSIONE',new Date().toLocaleDateString('it-IT')]],light);
  blockTitle('Anagrafica e servizio');
  infoGrid([['CLIENTE',data.customer_name||'—'],['CANE',data.dog_name||'—'],['TIPO SERVIZIO',data.service_type||'—'],['DATA E ORA',`${dateIT(data.service_date)} - ${String(data.service_time||'').slice(0,5)||'—'}`],['USCITE PREVISTE',data.daily_visits||1],['OPERATORE',data.employee_name||'—']],primaryLight);
  blockTitle('Svolgimento',secondary);
  infoGrid([['INIZIO EFFETTIVO',data.started_at?new Date(data.started_at).toLocaleString('it-IT'):'—'],['FINE EFFETTIVA',data.completed_at?new Date(data.completed_at).toLocaleString('it-IT'):'—']],secondaryLight);
  paragraphBlock('Rapporto del servizio',data.report_text,light);
  if(data.incident_notes)paragraphBlock('Anomalie e note',data.incident_notes,dangerLight);
  if(kind==='customer'){
    blockTitle('Riepilogo economico cliente',primary);
    ensure(78);rect(margin,y-68,contentW,68,primaryLight);text('TOTALE SERVIZI',margin+16,y-23,9,'F2',darken(primary,.15));text(pdfMoney(data.customer_amount),margin+16,y-51,22,'F2',primary);y-=78;
    ensure(24);text('Documento cliente: compensi del dipendente e margini interni non sono inclusi.',margin,y-8,7.5,'F3',gray);y-=24;
  }else{
    blockTitle('Riepilogo compenso dipendente',secondary);
    ensure(102);rect(margin,y-92,contentW,92,secondaryLight);text('COMPENSO DELLA SCHEDA',margin+16,y-24,9,'F2',darken(secondary,.12));text(pdfMoney(data.employee_compensation),margin+16,y-57,24,'F2',secondary);text(`${Number(data.daily_visits||1)} ${Number(data.daily_visits||1)===1?'uscita':'uscite'} - Stato: ${data.employee_payment_status||'da_liquidare'}`,margin+16,y-78,9,'F1',gray);y-=102;
    ensure(24);text('Documento interno: importo cliente e margine aziendale non sono inclusi.',margin,y-8,7.5,'F3',gray);y-=24;
  }
  if(st.show_signatures_pdf){ensure(72);line(margin,y-4,margin+210,y-4);line(pageW-margin-210,y-4,pageW-margin,y-4);text(kind==='customer'?'Firma / accettazione cliente':'Firma dipendente',margin,y-22,8,'F1',gray);text('Approvazione responsabile',pageW-margin-210,y-22,8,'F1',gray);y-=52}
  if(data.approver_name&&y>48){text(`Approvato da ${data.approver_name}${data.approved_at?' il '+new Date(data.approved_at).toLocaleString('it-IT'):''}`,margin,46,7.5,'F3',gray)}
  if(st.show_footer_pdf&&(st.footer_text||st.legal_text)){line(margin,52,pageW-margin,52);const lines=wrapPdfText([st.footer_text,st.legal_text].filter(Boolean).join(' · '),105).slice(0,3);let fy=39;for(const footer of lines){text(footer,margin,fy,6.7,'F1',gray);fy-=9}}
  addPage();
  const objs=[];const kids=[];let obj=1;const catalog=obj++,pagesObj=obj++,fontRegular=obj++,fontBold=obj++,fontItalic=obj++;
  const pageDefs=[];for(const stream of pages){const pageObj=obj++,contentObj=obj++;kids.push(`${pageObj} 0 R`);pageDefs.push({pageObj,contentObj,stream})}
  objs[catalog]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  objs[fontRegular]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[fontBold]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objs[fontItalic]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
  for(const p of pageDefs){objs[p.pageObj]=`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontItalic} 0 R >> >> /Contents ${p.contentObj} 0 R >>`;objs[p.contentObj]=`<< /Length ${p.stream.length} >>\nstream\n${p.stream}\nendstream`}
  let pdf='%PDF-1.4\n%K9PDF\n',offsets=[0];for(let i=1;i<objs.length;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;for(let i=1;i<objs.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objs.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf],{type:'application/pdf'})
}
function servicePdfData(service,extra={}){const docNumber=extra.document_number||(extra.progressive?`${String(extra.progressive).padStart(3,'0')} · V${Number(extra.version||1)}`:`K9-${service.service_date?.replaceAll('-','')||''}-${String(service.id).slice(0,6).toUpperCase()}`);return {...service,...extra,id:service.id,service_id:service.id,customer_name:extra.customer_name||cname(service.customer_id),dog_name:extra.dog_name||dname(service.dog_id),employee_name:extra.employee_name||pname(service.employee_id),document_number:docNumber}}
function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
async function makePassPdf(){
  if(!window.K9PdfEngine?.createPassPdf)throw Error('Motore PDF del pass non disponibile');
  const p=state.profile,code=passCode(p),verifyPayload=`K9PASS|${code}|${p.active?'ATTIVO':'SOSPESO'}`;
  return window.K9PdfEngine.createPassPdf({
    full_name:p.full_name||p.email,
    email:p.email,
    qualification:p.qualification||roleLabels[p.role]||p.role,
    role_label:roleLabels[p.role]||p.role,
    code,
    issued:passIssued(p),
    validity:passValidity(p),
    active:!!p.active,
    photo_url:p.photo_url||identityLogo()
  },state.settings||DEFAULT_SETTINGS,identityLogo(),qrImageUrl(verifyPayload));
}
window.downloadPassPdf=async()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');try{const blob=await makePassPdf(),name=`pass-${passCode(state.profile).toLowerCase()}.pdf`;downloadBlob(blob,name);toast('Pass identificativo scaricato in formato tessera')}catch(e){console.error(e);toast(e.message||'Impossibile creare il PDF del pass')}};
window.sharePassPdf=async()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');try{const blob=await makePassPdf(),file=new File([blob],`pass-${passCode(state.profile).toLowerCase()}.pdf`,{type:'application/pdf'});if(navigator.canShare?.({files:[file]}))await navigator.share({title:'Pass identificativo K9',files:[file]});else{downloadBlob(blob,file.name);toast('Condivisione file non disponibile: pass scaricato')}}catch(e){if(e.name!=='AbortError'){console.error(e);toast(e.message||'Condivisione non disponibile')}}};

async function createAccount(){modal('Nuovo account',`<div class="form-grid">${field('email','Email','','email','required')}${field('password','Password temporanea','','password','minlength="8" required')}${field('full_name','Nome completo','','text','required')}${field('employee_code','Codice dipendente')}<label>Ruolo<select name="role"><option value="dipendente">Dipendente</option>${isOwner()?'<option value="vice_admin">Vice amministratore</option>':''}</select></label></div>`,async f=>{const body={action:'create_user',...Object.fromEntries(f)};const r=await invokeHyperHandler(body);toast(r.message||'Account creato')})}


/* Release 6.7.1 — ripristino affidabile dei comandi nelle schede espandibili */
async function uploadDocument(path,blob){const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/service-documents/${path}`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':'application/pdf','x-upsert':'false'},body:blob});const t=await r.text();if(!r.ok)throw Error(t||'Caricamento PDF non riuscito')}
async function generateArchivedDocument(meta,{download=false}={}){const source=state.services.find(s=>s.id===meta.service_id)||meta,data=servicePdfData(source,meta),kind=meta.document_type==='employee'?'employee':'customer';if(!window.K9PdfEngine?.createServicePdf)throw Error('Motore PDF non disponibile. Aggiorna la pagina.');const blob=await window.K9PdfEngine.createServicePdf(data,kind,state.settings||DEFAULT_SETTINGS,identityLogo());await uploadDocument(meta.storage_path,blob);await rpc('finalize_document_version',{p_document_id:meta.id});if(download)downloadBlob(blob,meta.file_name);return blob}
async function createAndArchiveDocumentPair(id){const docs=await rpc('create_document_pair',{p_service_id:id});for(const d of docs)await generateArchivedDocument(d,{download:false});return docs}
window.approveService=async id=>{if(!confirm('Approvare il servizio e generare automaticamente PDF cliente e PDF interno? Entrambi saranno solo archiviati; nessun invio sarà effettuato.'))return;try{await createAndArchiveDocumentPair(id);await loadAll();renderServices();toast('Servizio approvato: PDF cliente e PDF interno archiviati')}catch(e){toast(e.message)}};
window.generateServiceDocumentPair=async id=>{if(!confirm('Generare e archiviare PDF cliente e PDF interno? Nessun documento verrà inviato automaticamente.'))return;try{await createAndArchiveDocumentPair(id);await loadAll();renderServices();toast('PDF cliente e PDF interno generati e archiviati')}catch(e){toast(e.message)}};
window.createDocumentVersionFromService=async(id,kind)=>{if(!confirm(`Creare una nuova versione del ${kind==='employee'?'PDF dipendente':'PDF cliente'}? Le versioni precedenti resteranno archiviate.`))return;try{const d=await rpc('create_document_version',{p_service_id:id,p_document_type:kind});await generateArchivedDocument(d,{download:true});await loadAll();renderServices();toast(`PDF ${kind==='employee'?'dipendente':'cliente'} V${d.version} creato`)}catch(e){toast(e.message)}};
window.downloadCustomerPdf=id=>createDocumentVersionFromService(id,'customer');window.downloadEmployeePdf=id=>createDocumentVersionFromService(id,'employee');
async function signedDocumentUrl(d){if(d.storage_path){const r=await request(`/storage/v1/object/sign/service-documents/${d.storage_path}`,{method:'POST',body:JSON.stringify({expiresIn:600})});return C.SUPABASE_URL+'/storage/v1'+r.signedURL}const old=await rpc('get_document_path',{p_document_id:d.id}),r=await request(`/storage/v1/object/sign/service-documents/${old.path}`,{method:'POST',body:JSON.stringify({expiresIn:600})});return C.SUPABASE_URL+'/storage/v1'+r.signedURL}
window.openDocument=async id=>{try{const d=state.documents.find(x=>x.id===id);if(!d)throw Error('Documento non trovato');window.open(await signedDocumentUrl(d),'_blank','noopener')}catch(e){toast(e.message)}};
window.downloadStoredDocument=async id=>{try{const d=state.documents.find(x=>x.id===id);if(!d)throw Error('Documento non trovato');const r=await fetch(await signedDocumentUrl(d));if(!r.ok)throw Error('Download non riuscito');downloadBlob(await r.blob(),d.file_name||'documento.pdf')}catch(e){toast(e.message)}};
window.shareStoredDocument=async id=>{try{const d=state.documents.find(x=>x.id===id);if(!d)throw Error('Documento non trovato');const r=await fetch(await signedDocumentUrl(d));if(!r.ok)throw Error('Documento non disponibile');const blob=await r.blob(),file=new File([blob],d.file_name||'documento.pdf',{type:'application/pdf'});if(navigator.canShare?.({files:[file]}))await navigator.share({title:documentTypeLabel(d),files:[file]});else{downloadBlob(blob,file.name);toast('Condivisione file non disponibile: PDF scaricato')}}catch(e){if(e.name!=='AbortError')toast(e.message)}};
window.regenerateDocument=async id=>{const d=state.documents.find(x=>x.id===id);if(!d)return toast('Documento non trovato');if(d.source_kind==='quote')return generateQuoteDocument(d.quote_id);return createDocumentVersionFromService(d.service_id,d.document_type||'customer')};
window.archiveDocument=async id=>{if(!confirm('Archiviare questo documento? Rimarrà nello storico e non verrà eliminato.'))return;try{const d=state.documents.find(x=>x.id===id);await rpc(d?.source_kind==='quote'?'archive_quote_document_version':'archive_document_version',{p_document_id:id});await loadAll();renderDocs();toast('Documento archiviato')}catch(e){toast(e.message)}};
window.markDocumentSent=async id=>{const d=state.documents.find(x=>x.id===id),ch=prompt('Canale di invio: WhatsApp, email o altro','WhatsApp');if(!ch)return;try{if(d?.source_kind==='quote')await rpc('mark_quote_document_version_sent',{p_document_id:id,p_channel:ch});else if(d?.document_type)await rpc('mark_document_version_sent',{p_document_id:id,p_channel:ch});else await rpc('mark_document_sent',{p_document_id:id,p_channel:ch});await loadAll();renderDocs();toast('Invio registrato')}catch(e){toast(e.message)}};
window.markSent=async sid=>{const d=state.documents.find(x=>x.service_id===sid&&(x.document_type||'customer')==='customer'&&x.is_active!==false);if(d)return markDocumentSent(d.id);toast('Documento cliente non trovato')};

function customerOnlyQuoteData(meta={}){
  const allowed=[
    'id','quote_id','customer_id','dog_id','customer_name','dog_name','customer_phone','customer_email','customer_address',
    'quote_date','valid_until','progressive','version','items','subtotal','discount_rate','discount_amount','total_amount',
    'payment_terms','payment_status','deposit_amount','deposit_received_at','deposit_payment_method','deposit_reference','balance_due','notes','periods','file_name','storage_path','status','organization_name'
  ];
  return Object.fromEntries(allowed.filter(key=>Object.prototype.hasOwnProperty.call(meta,key)).map(key=>[key,meta[key]]));
}

async function fetchPdfAttachment(path){const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/pdf-attachments/${path}`,{headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`}});if(!r.ok)throw Error('Impossibile leggere un allegato PDF.');return new Uint8Array(await r.arrayBuffer())}
async function mergeQuoteAttachments(baseBlob){const attachments=pdfAttachments().filter(a=>a.enabled!==false);if(state.settings.attach_pdfs_to_quotes===false||!attachments.length)return baseBlob;if(!window.PDFLib?.PDFDocument)throw Error('Motore unione PDF non disponibile. Ricarica l’app.');const out=await PDFLib.PDFDocument.load(await baseBlob.arrayBuffer());for(const a of attachments){const src=await PDFLib.PDFDocument.load(await fetchPdfAttachment(a.path));const pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p))}return new Blob([await out.save()],{type:'application/pdf'})}

async function generateArchivedQuoteDocument(meta,{download=true}={}){if(!window.K9PdfEngine?.createQuotePdf)throw Error('Motore PDF preventivo non disponibile. Aggiorna la pagina.');const quote=state.quotes.find(q=>q.id===(meta.quote_id||meta.id))||{};const quoteData=customerOnlyQuoteData({...quote,...meta,items:meta.items||quote.quote_items||[],periods:normalizePeriods(quote,'quote')});let blob=await window.K9PdfEngine.createQuotePdf(quoteData,state.settings||DEFAULT_SETTINGS,identityLogo());blob=await mergeQuoteAttachments(blob);await uploadDocument(meta.storage_path,blob);await rpc('finalize_quote_document_version',{p_document_id:meta.id});if(download)downloadBlob(blob,meta.file_name);return blob}
window.generateQuoteDocument=async quoteId=>{try{const meta=await rpc('create_quote_document_version',{p_quote_id:quoteId});await generateArchivedQuoteDocument(meta,{download:true});await loadAll();renderQuotes();toast(`Preventivo PDF V${meta.version} creato e archiviato`)}catch(e){toast(e.message)}};


window.deactivateUser=async(id,name='utente')=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const profile=state.profiles.find(p=>p.id===id);
  if(!profile)return toast('Account non trovato');
  if(profile.is_owner)return toast('Il titolare non può essere disattivato');
  if(!confirm(`Disattivare l’account di ${name}?`))return;
  try{
    await rpc('admin_update_profile',{
      p_user_id:id,
      p_full_name:profile.full_name||null,
      p_employee_code:profile.employee_code||null,
      p_qualification:profile.qualification||null,
      p_pass_expires_at:profile.pass_expires_at||null,
      p_role:profile.role,
      p_active:false
    });
    await loadAll();renderEmployees();toast('Account disattivato');
  }catch(error){toast(error?.message||'Disattivazione non riuscita')}
};
window.setCustomerPaid=async id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  try{await update('dogsitter_services',id,{customer_payment_status:'incassato'});await loadAll();renderPayments();toast('Incasso cliente registrato')}catch(error){toast(error?.message||'Aggiornamento non riuscito')}
};
window.setEmployeePaid=async id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  try{await update('dogsitter_services',id,{employee_payment_status:'liquidato'});await loadAll();renderPayments();toast('Liquidazione dipendente registrata')}catch(error){toast(error?.message||'Aggiornamento non riuscito')}
};

function stabilizeAccordionCommands(root=document){
  root.querySelectorAll('.record-accordion button, .entity-accordion button, .account-row button, .account-group button').forEach(button=>{
    button.type='button';
    button.style.pointerEvents='auto';
  });
}

document.addEventListener('click',event=>{
  const button=event.target.closest('.record-accordion button[onclick], .entity-accordion button[onclick], .account-row button[onclick], .account-group button[onclick]');
  if(!button)return;
  const command=button.getAttribute('onclick');
  if(!command)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try{
    const result=Function(`"use strict"; return (async()=>{${command}})();`).call(button);
    Promise.resolve(result).catch(error=>{
      console.error('Errore comando scheda espandibile:',error);
      toast(error?.message||'Comando non eseguito.');
    });
  }catch(error){
    console.error('Errore comando scheda espandibile:',error);
    toast(error?.message||'Comando non eseguito.');
  }
},true);

const accordionCommandObserver=new MutationObserver(records=>{
  for(const record of records){
    for(const node of record.addedNodes){
      if(node.nodeType===1)stabilizeAccordionCommands(node);
    }
  }
});
accordionCommandObserver.observe(document.documentElement,{childList:true,subtree:true});
addEventListener('DOMContentLoaded',()=>stabilizeAccordionCommands());
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#authError').textContent='';try{if(!configured())throw Error('Configura config.js.');await login($('#loginEmail').value.trim(),$('#loginPassword').value)}catch(err){$('#authError').textContent=err.message}});
$('#logoutBtn').onclick=logout;$('#nav').onclick=e=>{const b=e.target.closest('[data-screen]');if(b)show(b.dataset.screen)};
$('[data-action="new-customer"]').onclick=()=>isAdmin()?openCustomer():toast('Funzione non disponibile per il dipendente');$('[data-action="new-dog"]').onclick=()=>isAdmin()?openDog():toast('Funzione non disponibile per il dipendente');$('[data-action="new-service"]').onclick=()=>isAdmin()?openService():toast('Funzione non disponibile per il dipendente');$('[data-action="new-employee"]').onclick=()=>isAdmin()?createAccount():toast('Funzione non disponibile per il dipendente');
$('#serviceDateFilter').onchange=renderServices;$('#serviceStatusFilter').onchange=renderServices;$('#clearFilters').onclick=()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');$('#serviceDateFilter').value='';$('#serviceStatusFilter').value='';renderServices()};
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
restore();

verifyRuntimeDependencies();
