(function(){
  'use strict';

  const A4 = { width: 1240, height: 1754 };
  const PAGE_MARGIN = 72;

  function normalizeHex(value, fallback){
    return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
  }

  function lighten(hex, amount){
    const h = normalizeHex(hex, '#0f5f53').slice(1);
    const rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16));
    const out = rgb.map(v => Math.round(v + (255-v)*amount));
    return '#'+out.map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  function darken(hex, amount){
    const h = normalizeHex(hex, '#0f5f53').slice(1);
    const rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16));
    const out = rgb.map(v => Math.round(v*(1-amount)));
    return '#'+out.map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  function money(value){
    return Number(value || 0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
  }

  function dateIT(value){
    if(!value) return '—';
    const d = new Date(String(value).length === 10 ? value+'T12:00:00' : value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('it-IT');
  }

  function dateTimeIT(value){
    if(!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('it-IT');
  }

  function loadImage(url){
    return new Promise(resolve => {
      if(!url){ resolve(null); return; }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function roundedRect(ctx,x,y,w,h,r,fill,stroke){
    const radius = Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
  }

  function wrapLines(ctx,text,maxWidth){
    const paragraphs = String(text || '').split(/\n/);
    const lines=[];
    for(const p of paragraphs){
      const words=p.trim().split(/\s+/).filter(Boolean);
      if(!words.length){lines.push('');continue;}
      let line='';
      for(const word of words){
        const test=line?line+' '+word:word;
        if(ctx.measureText(test).width>maxWidth && line){lines.push(line);line=word;} else line=test;
      }
      if(line) lines.push(line);
    }
    return lines;
  }

  function drawText(ctx,text,x,y,{font='30px Arial',color='#23313f',maxWidth=null,lineHeight=40,bold=false}={}){
    ctx.fillStyle=color;
    ctx.font=(bold?'700 ':'')+font;
    const lines=maxWidth?wrapLines(ctx,text,maxWidth):[String(text ?? '')];
    lines.forEach((line,i)=>ctx.fillText(line,x,y+i*lineHeight));
    return y+Math.max(1,lines.length)*lineHeight;
  }

  function drawSection(ctx,title,items,x,y,w,accent,bg){
    const rows=[];
    for(const item of items){
      if(!item || item.value===undefined || item.value===null || item.value==='') continue;
      rows.push(item);
    }
    const h=78+rows.length*52;
    roundedRect(ctx,x,y,w,h,20,bg,'#dfe7ec');
    roundedRect(ctx,x,y,12,h,8,accent);
    drawText(ctx,title.toUpperCase(),x+32,y+48,{font:'25px Arial',color:darken(accent,.18),bold:true});
    let cy=y+92;
    for(const row of rows){
      drawText(ctx,row.label,x+32,cy,{font:'22px Arial',color:'#687783'});
      drawText(ctx,String(row.value),x+w*0.42,cy,{font:'24px Arial',color:'#1f2d36',bold:true,maxWidth:w*0.53,lineHeight:31});
      cy+=52;
    }
    return y+h;
  }

  function drawNarrative(ctx,title,text,x,y,w,accent,bg){
    ctx.font='25px Arial';
    const lines=wrapLines(ctx,text || 'Nessuna informazione inserita.',w-64);
    const h=92+Math.max(2,lines.length)*34;
    roundedRect(ctx,x,y,w,h,20,bg,'#dfe7ec');
    roundedRect(ctx,x,y,12,h,8,accent);
    drawText(ctx,title.toUpperCase(),x+32,y+48,{font:'25px Arial',color:darken(accent,.18),bold:true});
    let cy=y+92;
    for(const line of lines){drawText(ctx,line,x+32,cy,{font:'24px Arial',color:'#263640'});cy+=34;}
    return y+h;
  }

  function createCanvas(){
    const c=document.createElement('canvas');
    c.width=A4.width;c.height=A4.height;
    return c;
  }

  function newPage(){
    const canvas=createCanvas(),ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,A4.width,A4.height);
    ctx.textBaseline='alphabetic';
    return {canvas,ctx,y:PAGE_MARGIN};
  }


  function businessRows(settings){
    if(settings.show_fiscal_data_pdf===false)return [];
    const address=[settings.address,[settings.postal_code,settings.city].filter(Boolean).join(' '),settings.province,settings.country].filter(Boolean).join(' · ');
    const contacts=[settings.phone&&`Tel. ${settings.phone}`,settings.mobile&&`Cell. ${settings.mobile}`,settings.email,settings.website].filter(Boolean).join(' · ');
    const fiscal=[settings.vat_number&&`P.IVA ${settings.vat_number}`,settings.fiscal_code&&`C.F. ${settings.fiscal_code}`,settings.iban&&`IBAN ${settings.iban}`].filter(Boolean).join(' · ');
    return [address&&{label:'Sede',value:address},contacts&&{label:'Contatti',value:contacts},settings.social_text&&{label:'Riferimenti',value:settings.social_text},fiscal&&{label:'Dati fiscali',value:fiscal}].filter(Boolean);
  }

  function drawHeader(page,data,kind,settings,logo){
    const {ctx}=page;
    if(settings.show_header_pdf===false){page.y=PAGE_MARGIN;return;}
    const primary=normalizeHex(settings.primary_color,'#0f5f53');
    const secondary=normalizeHex(settings.secondary_color,'#153e75');
    roundedRect(ctx,PAGE_MARGIN,PAGE_MARGIN,A4.width-PAGE_MARGIN*2,245,28,primary);
    if(logo && settings.show_logo_pdf!==false){
      const maxW=180,maxH=150,ratio=Math.min(maxW/logo.width,maxH/logo.height);
      const w=logo.width*ratio,h=logo.height*ratio;
      roundedRect(ctx,PAGE_MARGIN+28,PAGE_MARGIN+34,210,176,20,'#ffffff');
      ctx.drawImage(logo,PAGE_MARGIN+43+(180-w)/2,PAGE_MARGIN+47+(150-h)/2,w,h);
    }
    const tx=logo && settings.show_logo_pdf!==false ? PAGE_MARGIN+270 : PAGE_MARGIN+42;
    drawText(ctx,settings.organization_name||'K9 Napoletano Academy',tx,PAGE_MARGIN+72,{font:'38px Arial',color:'#ffffff',bold:true,maxWidth:690,lineHeight:45});
    drawText(ctx,kind==='customer'?'RAPPORTO SERVIZIO CLIENTE':'RIEPILOGO COMPENSO DIPENDENTE',tx,PAGE_MARGIN+126,{font:'25px Arial',color:lighten(primary,.82),bold:true});
    drawText(ctx,`Documento ${data.document_number||'—'}  •  Versione V${Number(data.version||1)}`,tx,PAGE_MARGIN+174,{font:'21px Arial',color:'#ffffff'});
    roundedRect(ctx,A4.width-PAGE_MARGIN-246,PAGE_MARGIN+42,210,72,18,secondary);
    drawText(ctx,dateIT(data.service_date),A4.width-PAGE_MARGIN-220,PAGE_MARGIN+88,{font:'27px Arial',color:'#ffffff',bold:true});
    page.y=PAGE_MARGIN+280;
  }

  function drawFooter(page,settings,pageNo,total){
    if(settings.show_footer_pdf===false)return;
    const {ctx}=page,y=A4.height-72;
    ctx.strokeStyle='#dce5ea';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(PAGE_MARGIN,y-58);ctx.lineTo(A4.width-PAGE_MARGIN,y-58);ctx.stroke();
    const combined=settings.footer_text||settings.organization_name||'';
    ctx.font='16px Arial';const lines=wrapLines(ctx,combined,820).slice(0,3);
    let ty=y-34;for(const line of lines){drawText(ctx,line,PAGE_MARGIN,ty,{font:'16px Arial',color:'#6f7f88',maxWidth:840,lineHeight:19});ty+=19;}
    drawText(ctx,`Pagina ${pageNo} di ${total}`,A4.width-PAGE_MARGIN-120,y+35,{font:'17px Arial',color:'#6f7f88'});
  }

  function canvasToJpeg(canvas){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Impossibile creare la pagina PDF')),'image/jpeg',0.92));
  }

  function concatBytes(chunks){
    const len=chunks.reduce((s,c)=>s+c.length,0),out=new Uint8Array(len);let p=0;
    for(const c of chunks){out.set(c,p);p+=c.length;}return out;
  }
  function ascii(s){return new TextEncoder().encode(s);}
  async function buildImagePdf(jpegBlobs){
    const images=[];
    for(const b of jpegBlobs) images.push(new Uint8Array(await b.arrayBuffer()));
    const objects=[];
    const pageIds=[],contentIds=[],imageIds=[];
    let next=3;
    for(let i=0;i<images.length;i++){pageIds.push(next++);contentIds.push(next++);imageIds.push(next++);}
    objects[1]=ascii('<< /Type /Catalog /Pages 2 0 R >>');
    objects[2]=ascii(`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${images.length} >>`);
    for(let i=0;i<images.length;i++){
      const content=`q\n595 0 0 842 0 0 cm\n/Im${i+1} Do\nQ\n`;
      objects[pageIds[i]]=ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im${i+1} ${imageIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);
      objects[contentIds[i]]=concatBytes([ascii(`<< /Length ${content.length} >>\nstream\n`),ascii(content),ascii('endstream')]);
      objects[imageIds[i]]=concatBytes([ascii(`<< /Type /XObject /Subtype /Image /Width ${A4.width} /Height ${A4.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${images[i].length} >>\nstream\n`),images[i],ascii('\nendstream')]);
    }
    const chunks=[ascii('%PDF-1.4\n%K9\n')],offsets=[0];let pos=chunks[0].length;
    for(let i=1;i<objects.length;i++){
      offsets[i]=pos;
      const chunk=concatBytes([ascii(`${i} 0 obj\n`),objects[i],ascii('\nendobj\n')]);
      chunks.push(chunk);pos+=chunk.length;
    }
    const xref=pos;
    let table=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let i=1;i<objects.length;i++) table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    table+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    chunks.push(ascii(table));
    return new Blob([concatBytes(chunks)],{type:'application/pdf'});
  }

  async function createServicePdf(data,kind,settings,logoUrl){
    const primary=normalizeHex(settings.primary_color,'#0f5f53');
    const secondary=normalizeHex(settings.secondary_color,'#153e75');
    const logo=await loadImage(logoUrl);
    const pages=[newPage()];
    let page=pages[0];
    drawHeader(page,data,kind,settings,logo);
    const x=PAGE_MARGIN,w=A4.width-PAGE_MARGIN*2,gap=24;
    const footerReserve=settings.show_footer_pdf===false?70:190;
    const ensure=(height)=>{
      if(page.y+height>A4.height-footerReserve){page=newPage();pages.push(page);drawHeader(page,data,kind,settings,logo);}
    };
    ensure(260);
    page.y=drawSection(page.ctx,'Cliente',[
      {label:'Nome e cognome',value:data.customer_name||'—'},
      {label:'Cane',value:data.dog_name||'—'}
    ],x,page.y,w,primary,lighten(primary,.92))+gap;
    const company=businessRows(settings);if(company.length){ensure(170+company.length*58);page.y=drawSection(page.ctx,'Dati attività',company,x,page.y,w,secondary,lighten(secondary,.96))+gap;}
    ensure(360);
    const periods=Array.isArray(data.periods)&&data.periods.length?data.periods:[{start_date:data.service_date,end_date:data.end_date||data.service_date,daily_visits:data.daily_visits||1,time_slot_1:data.time_slot_1||data.service_time,time_slot_2:data.time_slot_2,time_slot_3:data.time_slot_3,time_slot_4:data.time_slot_4}];
    const periodRows=periods.map((p,i)=>({label:`Periodo ${i+1}`,value:`${dateIT(p.start_date)}${p.end_date&&p.end_date!==p.start_date?' - '+dateIT(p.end_date):''} · ${Number(p.daily_visits||1)} uscite/giorno · ${[p.time_slot_1,p.time_slot_2,p.time_slot_3,p.time_slot_4].filter(Boolean).join(', ')||'orari da concordare'}`}));
    const totalOutings=periods.reduce((sum,p)=>{const a=new Date(String(p.start_date||'')+'T00:00:00'),b=new Date(String(p.end_date||p.start_date||'')+'T00:00:00');const days=Number.isNaN(a.getTime())||Number.isNaN(b.getTime())?1:Math.max(1,Math.round((b-a)/86400000)+1);return sum+days*Math.max(1,Number(p.daily_visits||1))},0);
    if(kind==='customer'&&periods.length>=2){const netUnit=Number(data.customer_amount||0)/Math.max(1,totalOutings);for(let i=0;i<periodRows.length;i++){const pp=periods[i],a=new Date(String(pp.start_date||'')+'T00:00:00'),b=new Date(String(pp.end_date||pp.start_date||'')+'T00:00:00'),days=Number.isNaN(a.getTime())||Number.isNaN(b.getTime())?1:Math.max(1,Math.round((b-a)/86400000)+1),outings=days*Math.max(1,Number(pp.daily_visits||1));periodRows[i].value+=` · Totale periodo ${money(outings*netUnit)}`}periodRows.push({label:'Somma totale periodi',value:money(data.customer_amount)})}
    page.y=drawSection(page.ctx,'Servizio',[
      {label:'Tipologia',value:data.service_type||'—'},
      ...periodRows,
      {label:'Durata prevista',value:`${Number(data.planned_duration_minutes||0)} minuti`},
      {label:'Uscite complessive',value:totalOutings},
      {label:'Operatore',value:data.employee_name||'—'},
      {label:'Inizio effettivo',value:dateTimeIT(data.started_at)},
      {label:'Fine effettiva',value:dateTimeIT(data.completed_at)}
    ],x,page.y,w,secondary,lighten(secondary,.93))+gap;
    ensure(250);
    page.y=drawNarrative(page.ctx,'Rapporto del servizio',data.report_text||data.operational_notes||'Nessun rapporto inserito.',x,page.y,w,primary,lighten(primary,.95))+gap;
    if(data.incident_notes){ensure(190);page.y=drawNarrative(page.ctx,'Anomalie e note',data.incident_notes,x,page.y,w,'#c95f18','#fff3e9')+gap;}
    ensure(190);
    const econColor=kind==='customer'?primary:secondary;
    const econBg=lighten(econColor,.90);
    roundedRect(page.ctx,x,page.y,w,150,24,econBg,econColor);
    drawText(page.ctx,kind==='customer'?'TOTALE DOVUTO DAL CLIENTE':'COMPENSO DELLA SCHEDA',x+34,page.y+50,{font:'25px Arial',color:darken(econColor,.18),bold:true});
    drawText(page.ctx,money(kind==='customer'?data.customer_amount:data.employee_compensation),x+34,page.y+112,{font:'46px Arial',color:econColor,bold:true});
    if(kind==='employee') drawText(page.ctx,`Stato: ${data.employee_payment_status==='liquidato'?'Liquidato':'Da liquidare'}`,x+w-330,page.y+105,{font:'24px Arial',color:'#43515a',bold:true});
    page.y+=174;
    if(settings.show_fiscal_data_pdf!==false && kind==='customer'){
      ensure(190);
      const fiscal=[settings.vat_number&&`P.IVA ${settings.vat_number}`,settings.fiscal_code&&`C.F. ${settings.fiscal_code}`,settings.iban&&`IBAN ${settings.iban}`].filter(Boolean).join('  •  ');
      if(fiscal) page.y=drawNarrative(page.ctx,'Dati amministrativi',fiscal,x,page.y,w,secondary,lighten(secondary,.95))+gap;
    }
    if(settings.show_footer_pdf!==false&&settings.legal_text){ensure(190);page.y=drawNarrative(page.ctx,'Note legali e privacy',settings.legal_text,x,page.y,w,secondary,lighten(secondary,.97))+gap;}
    if(data.approver_name){ensure(130);page.y=drawNarrative(page.ctx,'Approvazione',`Approvato da ${data.approver_name}${data.approved_at?' il '+dateTimeIT(data.approved_at):''}`,x,page.y,w,primary,lighten(primary,.96))+gap;}
    const total=pages.length;
    pages.forEach((p,i)=>drawFooter(p,settings,i+1,total));
    const jpgs=[];
    for(const p of pages) jpgs.push(await canvasToJpeg(p.canvas));
    return buildImagePdf(jpgs);
  }


  function sanitizeQuoteData(input={}){
    const allowed=[
      'customer_name','dog_name','customer_phone','customer_email','customer_address',
      'quote_date','valid_until','progressive','version','items','subtotal','discount_rate','discount_amount','total_amount',
      'payment_terms','payment_status','deposit_amount','deposit_received_at','deposit_payment_method','deposit_reference','balance_due','notes','periods'
    ];
    return Object.fromEntries(allowed.filter(key=>Object.prototype.hasOwnProperty.call(input,key)).map(key=>[key,input[key]]));
  }

  async function createQuotePdf(input,settings,logoUrl){
    const data=sanitizeQuoteData(input);
    const primary=normalizeHex(settings.primary_color,'#0f5f53');
    const secondary=normalizeHex(settings.secondary_color,'#153e75');
    const logo=await loadImage(logoUrl);
    const pages=[newPage()];let page=pages[0];
    const drawQuoteHeader=()=>{
      const {ctx}=page;if(settings.show_header_pdf===false){page.y=PAGE_MARGIN;return;}roundedRect(ctx,PAGE_MARGIN,PAGE_MARGIN,A4.width-PAGE_MARGIN*2,245,28,primary);
      if(logo&&settings.show_logo_pdf!==false){const ratio=Math.min(180/logo.width,150/logo.height),w=logo.width*ratio,h=logo.height*ratio;roundedRect(ctx,PAGE_MARGIN+28,PAGE_MARGIN+34,210,176,20,'#ffffff');ctx.drawImage(logo,PAGE_MARGIN+43+(180-w)/2,PAGE_MARGIN+47+(150-h)/2,w,h)}
      const tx=logo&&settings.show_logo_pdf!==false?PAGE_MARGIN+270:PAGE_MARGIN+42;
      drawText(ctx,settings.organization_name||'K9 Napoletano Academy',tx,PAGE_MARGIN+62,{font:'34px Arial',color:'#ffffff',bold:true,maxWidth:690,lineHeight:40});
      if(settings.subtitle)drawText(ctx,settings.subtitle,tx,PAGE_MARGIN+96,{font:'18px Arial',color:'#e6f3f4',maxWidth:690,lineHeight:23});
      drawText(ctx,'PREVENTIVO SERVIZI DOGSITTER',tx,PAGE_MARGIN+126,{font:'25px Arial',color:lighten(primary,.82),bold:true});
      drawText(ctx,`Preventivo ${data.progressive?String(data.progressive).padStart(3,'0'):'—'}  •  Versione V${Number(data.version||1)}`,tx,PAGE_MARGIN+174,{font:'21px Arial',color:'#ffffff'});
      roundedRect(ctx,A4.width-PAGE_MARGIN-246,PAGE_MARGIN+42,210,72,18,secondary);drawText(ctx,dateIT(data.quote_date),A4.width-PAGE_MARGIN-220,PAGE_MARGIN+88,{font:'27px Arial',color:'#ffffff',bold:true});page.y=PAGE_MARGIN+280;
    };
    drawQuoteHeader();const x=PAGE_MARGIN,w=A4.width-PAGE_MARGIN*2,gap=24;
    const footerReserve=settings.show_footer_pdf===false?70:190;const ensure=height=>{if(page.y+height>A4.height-footerReserve){page=newPage();pages.push(page);drawQuoteHeader()}};
    ensure(260);page.y=drawSection(page.ctx,'Cliente',[{label:'Nome e cognome',value:data.customer_name||'—'},{label:'Cane',value:data.dog_name||'—'},{label:'Telefono',value:data.customer_phone||''},{label:'Email',value:data.customer_email||''},{label:'Indirizzo',value:data.customer_address||''}],x,page.y,w,primary,lighten(primary,.93))+gap;const company=businessRows(settings);if(company.length){ensure(170+company.length*58);page.y=drawSection(page.ctx,'Dati attività',company,x,page.y,w,secondary,lighten(secondary,.96))+gap;}
    const quotePeriods=Array.isArray(data.periods)&&data.periods.length?data.periods:[];
    const items=Array.isArray(data.items)?data.items:[];
    const quoteUnitPrice=Number(items[0]?.unit_price||0);
    const quotePeriodVisits=p=>{const a=new Date(String(p.start_date||'')+'T00:00:00'),b=new Date(String(p.end_date||p.start_date||'')+'T00:00:00');const days=Number.isNaN(a.getTime())||Number.isNaN(b.getTime())?1:Math.max(1,Math.round((b-a)/86400000)+1);return days*Math.max(1,Number(p.daily_visits||1))};
    if(quotePeriods.length){ensure(170+quotePeriods.length*70);const rows=quotePeriods.map((p,i)=>{const outings=quotePeriodVisits(p);return {label:`Periodo ${i+1}`,value:`${dateIT(p.start_date)}${p.end_date&&p.end_date!==p.start_date?' - '+dateIT(p.end_date):''} · ${outings} uscite · ${money(quoteUnitPrice)}/uscita · Totale ${money(outings*quoteUnitPrice)}`}});rows.push({label:'Somma periodi',value:money(quotePeriods.reduce((sum,p)=>sum+quotePeriodVisits(p)*quoteUnitPrice,0))});page.y=drawSection(page.ctx,'Periodi e riepilogo economico',rows,x,page.y,w,secondary,lighten(secondary,.95))+gap;}
    ensure(180+items.length*58);roundedRect(page.ctx,x,page.y,w,105+items.length*58,22,lighten(secondary,.95),'#dfe7ec');roundedRect(page.ctx,x,page.y,12,105+items.length*58,8,secondary);drawText(page.ctx,'SERVIZI PREVISTI',x+32,page.y+48,{font:'25px Arial',color:darken(secondary,.18),bold:true});let cy=page.y+94;
    for(const item of items){drawText(page.ctx,item.description||'Servizio',x+32,cy,{font:'23px Arial',color:'#263640',bold:true,maxWidth:520,lineHeight:29});drawText(page.ctx,`${Number(item.quantity||0)} × ${money(item.unit_price)}`,x+w-330,cy,{font:'22px Arial',color:'#65747e'});drawText(page.ctx,money(Number(item.quantity||0)*Number(item.unit_price||0)),x+w-155,cy,{font:'23px Arial',color:secondary,bold:true});cy+=58}page.y+=129+items.length*58;
    ensure(180);roundedRect(page.ctx,x,page.y,w,150,24,lighten(primary,.90),primary);drawText(page.ctx,'TOTALE PREVENTIVO',x+34,page.y+50,{font:'25px Arial',color:darken(primary,.18),bold:true});drawText(page.ctx,money(data.total_amount),x+34,page.y+112,{font:'46px Arial',color:primary,bold:true});drawText(page.ctx,`Valido fino al ${dateIT(data.valid_until)}`,x+w-355,page.y+104,{font:'24px Arial',color:'#43515a',bold:true});page.y+=174;
    if(data.payment_status==='Acconto ricevuto'&&Number(data.deposit_amount||0)>0){ensure(220);page.y=drawSection(page.ctx,'Acconto ricevuto',[{label:'Importo acconto',value:money(data.deposit_amount)},{label:'Data ricezione',value:dateIT(data.deposit_received_at)},{label:'Modalità',value:data.deposit_payment_method||'—'},{label:'Residuo da pagare',value:money(data.balance_due??Math.max(0,Number(data.total_amount||0)-Number(data.deposit_amount||0)))},{label:'Riferimento / nota',value:data.deposit_reference||'—'}],x,page.y,w,'#b56a12','#fff6e8')+gap}
    if(data.payment_terms){ensure(170);page.y=drawNarrative(page.ctx,'Modalità di pagamento',data.payment_terms,x,page.y,w,secondary,lighten(secondary,.95))+gap}
    if(data.notes){ensure(170);page.y=drawNarrative(page.ctx,'Note',data.notes,x,page.y,w,primary,lighten(primary,.96))+gap}
    if(settings.show_footer_pdf!==false&&settings.legal_text){ensure(190);page.y=drawNarrative(page.ctx,'Note legali e privacy',settings.legal_text,x,page.y,w,secondary,lighten(secondary,.97))+gap;}
    if(settings.show_signatures_pdf!==false){ensure(220);roundedRect(page.ctx,x,page.y,w,185,22,'#f7fafb','#dfe7ec');drawText(page.ctx,'ACCETTAZIONE DEL CLIENTE',x+32,page.y+48,{font:'24px Arial',color:'#263640',bold:true});drawText(page.ctx,'Data ______________________',x+32,page.y+112,{font:'22px Arial',color:'#43515a'});drawText(page.ctx,'Firma __________________________________________',x+w/2-30,page.y+112,{font:'22px Arial',color:'#43515a'});}
    const total=pages.length;pages.forEach((pg,i)=>drawFooter(pg,settings,i+1,total));const jpgs=[];for(const pg of pages)jpgs.push(await canvasToJpeg(pg.canvas));return buildImagePdf(jpgs);
  }



  async function buildCardImagePdf(jpegBlob,widthPx,heightPx,widthPt,heightPt){
    const image=new Uint8Array(await jpegBlob.arrayBuffer());
    const objects=[];
    objects[1]=ascii('<< /Type /Catalog /Pages 2 0 R >>');
    objects[2]=ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    const content=`q\n${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm\n/Im1 Do\nQ\n`;
    objects[3]=ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>`);
    objects[4]=concatBytes([ascii(`<< /Length ${content.length} >>\nstream\n`),ascii(content),ascii('endstream')]);
    objects[5]=concatBytes([ascii(`<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),image,ascii('\nendstream')]);
    const chunks=[ascii('%PDF-1.4\n%K9PASS\n')],offsets=[0];let pos=chunks[0].length;
    for(let i=1;i<objects.length;i++){offsets[i]=pos;const chunk=concatBytes([ascii(`${i} 0 obj\n`),objects[i],ascii('\nendobj\n')]);chunks.push(chunk);pos+=chunk.length;}
    const xref=pos;let table=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let i=1;i<objects.length;i++)table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    table+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    chunks.push(ascii(table));
    return new Blob([concatBytes(chunks)],{type:'application/pdf'});
  }

  async function createPassPdf(data,settings,logoUrl,qrUrl){
    const W=638,H=1011;
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');ctx.textBaseline='alphabetic';
    const primary=normalizeHex(settings.primary_color,'#0f5f53');
    const secondary=normalizeHex(settings.secondary_color,'#153e75');
    const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,primary);gradient.addColorStop(1,secondary);
    roundedRect(ctx,0,0,W,H,34,gradient);
    ctx.globalAlpha=.12;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(W-65,H-30,180,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    drawText(ctx,'PASS IDENTIFICATIVO',32,55,{font:'22px Arial',color:'#ffffff',bold:true});
    roundedRect(ctx,W-142,25,112,42,21,data.active?'#e6f6e9':'#fdeaea');
    drawText(ctx,data.active?'ATTIVO':'SOSPESO',W-124,54,{font:'19px Arial',color:data.active?'#246c3d':'#9b2e2e',bold:true});

    const photo=await loadImage(data.photo_url||logoUrl);
    roundedRect(ctx,32,92,150,174,24,'#ffffff');
    if(photo){const r=Math.min(120/photo.width,136/photo.height),w=photo.width*r,h=photo.height*r;ctx.drawImage(photo,47+(120-w)/2,111+(136-h)/2,w,h);}
    drawText(ctx,settings.organization_name||'K9 Napoletano Academy',208,128,{font:'22px Arial',color:'#d8eef2',maxWidth:390,lineHeight:28});
    drawText(ctx,data.full_name||data.email||'—',208,185,{font:'38px Arial',color:'#ffffff',bold:true,maxWidth:390,lineHeight:44});
    drawText(ctx,data.qualification||data.role_label||'—',208,235,{font:'27px Arial',color:'#e8f4f6',maxWidth:390,lineHeight:33});

    const rows=[['Codice',data.code],['Emissione',data.issued],['Validità',data.validity],['Ruolo',data.role_label]];
    let y=300;
    for(const [label,value] of rows){roundedRect(ctx,32,y,W-64,108,20,'rgba(255,255,255,.12)','rgba(255,255,255,.22)');drawText(ctx,label,54,y+37,{font:'20px Arial',color:'#cce3e7'});drawText(ctx,value||'—',54,y+78,{font:'28px Arial',color:'#ffffff',bold:true,maxWidth:520,lineHeight:32});y+=128;}

    roundedRect(ctx,32,824,W-64,154,24,'#ffffff');
    const qr=await loadImage(qrUrl);
    if(qr)ctx.drawImage(qr,50,842,120,120);
    drawText(ctx,'Codice di verifica',192,866,{font:'20px Arial',color:'#6c747a'});
    drawText(ctx,data.code||'—',192,910,{font:'29px Arial',color:'#17252e',bold:true});
    drawText(ctx,'Scansiona per verificare codice e stato del pass.',192,948,{font:'18px Arial',color:'#6c747a',maxWidth:380,lineHeight:23});

    const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Impossibile creare il PDF del pass')),'image/jpeg',0.94));
    return buildCardImagePdf(jpeg,W,H,153.01,242.65);
  }

  window.K9PdfEngine={createServicePdf,createQuotePdf,createPassPdf};
})();
