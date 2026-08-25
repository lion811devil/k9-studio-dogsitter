'use strict';

// Release 12.8.8: Responsive mobile fix globale + Statistiche analitiche + Economia amministrativa completa.
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

const RECOVERY_REDIRECT_URL=()=>{
  const url=new URL(location.href);
  url.hash='';
  url.search='';
  url.searchParams.set('password_recovery','1');
  return url.toString();
};
let recoveryClient=null;
function getRecoveryClient(){
  if(recoveryClient)return recoveryClient;
  if(!window.supabase?.createClient)throw Error('Modulo Supabase Auth non disponibile. Ricarica la pagina con connessione internet.');
  recoveryClient=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{
    auth:{
      flowType:'implicit',
      detectSessionInUrl:true,
      persistSession:true,
      autoRefreshToken:false,
      storageKey:'k9_password_recovery'
    }
  });
  return recoveryClient;
}
function hasRecoveryMarker(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  const query=new URLSearchParams(location.search);
  return query.get('password_recovery')==='1'||query.has('code')||query.has('token_hash')||hash.get('type')==='recovery'||hash.has('access_token')||query.get('type')==='recovery';
}
function clearAuthCallbackUrl(){
  const clean=new URL(location.href);
  clean.hash='';
  clean.search='';
  history.replaceState({},document.title,clean.toString());
}
function showPasswordRecovery(session){
  if(!session?.access_token)return;
  state.session=session;
  $('#loginForm')?.classList.add('hidden');
  $('#passwordRecoveryForm')?.classList.remove('hidden');
  $('#recoveryError').textContent='';
  $('#recoveryPassword')?.focus();
}
async function updateRecoveredPassword(password){
  const client=getRecoveryClient();
  const {error}=await client.auth.updateUser({password});
  if(error)throw Error(error.message||'Aggiornamento password non riuscito.');
  await client.auth.signOut({scope:'local'}).catch(()=>{});
  state.session=null;
  localStorage.removeItem('k9_session');
  clearAuthCallbackUrl();
  $('#passwordRecoveryForm')?.classList.add('hidden');
  $('#loginForm')?.classList.remove('hidden');
  $('#loginPassword').value='';
  $('#authError').textContent='Password aggiornata correttamente. Ora accedi con la nuova password.';
}
async function sendPasswordRecoveryEmail(){
  const email=$('#loginEmail')?.value.trim();
  if(!email)throw Error('Inserisci prima l’indirizzo email.');
  const client=getRecoveryClient();
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:RECOVERY_REDIRECT_URL()});
  if(error){
    const msg=String(error.message||'Invio email non riuscito.');
    if(/rate limit/i.test(msg))throw Error('Hai richiesto troppe email in poco tempo. Attendi alcuni minuti e riprova una sola volta.');
    throw Error(msg);
  }
  $('#authError').textContent='Email di recupero inviata. Apri il link ricevuto su questo dispositivo.';
}
async function initializePasswordRecovery(){
  const marker=hasRecoveryMarker();
  const client=getRecoveryClient();
  let resolvedSession=null;
  const subscription=client.auth.onAuthStateChange((event,session)=>{
    if((event==='PASSWORD_RECOVERY'||(marker&&event==='SIGNED_IN'))&&session){
      resolvedSession=session;
      showPasswordRecovery(session);
    }
  });
  try{
    const query=new URLSearchParams(location.search);
    const code=query.get('code');
    if(code){
      const {data,error}=await client.auth.exchangeCodeForSession(code);
      if(error)throw error;
      if(data?.session){resolvedSession=data.session;showPasswordRecovery(data.session);return true;}
    }
    const {data,error}=await client.auth.getSession();
    if(error&&marker)throw error;
    if(marker&&data?.session){resolvedSession=data.session;showPasswordRecovery(data.session);return true;}
    if(marker&&!resolvedSession){
      await new Promise(resolve=>setTimeout(resolve,900));
      const current=await client.auth.getSession();
      if(current.data?.session){showPasswordRecovery(current.data.session);return true;}
      throw Error('Link di recupero non valido, scaduto o già utilizzato. Richiedi una nuova email.');
    }
    return false;
  }catch(error){
    if(marker){
      $('#authError').textContent=error?.message||'Link di recupero non valido o scaduto.';
      await client.auth.signOut({scope:'local'}).catch(()=>{});
      clearAuthCallbackUrl();
    }
    return false;
  }finally{
    if(!marker)subscription?.data?.subscription?.unsubscribe?.();
  }
}

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
async function bootstrap(){const p=await select('profiles',`select=*&id=eq.${state.session.user.id}&limit=1`);state.profile=p[0];if(!state.profile||!state.profile.active)throw Error('Account non attivo.');await loadSettings();applyIdentity();$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');$('#roleLabel').textContent=`${state.profile.full_name||state.profile.email} · ${roleLabels[state.profile.role]||state.profile.role}`;buildNav();let recoveredNotifications=0;try{await rpc('refresh_operational_reminders')}catch(e){console.warn('Promemoria operativi:',e.message)}try{recoveredNotifications=Number(await rpc('sync_missed_app_notifications'))||0}catch(e){console.warn('Sincronizzazione notifiche all’avvio:',e.message)}await loadAll();buildNav();startNotificationPolling();show('dashboard');const unread=unreadNotificationCount();if(recoveredNotifications>0)toast(`${recoveredNotifications} ${recoveredNotifications===1?'nuova attività':'nuove attività'} dall’ultimo accesso`);else if(unread>0)toast(`${unread} ${unread===1?'notifica non letta':'notifiche non lette'}`)}
function communicationReadByCurrentUser(message){return state.communicationReads.some(r=>r.message_id===message.id&&r.user_id===state.profile?.id)}
function communicationReadByRecipient(message){return state.communicationReads.some(r=>r.message_id===message.id&&r.user_id!==message.author_id)}
function unreadCommunicationCount(serviceId=null){return state.communications.filter(m=>(!serviceId||m.service_id===serviceId)&&m.status==='sent'&&m.author_id!==state.profile?.id&&!communicationReadByCurrentUser(m)).length}
function unreadNotificationCount(){return state.notifications.filter(n=>!n.read_at).length}
let notificationPollTimer=null,knownNotificationIds=new Set();
function friendlyNotificationText(n){
  const title=String(n.title||'Notifica').trim();
  const raw=String(n.message||'').trim();
  const replacements={
    'Periodo avviato':'Il periodo del servizio è stato avviato.',
    'Periodo terminato':'Il periodo del servizio è terminato ed è pronto per la verifica.',
    'Pagamento preventivo aggiornato':'Acconto e residuo del cliente sono stati aggiornati.',
    'PDF cliente pronto':'Il PDF Cliente è pronto per la revisione.',
    'PDF interno pronto':'Il PDF Interno è pronto per la revisione.',
    'Servizio chiuso':'Il servizio è stato chiuso e archiviato.'
  };
  if(replacements[title])return replacements[title];
  return raw.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'').replace(/\s{2,}/g,' ').trim()||'Apri il dettaglio per maggiori informazioni.';
}
function renderNotifications(){
  const host=$('#notificationList');if(!host)return;
  const testButton=$('#testNotificationButton');if(testButton)testButton.classList.toggle('hidden',!isOwner());
  const visibleNotifications=isOwner()?state.notifications:state.notifications.filter(n=>String(n.title||'').trim()!=='Notifica di prova');
  host.innerHTML=visibleNotifications.map(n=>`<details class="record-accordion notification-card ${n.read_at?'':'unread'}"><summary><div class="record-summary-main"><span class="record-title">${esc(n.title||'Nuova notifica')}</span><small>${new Date(n.created_at).toLocaleString('it-IT')}</small></div>${n.read_at?'':`<span class="service-message-badge">Nuova</span>`}<span class="accordion-chevron"></span></summary><article class="record-expanded"><p class="notification-message">${esc(friendlyNotificationText(n))}</p><div class="card-actions">${n.service_id?`<button class="primary" onclick="openNotification('${n.id}','${n.service_id}')">Apri servizio</button>`:!n.read_at?`<button class="primary" onclick="markNotificationRead('${n.id}')">Segna come letta</button>`:''}${isAdmin()?`<button class="danger" onclick="deleteAppNotification('${n.id}')">Elimina</button>`:''}</div></article></details>`).join('')||'<div class="card">Nessuna notifica.</div>'
}
window.markNotificationRead=async id=>{try{await rpc('mark_app_notification_read',{p_notification_id:id});const n=state.notifications.find(x=>x.id===id);if(n)n.read_at=new Date().toISOString();buildNav();renderNotifications()}catch(e){toast(e.message)}};
window.deleteAppNotification=async id=>{if(!confirm('Eliminare definitivamente questa notifica?'))return;try{await rpc('delete_app_notification',{p_notification_id:id});state.notifications=state.notifications.filter(n=>n.id!==id);knownNotificationIds.delete(id);buildNav();renderNotifications();toast('Notifica eliminata')}catch(e){toast(e.message||'Eliminazione notifica non riuscita')}};
window.openNotification=async(id,serviceId)=>{await markNotificationRead(id);show('services');setTimeout(()=>openServiceCommunications(serviceId),50)};
async function refreshNotifications({system=true}={}){if(!state.session)return;try{const rows=await select('app_notifications','select=*&order=created_at.desc');const fresh=rows.filter(n=>!knownNotificationIds.has(n.id)&&!n.read_at);state.notifications=rows;rows.forEach(n=>knownNotificationIds.add(n.id));buildNav();if(!$('#notifications')?.classList.contains('hidden'))renderNotifications();if(fresh.length&&document.visibilityState==='visible')toast(fresh.length===1?fresh[0].title:`${fresh.length} nuove notifiche`);if(system&&fresh.length&&document.visibilityState!=='visible'&&'Notification'in window&&Notification.permission==='granted'){for(const n of fresh.slice(0,3))new Notification(n.title||'K9 Studio Dogsitter',{body:n.message||'Nuova comunicazione',icon:'assets/icon-192.png',tag:n.id})}}catch(e){console.warn('Notifiche:',e)}}
let notificationResumeSyncRunning=false;
async function syncNotificationsOnResume(){if(notificationResumeSyncRunning||!state.session)return;notificationResumeSyncRunning=true;try{await rpc('sync_missed_app_notifications');await refreshNotifications({system:false})}catch(e){console.warn('Sincronizzazione notifiche al rientro:',e.message)}finally{notificationResumeSyncRunning=false}}
function startNotificationPolling(){if(notificationPollTimer)clearInterval(notificationPollTimer);knownNotificationIds=new Set(state.notifications.map(n=>n.id));notificationPollTimer=setInterval(()=>refreshNotifications(),15000);if(!window.__k9NotificationVisibilityBound){document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNotificationsOnResume()});window.addEventListener('focus',()=>syncNotificationsOnResume());window.addEventListener('pageshow',()=>syncNotificationsOnResume());window.__k9NotificationVisibilityBound=true}}
window.enableSystemNotifications=async()=>{if(!('Notification'in window))return toast('Notifiche di sistema non supportate.');const p=await Notification.requestPermission();toast(p==='granted'?'Avvisi dispositivo attivati mentre l’app è in esecuzione':'Permesso notifiche non concesso')};
window.testAppNotification=async()=>{try{await rpc('create_test_app_notification');await refreshNotifications({system:false});renderNotifications();toast('Notifica di prova creata')}catch(e){toast(e?.message||'Impossibile creare la notifica di prova')}};
function buildNav(){const a=[['dashboard','Dashboard'],['calendar','Calendario'],['statistics','Statistiche'],['customers','Clienti'],['dogs','Animali'],['employees','Utenti'],['services','I miei servizi'],['quotes','Preventivi'],['payments','Economia'],['documents','Documenti'],['notifications','Notifiche'],['audit','Log'],['trash','Cestino'],['profile','Pass'],['settings','Impostazioni']];const e=[['dashboard','Oggi'],['customers','Clienti assegnati'],['dogs','Animali assegnati'],['services','I miei servizi'],['compensation','Compensi'],['notifications','Notifiche'],['profile','Il mio pass']];const unread=unreadCommunicationCount(),unreadN=unreadNotificationCount();$('#nav').innerHTML=(isAdmin()?a:e).map(([id,l])=>`<button data-screen="${id}">${l}${id==='services'&&unread?`<span class="nav-notification">${unread}</span>`:''}${id==='notifications'&&unreadN?`<span class="nav-notification">${unreadN}</span>`:''}</button>`).join('')}
async function loadDocuments(){
  let serviceDocs=[];let quoteDocs=[];let receiptDocs=[];
  try{serviceDocs=await select('dogsitter_document_versions','select=*&order=created_at.desc')}catch(e){console.warn('Archivio servizi versionato non ancora installato:',e.message);try{serviceDocs=await select('dogsitter_documents','select=*&order=created_at.desc')}catch{serviceDocs=[]}}
  try{quoteDocs=(await select('dogsitter_quote_document_versions','select=*&order=created_at.desc')).map(d=>({...d,source_kind:'quote',document_type:'quote'}))}catch(e){console.warn('Archivio preventivi non ancora installato:',e.message)}
  try{receiptDocs=(await select('dogsitter_receipts','select=*&order=created_at.desc')).map(d=>({...d,source_kind:'receipt',document_type:'receipt',version:1,is_active:true}))}catch(e){console.warn('Archivio ricevute non ancora installato:',e.message)}
  return [...receiptDocs,...quoteDocs,...serviceDocs];
}
async function loadQuotes(){try{return await select('dogsitter_quotes','select=*,quote_items:dogsitter_quote_items(*)&deleted_at=is.null&order=created_at.desc')}catch(e){console.warn('Modulo preventivi non ancora installato:',e.message);return []}}
async function loadCommunicationReads(){try{return await select('service_communication_reads','select=*&order=read_at.asc')}catch(error){console.warn('Ricevute comunicazioni non disponibili:',error?.message||error);return []}}
async function loadAll(){if(isAdmin()){[state.customers,state.dogs,state.profiles,state.services,state.quotes,state.documents,state.communications,state.communicationReads,state.notifications,state.periodRuns,state.pdfDrafts]=await Promise.all([select('customers','select=*&deleted_at=is.null&order=last_name.asc,first_name.asc'),select('dogs','select=*&deleted_at=is.null&order=name.asc'),select('profiles','select=*&order=full_name.asc'),select('dogsitter_services','select=*&deleted_at=is.null&order=service_date.desc,service_time.asc'),loadQuotes(),loadDocuments(),select('service_communications','select=*&order=created_at.asc'),loadCommunicationReads(),select('app_notifications','select=*&order=created_at.desc'),select('service_period_workflows','select=*&order=service_id.asc,period_index.asc'),select('service_pdf_drafts','select=*&order=updated_at.desc')]);state.compensationServices=state.services;state.compensationPeriodRuns=state.periodRuns}else{const d=await rpc('employee_workspace');state.customers=d.customers||[];state.dogs=d.dogs||[];state.services=d.services||[];state.periodRuns=d.period_runs||[];state.compensationServices=d.compensation_services||[];state.compensationPeriodRuns=d.compensation_period_runs||[];state.quotes=[];state.documents=[];state.profiles=[];state.pdfDrafts=[];[state.communications,state.communicationReads,state.notifications]=await Promise.all([select('service_communications','select=*&order=created_at.asc'),loadCommunicationReads(),select('app_notifications','select=*&order=created_at.desc')])}}
function resetServiceFilters(){const dateFilter=$('#serviceDateFilter'),statusFilter=$('#serviceStatusFilter');if(dateFilter)dateFilter.value='';if(statusFilter)statusFilter.value=''}
function show(id){const current=$$('.screen:not(.hidden)')[0]?.id||'';if(id==='services'&&current!=='services')resetServiceFilters();$$('.screen').forEach(e=>e.classList.add('hidden'));$('#'+id).classList.remove('hidden');$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));const activeNav=$(`#nav button[data-screen="${id}"]`);activeNav?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});render(id)}
function render(id){if(isEmployee()&&!['dashboard','customers','dogs','services','compensation','notifications','profile'].includes(id))id='dashboard';({dashboard:renderDashboard,calendar:renderCalendar,statistics:renderStatistics,customers:renderCustomers,dogs:renderDogs,employees:renderEmployees,services:renderServices,quotes:renderQuotes,compensation:renderComp,payments:renderPayments,documents:renderDocs,notifications:renderNotifications,audit:renderAudit,trash:renderTrash,profile:renderPass,settings:renderSettings}[id]||(()=>{}))()}
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
function renderDashboard(){
  if(isAdmin()){renderOperationalDashboard();return}
  const today=localDate(),todays=state.services.filter(s=>employeeServiceIsVisible(s)&&serviceOccursOn(s,today));
  $('#dashboard').innerHTML=`<div class="page-title"><div><span class="eyebrow">AREA DIPENDENTE</span><h2>Il mio lavoro di oggi</h2></div></div><div class="stats dashboard-stats"><div class="stat stat-today"><span>Servizi</span><strong>${todays.length}</strong><small>Assegnati oggi</small></div><div class="stat stat-dogs"><span>Uscite</span><strong>${todays.reduce((a,s)=>a+visitsOnDate(s,today),0)}</strong><small>Totale previsto</small></div><div class="stat stat-pay"><span>Compenso maturato</span><strong>${money(todays.filter(matured).reduce((a,s)=>a+Number(s.employee_compensation),0))}</strong><small>Solo servizi maturati</small></div></div><div class="grid service-grid">${todays.map(serviceCard).join('')||'<div class="card empty-state"><strong>Nessun servizio oggi</strong><span>Non risultano attività assegnate.</span></div>'}</div>`
}

function documentRelation(d){
  const service=d?.service_id?(state.services||[]).find(s=>s.id===d.service_id):null;
  const quote=d?.quote_id?(state.quotes||[]).find(q=>q.id===d.quote_id):null;
  return {
    customer_id:d?.customer_id||service?.customer_id||quote?.customer_id||null,
    dog_id:d?.dog_id||service?.dog_id||quote?.dog_id||null,
    service_id:d?.service_id||quote?.converted_service_id||null,
    quote_id:d?.quote_id||service?.quote_id||null
  };
}
function linkedDocuments({customerId=null,dogId=null,serviceId=null}={}){
  const service=serviceId?(state.services||[]).find(s=>s.id===serviceId):null;
  const quote=service?linkedQuoteForService(service):null;
  return (state.documents||[]).filter(d=>{
    const rel=documentRelation(d);
    if(customerId&&rel.customer_id!==customerId)return false;
    if(dogId&&rel.dog_id!==dogId)return false;
    if(serviceId){
      const direct=rel.service_id===serviceId;
      const quoteDoc=d.source_kind==='quote'&&quote&&rel.quote_id===quote.id;
      if(!direct&&!quoteDoc)return false;
    }
    return true;
  }).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
function linkedDocumentsBlock(filter,title='Documenti collegati'){
  if(!isAdmin())return '';
  const rows=linkedDocuments(filter);
  if(!rows.length)return `<div class="linked-documents"><b>${esc(title)}</b><span class="muted">Nessun PDF archiviato.</span></div>`;
  return `<div class="linked-documents"><b>${esc(title)}</b><div class="linked-document-list">${rows.map(d=>`<div class="linked-document-row"><div><strong>${esc(documentTypeLabel(d))}</strong><small>${esc(d.file_name||'Documento')} · V${Number(d.version||1)} · ${esc(documentStatusLabel(d.status))}</small></div><div class="linked-document-actions">${documentIsReady(d)?`<button type="button" onclick="openDocument('${d.id}')">Apri</button><button type="button" onclick="downloadStoredDocument('${d.id}')">Scarica</button><button type="button" onclick="shareStoredDocument('${d.id}')">Condividi</button>`:`<button type="button" class="primary-soft" onclick="regenerateDocument('${d.id}')">Rigenera documento</button>`}</div></div>`).join('')}</div></div>`;
}
function customerCrmStatusLabel(value){return ({programmato:'Programmato','in_corso':'In corso','da_verificare':'Da verificare',chiuso:'Chiuso',annullato:'Annullato'}[value]||String(value||'—').replaceAll('_',' '))}
function customerCrmSections(customer,dogs,services){
  if(!isAdmin())return '';
  const quotes=(state.quotes||[]).filter(q=>q.customer_id===customer.id).sort((a,b)=>String(b.quote_date||'').localeCompare(String(a.quote_date||'')));
  const documents=linkedDocuments({customerId:customer.id});
  const communications=(state.communications||[]).filter(m=>services.some(s=>s.id===m.service_id)&&m.status==='sent').sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  const serviceRows=[...services].sort((a,b)=>String(serviceFirstDate(b)||'').localeCompare(String(serviceFirstDate(a)||'')));
  const serviceCounts={programmato:0,in_corso:0,da_verificare:0,chiuso:0,annullato:0};serviceRows.forEach(x=>serviceCounts[x.status]=(serviceCounts[x.status]||0)+1);
  const quoteCounts={bozza:0,inviato:0,accettato:0,rifiutato:0,scaduto:0,convertito:0};quotes.forEach(q=>{quoteCounts[q.converted_service_id?'convertito':q.status]=(quoteCounts[q.converted_service_id?'convertito':q.status]||0)+1});
  const economicallyRelevantQuotes=quotes.filter(q=>q.converted_service_id||['accettato','inviato'].includes(q.status));
  const totalQuotes=economicallyRelevantQuotes.reduce((sum,q)=>sum+quoteTotal(q),0);
  const totalServices=serviceRows.reduce((sum,x)=>sum+Number(x.customer_amount||0),0);
  const acconti=quotes.reduce((sum,q)=>sum+Number(q.deposit_amount||0),0);
  const incassato=serviceRows.filter(x=>x.customer_payment_status==='incassato').reduce((sum,x)=>sum+Number(x.customer_amount||0),0);
  const saldoServizi=serviceRows.reduce((sum,x)=>sum+Math.max(0,Number(x.balance_due??(x.customer_payment_status==='incassato'?0:x.customer_amount||0))),0);
  const residuo=Math.max(0,saldoServizi);
  const unread=serviceRows.reduce((sum,x)=>sum+unreadCommunicationCount(x.id),0);
  const lastService=serviceRows[0];
  const lastPayment=quotes.filter(q=>Number(q.deposit_amount||0)>0&&q.deposit_received_at).sort((a,b)=>String(b.deposit_received_at).localeCompare(String(a.deposit_received_at)))[0];
  const created=customer.created_at?new Date(customer.created_at).toLocaleDateString('it-IT'):'—';
  const dogRows=dogs.map(d=>`<div class="crm-row"><div><strong>${esc(d.name)}</strong><small>${esc(firstValue(d,'breed_detail','breed','breed_type')||'Razza non indicata')} · ${esc(firstValue(d,'age_detail','age_range')||'Età non indicata')}</small></div><button type="button" onclick="openDog('${d.id}')">Apri animale</button></div>`).join('')||'<div class="empty-compact">Nessun animale associato.</div>';
  const serviceHtml=serviceRows.map(x=>`<div class="crm-row"><div><strong>${esc(dname(x.dog_id))} · ${esc(x.service_type||'Servizio')}</strong><small>${esc(servicePeriod(x))} · ${esc(customerCrmStatusLabel(x.status))}</small></div><div class="crm-row-actions"><button type="button" onclick="viewService('${x.id}')">Dettaglio</button><button type="button" onclick="openServiceCommunications('${x.id}')">Comunicazioni${unreadCommunicationCount(x.id)?` (${unreadCommunicationCount(x.id)})`:''}</button></div></div>`).join('')||'<div class="empty-compact">Nessun servizio collegato.</div>';
  const quoteHtml=quotes.map(q=>`<div class="crm-row"><div><strong>Preventivo ${dateIT(q.quote_date)}</strong><small>${esc(dname(q.dog_id))} · ${esc(quoteStatusLabels[q.status]||q.status||'Bozza')} · ${money(quoteTotal(q))}</small></div><button type="button" onclick="openQuote('${q.id}')">Apri preventivo</button></div>`).join('')||'<div class="empty-compact">Nessun preventivo collegato.</div>';
  const documentHtml=documents.map(d=>{const rel=documentRelation(d);const service=rel.service_id?(state.services||[]).find(s=>s.id===rel.service_id):null;const relation=[rel.dog_id?dname(rel.dog_id):'',service?.service_type||'',service?servicePeriod(service):''].filter(Boolean).join(' · ');return `<div class="crm-row"><div><strong>${esc(documentTypeLabel(d))}</strong><small>${esc(d.file_name||'Documento')} · V${Number(d.version||1)} · ${esc(documentStatusLabel(d.status))}${relation?' · '+esc(relation):''}</small></div><div class="crm-row-actions">${documentIsReady(d)?`<button type="button" onclick="openDocument('${d.id}')">Apri</button><button type="button" onclick="downloadStoredDocument('${d.id}')">Scarica</button><button type="button" onclick="shareStoredDocument('${d.id}')">Condividi</button>`:`<button type="button" class="primary-soft" onclick="regenerateDocument('${d.id}')">Rigenera</button>`}</div></div>`}).join('')||'<div class="empty-compact">Nessun documento correlato al cliente.</div>';
  const communicationHtml=communications.slice(0,12).map(c=>{const sv=serviceRows.find(x=>x.id===c.service_id);return `<div class="crm-row"><div><strong>${esc(communicationLabel(c))}</strong><small>${esc(dname(sv?.dog_id))} · ${communicationTime(c.created_at)} · ${esc(String(c.message||'').slice(0,90))}${String(c.message||'').length>90?'…':''}</small></div><button type="button" onclick="openServiceCommunications('${c.service_id}')">Apri</button></div>`}).join('')||'<div class="empty-compact">Nessuna comunicazione collegata.</div>';
  const docCounts={customer:documents.filter(d=>(d.document_type||'customer')==='customer').length,employee:documents.filter(d=>d.document_type==='employee').length,internal:documents.filter(d=>d.document_type==='internal').length,quote:documents.filter(d=>d.document_type==='quote').length,receipt:documents.filter(d=>d.document_type==='receipt').length};
  return `<section class="customer-crm" aria-label="CRM cliente">
    <div class="crm-customer-overview"><div><span>Cliente dal</span><strong>${created}</strong></div><div><span>Ultimo servizio</span><strong>${lastService?dateIT(serviceFirstDate(lastService)):'—'}</strong></div><div><span>Ultimo acconto</span><strong>${lastPayment?dateIT(lastPayment.deposit_received_at):'—'}</strong></div><div><span>Stato</span><strong>${serviceRows.length?'Cliente attivo':'Nessun servizio'}</strong></div></div>
    <details class="crm-section" open><summary><span>Dati cliente</span><strong>Profilo</strong></summary><div class="crm-section-body"><div class="operational-note"><b>Note operative</b><span>${esc(firstValue(customer,'operational_notes')||'Nessuna nota operativa')}</span></div></div></details>
    <details class="crm-section"><summary><span>Animali associati</span><strong>${dogs.length}</strong></summary><div class="crm-section-body">${dogRows}</div></details>
    <details class="crm-section"><summary><span>Servizi</span><strong>${serviceRows.length}</strong></summary><div class="crm-section-body"><div class="crm-mini-stats"><span>Programm. <b>${serviceCounts.programmato}</b></span><span>In corso <b>${serviceCounts.in_corso}</b></span><span>Da verificare <b>${serviceCounts.da_verificare}</b></span><span>Conclusi <b>${serviceCounts.chiuso}</b></span></div>${serviceHtml}</div></details>
    <details class="crm-section"><summary><span>Preventivi</span><strong>${quotes.length}</strong></summary><div class="crm-section-body"><div class="crm-mini-stats"><span>Bozza <b>${quoteCounts.bozza}</b></span><span>Inviati <b>${quoteCounts.inviato}</b></span><span>Accettati <b>${quoteCounts.accettato}</b></span><span>Convertiti <b>${quoteCounts.convertito}</b></span><span>Scaduti <b>${quoteCounts.scaduto}</b></span></div>${quoteHtml}</div></details>
    <details class="crm-section"><summary><span>Fascicolo documentale</span><strong>${documents.length}</strong></summary><div class="crm-section-body"><p class="muted">Raccoglie automaticamente tutti i documenti assegnati o correlati a questo cliente, anche tramite preventivi e servizi.</p><div class="crm-mini-stats"><span>Cliente <b>${docCounts.customer}</b></span><span>Dipendente <b>${docCounts.employee}</b></span><span>Interni <b>${docCounts.internal}</b></span><span>Preventivi <b>${docCounts.quote}</b></span><span>Ricevute <b>${docCounts.receipt}</b></span></div>${documentHtml}</div></details>
    <details class="crm-section"><summary><span>Comunicazioni</span><strong class="${unread?'crm-alert-badge':''}">${unread?unread+' non lette':communications.length}</strong></summary><div class="crm-section-body"><div class="crm-mini-stats"><span>Totali <b>${communications.length}</b></span><span>Non lette <b>${unread}</b></span><span>Ultima <b>${communications[0]?new Date(communications[0].created_at).toLocaleDateString('it-IT'):'—'}</b></span></div>${communicationHtml}</div></details>
    <details class="crm-section"><summary><span>Situazione economica</span><strong>${money(residuo)}</strong></summary><div class="crm-section-body"><div class="crm-economy"><div><span>Totale preventivi</span><strong>${money(totalQuotes)}</strong></div><div><span>Totale servizi</span><strong>${money(totalServices)}</strong></div><div class="economy-good"><span>Incassato</span><strong>${money(incassato)}</strong></div><div class="economy-warning"><span>Acconti ricevuti</span><strong>${money(acconti)}</strong></div><div class="economy-danger"><span>Residuo da incassare</span><strong>${money(residuo)}</strong></div></div></div></details>
  </section>`;
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
    const baseDetails=`<div class="entity-details"><p><span>Telefono</span><strong>${esc(displayValue(firstValue(c,'phone')))}</strong></p><p><span>Email</span><strong>${esc(displayValue(firstValue(c,'email')))}</strong></p><p class="wide"><span>Indirizzo</span><strong>${esc(address)}</strong></p><p><span>Animali associati</span><strong>${dogs.length}${dogs.length?` · ${esc(dogs.map(d=>d.name).join(', '))}`:''}</strong></p>${isAdmin()?`<p><span>Dipendente assegnato</span><strong>${esc(pname(c.assigned_employee_id))}</strong></p>`:''}<p class="wide"><span>Contatto emergenza</span><strong>${esc(emergency)}</strong></p><p><span>Reperibilità</span><strong>${esc(displayValue(firstValue(c,'availability'),'Non indicata'))}</strong></p>${next?`<p class="wide"><span>Prossimo servizio</span><strong>${servicePeriod(next)} · ${esc(serviceSlots(next))} · ${esc(next.service_type||'Servizio')}</strong></p>`:''}</div>`;
    return `<details class="entity-accordion customer-accordion"><summary><span class="accordion-name">${esc(c.first_name)} ${esc(c.last_name)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="entity-expanded"><div class="entity-card-head"><div class="entity-avatar">${esc((c.first_name||'?').slice(0,1)+(c.last_name||'').slice(0,1))}</div><div><span class="entity-kicker">CLIENTE</span><h3>${esc(c.first_name)} ${esc(c.last_name)}</h3></div></div>${baseDetails}${isAdmin()?customerCrmSections(c,dogs,services):`<div class="operational-note"><b>Note operative</b><span>${esc(firstValue(c,'operational_notes')||'Nessuna nota operativa')}</span></div>`}${isAdmin()?`<div class="card-actions"><button class="primary-soft" onclick="openCustomer('${c.id}')">Apri / modifica</button><button onclick="openQuote(null,'${c.id}')">Crea preventivo</button><button onclick="openService(null,{customer_id:'${c.id}'})">Nuovo servizio</button><button class="danger" onclick="archiveEntity('customers','${c.id}','cliente ${esc(c.first_name+' '+c.last_name)}')">Archivia</button></div>`:''}</article></details>`
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
    return `<details class="entity-accordion dog-accordion"><summary><span class="accordion-name">${esc(d.name)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="entity-expanded"><div class="entity-card-head"><div class="entity-avatar dog-avatar">🐾</div><div><span class="entity-kicker">${esc((d.animal_type||'Animale').toUpperCase())}</span><h3>${esc(d.name)}</h3><p class="entity-subtitle">${esc(breed)}</p></div></div><div class="entity-details"><p><span>Proprietario</span><strong>${esc(cname(d.customer_id))}</strong></p><p><span>Taglia / età</span><strong>${esc([firstValue(d,'size'),firstValue(d,'age_detail','age_range')].filter(Boolean).join(' · ')||'Non indicate')}</strong></p><p><span>Peso / sesso</span><strong>${esc([firstValue(d,'weight_detail'),firstValue(d,'sex'),firstValue(d,'sterilized')].filter(Boolean).join(' · ')||'Non indicati')}</strong></p><p><span>Microchip</span><strong>${esc(firstValue(d,'microchip_number','microchip')||'Non indicato')}</strong></p><p class="wide"><span>Veterinario</span><strong>${esc(vet)}</strong></p><p class="wide"><span>Salute e sicurezza</span><strong>${esc(health)}</strong></p><p class="wide"><span>Alimentazione e routine</span><strong>${esc(food)}</strong></p><p class="wide"><span>Comportamento</span><strong>${esc(behavior)}</strong></p><p class="wide"><span>Passeggiata</span><strong>${esc(walk)}</strong></p>${firstValue(d,'routine_notes')?`<p class="wide"><span>Routine / note operative</span><strong>${esc(firstValue(d,'routine_notes'))}</strong></p>`:''}</div>${linkedDocumentsBlock({dogId:d.id},'PDF associati all’animale')}${isAdmin()?`<div class="card-actions"><button class="primary-soft" onclick="openDog('${d.id}')">Apri / modifica</button><button class="danger" onclick="archiveEntity('dogs','${d.id}','animale ${esc(d.name)}')">Elimina</button></div>`:''}</article></details>`
  }).join('')||`<div class="card empty-state"><strong>Nessun animale</strong><span>${isAdmin()?'Collega un animale a un cliente per visualizzarlo qui.':'Non risultano animali assegnati.'}</span></div>`
}
function renderEmployees(){
  const groups=[
    {key:'administrators',label:'Amministratori',rows:state.profiles.filter(p=>p.role==='owner'||p.role==='vice_admin')},
    {key:'employees',label:'Dipendenti',rows:state.profiles.filter(p=>p.role==='dipendente')}
  ];
  $('#employeeList').innerHTML=groups.map(group=>`<details class="account-group" open><summary><span>${group.label}</span><strong>${group.rows.length}</strong></summary><div class="account-group-body">${group.rows.map(p=>{const assigned=state.services.filter(s=>s.employee_id===p.id&&s.status!=='annullato').length;return `<details class="account-row" data-profile-id="${p.id}"><summary><div class="account-summary-main"><span class="entity-avatar employee-avatar">${esc((p.full_name||p.email||'?').slice(0,2).toUpperCase())}</span><div><strong>${esc(p.full_name||p.email)}</strong><small>${esc(roleLabels[p.role]||p.role)} · ${p.active?'Attivo':'Sospeso'}</small></div></div><span class="account-chevron">⌄</span></summary><div class="account-expanded"><div class="entity-details"><p><span>Codice</span><strong>${esc(p.employee_code||'Non assegnato')}</strong></p><p><span>Qualifica</span><strong>${esc(p.qualification||'Non indicata')}</strong></p><p><span>Servizi associati</span><strong>${assigned}</strong></p><p><span>Stato</span><strong class="${p.active?'text-success':'text-danger'}">${p.active?'Attivo':'Sospeso'}</strong></p></div>${p.is_owner?'<div class="protected-note">Titolare protetto</div>':''}<div class="card-actions"><button class="primary-soft" onclick="openEmployee('${p.id}')">Seleziona e gestisci</button>${!p.is_owner&&p.active?`<button class="danger" onclick="deactivateUser('${p.id}','${esc(p.full_name||p.email)}')">Disattiva</button>`:''}${!p.is_owner&&!p.active?`<button onclick="reactivateUser('${p.id}','${esc(p.full_name||p.email)}')">Riattiva</button>${isOwner()?`<button class="danger" onclick="deleteUserPermanently('${p.id}','${esc(p.full_name||p.email)}')">Elimina definitivamente</button>`:''}`:''}</div></div></details>`}).join('')||'<div class="empty-compact">Nessun account in questa categoria.</div>'}</div></details>`).join('')
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
window.saveCommunication=async(serviceId,status)=>{const area=$('#communicationText'),message=String(area?.value||'').trim();if(!message)return toast('Scrivi prima il messaggio.');const draft=state.communications.find(m=>m.service_id===serviceId&&m.author_id===state.profile.id&&m.status==='draft');try{let saved=null;if(status==='draft'&&draft){const rows=await update('service_communications',draft.id,{message,updated_at:new Date().toISOString()});saved=Array.isArray(rows)?rows[0]:rows;if(saved)state.communications=state.communications.map(m=>m.id===draft.id?saved:m)}else{const rows=await insert('service_communications',{service_id:serviceId,author_id:state.profile.id,author_role:state.profile.role,message,status,edited_from_id:draft?.id||null});saved=Array.isArray(rows)?rows[0]:rows;if(!saved?.id)throw Error('Il messaggio è stato inviato ma il server non ha restituito la comunicazione salvata.');if(draft){await request(`/rest/v1/service_communications?id=eq.${encodeURIComponent(draft.id)}`,{method:'DELETE'});state.communications=state.communications.filter(m=>m.id!==draft.id)}state.communications=state.communications.filter(m=>m.id!==saved.id);state.communications.push(saved)}state.communications.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));buildNav();$('#modalBody').innerHTML=communicationPanel(serviceId);renderServices();toast(status==='draft'?'Bozza salvata':'Comunicazione inviata');setTimeout(async()=>{try{const [communications,reads]=await Promise.all([select('service_communications','select=*&order=created_at.asc'),loadCommunicationReads()]);state.communications=communications;state.communicationReads=reads;buildNav();if($('#modalBody')&&document.querySelector('.communication-panel'))$('#modalBody').innerHTML=communicationPanel(serviceId);renderServices()}catch(e){console.warn('Aggiornamento comunicazioni:',e.message)}},800)}catch(e){toast(e.message)}};
window.markCommunicationsRead=async(serviceId,notify=true)=>{const unread=state.communications.filter(m=>m.service_id===serviceId&&m.status==='sent'&&m.author_id!==state.profile.id&&!communicationReadByCurrentUser(m));if(!unread.length)return;try{await rpc('mark_service_communications_read',{p_service_id:serviceId});await loadAll();buildNav();renderServices();if(notify)toast('Comunicazioni segnate come lette')}catch(e){if(notify)toast(e.message)}};
function periodActorName(id){if(!id)return '—';if(id===state.profile?.id)return 'Tu';return pname(id)}
function servicePeriodWorkflowBlock(s){
  const periods=normalizePeriods(s),runs=(state.periodRuns||[]).filter(r=>r.service_id===s.id),employee=isEmployee(),admin=isAdmin();
  return `<div class="period-workflow"><strong>Gestione periodi</strong>${periods.map((p,i)=>{
    const r=runs.find(x=>Number(x.period_index)===i)||{status:'programmato',start_date:p.start_date,end_date:p.end_date};
    const today=localDate(),expired=r.status==='programmato'&&String(p.end_date||'')<today;
    const canEmployeeStart=employee&&r.status==='programmato'&&!expired&&!['chiuso','annullato'].includes(s.status);
    const canEmployeeEnd=employee&&r.status==='in_corso';
    const canVerify=admin&&r.status==='da_verificare';
    const adminIntervention=admin&&['programmato','in_corso'].includes(r.status)&&!expired&&!['chiuso','annullato'].includes(s.status);
    const startedMeta=r.started_at?`<small>Avviato da ${esc(periodActorName(r.started_by))} · ${new Date(r.started_at).toLocaleString('it-IT')}</small>`:'';
    const endedMeta=r.ended_at?`<small>Terminato da ${esc(periodActorName(r.ended_by))} · ${new Date(r.ended_at).toLocaleString('it-IT')}</small>`:'';
    const verifiedMeta=r.verified_at?`<small>Verificato da ${esc(periodActorName(r.verified_by))} · ${new Date(r.verified_at).toLocaleString('it-IT')}</small>`:'';
    const compensationMeta=r.status==='chiuso'&&r.verified_at?`<small><b>Compenso maturato:</b> ${money(r.employee_amount||0)} · ${r.employee_payment_status==='liquidato'?'Liquidato':'Da liquidare'}</small>`:'';
    const report=admin&&r.status==='da_verificare'&&(r.report_text||r.incident_notes)?`<div class="period-review-summary">${r.report_text?`<small><b>Resoconto:</b> ${esc(r.report_text)}</small>`:''}${r.incident_notes?`<small><b>Anomalie/note:</b> ${esc(r.incident_notes)}</small>`:''}</div>`:'';
    const adminState=admin&&r.status==='in_corso'?`<span class="muted">Periodo in corso · gestito dal dipendente</span>`:admin&&r.status==='da_verificare'?`<span class="muted">Terminato dal dipendente · da verificare</span>`:'';
    return `<div class="period-workflow-row"><div><b>Periodo ${i+1}</b><span>${dateIT(p.start_date)} – ${dateIT(p.end_date)} · ${periodRunLabel(r.status)}</span>${startedMeta}${endedMeta}${verifiedMeta}${compensationMeta}${report}</div><div>${expired?`<span class="muted">Periodo concluso · non avviato</span>`:''}${adminState}${canEmployeeStart?`<button type="button" class="primary" onclick="startServicePeriod('${s.id}',${i})">Inizia periodo</button>`:''}${canEmployeeEnd?`<button type="button" class="primary" onclick="endServicePeriod('${s.id}',${i})">Termina periodo</button>`:''}${canVerify?`<button type="button" class="primary" onclick="verifyServicePeriod('${s.id}',${i})">Verifica e chiudi periodo</button>`:''}${adminIntervention?`<button type="button" class="primary-soft" onclick="openPeriodAdminIntervention('${s.id}',${i},'${r.status}')">Intervento amministrativo</button>`:''}</div></div>`
  }).join('')}</div>`
}
function serviceCard(s){
  if(isAdmin())s=serviceFinancialData(s);
  const margin=Number(s.customer_amount||0)-Number(s.employee_compensation||0), status=statusLabels[s.status]||s.status, visits=Number(s.daily_visits||1), total=totalVisits(s);let actions='';
  if(isEmployee()){
    actions=`<button class="primary-soft" onclick="viewService('${s.id}')">Visualizza</button><button onclick="addAssignedServiceToCalendar('${s.id}')">Collega a calendario</button><button class="communication-button" onclick="openServiceCommunications('${s.id}')">Note operative${unreadCommunicationCount(s.id)?` <span>${unreadCommunicationCount(s.id)}</span>`:''}</button>`;
  }else{
    const serviceDocs=linkedDocuments({serviceId:s.id});
    const internalDoc=serviceDocs.find(d=>d.document_type==='internal'&&documentIsReady(d)&&d.is_active!==false);
    const receipt=serviceDocs.find(d=>d.document_type==='receipt'&&documentIsReady(d));
    const closed=s.status==='chiuso';
    const allReady=servicePeriodsReadyForClosure(s.id);
    const balance=Math.max(0,Number(s.balance_due??0));
    const paid=s.customer_payment_status==='incassato'||balance<=0;
    if(closed){
      actions=`<button class="primary-soft" onclick="viewService('${s.id}')">Apri</button>${internalDoc?`<button onclick="openDocument('${internalDoc.id}')">Apri documento interno</button>`:`<button onclick="downloadClosedServiceDocument('${s.id}','internal',true)">Prepara documento interno</button>`}${receipt?`<button class="primary" onclick="openDocument('${receipt.id}')">Visualizza ricevuta</button><button onclick="downloadStoredDocument('${receipt.id}')">Scarica ricevuta</button><button onclick="shareStoredDocument('${receipt.id}')">Condividi ricevuta</button>`:`<button class="primary" onclick="downloadServiceReceipt('${s.id}')">Emetti ricevuta</button>`}`;
    }else{
      const settlementAction=!paid
        ? `<button class="primary" onclick="setCustomerPaid('${s.id}',${allReady?'true':'false'})">${allReady?'Registra saldo e chiudi':'Registra saldo cliente'}</button>`
        : allReady
          ? `<button class="primary" onclick="closeService('${s.id}')">Chiudi servizio</button>`
          : '';
      actions=`<button class="primary-soft" onclick="viewService('${s.id}')">Apri</button><button onclick="addAssignedServiceToCalendar('${s.id}')">Collega a calendario</button><button class="communication-button" onclick="openServiceCommunications('${s.id}')">Comunicazioni${unreadCommunicationCount(s.id)?` <span>${unreadCommunicationCount(s.id)}</span>`:''}</button><button onclick="openService('${s.id}')">Modifica</button>${settlementAction}${s.status==='da_verificare'?`<button onclick="openPdfReviewHub('${s.id}')">Documenti e chiusura</button>`:''}`;
    }
  }
  const employeeUnit=Number(s.employee_unit_compensation||0)||Number(s.employee_compensation||0)/Math.max(1,total);
  const economics=isEmployee()?`<div class="employee-compensation"><span>Compenso della scheda</span><strong>${money(s.employee_compensation)}</strong><small>${money(employeeUnit)} per uscita · ${total} uscite totali</small></div>`:`<div class="economic-split"><div><span>Importo cliente</span><strong>${money(s.customer_amount)}</strong></div><div><span>Compenso per uscita</span><strong>${money(employeeUnit)}</strong></div><div><span>Compenso totale</span><strong>${money(s.employee_compensation)}</strong></div><div><span>Margine attività</span><strong>${money(margin)}</strong></div></div>`;
  const employeeFacts=isEmployee()?`<div><span>Periodo</span><strong>${esc(servicePeriod(s))}</strong></div><div><span>Frequenza</span><strong>${esc(displayValue(s.frequency,'Non indicata'))}</strong></div><div><span>Fasce orarie</span><strong>${esc(serviceSlots(s))}</strong></div><div><span>Durata</span><strong>${Number(s.planned_duration_minutes||0)} min</strong></div><div><span>Uscite/giorno</span><strong>${visits}</strong></div><div><span>Uscite totali</span><strong>${total}</strong></div>`:`<div><span>Periodo</span><strong>${esc(servicePeriod(s))}</strong></div><div><span>Fasce orarie</span><strong>${esc(serviceSlots(s))}</strong></div><div><span>Durata</span><strong>${Number(s.planned_duration_minutes||0)} min</strong></div><div><span>Uscite totali</span><strong>${total}</strong></div><div><span>Dipendente</span><strong>${esc(pname(s.employee_id))}</strong></div>`;
  const paymentBlock=isAdmin()&&Number(s.deposit_amount||0)>0?`<div class="service-payment-status"><div><span>Acconto ricevuto</span><strong>${money(s.deposit_amount)}</strong></div><div><span>Residuo cliente</span><strong>${money(Math.max(0,Number(s.balance_due||0)))}</strong></div><div><span>Stato pagamento</span><strong>${s.customer_payment_status==='incassato'?'Incassato':'Da incassare'}</strong></div></div>`:'';
  return `<details class="record-accordion service-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(dname(s.dog_id))}</span><small>${esc(cname(s.customer_id))} · ${esc(servicePeriod(s))} · ${esc(s.service_type||'Servizio')}</small></div><span class="status-badge status-${esc(s.status)}">${esc(status)}</span>${unreadCommunicationCount(s.id)?`<span class="service-message-badge" title="Nuove comunicazioni">${unreadCommunicationCount(s.id)}</span>`:''}<span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded service-card"><div class="service-card-top"><div><span class="entity-kicker">${esc(s.service_type||'SERVIZIO')}</span><h3>${esc(dname(s.dog_id))}</h3><p>${esc(cname(s.customer_id))}</p></div></div><div class="service-facts">${employeeFacts}</div>${servicePeriodWorkflowBlock(s)}${economics}${paymentBlock}${s.keys_status||s.customer_updates?`<div class="operational-note"><b>Organizzazione</b><span>${esc([s.keys_status&&`Chiavi: ${s.keys_status}`,s.customer_updates&&`Aggiornamenti: ${s.customer_updates}`].filter(Boolean).join(' · '))}</span></div>`:''}${s.operational_notes?`<div class="operational-note"><b>Note operative</b><span>${esc(s.operational_notes)}</span></div>`:''}${s.report_text?`<div class="operational-note"><b>Rapporto</b><span>${esc(s.report_text)}</span></div>`:''}${isAdmin()?linkedDocumentsBlock({serviceId:s.id},'Documenti del servizio'):''}<div class="service-actions">${actions}</div></article></details>`;
}
function employeeServiceIsVisible(s){
  if(!s||s.deleted_at!=null||['chiuso','annullato'].includes(s.status))return false;
  const periods=normalizePeriods(s);
  if(!periods.length){
    const end=String(s.end_date||s.service_date||'');
    return !end||end>=localDate();
  }
  const runs=(state.periodRuns||[]).filter(r=>r.service_id===s.id);
  const today=localDate();
  return periods.some((p,i)=>{
    const run=runs.find(r=>Number(r.period_index)===i);
    const runStatus=run?.status||'programmato';
    if(runStatus==='in_corso')return true;
    if(runStatus==='programmato')return String(p.end_date||p.start_date||'')>=today;
    return false;
  });
}
function renderServices(){
  $('[data-action="new-service"]')?.classList.toggle('hidden',!isAdmin());
  const clearButton=$('#clearFilters');if(clearButton)clearButton.classList.remove('hidden');
  const d=$('#serviceDateFilter')?.value||'',st=$('#serviceStatusFilter')?.value||'';
  const source=[...(state.services||[])].filter(s=>s&&s.deleted_at==null&&!['chiuso','annullato'].includes(s.status));
  const all=isEmployee()?source.filter(employeeServiceIsVisible):source;
  const visible=all.filter(s=>(!d||serviceOccursOn(s,d))&&(!st||s.status===st));
  const counter=$('#serviceFilterSummary');if(counter)counter.textContent=(d||st)?`${visible.length} di ${all.length} servizi visualizzati`:`${all.length} ${all.length===1?'servizio':'servizi'} assegnati`;
  $('#serviceList').innerHTML=visible.map(serviceCard).join('')||(all.length?'<div class="card empty-state"><strong>Nessun servizio con questi filtri.</strong><span>Premi “Mostra tutti” per visualizzare nuovamente tutti i servizi assegnati.</span><button type="button" class="primary-soft" onclick="resetServiceFilters();renderServices()">Mostra tutti</button></div>':(isEmployee()?'<div class="card empty-state"><strong>Nessun servizio attivo assegnato.</strong><span>Vedi solo i servizi che ti competono e che non sono terminati.</span></div>':'<div class="card empty-state"><strong>Nessun servizio operativo.</strong><span>I servizi chiusi o annullati sono fuori dalla lista operativa e restano conservati nello storico amministrativo.</span></div>'))
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
function linkedQuoteForService(service){if(!service)return null;const qid=service.quote_id||null;return (qid?state.quotes.find(q=>q.id===qid):null)||state.quotes.find(q=>q.converted_service_id===service.id)||null}
function serviceFinancialData(service){const q=linkedQuoteForService(service);if(!q)return service;const total=Number(q.total_amount??service.customer_amount??0),deposit=Number(q.deposit_amount||0),balance=Number(q.balance_due??Math.max(0,total-deposit));return {...service,quote_id:q.id,customer_amount:total,unit_rate:Number(service.unit_rate||0),payment_method:q.payment_terms||service.payment_method,customer_payment_status:balance<=0?'incassato':'da_incassare',deposit_amount:deposit,deposit_received_at:q.deposit_received_at||null,deposit_payment_method:q.deposit_payment_method||null,deposit_reference:q.deposit_reference||null,balance_due:balance,quote_payment_status:q.payment_status||null}}

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
    <label>Animale<select id="quoteDog" name="dog_id"><option value="">Nessun animale / seleziona</option></select></label>
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
    let quoteId=id;if(id){await update('dogsitter_quotes',id,payload);await request(`/rest/v1/dogsitter_quote_items?quote_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}else{const created=await insert('dogsitter_quotes',payload);quoteId=created[0]?.id;if(!quoteId)throw Error('Preventivo non creato.')}await insert('dogsitter_quote_items',items.map(i=>({...i,quote_id:quoteId})));if(id&&q.converted_service_id){await rpc('sync_quote_financials',{p_quote_id:quoteId});}clearQuoteDraft(id);
  });
  const customer=$('#quoteCustomer'),dog=$('#quoteDog');const fillDogs=()=>{const dogs=state.dogs.filter(d=>d.customer_id===customer.value);dog.innerHTML='<option value="">Nessun animale / seleziona</option>'+dogs.map(d=>`<option value="${d.id}" ${d.id===selectedDog?'selected':''}>${esc(d.name)}</option>`).join('');if(!id&&dogs.length===1)dog.value=dogs[0].id};customer.onchange=fillDogs;fillDogs();
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
function quoteToServiceSeed(q){
  const items=(q.quote_items||[]).sort((a,b)=>Number(a.position||0)-Number(b.position||0));
  const type=items.map(i=>i.description).filter(Boolean).join(' + ').slice(0,80)||'Servizio dogsitter';
  const periods=normalizePeriods(q,'quote');
  const firstPeriod=periods[0];
  const start=firstPeriod.start_date,end=firstPeriod.end_date,daily=firstPeriod.daily_visits;
  const totalVisits=Math.max(1,periodsTotals(periods).visits);
  const customerAmount=Number(q.total_amount||quoteTotal(q)||0);
  const unitRate=items.length===1?Number(items[0].unit_price||0):(totalVisits?customerAmount/totalVisits:0);
  return {
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
    customer_payment_status:Number(q.balance_due??Math.max(0,customerAmount-Number(q.deposit_amount||0)))<=0?'incassato':'da_incassare',
    deposit_amount:Number(q.deposit_amount||0),
    deposit_received_at:q.deposit_received_at||null,
    deposit_payment_method:q.deposit_payment_method||null,
    deposit_reference:q.deposit_reference||null,
    balance_due:Number(q.balance_due??Math.max(0,customerAmount-Number(q.deposit_amount||0))),
    quote_payment_status:q.payment_status||null,
    keys_status:q.keys_status||null,
    keys_mode:q.keys_mode||null,
    customer_updates:q.customer_updates||'Messaggio WhatsApp',
    auth_vet:q.auth_vet||'Solo dopo contatto telefonico',
    auth_transport:q.auth_transport||'Solo dopo contatto telefonico',
    operational_notes:[`Servizio derivato dal preventivo del ${dateIT(q.quote_date)}.`,q.notes||''].filter(Boolean).join('\n'),
    status:'programmato'
  };
}
window.transformQuoteToService=async id=>{
  const q=state.quotes.find(x=>x.id===id);
  if(!q)return toast('Preventivo non trovato');

  if(q.converted_service_id){
    let linked=(state.services||[]).find(s=>s.id===q.converted_service_id)||null;
    if(!linked){
      try{
        const rows=await select('dogsitter_services',`select=*&id=eq.${encodeURIComponent(q.converted_service_id)}&limit=1`);
        linked=Array.isArray(rows)?rows[0]||null:null;
      }catch(error){
        console.warn('Verifica servizio collegato non riuscita:',error?.message||error);
      }
    }

    if(linked&&!linked.deleted_at){
      if(!(state.services||[]).some(s=>s.id===linked.id))state.services=[linked,...(state.services||[])];
      resetServiceFilters();
      show('services');
      renderServices();
      return toast('Il servizio collegato esiste ed è stato aperto nella sezione Servizi.');
    }

    if(linked?.deleted_at){
      if(!confirm('Il servizio collegato a questo preventivo è nel Cestino. Vuoi ripristinarlo nei Servizi?'))return;
      try{
        await rpc('restore_entity',{p_table:'dogsitter_services',p_id:linked.id});
        await loadAll();
        resetServiceFilters();
        show('services');
        renderServices();
        return toast('Servizio ripristinato correttamente.');
      }catch(error){
        return toast(error?.message||'Ripristino del servizio non riuscito');
      }
    }

    if(!confirm('Il preventivo risulta collegato a un servizio che non esiste più. Vuoi ricreare correttamente il servizio dal preventivo?'))return;
  }

  openService(null,quoteToServiceSeed(q));
};

function compensationRunDate(r){return r?.verified_at?localDate(new Date(r.verified_at)):''}
function compensationPeriodRows({includeUnmatured=false}={}){
  const serviceSource=isEmployee()?(state.compensationServices||[]):(state.services||[]);
  const runSource=isEmployee()?(state.compensationPeriodRuns||[]):(state.periodRuns||[]);
  const services=new Map(serviceSource.map(s=>[s.id,s]));
  return runSource.map(r=>{
    const service=services.get(r.service_id);if(!service)return null;
    const periods=normalizePeriods(service),period=periods[Number(r.period_index)]||null;if(!period)return null;
    const visits=Number(r.employee_visits??periodVisits(period))||0;
    const unit=Number(r.employee_unit_compensation??service.employee_unit_compensation??0)||(Number(service.employee_compensation||0)/Math.max(1,totalVisits(service)));
    const amount=Number(r.employee_amount??(r.status==='chiuso'?unit*visits:0))||0;
    const maturedRun=r.status==='chiuso'&&!!r.verified_at;
    if(!includeUnmatured&&!maturedRun)return null;
    return {run:r,service,period,visits,unit,amount,matured:maturedRun,date:compensationRunDate(r),payment_status:r.employee_payment_status||(maturedRun?'da_liquidare':'non_maturato')};
  }).filter(Boolean).sort((a,b)=>String(b.run.verified_at||b.period.end_date||'').localeCompare(String(a.run.verified_at||a.period.end_date||'')));
}
function compensationTotals(rows){return {sum:rows.reduce((a,x)=>a+x.amount,0),visits:rows.reduce((a,x)=>a+x.visits,0)}}
function compensationPeriodCard(x,{archive=false}={}){
  const label=x.matured?(x.payment_status==='liquidato'?'Liquidato':'Da liquidare'):(x.run.status==='da_verificare'?'In attesa di verifica':x.run.status==='in_corso'?'Periodo in corso':'Non maturato');
  const paidMeta=x.payment_status==='liquidato'?`<p><span>Liquidato il</span><strong>${x.run.employee_paid_at?new Date(x.run.employee_paid_at).toLocaleString('it-IT'):'—'}</strong></p><p><span>Registrato da</span><strong>${x.run.employee_paid_by?esc(pname(x.run.employee_paid_by)):'Titolare/Vice'}</strong></p>`:'';
  return `<article class="card"><div class="section-title-row"><div><strong>${esc(x.service.dog_name||dname(x.service.dog_id))} · ${esc(x.service.service_type||'Servizio')}</strong><p class="muted">Periodo ${Number(x.run.period_index)+1} · ${dateIT(x.period.start_date)} – ${dateIT(x.period.end_date)}</p></div><span class="status-badge">${esc(label)}</span></div><div class="entity-details"><p><span>Uscite del periodo</span><strong>${x.visits}</strong></p><p><span>Compenso per uscita</span><strong>${money(x.unit)}</strong></p><p><span>Compenso del periodo</span><strong>${money(x.matured?x.amount:x.unit*x.visits)}</strong></p><p><span>Maturato il</span><strong>${x.run.verified_at?new Date(x.run.verified_at).toLocaleString('it-IT'):'—'}</strong></p>${paidMeta}</div>${archive?'<div class="protected-note"><b>Compenso liquidato</b><br>Liquidazione archiviata nello storico.</div>':''}</article>`
}
let compensationView='current';
window.setCompensationView=view=>{compensationView=view==='archive'?'archive':'current';renderComp()};
function renderComp(){
  const now=new Date(),today=localDate(now),week=new Date(now);week.setDate(now.getDate()-((now.getDay()+6)%7));const ws=localDate(week),month=today.slice(0,7);
  const maturedRows=compensationPeriodRows(),allRows=compensationPeriodRows({includeUnmatured:true}),paidRows=maturedRows.filter(x=>x.payment_status==='liquidato');
  const defs=[['Oggi',x=>x.date===today],['Settimana',x=>x.date>=ws&&x.date<=today],['Mese',x=>String(x.date||'').startsWith(month)]];
  $('#compCards').innerHTML=defs.map(([l,f])=>{const t=compensationTotals(maturedRows.filter(f));return `<div class="stat"><span>${l}</span><strong>${money(t.sum)}</strong><small>${t.visits} uscite maturate</small></div>`}).join('')+`<div class="stat"><span>Da liquidare</span><strong>${money(maturedRows.filter(x=>x.payment_status==='da_liquidare').reduce((a,x)=>a+x.amount,0))}</strong><small>Periodi verificati</small></div><div class="stat"><span>Liquidato</span><strong>${money(paidRows.reduce((a,x)=>a+x.amount,0))}</strong><small>${paidRows.length} periodi archiviati</small></div>`;
  const host=$('#compList');
  const toolbar=`<div class="card-actions"><button type="button" class="${compensationView==='current'?'primary':''}" onclick="setCompensationView('current')">Compensi correnti</button><button type="button" class="${compensationView==='archive'?'primary':''}" onclick="setCompensationView('archive')">Compensi liquidati · Archivio</button></div>`;
  if(compensationView==='archive') host.innerHTML=toolbar+(paidRows.map(x=>compensationPeriodCard(x,{archive:true})).join('')||'<div class="card empty-state"><strong>Archivio vuoto</strong><span>Qui compariranno i compensi registrati come liquidati dal Titolare/Vice.</span></div>');
  else {const currentRows=allRows.filter(x=>x.payment_status!=='liquidato');host.innerHTML=toolbar+(currentRows.map(x=>compensationPeriodCard(x)).join('')||'<div class="card empty-state"><strong>Nessun compenso corrente</strong><span>I compensi diventano maturati quando un periodo terminato viene verificato dal Titolare/Vice.</span></div>')}
}
function economyQuoteStatus(q){
  if(q?.converted_service_id)return 'Convertito in servizio';
  const labels={bozza:'Bozza',inviato:'Inviato',accettato:'Accettato',rifiutato:'Rifiutato',scaduto:'Scaduto'};
  return labels[q?.status]||q?.status||'Bozza';
}
function economyPaymentStatus(q,s){
  if(s?.customer_payment_status==='incassato')return 'Pagato';
  const raw=String(q?.payment_status||s?.quote_payment_status||'').toLowerCase();
  if(['pagato','incassato'].includes(raw))return 'Pagato';
  if(Number((q?.deposit_amount ?? s?.deposit_amount) || 0)>0)return 'Acconto ricevuto';
  return 'Da pagare';
}
function economyRows(){
  const quotes=(state.quotes||[]).filter(q=>!q.deleted_at);
  const services=(state.services||[]).filter(s=>!s.deleted_at);
  const linkedServiceByQuote=new Map();
  services.forEach(s=>{if(s.quote_id)linkedServiceByQuote.set(s.quote_id,s)});
  const rows=quotes.map(q=>{
    const s=linkedServiceByQuote.get(q.id)||services.find(x=>x.id===q.converted_service_id)||null;
    const total=Number(q.total_amount??(s?.customer_amount||0))||0;
    const deposit=Number(q.deposit_amount??(s?.deposit_amount||0))||0;
    const rawBalance=q.balance_due??s?.balance_due;
    let balance=rawBalance===null||rawBalance===undefined?Math.max(0,total-deposit):Math.max(0,Number(rawBalance)||0);
    const paid=economyPaymentStatus(q,s)==='Pagato';
    if(paid)balance=0;
    const collected=paid?total:Math.min(total,Math.max(0,deposit));
    return {kind:'quote',id:q.id,quote:q,service:s,total,deposit,balance,collected,paid,customer_id:q.customer_id||s?.customer_id,dog_id:q.dog_id||s?.dog_id,date:q.quote_date||q.created_at||s?.service_date||'',deposit_date:q.deposit_received_at||s?.deposit_received_at||null,deposit_method:q.deposit_payment_method||s?.deposit_payment_method||null,deposit_reference:q.deposit_reference||s?.deposit_reference||null};
  });
  const linkedQuoteIds=new Set(quotes.map(q=>q.id));
  services.filter(s=>!s.quote_id||!linkedQuoteIds.has(s.quote_id)).forEach(s=>{
    const total=Number(s.customer_amount||0),deposit=Number(s.deposit_amount||0);
    const paid=s.customer_payment_status==='incassato';
    const balance=paid?0:Math.max(0,Number(s.balance_due??Math.max(0,total-deposit))||0);
    rows.push({kind:'service',id:s.id,quote:null,service:s,total,deposit,balance,collected:paid?total:Math.min(total,Math.max(0,deposit)),paid,customer_id:s.customer_id,dog_id:s.dog_id,date:s.service_date||s.created_at||'',deposit_date:s.deposit_received_at||null,deposit_method:s.deposit_payment_method||null,deposit_reference:s.deposit_reference||null});
  });
  return rows.sort((a,b)=>String(b.deposit_date||b.date||'').localeCompare(String(a.deposit_date||a.date||'')));
}
function renderPayments(){
  if(!isAdmin())return;
  const rows=economyRows();
  const activeQuoteRows=rows.filter(r=>r.kind==='quote'&&!['rifiutato','scaduto'].includes(String(r.quote?.status||'').toLowerCase()));
  const quoted=activeQuoteRows.reduce((a,r)=>a+r.total,0);
  const deposits=rows.reduce((a,r)=>a+r.deposit,0);
  const collected=rows.reduce((a,r)=>a+r.collected,0);
  const outstanding=rows.reduce((a,r)=>a+r.balance,0);
  const maturedRows=(state.services||[]).filter(matured).map(serviceFinancialData);
  const periodCompRows=compensationPeriodRows();
  const toPay=periodCompRows.filter(x=>x.payment_status==='da_liquidare').reduce((a,x)=>a+x.amount,0);
  const paidEmployees=periodCompRows.filter(x=>x.payment_status==='liquidato').reduce((a,x)=>a+x.amount,0);
  const margin=maturedRows.reduce((a,s)=>a+Number(s.customer_amount||0)-Number(s.employee_compensation||0),0);
  $('#paymentSummary').innerHTML=`
    <div class="stat"><span>Preventivi attivi</span><strong>${money(quoted)}</strong><small>${activeQuoteRows.length} preventivi</small></div>
    <div class="stat"><span>Acconti ricevuti</span><strong>${money(deposits)}</strong><small>Registrati subito, anche prima del servizio</small></div>
    <div class="stat"><span>Incassato complessivo</span><strong>${money(collected)}</strong><small>Acconti + saldi pagati</small></div>
    <div class="stat"><span>Residuo da incassare</span><strong>${money(outstanding)}</strong></div>
    <div class="stat"><span>Da liquidare dipendenti</span><strong>${money(toPay)}</strong></div>
    <div class="stat"><span>Già liquidato dipendenti</span><strong>${money(paidEmployees)}</strong></div>
    <div class="stat"><span>Margine attività maturato</span><strong>${money(margin)}</strong></div>`;
  const pendingPeriodRows=periodCompRows.filter(x=>x.payment_status==='da_liquidare');
  const archivedPeriodRows=periodCompRows.filter(x=>x.payment_status==='liquidato');
  const employeePeriodSection=`<div class="card"><div class="section-title-row"><div><h3>Compensi per periodo</h3><p class="muted">Il compenso matura solo dopo la verifica del singolo periodo.</p></div></div><h4>Da liquidare</h4>${pendingPeriodRows.map(x=>`<div class="linked-document-row"><div><strong>${esc(pname(x.service.employee_id))} · Periodo ${Number(x.run.period_index)+1}</strong><small>${esc(dname(x.service.dog_id))} · ${dateIT(x.period.start_date)} – ${dateIT(x.period.end_date)} · ${x.visits} uscite × ${money(x.unit)}</small></div><div><strong>${money(x.amount)}</strong><small>Da liquidare</small><button type="button" onclick="setPeriodEmployeePaid('${x.run.id}')">Segna liquidato</button></div></div>`).join('')||'<p class="muted">Nessun compenso da liquidare.</p>'}<details class="record-accordion payment-accordion"><summary><div class="record-summary-main"><span class="record-title">Archivio compensi liquidati</span><small>${archivedPeriodRows.length} periodi · ${money(archivedPeriodRows.reduce((a,x)=>a+x.amount,0))}</small></div><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded">${archivedPeriodRows.map(x=>`<div class="linked-document-row"><div><strong>${esc(pname(x.service.employee_id))} · Periodo ${Number(x.run.period_index)+1}</strong><small>${esc(dname(x.service.dog_id))} · ${dateIT(x.period.start_date)} – ${dateIT(x.period.end_date)} · ${x.visits} uscite × ${money(x.unit)}</small><small>Maturato: ${x.run.verified_at?new Date(x.run.verified_at).toLocaleString('it-IT'):'—'} · Liquidato: ${x.run.employee_paid_at?new Date(x.run.employee_paid_at).toLocaleString('it-IT'):'—'}</small></div><div><strong>${money(x.amount)}</strong><small>Liquidato</small></div></div>`).join('')||'<p class="muted">Archivio vuoto.</p>'}</article></details></div>`;
  $('#paymentList').innerHTML=employeePeriodSection+rows.map(r=>{
    const q=r.quote,s=r.service;
    const title=r.kind==='quote'?`Preventivo ${q?.progressive?esc(q.progressive):dateIT(r.date)}`:`Servizio ${dateIT(r.date)}`;
    const serviceLabel=s?`${esc(s.service_type||'Servizio')} · ${esc(statusLabels[s.status]||s.status||'—')}`:'Non ancora trasformato in servizio';
    const quoteStatus=r.kind==='quote'?economyQuoteStatus(q):'Senza preventivo collegato';
    const paymentStatus=economyPaymentStatus(q,s);
    return `<details class="record-accordion payment-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(cname(r.customer_id))}</span><small>${esc(dname(r.dog_id))} · ${title}</small></div><strong class="record-amount">${money(r.total)}</strong><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded"><div class="entity-details">
      <p><span>Origine</span><strong>${title}</strong></p>
      <p><span>Stato preventivo</span><strong>${esc(quoteStatus)}</strong></p>
      <p><span>Totale</span><strong>${money(r.total)}</strong></p>
      <p><span>Stato pagamento</span><strong>${esc(paymentStatus)}</strong></p>
      <p><span>Acconto ricevuto</span><strong>${money(r.deposit)}</strong></p>
      <p><span>Data acconto</span><strong>${r.deposit_date?dateIT(r.deposit_date):'—'}</strong></p>
      <p><span>Modalità acconto</span><strong>${esc(r.deposit_method||'—')}</strong></p>
      <p><span>Riferimento / CRO</span><strong>${esc(r.deposit_reference||'—')}</strong></p>
      <p><span>Residuo da incassare</span><strong>${money(r.balance)}</strong></p>
      <p class="wide"><span>Servizio collegato</span><strong>${serviceLabel}</strong></p>
      ${s?`<p><span>Compenso dipendente</span><strong>${money(s.employee_compensation||0)}</strong></p><p><span>Stato liquidazione</span><strong>${esc(s.employee_payment_status||'da_liquidare')}</strong></p>`:''}
    </div><div class="service-actions">
      ${r.kind==='quote'?`<button type="button" onclick="openQuote('${r.id}')">Apri preventivo</button>`:''}
      ${s?`<button type="button" onclick="viewService('${s.id}')">Apri servizio</button>`:''}
      ${s&&s.customer_payment_status!=='incassato'?`<button type="button" onclick="setCustomerPaid('${s.id}')">Registra saldo cliente</button>`:''}
      
    </div></article></details>`;
  }).join('')||'<div class="card">Nessun movimento economico presente.</div>';
}

function documentTypeLabel(d){if((d.document_type||'customer')==='quote')return 'Preventivo';if(d.document_type==='receipt')return 'Ricevuta cliente';if(d.document_type==='internal')return 'Documento interno';if(d.document_type==='employee')return 'Documento dipendente';return 'Documento cliente'}
function documentStatusLabel(v){return ({generating:'In generazione',generated:'Generato',inviato:'Inviato',archived:'Archiviato'}[v]||v||'Generato')}

function closedServiceArchiveCard(s){
  const docs=linkedDocuments({serviceId:s.id}).filter(d=>d.status!=='archived');
  const customer=docs.find(d=>d.document_type==='customer'&&documentIsReady(d)&&d.is_active!==false);
  const employee=docs.find(d=>d.document_type==='employee'&&documentIsReady(d)&&d.is_active!==false);
  const internal=docs.find(d=>d.document_type==='internal'&&documentIsReady(d)&&d.is_active!==false);
  const one=(label,d,kind)=>d
    ? `<div class="archive-doc-row"><b>${label}</b><button onclick="downloadStoredDocument('${d.id}')">Scarica</button><button onclick="downloadClosedServiceDocument('${s.id}','${kind}',true)">Nuova versione</button></div>`
    : `<div class="archive-doc-row"><b>${label}</b><button onclick="downloadClosedServiceDocument('${s.id}','${kind}',true)">Prepara e scarica</button></div>`;
  return `<details class="record-accordion document-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(cname(s.customer_id))} · ${esc(dname(s.dog_id))}</span><small>${esc(s.service_type||'Servizio')} · ${esc(servicePeriod(s))}</small></div><span class="pill">Chiuso</span><span class="accordion-chevron"></span></summary><article class="record-expanded document-card"><div class="archive-documents">${one('Documento cliente',customer,'customer')}${one('Documento dipendente',employee,'employee')}${one('Documento interno',internal,'internal')}</div><div class="service-actions"><button class="primary" onclick="downloadAllClosedServiceDocuments('${s.id}')">Scarica tutti e 3 (ZIP)</button></div></article></details>`;
}
async function getClosedServiceDocumentBlob(id,kind,{forceNew=false}={}){
  if(!isAdmin())throw Error('Funzione riservata a Titolare/Vice.');
  if(!['customer','employee','internal'].includes(kind))throw Error('Tipo documento non valido.');
  const s=state.services.find(x=>x.id===id);if(!s)throw Error('Servizio non trovato.');
  if(s.status!=='chiuso')throw Error('I documenti definitivi sono disponibili dopo la chiusura del servizio.');
  const existing=!forceNew?(state.documents||[]).find(d=>d.service_id===id&&d.document_type===kind&&documentIsReady(d)&&d.is_active!==false):null;
  if(existing){
    const response=await fetch(await signedDocumentUrl(existing));
    if(!response.ok)throw Error('Documento archiviato non disponibile.');
    return {blob:await response.blob(),file_name:existing.file_name||`Documento_${kind}.pdf`,document:existing};
  }
  const meta=await rpc('create_document_version',{p_service_id:id,p_document_type:kind});
  const financial=serviceFinancialData(s);
  const titles={customer:'Documento cliente del servizio',employee:'Documento compenso dipendente',internal:'Documento amministrativo interno'};
  const data={...reviewedPdfData(s,kind,{title:titles[kind]}),...meta,customer_amount:Number(financial.customer_amount||0),employee_compensation:Number(financial.employee_compensation||0),employee_payment_status:financial.employee_payment_status||'da_liquidare',customer_payment_status:financial.customer_payment_status||'da_incassare',deposit_amount:Number(financial.deposit_amount||0),balance_due:Number(financial.balance_due||0),internal_margin:Number(financial.customer_amount||0)-Number(financial.employee_compensation||0)};
  const blob=await window.K9PdfEngine.createServicePdf(data,kind,state.settings||DEFAULT_SETTINGS,identityLogo());
  await uploadDocument(meta.storage_path,blob);
  await rpc('finalize_document_version',{p_document_id:meta.id});
  await loadAll();
  return {blob,file_name:meta.file_name||`Documento_${kind}.pdf`,document:meta};
}
window.downloadClosedServiceDocument=async(id,kind,forceNew=false)=>{try{const result=await getClosedServiceDocumentBlob(id,kind,{forceNew});downloadBlob(result.blob,result.file_name);toast('Documento preparato e scaricato.')}catch(e){toast(e.message||'Documento non disponibile')}}
window.downloadAllClosedServiceDocuments=async id=>{try{
  if(!window.JSZip)throw Error('Modulo ZIP non disponibile. Ricarica la pagina.');
  const labels={customer:'Cliente',employee:'Dipendente',internal:'Interno'};
  const zip=new JSZip();
  for(const kind of ['customer','employee','internal']){
    const result=await getClosedServiceDocumentBlob(id,kind,{forceNew:true});
    zip.file(result.file_name||`Documento_${labels[kind]}.pdf`,result.blob);
  }
  const s=state.services.find(x=>x.id===id),name=`Documenti_${String(cname(s?.customer_id)||'Cliente').replace(/[^a-z0-9àèéìòù_-]+/gi,'_')}_${String(dname(s?.dog_id)||'Animale').replace(/[^a-z0-9àèéìòù_-]+/gi,'_')}.zip`;
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  downloadBlob(blob,name);
  toast('Archivio ZIP creato con i tre documenti distinti.');
}catch(e){toast(e.message||'Preparazione documenti non riuscita')}}

function renderDocs(){
  if(isEmployee())return;
  const closed=(state.services||[]).filter(s=>s&&s.deleted_at==null&&s.status==='chiuso');
  const archiveHost=$('#closedServiceArchive');
  if(archiveHost)archiveHost.innerHTML=closed.map(closedServiceArchiveCard).join('')||'<div class="card">Nessun servizio chiuso archiviato.</div>';
  const host=$('#documentList'),docs=state.documents||[],active=docs.filter(d=>d.status!=='archived').length,customers=docs.filter(d=>(d.document_type||'customer')==='customer').length,employees=docs.filter(d=>d.document_type==='employee').length,internals=docs.filter(d=>d.document_type==='internal').length,quotes=docs.filter(d=>d.document_type==='quote').length,receipts=docs.filter(d=>d.document_type==='receipt').length,sent=docs.filter(d=>d.status==='inviato').length;
  host.innerHTML=`<div class="document-summary"><div class="stat"><span>Documenti</span><strong>${docs.length}</strong></div><div class="stat"><span>Attivi</span><strong>${active}</strong></div><div class="stat"><span>PDF cliente legacy</span><strong>${customers}</strong></div><div class="stat"><span>Documenti dipendente</span><strong>${employees}</strong></div><div class="stat"><span>Documenti interni</span><strong>${internals}</strong></div><div class="stat"><span>Preventivi</span><strong>${quotes}</strong></div><div class="stat"><span>Ricevute</span><strong>${receipts}</strong></div><div class="stat"><span>Inviati</span><strong>${sent}</strong></div></div><div class="document-toolbar"><input id="documentSearch" type="search" placeholder="Cerca cliente, animale, dipendente o file"><select id="documentTypeFilter"><option value="">Tutti i documenti</option><option value="customer">PDF cliente</option><option value="employee">Documento dipendente</option><option value="internal">Documento interno</option><option value="quote">Preventivi</option><option value="receipt">Ricevute</option></select><select id="documentStatusFilter"><option value="">Tutti gli stati</option><option value="generated">Generati</option><option value="inviato">Inviati</option><option value="archived">Archiviati</option></select></div><div id="documentCards" class="document-grid"></div>`;
  const draw=()=>{
    const q=$('#documentSearch').value.trim().toLowerCase(),type=$('#documentTypeFilter').value,status=$('#documentStatusFilter').value,rows=docs.filter(d=>(!type||(d.document_type||'customer')===type)&&(!status||d.status===status)&&(!q||[d.file_name,d.customer_name,d.dog_name,d.employee_name,d.title].some(v=>String(v||'').toLowerCase().includes(q))));
    $('#documentCards').innerHTML=rows.map(d=>`<details class="record-accordion document-accordion ${d.is_active===false?'is-superseded':''}"><summary><div class="record-summary-main"><span class="record-title">${esc(d.file_name||d.title||'Documento')}</span><small>${esc(d.customer_name||cname(d.customer_id))} · ${esc(d.dog_name||dname(d.dog_id))}</small></div><span class="document-kind ${d.document_type==='employee'?'internal':d.document_type==='quote'?'quote-kind':d.document_type==='receipt'?'receipt-kind':''}">${documentTypeLabel(d)}</span><span class="document-version">V${Number(d.version||1)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded document-card"><div class="document-meta"><div><span>Cliente</span><strong>${esc(d.customer_name||cname(d.customer_id))}</strong></div><div><span>Animale</span><strong>${esc(d.dog_name||dname(d.dog_id))}</strong></div><div><span>Dipendente</span><strong>${esc(d.employee_name||pname(d.employee_id))}</strong></div><div><span>${d.document_type==='quote'?'Data preventivo':d.document_type==='receipt'?'Data ricevuta':'Data servizio'}</span><strong>${dateIT(d.receipt_date||d.quote_date||d.service_date)}</strong></div></div><div class="document-state"><span class="pill">${esc(documentStatusLabel(d.status))}</span>${d.is_active===false?'<span class="pill muted-pill">Versione superata</span>':'<span class="pill active-pill">Versione attiva</span>'}</div><p class="muted">Creato ${d.created_at?new Date(d.created_at).toLocaleString('it-IT'):'—'}</p><div class="service-actions">${documentIsReady(d)?`<button onclick="openDocument('${d.id}')">Apri</button><button onclick="downloadStoredDocument('${d.id}')">Scarica</button><button onclick="shareStoredDocument('${d.id}')">Condividi</button>`:`<button class="primary" onclick="regenerateDocument('${d.id}')">Rigenera documento</button>`}${d.source_kind==='quote'&&d.quote_id&&d.status!=='archived'?`<button onclick="generateQuoteDocument('${d.quote_id}')">Nuova versione</button>`:d.source_kind!=='receipt'&&d.service_id&&d.status!=='archived'&&documentIsReady(d)?`<button onclick="regenerateDocument('${d.id}')">Nuova versione</button>`:''}${d.status!=='inviato'&&['customer','quote','receipt'].includes(d.document_type||'customer')?`<button onclick="markDocumentSent('${d.id}')">Segna inviato</button>`:''}${d.source_kind!=='receipt'&&d.status!=='archived'?`<button class="danger" onclick="archiveDocument('${d.id}')">Archivia</button>`:''}</div></article></details>`).join('')||'<div class="card">Nessun documento corrispondente.</div>'
  };
  $('#documentSearch').oninput=draw;$('#documentTypeFilter').onchange=draw;$('#documentStatusFilter').onchange=draw;draw()
}
function auditSubject(a){const d=a.details?.new||a.details?.old||{};if(a.table_name==='customers')return [d.first_name,d.last_name].filter(Boolean).join(' ');if(a.table_name==='dogs')return d.name||'';if(a.table_name==='dogsitter_services')return d.service_type||'';if(a.table_name==='dogsitter_quotes')return d.customer_name||'';if(a.table_name==='profiles')return d.full_name||d.email||'';return ''}
const auditFieldLabels={status:'Stato',periods:'Periodi',auth_vet:'Autorizzazione veterinaria',auth_transport:'Trasporto veterinario',end_date:'Data fine',start_date:'Data inizio',frequency:'Frequenza',unit_rate:'Tariffa cliente',balance_due:'Residuo',keys_status:'Chiavi affidate',daily_visits:'Prestazioni giornaliere',service_date:'Data servizio',service_time:'Orario indicativo',deposit_amount:'Acconto',deposit_received_at:'Data del bonifico',deposit_date:'Data del bonifico',deposit_payment_method:'Modalità acconto',deposit_method:'Modalità acconto',deposit_reference:'Riferimento acconto',quote_payment_status:'Stato pagamento preventivo',payment_status:'Stato pagamento preventivo',customer_payment_status:'Stato pagamento cliente',customer_amount:'Importo cliente',employee_compensation:'Compenso dipendente',service_type:'Tipo servizio',payment_method:'Metodo di pagamento'};
const auditHiddenFields=new Set(['id','quote_id','service_id','created_by','updated_at','created_at','customer_id','employee_id','dog_id','deleted_by','updated_by','converted_service_id']);
function auditValueLabel(key,value){
  if(value===null||value===undefined||value==='')return 'Non indicato';
  if(key==='periods'&&Array.isArray(value))return value.map((p,i)=>`Periodo ${i+1}: ${dateIT(p.start_date)} – ${dateIT(p.end_date||p.start_date)} · ${Number(p.daily_visits||1)} al giorno`).join('<br>');
  if(['start_date','end_date','service_date','deposit_date','deposit_received_at'].includes(key))return dateIT(value);
  if(['unit_rate','balance_due','deposit_amount','customer_amount','employee_compensation'].includes(key))return money(value);
  if(typeof value==='boolean')return value?'Sì':'No';
  if(typeof value==='object')return 'Dati aggiornati';
  const labels={programmato:'Programmato',in_corso:'In corso',da_verificare:'Da verificare',chiuso:'Chiuso',annullato:'Annullato',da_incassare:'Da incassare',incassato:'Incassato',acconto_ricevuto:'Acconto ricevuto',bozza:'Bozza',inviato:'Inviato',accettato:'Accettato',rifiutato:'Rifiutato'};
  return labels[value]||String(value).replaceAll('_',' ');
}
function auditEventTitle(a){
  const before=a.details?.old||{},after=a.details?.new||{};
  if(a.action==='PAYMENT_SYNC')return Number(before.deposit_amount||0)>0?'Acconto modificato':'Acconto registrato';
  const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
  if(a.table_name==='dogsitter_services'&&changed.length===1&&changed[0]==='quote_id')return 'Preventivo collegato al servizio';
  if(changed.includes('deposit_amount')||changed.includes('balance_due')||changed.includes('deposit_received_at')||changed.includes('deposit_payment_method'))return Number(before.deposit_amount||0)>0?'Acconto modificato':'Acconto registrato';
  const tableNames={customers:'Cliente',dogs:'Animale',dogsitter_services:'Servizio',dogsitter_quotes:'Preventivo',profiles:'Utente'};
  const actionNames={INSERT:'Creato',UPDATE:'Modificato',DELETE:'Archiviato',PAYMENT_SYNC:'Sincronizzato pagamento'};
  const obj=tableNames[a.table_name]||a.table_name||'Elemento',subject=auditSubject(a);
  return `${actionNames[a.action]||a.action} ${obj.toLowerCase()}${subject?`: ${subject}`:''}`;
}
function auditDetails(a){
  const before=a.details?.old||{},after=a.details?.new||{};
  const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!auditHiddenFields.has(k));
  const changed=keys.filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k])&&after[k]!==undefined);
  const rows=(a.action==='UPDATE'||a.action==='PAYMENT_SYNC'?changed:keys.filter(k=>after[k]!==undefined&&after[k]!==null&&after[k]!=='' )).slice(0,18);
  if(a.table_name==='dogsitter_services'&&Object.keys(after).includes('quote_id')&&rows.length===0)return '<div class="audit-change"><span>Collegamento</span><strong>Preventivo collegato correttamente al servizio</strong></div>';
  if(!rows.length)return '';
  return rows.map(k=>{const label=auditFieldLabels[k]||k.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase());const oldVal=auditValueLabel(k,before[k]);const newVal=auditValueLabel(k,after[k]);const showArrow=(a.action==='UPDATE'||a.action==='PAYMENT_SYNC')&&before[k]!==undefined&&before[k]!==null&&before[k]!==''&&String(before[k])!=='0'&&String(before[k])!=='0.00';return `<div class="audit-change"><span>${esc(label)}</span><strong>${showArrow?`${oldVal} <b aria-hidden="true">→</b> ${newVal}`:newVal}</strong></div>`}).join('');
}
async function renderAudit(){
  const clearBtn=$('#clearAuditLog');clearBtn?.classList.toggle('hidden',!isOwner());if(clearBtn)clearBtn.onclick=clearAuditLog;
  const rows=await select('audit_log','select=*&order=created_at.desc&limit=250');
  const displayRows=rows.map(a=>({...a,__details:auditDetails(a)}));
  $('#auditList').innerHTML=displayRows.map(a=>{const who=state.profiles.find(p=>p.id===a.user_id)?.full_name||'Automazione di sistema',details=a.__details||'<div class="audit-change"><span>Dettagli</span><strong>Nessun dettaglio aggiuntivo disponibile.</strong></div>',detailId=`audit-detail-${a.id}`;return `<details class="record-accordion audit-accordion"><summary><div class="record-summary-main"><span class="record-title">${esc(auditEventTitle(a))}</span><small>${new Date(a.created_at).toLocaleString('it-IT')}</small></div><span class="pill">${esc(who)}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><article class="record-expanded"><button type="button" onclick="toggleAuditDetails('${detailId}',this)">Mostra dettagli</button><div id="${detailId}" class="audit-friendly hidden">${details}</div></article></details>`}).join('')||'<div class="card">Nessuna attività registrata.</div>'
}
async function clearAuditLog(){if(!isOwner())return;const first=confirm('Vuoi azzerare definitivamente tutto il Registro attività? Questa operazione non può essere annullata.');if(!first)return;const typed=prompt('Per confermare scrivi AZZERA');if(typed!=='AZZERA'){toast('Operazione annullata');return}const btn=$('#clearAuditLog');try{if(btn){btn.disabled=true;btn.textContent='Azzeramento...'}const result=await rpc('clear_audit_log');const remaining=await select('audit_log','select=id&limit=1');if(remaining.length)throw Error('Il database non ha cancellato tutte le registrazioni. Riesegui la migrazione 4.1.1 in Supabase.');await renderAudit();const deleted=typeof result==='number'?result:(result?.deleted_count??null);toast(deleted===null?'Registro attività azzerato definitivamente':`Registro azzerato: ${deleted} voci eliminate`)}catch(e){console.error('Errore azzeramento registro:',e);toast(e.message||'Impossibile azzerare il Registro attività')}finally{if(btn){btn.disabled=false;btn.textContent='Azzera definitivamente'}}}
function passCode(p){if(p.employee_code)return p.employee_code;const suffix=String(p.id||'').replace(/-/g,'').slice(-6).toUpperCase();return p.is_owner||p.role==='owner'?`K9-TIT-${suffix||'000001'}`:`K9-${suffix||'000001'}`}
function passValidity(p){if(p.is_owner||p.role==='owner')return 'Illimitata';return p.pass_expires_at?dateIT(p.pass_expires_at):'Da definire'}
function passIssued(p){return p.pass_issued_at?dateIT(p.pass_issued_at):(p.created_at?new Date(p.created_at).toLocaleDateString('it-IT'):'—')}
function qrImageUrl(value){return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(value)}`}
function renderPass(){const p=state.profile;const code=passCode(p);const verifyPayload=`K9PASS|${code}|${p.active?'ATTIVO':'SOSPESO'}`;const adminActions=isAdmin()?`<div class="pass-actions"><button type="button" class="primary" onclick="downloadPassPdf()">Scarica PDF</button><button type="button" onclick="sharePassPdf()">Condividi PDF</button><button type="button" onclick="sharePass()">Condividi dati pass</button><button type="button" onclick="openCurrentProfile()">Modifica dati pass</button></div><p class="muted pass-note">Per modificare foto, codice, qualifica o scadenza usa “Modifica dati pass”.</p>`:'';$('#passCard').innerHTML=`<div class="pass-shell"><article id="printablePass" class="pass pass-professional"><div class="pass-topline"><span>PASS IDENTIFICATIVO</span><span class="pass-status ${p.active?'is-active':'is-suspended'}">${p.active?'ATTIVO':'SOSPESO'}</span></div><div class="pass-head"><div class="pass-photo"><img src="${esc(p.photo_url||identityLogo())}" alt="Foto o logo"></div><div class="pass-person"><small>${esc(state.settings.organization_name||DEFAULT_SETTINGS.organization_name)}</small><h2>${esc(p.full_name||p.email)}</h2><p>${esc(p.qualification||roleLabels[p.role]||p.role)}</p></div></div><div class="pass-data"><div><span>Codice</span><strong>${esc(code)}</strong></div><div><span>Emissione</span><strong>${esc(passIssued(p))}</strong></div><div><span>Validità</span><strong>${esc(passValidity(p))}</strong></div><div><span>Ruolo</span><strong>${esc(roleLabels[p.role]||p.role)}</strong></div></div><div class="pass-verification"><img src="${qrImageUrl(verifyPayload)}" alt="QR di verifica del pass" crossorigin="anonymous"><div><span>Codice di verifica</span><strong>${esc(code)}</strong><small>Scansiona per verificare codice e stato del pass.</small></div></div></article>${adminActions}</div>`}
window.sharePass=async()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');const p=state.profile,code=passCode(p);const text=`${state.settings.organization_name||DEFAULT_SETTINGS.organization_name}\n${p.full_name||p.email}\n${roleLabels[p.role]||p.role}\nCodice: ${code}\nStato: ${p.active?'ATTIVO':'SOSPESO'}\nValidità: ${passValidity(p)}`;try{if(navigator.share)await navigator.share({title:'Pass K9',text});else{await navigator.clipboard.writeText(text);toast('Dati del pass copiati')}}catch(e){if(e.name!=='AbortError')toast('Condivisione non disponibile')}};
window.openCurrentProfile=()=>{if(!isAdmin())return toast('Funzione non disponibile per il dipendente');openEmployee(state.profile.id)};
function modal(title,html,onSave){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;const errorBox=$('#modalError');const save=$('#modalSave');if(errorBox){errorBox.textContent='';errorBox.classList.add('hidden')}if(save){save.classList.remove('hidden');save.disabled=false;save.textContent='Salva'}$('#modal').showModal();$('#modalForm').onsubmit=async e=>{e.preventDefault();if(e.submitter?.value==='cancel')return $('#modal').close();try{if(errorBox){errorBox.textContent='';errorBox.classList.add('hidden')}if(save){save.disabled=true;save.textContent='Salvataggio...'}await onSave(new FormData(e.currentTarget));$('#modal').close();await loadAll();render($$('.screen:not(.hidden)')[0]?.id||'dashboard');toast('Salvato')}catch(err){const message=err?.message||String(err)||'Operazione non riuscita';console.error('Errore modale:',err);if(errorBox){errorBox.textContent=message;errorBox.classList.remove('hidden');errorBox.scrollIntoView({behavior:'smooth',block:'center'})}toast(message)}finally{if(save){save.disabled=false;save.textContent='Salva'}}}}
const field=(n,l,v='',type='text',extra='')=>`<label>${l}<input name="${n}" type="${type}" value="${esc(v)}" ${extra}></label>`;
const areaField=(n,l,v='',wide=true)=>`<label class="${wide?'wide':''}">${l}<textarea name="${n}">${esc(v||'')}</textarea></label>`;
const selectField=(n,l,options,value='',wide=false,placeholder='Seleziona')=>`<label class="${wide?'wide':''}">${l}<select name="${n}"><option value="">${placeholder}</option>${options.map(o=>{const val=typeof o==='string'?o:o.value;const text=typeof o==='string'?o:o.label;return `<option value="${esc(val)}" ${String(val)===String(value||'')?'selected':''}>${esc(text)}</option>`}).join('')}</select></label>`;
const formSection=(title,subtitle,content,open=false)=>`<details class="data-form-section" ${open?'open':''}><summary><span>${esc(title)}</span><small>${esc(subtitle)}</small></summary><div class="form-grid">${content}</div></details>`;

const emergencyTypes=['Familiare convivente','Familiare non convivente','Amico / referente','Veterinario','Clinica veterinaria','Altro referente'];
const availabilityOptions=['Sempre reperibile','Reperibile solo mattina','Reperibile solo pomeriggio','Reperibile solo sera','Non sempre reperibile','Da concordare'];
const animalTypes=['Cane','Gatto','Coniglio','Uccello','Altro'];
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
    ${formSection('Identificazione','Dati anagrafici e veterinario',`${field('name','Nome',d.name,'text','required')}<label>Proprietario<select name="customer_id" required><option value="">Seleziona proprietario</option>${state.customers.map(c=>`<option value="${c.id}" ${c.id===d.customer_id?'selected':''}>${esc(c.first_name+' '+c.last_name)}</option>`).join('')}</select></label>${selectField('animal_type','Tipo animale',animalTypes,d.animal_type||'Cane')}${selectField('breed_type','Razza / tipologia',breedTypes,d.breed_type)}${field('breed_detail','Dettaglio razza / tipologia',d.breed_detail||d.breed)}${selectField('size','Taglia',sizeOptions,d.size)}${selectField('age_range','Fascia età',ageOptions,d.age_range)}${field('age_detail','Età precisa',d.age_detail)}${field('weight_detail','Peso indicativo',d.weight_detail)}${selectField('sex','Sesso',sexOptions,d.sex)}${selectField('sterilized','Sterilizzato / castrato',yesNoUnknown,d.sterilized)}${selectField('microchip_status','Microchip',['Presente','Non presente','Non so','Da verificare'],d.microchip_status)}${field('microchip_number','Numero microchip',d.microchip_number||d.microchip)}${selectField('vet_status','Veterinario',vetOptions,d.vet_status)}${field('vet_name','Nome veterinario / clinica',d.vet_name)}${field('vet_phone','Telefono veterinario / clinica',d.vet_phone,'tel')}`,true)}
    ${formSection('Salute e sicurezza','Vaccinazioni, patologie, allergie e terapie',`${selectField('vaccines','Vaccinazioni',vaccineOptions,d.vaccines)}${selectField('parasites','Antiparassitario',parasiteOptions,d.parasites)}${selectField('illnesses','Patologie note',illnessOptions,d.illnesses)}${areaField('illnesses_detail','Dettaglio patologie',d.illnesses_detail)}${selectField('allergies','Allergie',allergyOptions,d.allergies)}${areaField('allergies_detail','Dettaglio allergie',d.allergies_detail)}${selectField('medicines','Farmaci / terapie',medicineOptions,d.medicines)}${areaField('medicines_detail','Dettaglio farmaci / dosaggio',d.medicines_detail)}${selectField('health_risk','Livello rischio sanitario',riskOptions,d.health_risk)}`)}
    ${formSection('Alimentazione e routine','Pasti, premi e regole domestiche',`${selectField('food_type','Tipo alimentazione',foodOptions,d.food_type)}${field('food_detail','Marca / alimento / note dieta',d.food_detail)}${selectField('meals','Numero pasti',mealOptions,d.meals)}${field('meal_times','Orari pasti',d.meal_times)}${selectField('treats','Premi alimentari',treatOptions,d.treats)}${areaField('treats_detail','Premi consentiti / vietati',d.treats_detail)}${selectField('home_rules','Regole domestiche',homeRuleOptions,d.home_rules)}${areaField('home_rules_detail','Dettaglio regole domestiche',d.home_rules_detail)}${areaField('routine_notes','Routine quotidiana',d.routine_notes)}`)}
    ${formSection('Comportamento','Socialità, paure e criticità',`${selectField('character','Carattere generale',characterOptions,d.character)}${selectField('adults','Con adulti',socialOptions,d.adults)}${selectField('children','Con bambini',childrenOptions,d.children)}${selectField('dogs_social','Con altri cani',socialOptions,d.dogs_social)}${selectField('fears','Paure / fobie',fearOptions,d.fears)}${areaField('fears_detail','Dettaglio paure / fobie',d.fears_detail)}${selectField('bite_history','Storico morsi',biteOptions,d.bite_history)}${areaField('bite_history_detail','Dettaglio episodio morso / pinzata',d.bite_history_detail)}${selectField('resource_guarding','Possessività',guardingOptions,d.resource_guarding)}${areaField('resource_guarding_detail','Dettaglio possessività',d.resource_guarding_detail)}${areaField('behavior_notes','Altre note comportamentali',d.behavior_notes)}`)}
    ${formSection('Passeggiata','Attrezzatura, reazioni e aree da evitare',`${selectField('equipment','Attrezzatura usata',equipmentOptions,d.equipment)}${field('equipment_detail','Dettaglio attrezzatura / taglia',d.equipment_detail)}${selectField('dog_triggers','Reazione ad altri cani',dogTriggerOptions,d.dog_triggers)}${selectField('moving_triggers','Reazione a bici / auto / runner',movingTriggerOptions,d.moving_triggers)}${selectField('avoid_areas','Zone da evitare',avoidOptions,d.avoid_areas)}${areaField('avoid_areas_detail','Dettaglio zone da evitare',d.avoid_areas_detail)}${selectField('off_leash','Libero dal guinzaglio',offLeashOptions,d.off_leash)}${selectField('walk_level','Livello gestione passeggiata',walkLevelOptions,d.walk_level)}`)}
  </div>`;
  modal(id?'Modifica animale':'Nuovo animale',html,async f=>{
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
    <label>Animale<select id="serviceDog" name="dog_id" required><option value="">Seleziona animale</option></select></label>
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
    if(!payload.customer_id||!payload.dog_id||!payload.employee_id)throw Error('Seleziona cliente, animale e dipendente.');if(!payload.service_type)throw Error('Indica il tipo di servizio.');const dog=state.dogs.find(d=>d.id===payload.dog_id);if(!dog||dog.customer_id!==payload.customer_id)throw Error('L’animale selezionato non appartiene al cliente.');if(payload.employee_compensation>payload.customer_amount)throw Error('Il compenso dipendente non può superare l’importo cliente.');if(payload.payment_method!=='Altro')payload.payment_method_other=null;
    const sourceQuoteId=service.quote_id||null;
    if(sourceQuoteId){const sourceQuote=state.quotes.find(q=>q.id===sourceQuoteId);payload.quote_id=sourceQuoteId;if(sourceQuote){payload.customer_amount=Number(sourceQuote.total_amount||payload.customer_amount||0);payload.deposit_amount=Number(sourceQuote.deposit_amount||0);payload.deposit_received_at=sourceQuote.deposit_received_at||null;payload.deposit_payment_method=sourceQuote.deposit_payment_method||null;payload.deposit_reference=sourceQuote.deposit_reference||null;payload.balance_due=Number(sourceQuote.balance_due??Math.max(0,Number(sourceQuote.total_amount||0)-Number(sourceQuote.deposit_amount||0)));payload.quote_payment_status=sourceQuote.payment_status||null;payload.customer_payment_status=payload.balance_due<=0?'incassato':'da_incassare';payload.payment_method=sourceQuote.payment_terms||payload.payment_method;}}
    let savedService;
    if(id){savedService=await update('dogsitter_services',id,payload)}else{savedService=await insert('dogsitter_services',payload)}
    if(sourceQuoteId&&!id){
      const created=Array.isArray(savedService)?savedService[0]:savedService;
      if(!created?.id)throw Error('Il servizio non è stato creato correttamente: identificativo mancante.');
      await update('dogsitter_quotes',sourceQuoteId,{status:'accettato',converted_service_id:created.id});
      try{await rpc('sync_quote_financials',{p_quote_id:sourceQuoteId})}catch(err){console.warn('Sincronizzazione economica preventivo:',err?.message||err)}
      const check=await select('dogsitter_services',`select=id,deleted_at&id=eq.${encodeURIComponent(created.id)}&limit=1`);
      if(!Array.isArray(check)||!check[0]||check[0].deleted_at)throw Error('Il servizio è stato salvato ma non risulta disponibile nell’elenco Servizi.');
    }
  });
  const customer=$('#serviceCustomer'),dog=$('#serviceDog'),employee=$('#serviceEmployee');const fillDogs=()=>{const dogs=state.dogs.filter(d=>d.customer_id===customer.value);dog.innerHTML='<option value="">Seleziona animale</option>'+dogs.map(d=>`<option value="${d.id}" ${d.id===service.dog_id?'selected':''}>${esc(d.name)}</option>`).join('');if(!id&&dogs.length===1)dog.value=dogs[0].id;const assigned=state.customers.find(c=>c.id===customer.value)?.assigned_employee_id;if(!id&&assigned&&employees.some(p=>p.id===assigned))employee.value=assigned};customer.onchange=fillDogs;fillDogs();
  const toggleCustom=()=>{const on=$('#serviceType').value==='Altro servizio';$('#customServiceTypeWrap').classList.toggle('hidden',!on);$('#customServiceType').required=on};$('#serviceType').onchange=toggleCustom;toggleCustom();
  window.recalculateServiceTotals=()=>{const periods=readPeriodRows('service'),totals=periodsTotals(periods),rate=Number($('#serviceUnitRate')?.value||0),discount=Number($('#serviceDiscount')?.value||0),customerTotal=rate*totals.visits*(1-discount/100),employeeUnit=Number($('#serviceEmployeeUnitCompensation')?.value||0),employeeTotal=employeeUnit*totals.visits;if($('#serviceCalcPreview'))$('#serviceCalcPreview').textContent=`Cliente ${money(customerTotal)}`;if($('#serviceEmployeeCalcPreview'))$('#serviceEmployeeCalcPreview').textContent=`Dipendente ${money(employeeTotal)} · ${totals.visits} ${totals.visits===1?'uscita':'uscite'}`;if($('#servicePeriodsSummary'))$('#servicePeriodsSummary').textContent=`${totals.days} giorni complessivi · ${totals.visits} uscite totali`;if($('#serviceCustomerAmount'))$('#serviceCustomerAmount').value=customerTotal.toFixed(2);$('#serviceEmployeeCompensation').value=employeeTotal.toFixed(2)};['serviceUnitRate','serviceEmployeeUnitCompensation','serviceDiscount'].forEach(fieldId=>{const el=$('#'+fieldId);if(el){el.oninput=recalculateServiceTotals;el.onchange=recalculateServiceTotals}});bindPeriodRows('service');recalculateServiceTotals();
  const toggleKeys=()=>$('#serviceKeysModeWrap').classList.toggle('hidden',!['Sì','Da concordare'].includes($('#serviceKeys').value));$('#serviceKeys').onchange=toggleKeys;toggleKeys();
  const togglePayment=()=>$('#servicePaymentOtherWrap').classList.toggle('hidden',$('#servicePayment').value!=='Altro');$('#servicePayment').onchange=togglePayment;togglePayment();
};
window.openEmployee=id=>{const p=state.profiles.find(x=>x.id===id);if(!p)return;const ownerLocked=p.is_owner&&!isOwner(),code=passCode(p),verifyPayload=`K9PASS|${code}|${p.active?'ATTIVO':'SOSPESO'}`,canResetPassword=!p.is_owner&&(isOwner()||(state.profile?.role==='vice_admin'&&p.role==='dipendente'));modal('Gestisci account',`<div class="account-pass-media"><div class="account-photo-box"><img id="profilePhotoPreview" src="${esc(p.photo_url||identityLogo())}" alt="Foto tesserino"><label class="photo-upload-button">Aggiungi o cambia foto<input id="profilePhotoFile" type="file" accept="image/jpeg,image/png,image/webp" onchange="previewProfilePhoto(event)"></label></div><div class="account-qr-box"><img src="${qrImageUrl(verifyPayload)}" alt="QR tesserino"><span>QR del tesserino</span></div></div><div class="form-grid">${field('full_name','Nome completo',p.full_name,'text','required')}${field('employee_code','Codice',p.employee_code)}${field('qualification','Qualifica',p.qualification)}${field('pass_expires_at','Scadenza pass',p.pass_expires_at||'','date')}<label>Ruolo<select name="role" ${ownerLocked?'disabled':''}><option value="dipendente" ${p.role==='dipendente'?'selected':''}>Dipendente</option><option value="vice_admin" ${p.role==='vice_admin'?'selected':''}>Vice amministratore</option>${p.is_owner?'<option value="owner" selected>Datore di lavoro</option>':''}</select></label><label>Stato<select name="active" ${ownerLocked?'disabled':''}><option value="true" ${p.active?'selected':''}>Attivo</option><option value="false" ${!p.active?'selected':''}>Sospeso</option></select></label></div>${canResetPassword?`<div class="settings-block"><h3>Credenziali di accesso</h3><p class="muted">Email e password sono gestite dall'amministrazione. L'utente non può modificarle dall'app.</p><button type="button" onclick="openPasswordReset('${id}')">Imposta nuova password</button></div>`:''}`,async f=>{const x=Object.fromEntries(f);x.active=x.active==='true';if(p.is_owner&&!isOwner())throw Error('Il titolare può essere modificato solo dal titolare.');await rpc('admin_update_profile',{p_user_id:id,p_full_name:x.full_name,p_employee_code:x.employee_code||null,p_qualification:x.qualification||null,p_pass_expires_at:x.pass_expires_at||null,p_role:x.role||p.role,p_active:x.active});const photoFile=$('#profilePhotoFile')?.files?.[0];if(photoFile){const photoUrl=await uploadProfilePhoto(id,photoFile);await rpc('set_profile_photo',{p_user_id:id,p_photo_url:photoUrl})}await loadAll();if(state.profile.id===id)renderPass()})};
window.generateSecureUserPassword=()=>{const lower='abcdefghjkmnpqrstuvwxyz',upper='ABCDEFGHJKMNPQRSTUVWXYZ',digits='23456789',symbols='!@#$%*-_';const pick=x=>x[Math.floor(Math.random()*x.length)];let chars=[pick(lower),pick(upper),pick(digits),pick(symbols)];const all=lower+upper+digits+symbols;while(chars.length<14)chars.push(pick(all));for(let i=chars.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[chars[i],chars[j]]=[chars[j],chars[i]]}const value=chars.join('');const a=document.querySelector('#modalForm [name="password"]'),b=document.querySelector('#modalForm [name="confirm_password"]');if(a)a.value=value;if(b)b.value=value;toast('Password sicura generata')};
window.toggleResetPasswordVisibility=()=>{const fields=[...document.querySelectorAll('#modalForm [name="password"],#modalForm [name="confirm_password"]')];const show=fields.some(el=>el.type==='password');fields.forEach(el=>el.type=show?'text':'password');const btn=document.getElementById('toggleResetPassword');if(btn)btn.textContent=show?'Nascondi password':'Mostra password'};
window.openPasswordReset=id=>{const p=state.profiles.find(x=>x.id===id);if(!p)return toast('Utente non trovato');if(p.is_owner)return toast('La password del titolare non può essere modificata da questa funzione');if(state.profile?.role==='vice_admin'&&p.role!=='dipendente')return toast('Il Vice Amministratore può reimpostare solo password dei dipendenti');modal('Reimposta password',`<p><b>${esc(p.full_name||p.email)}</b></p><p class="muted">La nuova password sostituirà immediatamente quella precedente. Comunicala all'utente con un canale sicuro.</p><div class="form-grid">${field('password','Nuova password','','password','minlength="8" autocomplete="new-password" required')}${field('confirm_password','Conferma password','','password','minlength="8" autocomplete="new-password" required')}</div><div class="card-actions"><button type="button" onclick="generateSecureUserPassword()">Genera password sicura</button><button id="toggleResetPassword" type="button" onclick="toggleResetPasswordVisibility()">Mostra password</button></div><div class="protected-note">La password non viene salvata nel database dell'app né mostrata nel Registro attività.</div>`,async f=>{const x=Object.fromEntries(f);if(x.password!==x.confirm_password)throw Error('Le password non coincidono');if(String(x.password||'').length<8)throw Error('La password deve contenere almeno 8 caratteri');if(!confirm(`Confermi la reimpostazione della password per ${p.full_name||p.email}?`))throw Error('Operazione annullata');const r=await invokeHyperHandler({action:'reset_password',user_id:id,password:x.password});await refreshNotifications({system:false});toast(r.message||'Password aggiornata correttamente')})};
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
  const quoteDocs=table==='dogsitter_quotes'?state.documents.filter(d=>d.source_kind==='quote'&&d.quote_id===id&&d.storage_path):[];
  await rpc('purge_entity',{p_table:table,p_id:id});
  for(const doc of quoteDocs){
    const response=await fetch(`${C.SUPABASE_URL}/storage/v1/object/service-documents/${doc.storage_path}`,{method:'DELETE',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`}});
    if(!response.ok&&response.status!==404)console.warn('PDF orfano da rimuovere manualmente:',doc.storage_path,await response.text());
  }
  await loadAll();
  await renderTrash();
  toast('Elemento eliminato definitivamente');
};
function periodRunFor(serviceId,index){return (state.periodRuns||[]).find(r=>r.service_id===serviceId&&Number(r.period_index)===Number(index))}
function periodRunLabel(status){return ({programmato:'Programmato',in_corso:'In corso',da_verificare:'Da verificare',chiuso:'Chiuso',annullato:'Annullato'}[status]||status||'Programmato')}
function mergePeriodRun(run){
  if(!run?.service_id||run.period_index===undefined||run.period_index===null)return;
  const keyIndex=Number(run.period_index);
  state.periodRuns=(state.periodRuns||[]).filter(r=>!(r.service_id===run.service_id&&Number(r.period_index)===keyIndex));
  state.periodRuns.push(run);
}
window.startServicePeriod=async(serviceId,index)=>{
  if(!confirm(`Iniziare il periodo ${Number(index)+1}? Il comando riguarda l’intero intervallo di date, non le singole uscite.`))return;
  try{
    const saved=await rpc('start_service_period',{p_service_id:serviceId,p_period_index:Number(index)});
    mergePeriodRun(saved);
    renderServices();
    await loadAll();
    const refreshed=(state.periodRuns||[]).find(r=>r.service_id===serviceId&&Number(r.period_index)===Number(index));
    if(!refreshed||refreshed.status!=='in_corso')mergePeriodRun(saved);
    renderServices();
    toast('Periodo iniziato');
  }catch(e){toast(e.message||'Avvio periodo non riuscito')}
};
window.endServicePeriod=(serviceId,index)=>modal(`Termina periodo ${Number(index)+1}`,`<div class="form-grid"><label class="wide">Resoconto del periodo<textarea name="report" placeholder="Riepilogo del periodo concluso"></textarea></label><label class="wide">Anomalie o note<textarea name="incident"></textarea></label></div><p class="muted">La chiusura riguarda l’intero periodo selezionato. Orari e uscite giornaliere non vengono avviati o terminati singolarmente.</p>`,async f=>{
  const saved=await rpc('end_service_period',{p_service_id:serviceId,p_period_index:Number(index),p_report_text:f.get('report')||null,p_incident_notes:f.get('incident')||null});
  mergePeriodRun(saved);
  renderServices();
  await loadAll();
  const refreshed=(state.periodRuns||[]).find(r=>r.service_id===serviceId&&Number(r.period_index)===Number(index));
  if(!refreshed||refreshed.status!=='da_verificare')mergePeriodRun(saved);
  renderServices();
  toast('Periodo terminato e inviato alla verifica')
});
window.verifyServicePeriod=async(serviceId,index)=>{if(!isAdmin())return toast('Operazione riservata al Titolare/Vice.');if(!confirm(`Verificare e chiudere il periodo ${Number(index)+1}? Il compenso di questo periodo diventerà maturato e da liquidare.`))return;try{const saved=await rpc('verify_service_period',{p_service_id:serviceId,p_period_index:Number(index)});mergePeriodRun(saved);await loadAll();renderServices();renderPayments();toast(`Periodo verificato. Compenso maturato: ${money(saved?.employee_amount||0)}`)}catch(e){toast(e.message||'Verifica periodo non riuscita')}};
window.openPeriodAdminIntervention=(serviceId,index,status)=>{if(!isAdmin())return toast('Operazione riservata al Titolare/Vice.');const action=status==='in_corso'?'terminare':'avviare';modal('Intervento amministrativo',`<div class="modal-inline-error">Usa questa funzione solo in caso eccezionale.</div><p>Stai per <b>${action}</b> il periodo ${Number(index)+1} al posto del dipendente.</p><p class="muted">L’operazione sarà registrata con il tuo utente.</p><div class="service-actions"><button type="button" class="primary" id="periodAdminConfirm">Conferma intervento</button></div>`,async()=>{});$('#modalSave')?.classList.add('hidden');setTimeout(()=>{const b=$('#periodAdminConfirm');if(!b)return;b.onclick=()=>{if(status==='in_corso'){endServicePeriod(serviceId,index)}else{startServicePeriod(serviceId,index)}}},0)};
function icsEscape(value){return String(value??'').replaceAll('\\','\\\\').replaceAll('\r','').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function icsDate(value){return String(value||'').replaceAll('-','')}
function icsNextDate(value){const d=parseLocalDate(value);if(!d)return '';d.setDate(d.getDate()+1);return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`}
function icsUtcStamp(){return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}
function calendarDays(startDate,endDate){const start=parseLocalDate(startDate),end=parseLocalDate(endDate||startDate);if(!start||!end||end<start)return[];const days=[];for(const current=new Date(start);current<=end;current.setDate(current.getDate()+1)){days.push(`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}-${String(current.getDate()).padStart(2,'0')}`)}return days}
function assignedServiceCalendarFile(service){
  const periods=normalizePeriods(service),stamp=icsUtcStamp(),customer=cname(service.customer_id),dog=dname(service.dog_id),title=[service.service_type||'Servizio',customer,dog].filter(v=>v&&v!=='—').join(' • ');
  const events=[];
  periods.forEach((period,periodIndex)=>{
    calendarDays(period.start_date,period.end_date).forEach((day,dayIndex)=>{
      events.push(['BEGIN:VEVENT',`UID:${service.id}-p${periodIndex+1}-d${icsDate(day)}@k9studio-dogsitter`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${icsDate(day)}`,`DTEND;VALUE=DATE:${icsNextDate(day)}`,`SUMMARY:${icsEscape(title)}`,'STATUS:CONFIRMED','TRANSP:OPAQUE','END:VEVENT'].join('\r\n'))
    })
  });
  const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//K9 Studio Dogsitter//Calendario personale//IT','CALSCALE:GREGORIAN','METHOD:PUBLISH',events.join('\r\n'),'END:VCALENDAR',''].join('\r\n');
  const safeTitle=String(`${service.service_type||'servizio'}-${customer}-${dog}`).replace(/[^a-z0-9àèéìòù_-]+/gi,'-').replace(/^-+|-+$/g,'');
  return {content,fileName:`${safeTitle||'servizio'}-${periods[0]?.start_date||'calendario'}.ics`,eventCount:events.length}
}
window.addAssignedServiceToCalendar=async id=>{
  const service=state.services.find(x=>x.id===id);if(!service)return toast('Servizio non trovato');
  if(isEmployee()&&service.employee_id!==state.profile?.id)return toast('Questo servizio non è assegnato al tuo account.');
  if(!isEmployee()&&!isAdmin())return toast('Operazione non autorizzata.');
  const periods=normalizePeriods(service);if(!periods.length)return toast('Il servizio non contiene periodi validi.');
  try{
    const calendar=assignedServiceCalendarFile(service);if(!calendar.eventCount)return toast('Non risultano date valide da collegare al calendario.');
    const blob=new Blob([calendar.content],{type:'text/calendar;charset=utf-8'}),file=new File([blob],calendar.fileName,{type:'text/calendar'});
    if(navigator.share&&navigator.canShare?.({files:[file]})){
      await navigator.share({title:`Calendario · ${service.service_type||'Servizio'}`,text:`Aggiungi ${calendar.eventCount} eventi giornalieri al calendario personale.`,files:[file]});
      toast(`${calendar.eventCount} eventi inviati al calendario personale.`);
      return
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=calendar.fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);toast(`File calendario creato con ${calendar.eventCount} eventi giornalieri.`)
  }catch(error){if(error?.name==='AbortError')return;toast(error?.message||'Collegamento al calendario non riuscito')}
};
window.viewService=id=>{let s=state.services.find(x=>x.id===id);if(!s)return toast('Servizio non trovato');s=serviceFinancialData(s);const total=totalVisits(s),unit=Number(s.employee_unit_compensation||0)||Number(s.employee_compensation||0)/Math.max(1,total);const operational=`<div class="entity-details"><p><span>Cliente</span><strong>${esc(cname(s.customer_id))}</strong></p><p><span>Animale</span><strong>${esc(dname(s.dog_id))}</strong></p><p><span>Tipo servizio</span><strong>${esc(s.service_type||'—')}</strong></p><p class="wide"><span>Periodi</span><strong>${normalizePeriods(s).map((p,i)=>`P${i+1}: ${p.start_date===p.end_date?dateIT(p.start_date):dateIT(p.start_date)+' – '+dateIT(p.end_date)} · ${p.daily_visits}/giorno · ${periodVisits(p)} uscite`).join('<br>')}</strong></p><p><span>Frequenza</span><strong>${esc(displayValue(s.frequency,'Non indicata'))}</strong></p><p class="wide"><span>Fasce orarie</span><strong>${esc(serviceSlots(s))}</strong></p><p><span>Durata</span><strong>${Number(s.planned_duration_minutes||0)} minuti</strong></p><p><span>Uscite giornaliere</span><strong>${Number(s.daily_visits||1)}</strong></p><p><span>Uscite totali</span><strong>${total}</strong></p><p><span>Stato</span><strong>${esc(statusLabels[s.status]||s.status)}</strong></p><p><span>Chiavi affidate</span><strong>${esc(displayValue(s.keys_status))}</strong></p><p><span>Consegna chiavi</span><strong>${esc(displayValue(s.keys_mode))}</strong></p><p><span>Aggiornamenti proprietario</span><strong>${esc(displayValue(s.customer_updates))}</strong></p><p><span>Contatto veterinario</span><strong>${esc(displayValue(s.auth_vet))}</strong></p><p class="wide"><span>Trasporto in clinica</span><strong>${esc(displayValue(s.auth_transport))}</strong></p><p class="wide"><span>Note operative</span><strong>${esc(s.operational_notes||'Nessuna nota')}</strong></p>${s.report_text?`<p class="wide"><span>Rapporto</span><strong>${esc(s.report_text)}</strong></p>`:''}${s.incident_notes?`<p class="wide"><span>Anomalie</span><strong>${esc(s.incident_notes)}</strong></p>`:''}`;const adminPeriodEconomics=isAdmin()?`<div class="service-period-economics wide"><strong>Riepilogo economico periodi</strong>${normalizePeriods(s).map((p,i)=>`<div><span>P${i+1} · ${periodVisits(p)} uscite</span><b>${money(periodClientTotal(p,Number(s.unit_rate||0)||Number(s.customer_amount||0)/Math.max(1,total)))}</b></div>`).join('')}<div><span>Totale cliente</span><b>${money(s.customer_amount)}</b></div></div>`:'';const economics=isAdmin()?`<p><span>Dipendente</span><strong>${esc(pname(s.employee_id))}</strong></p><p><span>Importo cliente</span><strong>${money(s.customer_amount)}</strong></p>${Number(s.deposit_amount||0)>0?`<p><span>Acconto ricevuto</span><strong>${money(s.deposit_amount)}</strong></p><p><span>Residuo cliente</span><strong>${money(s.balance_due)}</strong></p><p><span>Modalità acconto</span><strong>${esc(s.deposit_payment_method||'—')}</strong></p>`:''}<p><span>Compenso per uscita</span><strong>${money(unit)}</strong></p><p><span>Compenso totale</span><strong>${money(s.employee_compensation)}</strong></p><p><span>Margine attività</span><strong>${money(Number(s.customer_amount||0)-Number(s.employee_compensation||0))}</strong></p>`:`<p><span>Compenso per uscita</span><strong>${money(unit)}</strong></p><p><span>Compenso totale scheda</span><strong>${money(s.employee_compensation)}</strong></p>`;modal('Dettaglio servizio',operational+adminPeriodEconomics+economics+`</div>`,async()=>{});const save=$('#modalSave');if(save)save.classList.add('hidden')};
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
function servicePdfData(service,extra={}){service=serviceFinancialData(service);const docNumber=extra.document_number||(extra.progressive?`${String(extra.progressive).padStart(3,'0')} · V${Number(extra.version||1)}`:`K9-${service.service_date?.replaceAll('-','')||''}-${String(service.id).slice(0,6).toUpperCase()}`);return {...service,...extra,id:service.id,service_id:service.id,customer_name:extra.customer_name||cname(service.customer_id),dog_name:extra.dog_name||dname(service.dog_id),employee_name:extra.employee_name||pname(service.employee_id),document_number:docNumber}}
function downloadBlob(blob,fileName){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
window.closeService=async id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const raw=state.services.find(s=>s.id===id);if(!raw)return toast('Servizio non trovato');
  const s=serviceFinancialData(raw);
  if(s.status==='chiuso')return toast('Il servizio è già chiuso e archiviato.');
  const pending=serviceClosurePendingPeriods(id);
  if(pending.length)return toast(`Completa prima ${pending.map(x=>`P${x.index}: ${periodRunLabel(x.status)}`).join(', ')}.`);
  if(s.customer_payment_status!=='incassato'&&Number(s.balance_due||0)>0)return setCustomerPaid(id,true);
  if(!confirm(`Chiudere definitivamente il servizio di ${cname(s.customer_id)} / ${dname(s.dog_id)}? Il servizio uscirà dalle attività operative e resterà nello storico amministrativo.`))return;
  try{
    await update('dogsitter_services',id,{status:'chiuso',completed_at:new Date().toISOString(),balance_due:0,customer_payment_status:'incassato'});
    await loadAll();
    renderServices();
    renderDashboard();
    toast('Servizio chiuso e archiviato correttamente.');
  }catch(e){toast(e.message||'Chiusura servizio non riuscita')}
};
function serviceClosurePendingPeriods(id){const service=state.services.find(x=>x.id===id);if(!service)return[];const periods=normalizePeriods(service),runs=(state.periodRuns||[]).filter(r=>r.service_id===id);return periods.map((p,i)=>{const run=runs.find(r=>Number(r.period_index)===i);return {index:i+1,start_date:p.start_date,end_date:p.end_date,status:run?.status||'programmato'}}).filter(x=>!['da_verificare','chiuso'].includes(x.status))}
function servicePeriodsReadyForClosure(id){return serviceClosurePendingPeriods(id).length===0}
async function ensureServiceClosedForReceipt(id){const s=state.services.find(x=>x.id===id);if(!s)throw Error('Servizio non trovato');if(s.status==='chiuso')return s;if(!servicePeriodsReadyForClosure(id))throw Error('Prima di emettere la ricevuta devono essere terminati tutti i periodi del servizio.');await update('dogsitter_services',id,{status:'chiuso',completed_at:new Date().toISOString()});await loadAll();return state.services.find(x=>x.id===id)||s}
function receiptDataForService(id,testMode=false,meta={}){
  const rawService=state.services.find(x=>x.id===id);if(!rawService)throw Error('Servizio non trovato');
  const quote=linkedQuoteForService(rawService);
  if(!quote&&!testMode)throw Error('Questo servizio non è collegato a un preventivo. La ricevuta definitiva deve nascere dal preventivo originario.');
  const service=serviceFinancialData(rawService);
  if(!testMode&&service.status!=='chiuso')throw Error('La ricevuta è disponibile solo dopo la chiusura del servizio.');
  if(!testMode&&service.customer_payment_status!=='incassato')throw Error('Prima di emettere la ricevuta, registra il saldo del cliente come incassato.');
  const customer=state.customers.find(x=>x.id===service.customer_id)||{};
  const receiptDate=meta.receipt_date||localDate();
  const quoteDate=quote?.quote_date||service.service_date||receiptDate;
  const year=String(quoteDate||receiptDate).slice(0,4)||String(new Date().getFullYear());
  const quoteProgressive=Number(quote?.progressive||0);
  const quoteNumber=meta.quote_number||(quoteProgressive?`${String(quoteProgressive).padStart(3,'0')}/${year}`:`${String(quote?.id||service.id).slice(0,8).toUpperCase()}/${year}`);
  const receiptNumber=meta.receipt_number||(testMode?(quoteProgressive?`R-${String(quoteProgressive).padStart(3,'0')}/${year}`:`R-${String(quote?.id||service.id).slice(0,8).toUpperCase()}/${year}`):'—');
  const total=Number(meta.total_amount??quote?.total_amount??service.customer_amount??0);
  const deposit=Number(meta.deposit_amount??quote?.deposit_amount??service.deposit_amount??0);
  const saldo=Number(meta.saldo_amount??Math.max(0,total-deposit));
  const periods=quote?normalizePeriods(quote,'quote'):normalizePeriods(service);
  const paymentMethod=meta.payment_method||service.payment_method_other||service.payment_method||quote?.payment_terms||service.deposit_payment_method||quote?.deposit_payment_method||'—';
  return {...service,...meta,quote_id:quote?.id||service.quote_id||null,quote_number:quoteNumber,quote_date:quoteDate,customer_name:meta.customer_name||cname(service.customer_id),dog_name:meta.dog_name||dname(service.dog_id),customer_email:customer.email||'',customer_phone:customer.phone||'',customer_address:[customer.address,customer.postal_code,customer.city].filter(Boolean).join(', '),periods,receipt_date:receiptDate,receipt_number:receiptNumber,total_amount:total,deposit_amount:deposit,saldo_amount:saldo,amount_received:total,payment_method:paymentMethod,deposit_payment_method:quote?.deposit_payment_method||service.deposit_payment_method||null,deposit_received_at:quote?.deposit_received_at||service.deposit_received_at||null,test_mode:!!testMode};
}
async function makeServiceReceipt(id,testMode=false,meta={}){
  if(!window.K9PdfEngine?.createReceiptPdf)throw Error('Motore ricevuta non disponibile. Aggiorna la pagina.');
  return window.K9PdfEngine.createReceiptPdf(receiptDataForService(id,testMode,meta),state.settings||DEFAULT_SETTINGS,identityLogo(),'assets/timbro-firma-ricevuta.jpg?v=1296');
}
async function uploadReceiptDocument(path,blob){const r=await fetch(`${C.SUPABASE_URL}/storage/v1/object/service-documents/${path}`,{method:'POST',headers:{apikey:C.SUPABASE_ANON_KEY,Authorization:`Bearer ${state.session.access_token}`,'Content-Type':'application/pdf','x-upsert':'true'},body:blob});const t=await r.text();if(!r.ok)throw Error(t||'Archiviazione ricevuta non riuscita')}
window.downloadServiceReceiptTest=async id=>{try{if(!isAdmin())throw Error('Funzione riservata ad amministratore e vice amministratore.');const data=receiptDataForService(id,true),blob=await makeServiceReceipt(id,true);downloadBlob(blob,`PROVA_Ricevuta_${String(data.customer_name||'cliente').replace(/[^a-z0-9àèéìòù_-]+/gi,'_')}_${data.receipt_date}.pdf`);toast('Ricevuta di prova generata: nessun dato del servizio è stato modificato')}catch(e){toast(e.message||'Generazione ricevuta di prova non riuscita')}};
window.downloadServiceReceipt=async id=>{try{if(!isAdmin())throw Error('Funzione riservata al titolare o vice amministratore.');const existing=state.documents.find(d=>d.source_kind==='receipt'&&d.service_id===id&&documentIsReady(d));if(existing){await downloadStoredDocument(existing.id);return}await ensureServiceClosedForReceipt(id);const current=state.services.find(x=>x.id===id);if(current?.customer_payment_status!=='incassato')throw Error('Per emettere la ricevuta reale devi prima registrare il saldo cliente come incassato.');const meta=await rpc('create_service_receipt',{p_service_id:id});const blob=await makeServiceReceipt(id,false,meta);await uploadReceiptDocument(meta.storage_path,blob);await rpc('finalize_service_receipt',{p_receipt_id:meta.id});await loadAll();renderServices();downloadBlob(blob,meta.file_name);toast(`Ricevuta ${meta.receipt_number} emessa, archiviata e collegata al servizio`)}catch(e){toast(e.message||'Emissione ricevuta non riuscita')}};
window.shareServiceReceipt=async id=>{try{const existing=state.documents.find(d=>d.source_kind==='receipt'&&d.service_id===id&&d.status!=='archived');if(!existing)throw Error('Prima emetti la ricevuta definitiva.');await shareStoredDocument(existing.id)}catch(e){if(e.name!=='AbortError')toast(e.message||'Condivisione ricevuta non riuscita')}};

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
async function generateArchivedDocument(meta,{download=false}={}){const source=state.services.find(s=>s.id===meta.service_id)||meta,kind=['customer','employee','internal'].includes(meta.document_type)?meta.document_type:'customer',draft=kind==='internal'?{}:pdfDraftFor(meta.service_id,kind),data=reviewedPdfData(source,kind,{...draft,...meta});if(!window.K9PdfEngine?.createServicePdf)throw Error('Motore PDF non disponibile. Aggiorna la pagina.');const blob=await window.K9PdfEngine.createServicePdf(data,kind,state.settings||DEFAULT_SETTINGS,identityLogo());await uploadDocument(meta.storage_path,blob);await rpc('finalize_document_version',{p_document_id:meta.id});if(download)downloadBlob(blob,meta.file_name);return blob}

function pdfDraftFor(serviceId,kind){return (state.pdfDrafts||[]).find(d=>d.service_id===serviceId&&d.document_type===kind)?.draft_data||{}}
async function savePdfDraft(serviceId,kind,data){const existing=(state.pdfDrafts||[]).find(d=>d.service_id===serviceId&&d.document_type===kind);if(existing)await update('service_pdf_drafts',existing.id,{draft_data:data,updated_by:state.profile.id,updated_at:new Date().toISOString()});else await insert('service_pdf_drafts',{service_id:serviceId,document_type:kind,draft_data:data,updated_by:state.profile.id});}
function reviewedPdfData(service,kind,draft={}){service=serviceFinancialData(service);const base=servicePdfData(service);return {...base,...draft,service_id:service.id,document_type:kind,periods:normalizePeriods(service),period_runs:(state.periodRuns||[]).filter(r=>r.service_id===service.id)}}
window.openPdfReviewHub=id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  let s=state.services.find(x=>x.id===id);if(!s)return toast('Servizio non trovato');
  s=serviceFinancialData(s);
  const allReady=s.status==='chiuso'||servicePeriodsReadyForClosure(id);
  const paid=s.customer_payment_status==='incassato'||Number(s.balance_due||0)<=0;
  const pending=!allReady?serviceClosurePendingPeriods(id):[];
  const closed=s.status==='chiuso';
  modal('Documenti e chiusura servizio',`<div class="review-hub">
    <p><b>${esc(cname(s.customer_id))} · ${esc(dname(s.dog_id))}</b></p>
    <p class="muted">${esc(servicePeriod(s))}</p>
    <div class="service-close-summary">
      <div><span>Stato operativo</span><strong>${esc(statusLabels[s.status]||s.status)}</strong></div>
      <div><span>Acconto</span><strong>${money(s.deposit_amount||0)}</strong></div>
      <div><span>Residuo</span><strong>${money(Math.max(0,Number(s.balance_due||0)))}</strong></div>
      <div><span>Pagamento</span><strong>${paid?'Incassato':'Da incassare'}</strong></div>
    </div>
    ${pending.length?`<div class="modal-inline-error"><b>Periodi ancora da completare:</b><br>${pending.map(x=>`P${x.index} · ${dateIT(x.start_date)} – ${dateIT(x.end_date)} · ${periodRunLabel(x.status)}`).join('<br>')}</div>`:''}
    <div class="review-choice-grid">
      ${!closed&&!paid?`<button type="button" class="primary" onclick="setCustomerPaid('${id}',${allReady?'true':'false'})">${allReady?'Registra saldo e chiudi':'Registra saldo cliente'}</button>`:''}
      ${!closed&&paid&&allReady?`<button type="button" class="primary" onclick="closeService('${id}')">Chiudi servizio</button>`:''}
      ${closed?`<button type="button" onclick="downloadClosedServiceDocument('${id}','customer',true)">Documento cliente</button><button type="button" onclick="downloadClosedServiceDocument('${id}','employee',true)">Documento dipendente</button><button type="button" onclick="downloadClosedServiceDocument('${id}','internal',true)">Documento interno</button><button type="button" class="primary-soft" onclick="downloadAllClosedServiceDocuments('${id}')">Scarica tutti e 3 (ZIP)</button>${paid?`<button type="button" class="primary" onclick="downloadServiceReceipt('${id}')">Emetti ricevuta cliente</button>`:''}`:''}
    </div>
    <p class="muted">La chiusura operativa e la situazione economica sono separate: un servizio chiuso resta nello storico. I documenti amministrativi sono visibili solo a Titolare e Vice.</p>
  </div>`,async()=>{});
  $('#modalSave')?.classList.add('hidden');
}
window.approveService=id=>openPdfReviewHub(id);

window.createDocumentVersionFromService=async(id,kind)=>{const labels={customer:'documento cliente',employee:'documento dipendente',internal:'documento interno'};if(!['customer','employee','internal'].includes(kind))return toast('Tipo documento non valido');if(!confirm(`Creare una nuova versione del ${labels[kind]}? Le versioni precedenti resteranno nello storico.`))return;try{const d=await rpc('create_document_version',{p_service_id:id,p_document_type:kind});await generateArchivedDocument(d,{download:true});await loadAll();renderServices();toast(`${labels[kind]} V${d.version} creato`)}catch(e){toast(e.message)}};

function documentIsReady(d){return !!d&&d.status==='generated'&&!!d.storage_path}
function documentProblemMessage(e){
  const m=String(e?.message||e||'');
  if(/Object not found|not found|404/i.test(m))return 'File PDF mancante nello Storage. Rigenera il documento.';
  return m;
}
async function signedDocumentUrl(d){if(!d?.storage_path)throw Error('Percorso documento non disponibile. Rigenera il documento in formato versionato.');const r=await request(`/storage/v1/object/sign/service-documents/${d.storage_path}`,{method:'POST',body:JSON.stringify({expiresIn:600})});return C.SUPABASE_URL+'/storage/v1'+r.signedURL}
window.openDocument=async id=>{try{const d=state.documents.find(x=>x.id===id);if(!d)throw Error('Documento non trovato');if(!documentIsReady(d))throw Error('Documento non completato. Usa Rigenera documento.');window.open(await signedDocumentUrl(d),'_blank','noopener')}catch(e){toast(documentProblemMessage(e))}};
window.downloadStoredDocument=async id=>{try{const d=state.documents.find(x=>x.id===id);if(!d)throw Error('Documento non trovato');if(!documentIsReady(d))throw Error('Documento non completato. Usa Rigenera documento.');const r=await fetch(await signedDocumentUrl(d));if(!r.ok)throw Error(r.status===404?'Object not found':'Download non riuscito');downloadBlob(await r.blob(),d.file_name||'documento.pdf')}catch(e){toast(documentProblemMessage(e))}};
window.shareStoredDocument=async id=>{try{const d=state.documents.find(x=>x.id===id);if(!d)throw Error('Documento non trovato');if(!documentIsReady(d))throw Error('Documento non completato. Usa Rigenera documento.');const r=await fetch(await signedDocumentUrl(d));if(!r.ok)throw Error(r.status===404?'Object not found':'Documento non disponibile');const blob=await r.blob(),file=new File([blob],d.file_name||'documento.pdf',{type:'application/pdf'});if(navigator.canShare?.({files:[file]}))await navigator.share({title:documentTypeLabel(d),files:[file]});else{downloadBlob(blob,file.name);toast('Condivisione file non disponibile: PDF scaricato')}}catch(e){if(e.name!=='AbortError')toast(documentProblemMessage(e))}};
window.regenerateDocument=async id=>{const d=state.documents.find(x=>x.id===id);if(!d)return toast('Documento non trovato');if(d.source_kind==='receipt')return toast('La ricevuta emessa è definitiva e non genera nuove versioni.');if(d.source_kind==='quote')return generateQuoteDocument(d.quote_id);return createDocumentVersionFromService(d.service_id,d.document_type||'customer')};
window.archiveDocument=async id=>{const d=state.documents.find(x=>x.id===id);if(d?.source_kind==='receipt')return toast('Le ricevute emesse restano associate al servizio e non possono essere archiviate da questa schermata.');if(!confirm('Archiviare questo documento? Rimarrà nello storico e non verrà eliminato.'))return;try{await rpc(d?.source_kind==='quote'?'archive_quote_document_version':'archive_document_version',{p_document_id:id});await loadAll();renderDocs();toast('Documento archiviato')}catch(e){toast(e.message)}};
window.markDocumentSent=async id=>{const d=state.documents.find(x=>x.id===id),ch=prompt('Canale di invio: WhatsApp, email o altro','WhatsApp');if(!ch)return;try{if(d?.source_kind==='receipt')await rpc('mark_service_receipt_sent',{p_receipt_id:id,p_channel:ch});else if(d?.source_kind==='quote')await rpc('mark_quote_document_version_sent',{p_document_id:id,p_channel:ch});else if(d?.document_type)await rpc('mark_document_version_sent',{p_document_id:id,p_channel:ch});else throw Error('Documento legacy non aggiornabile: rigenera una nuova versione.');await loadAll();renderDocs();toast('Invio registrato')}catch(e){toast(e.message)}};
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

window.reactivateUser=async(id,name='utente')=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const profile=state.profiles.find(p=>p.id===id);
  if(!profile)return toast('Account non trovato');
  if(profile.is_owner)return toast('Il titolare è già protetto e attivo');
  if(!confirm(`Riattivare l’account di ${name}? L’utente potrà accedere nuovamente.`))return;
  try{
    await rpc('admin_update_profile',{
      p_user_id:id,
      p_full_name:profile.full_name||null,
      p_employee_code:profile.employee_code||null,
      p_qualification:profile.qualification||null,
      p_pass_expires_at:profile.pass_expires_at||null,
      p_role:profile.role,
      p_active:true
    });
    await loadAll();renderEmployees();toast('Account riattivato');
  }catch(error){toast(error?.message||'Riattivazione non riuscita')}
};
window.deleteUserPermanently=async(id,name='utente')=>{
  if(!isOwner())return toast('Solo il Datore di lavoro può eliminare definitivamente un account');
  const profile=state.profiles.find(p=>p.id===id);
  if(!profile)return toast('Account non trovato');
  if(profile.is_owner||profile.role==='owner')return toast('Il titolare non può essere eliminato');
  if(profile.active)return toast('Prima disattiva l’account');
  const confirmation=prompt(`Eliminazione definitiva di ${name}.\n\nQuesta operazione rimuove l’accesso Supabase Auth e il profilo, e non può essere annullata. Se esistono clienti, servizi o comunicazioni collegati, l’eliminazione verrà bloccata.\n\nScrivi ELIMINA per confermare:`,'');
  if(confirmation!=='ELIMINA')return toast('Eliminazione annullata');
  try{
    const result=await invokeHyperHandler({action:'delete_user',user_id:id});
    await loadAll();renderEmployees();toast(result.message||'Account eliminato definitivamente');
  }catch(error){toast(error?.message||'Eliminazione definitiva non riuscita')}
};

window.setCustomerPaid=async(id,closeAfter=false)=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  const rawService=state.services.find(s=>s.id===id);if(!rawService)return toast('Servizio non trovato');
  const quote=linkedQuoteForService(rawService);
  if(!quote)return toast('Il servizio non è collegato a un preventivo: prima regolarizza il collegamento documentale.');
  const total=Number(quote.total_amount??rawService.customer_amount??0),deposit=Number(quote.deposit_amount||0),saldo=Math.max(0,Number(quote.balance_due??(total-deposit)));
  if(saldo<=0){
    await update('dogsitter_services',id,{customer_payment_status:'incassato',balance_due:0,quote_payment_status:'Pagato'});
    await update('dogsitter_quotes',quote.id,{payment_status:'Pagato',balance_due:0});
    await loadAll();
    if(closeAfter&&servicePeriodsReadyForClosure(id))return closeService(id);
    return toast('Il cliente risulta già saldato.');
  }
  const currentMethod=rawService.payment_method_other||rawService.payment_method||quote.payment_terms||'Bonifico';
  modal(closeAfter?'Registra saldo e chiudi servizio':'Registra saldo cliente',`<div class="data-form-stack"><div class="protected-note"><b>Situazione economica</b><br>Totale ${money(total)} · Acconto ${money(deposit)} · Residuo ${money(saldo)}</div><div class="form-grid"><label>Totale preventivo<input value="${money(total)}" readonly></label><label>Acconto già ricevuto<input value="${money(deposit)}" readonly></label><label>Saldo da registrare<input value="${money(saldo)}" readonly></label><label>Modalità saldo<select id="finalPaymentMethod" name="payment_method">${paymentPresets.map(v=>`<option value="${esc(v)}" ${v===currentMethod?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label id="finalPaymentOtherWrap" class="wide ${currentMethod==='Altro'?'':'hidden'}">Altra modalità<input name="payment_method_other" value="${esc(rawService.payment_method_other||'')}"></label></div><p class="muted">${closeAfter?'Confermando, il saldo viene registrato e, se tutti i periodi sono completati, il servizio viene chiuso e spostato nello storico amministrativo.':'Confermando, il pagamento viene aggiornato sia nel servizio sia nel preventivo collegato.'}</p></div>`,async formData=>{
    const x=Object.fromEntries(formData);const method=x.payment_method||'Bonifico';const other=method==='Altro'?String(x.payment_method_other||'').trim():null;if(method==='Altro'&&!other)throw Error('Indica la modalità di pagamento.');
    await update('dogsitter_services',id,{customer_payment_status:'incassato',payment_method:method,payment_method_other:other,balance_due:0,quote_payment_status:'Pagato'});
    await update('dogsitter_quotes',quote.id,{payment_status:'Pagato',balance_due:0});
    try{await rpc('sync_quote_financials',{p_quote_id:quote.id})}catch(err){console.warn('Sincronizzazione economica preventivo/servizio:',err?.message||err)}
    if(closeAfter){
      if(!servicePeriodsReadyForClosure(id))throw Error('Saldo registrato, ma uno o più periodi non risultano ancora completati.');
      await update('dogsitter_services',id,{status:'chiuso',completed_at:new Date().toISOString(),customer_payment_status:'incassato',balance_due:0,quote_payment_status:'Pagato'});
    }
    await loadAll();
    renderPayments();
    renderServices();
    renderDashboard();
    toast(closeAfter?'Saldo registrato e servizio chiuso correttamente.':'Saldo registrato correttamente.');
  });
  setTimeout(()=>{const sel=$('#finalPaymentMethod'),wrap=$('#finalPaymentOtherWrap');if(sel&&wrap)sel.onchange=()=>wrap.classList.toggle('hidden',sel.value!=='Altro')},0);
};

window.setPeriodEmployeePaid=async workflowId=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  if(!confirm('Confermi la liquidazione del compenso relativo a questo periodo?'))return;
  try{const saved=await rpc('liquidate_period_compensation',{p_workflow_id:workflowId});mergePeriodRun(saved);await loadAll();renderPayments();toast(`Compenso del periodo liquidato: ${money(saved?.employee_amount||0)}`)}catch(error){toast(error?.message||'Liquidazione non riuscita')}
};
window.setEmployeePaid=async id=>{
  if(!isAdmin())return toast('Funzione riservata al titolare o vice amministratore');
  try{await update('dogsitter_services',id,{employee_payment_status:'liquidato'});await loadAll();renderPayments();toast('Liquidazione dipendente registrata')}catch(error){toast(error?.message||'Aggiornamento non riuscito')}
};

// I comandi delle schede usano gli handler onclick nativi; nessuna esecuzione dinamica tramite Function().
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#authError').textContent='';try{if(!configured())throw Error('Configura config.js.');await login($('#loginEmail').value.trim(),$('#loginPassword').value)}catch(err){$('#authError').textContent=err.message}});
$('#forgotPassword').addEventListener('click',async()=>{try{$('#authError').textContent='';if(!configured())throw Error('Configura config.js.');await sendPasswordRecoveryEmail()}catch(err){$('#authError').textContent=err.message}});
$('#passwordRecoveryForm').addEventListener('submit',async e=>{e.preventDefault();$('#recoveryError').textContent='';try{const p=$('#recoveryPassword').value,c=$('#recoveryPasswordConfirm').value;if(p.length<8)throw Error('La password deve contenere almeno 8 caratteri.');if(p!==c)throw Error('Le due password non coincidono.');await updateRecoveredPassword(p)}catch(err){$('#recoveryError').textContent=err.message}});
$('#logoutBtn').onclick=logout;$('#nav').onclick=e=>{const b=e.target.closest('[data-screen]');if(b)show(b.dataset.screen)};
$('[data-action="new-customer"]').onclick=()=>isAdmin()?openCustomer():toast('Funzione non disponibile per il dipendente');$('[data-action="new-dog"]').onclick=()=>isAdmin()?openDog():toast('Funzione non disponibile per il dipendente');$('[data-action="new-service"]').onclick=()=>isAdmin()?openService():toast('Funzione non disponibile per il dipendente');$('[data-action="new-employee"]').onclick=()=>isAdmin()?createAccount():toast('Funzione non disponibile per il dipendente');
$('#serviceDateFilter').onchange=renderServices;$('#serviceStatusFilter').onchange=renderServices;$('#clearFilters').onclick=()=>{resetServiceFilters();renderServices()};
if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service Worker:',err)));}
initializePasswordRecovery().then(recoveryActive=>{if(!recoveryActive)restore()}).catch(error=>{$('#authError').textContent=error?.message||'Errore nel recupero password.';restore()});

verifyRuntimeDependencies();
