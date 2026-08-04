'use strict';
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
