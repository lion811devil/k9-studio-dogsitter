'use strict';
// Calcoli condivisi; gli importi concordati e registrati restano autorevoli.
const roundMoney=n=>Math.round((Number(n||0)+Number.EPSILON)*100)/100;
const daysInclusive=(start,end)=>{const n=daysBetween(start,end||start);return n===null||n<0?0:n+1};
const totalVisits=s=>periodsTotals(normalizePeriods(s)).visits;
const employeeBillingFactor=s=>s.billing_mode==='ora'?Math.max(0,Number(s.planned_duration_minutes||0))/30:1;
function employeeUnitFor(s,periodUnit){
  const unit=Number(periodUnit??s.employee_unit_compensation??0);
  const units=totalVisits(s)*employeeBillingFactor(s);
  return unit>0?unit:units>0?Number(s.employee_compensation||0)/units:0;
}
function calculateAmounts({visits,mode,minutes,rate,discount,employeeUnit}){
  const n=Math.max(0,Number(visits)||0),m=Math.max(0,Number(minutes)||0),d=Math.max(0,Math.min(100,Number(discount)||0));
  const customerUnits=n*(mode==='ora'?m/60:1),employeeUnits=n*(mode==='ora'?m/30:1);
  const subtotal=roundMoney(customerUnits*Math.max(0,Number(rate)||0)),total=roundMoney(customerUnits*Math.max(0,Number(rate)||0)*(1-d/100));
  return {subtotal,total,discount:roundMoney(subtotal-total),employeeTotal:roundMoney(employeeUnits*Math.max(0,Number(employeeUnit)||0)),customerUnits,employeeUnits};
}
function paymentBalance(total,deposit,status){
  return ['pagato','incassato'].includes(String(status||'').trim().toLowerCase())?0:Math.max(0,roundMoney(Number(total||0)-Number(deposit||0)));
}
function serviceFinancialData(service){
  const q=linkedQuoteForService(service),total=roundMoney(q?.total_amount??service.customer_amount??0),deposit=roundMoney(q?.deposit_amount??service.deposit_amount??0);
  const balance=paymentBalance(total,deposit,q?q.payment_status:service.customer_payment_status);
  return {...service,customer_amount:total,deposit_amount:deposit,balance_due:balance,customer_payment_status:balance===0?'incassato':'da_incassare',...(q?{quote_id:q.id,payment_method:service.payment_method||q.payment_terms,deposit_received_at:q.deposit_received_at||null,deposit_payment_method:q.deposit_payment_method||null,deposit_reference:q.deposit_reference||null,quote_payment_status:q.payment_status||null}:{})};
}
