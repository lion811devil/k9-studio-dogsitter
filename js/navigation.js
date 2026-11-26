'use strict';
// Tutte le schermate storiche restano raggiungibili, raggruppate per attività.
const adminNavigation=[
 ['Home',[['dashboard','Home']]],
 ['Anagrafiche',[['customers','Clienti'],['dogs','Animali']]],
 ['Attività',[['services','Servizi'],['quotes','Preventivi'],['calendar','Calendario']]],
 ['Economia',[['payments','Pagamenti'],['statistics','Statistiche']]],
 ['Archivio',[['documents','Documenti e ricevute']]],
 ['Gestione',[['employees','Utenti'],['profile','Pass'],['settings','Impostazioni'],['audit','Registro'],['trash','Cestino']]]
];
const employeeNavigation=[['Oggi',[['dashboard','Oggi']]],['Servizi',[['services','Servizi'],['customers','Clienti assegnati'],['dogs','Animali assegnati']]],['Compensi',[['compensation','Compensi']]],['Profilo',[['profile','Pass']]]];
const navigationGroups=()=>isAdmin()?adminNavigation:isEmployee()?employeeNavigation:[];
const allowedScreen=id=>!!state.profile&&(id==='notifications'?(isAdmin()||isEmployee()):navigationGroups().some(([,pages])=>pages.some(([key])=>key===id)));
function buildNav(id=$$('.screen:not(.hidden)')[0]?.id||'dashboard'){
 const groups=navigationGroups(),group=groups.find(([,pages])=>pages.some(([key])=>key===id));
 const nav=$('#nav'),sub=$('#subnav'),shortcut=$('#notificationShortcut');
 const unread=unreadCommunicationCount(),unreadN=unreadNotificationCount();
 const oldScroll=nav.scrollLeft;
 const markup=groups.map(([label,pages])=>`<button type="button" data-screen="${pages[0][0]}" class="${pages.some(([key])=>key===id)?'active':''}"${pages.some(([key])=>key===id)?' aria-current="page"':''}>${label}${pages.some(([key])=>key==='services')&&unread?`<span class="nav-notification">${unread}</span>`:''}</button>`).join('');
 if(nav.innerHTML!==markup){nav.innerHTML=markup;nav.scrollLeft=oldScroll;}
 const pages=group?.[1]||[];const subMarkup=pages.length>1?pages.map(([key,label])=>`<button type="button" data-screen="${key}" class="${key===id?'active':''}"${key===id?' aria-current="page"':''}>${label}</button>`).join(''):'';
 if(sub.innerHTML!==subMarkup)sub.innerHTML=subMarkup;
 sub.classList.toggle('hidden',pages.length<=1);
 const text=unreadN?`Avvisi (${unreadN})`:'Avvisi';if(shortcut.textContent!==text)shortcut.textContent=text;shortcut.classList.toggle('active',id==='notifications');
}
