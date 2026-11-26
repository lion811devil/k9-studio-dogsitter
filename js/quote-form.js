/* K9 13.1.3 — AcroForm esclusivo del PDF preventivo. Nessuna modifica al database. */
(function(){
  'use strict';
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const euro=n=>Number(n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
  // Reflow only the exact known adhesion text. Unknown/revised attachments are kept intact.
  // Only fingerprints of the known attachment are stored in the public application.
  // Its actual clauses and bank details are read from the private PDF at generation time.
  const sourceFingerprints=["359e14649c98c6be6e861b105c0e84a70e1a226388eedd50df02e327d84bf38f", "9c4f8bdca55add2bb9b00b42af605a1f26bccd00050b13a917ca056f37605d84"];
  const exact=s=>String(s).normalize('NFKC').replace(/\s+/g,'');
  async function fingerprint(s){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(exact(s)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
  function extractSections(first,second){
    const part=(text,a,b)=>{const x=text.indexOf(a),y=text.indexOf(b,x+a.length);if(x<0||y<0)throw Error('Struttura allegato non riconosciuta');return text.slice(x+a.length,y).trim();};
    const paragraphs=(text,labels)=>labels.reduce((value,label)=>value.replace(' '+label,'\n'+label),text);
    return [
      ['1. Coordinate per il pagamento',paragraphs('IBAN '+part(first,'IBAN ','2. CONDIZIONI DI PARTECIPAZIONE'),['Intestatario','Causale'])],
      ['2. Condizioni di partecipazione',paragraphs(part(first,'2. CONDIZIONI DI PARTECIPAZIONE','3. INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI'),['Responsabilità personale.','Sicurezza.','Variazioni.','Rinuncia o mancata partecipazione.'])],
      ['3. Informativa sul trattamento dei dati personali',paragraphs(part(first,'3. INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI','4. CONSENSI FACOLTATIVI'),['Finalità e base giuridica:','Dati trattati:','Conferimento:','Destinatari:','Conservazione:','Diritti dell’interessato:','Informativa completa:'])],
      ['4. Consensi facoltativi','Comunicazioni informative e promozionali. '+part(first,'Comunicazioni informative e promozionali','[ ] ACCONSENTO')+'\nRiprese fotografiche e video. '+part(second,'Riprese fotografiche e video','[ ] ACCONSENTO')],
      ['5. Accettazione e firme',part(second,'5. ACCETTAZIONE E FIRME','Luogo e data')+'\nPer partecipanti minorenni: nome del genitore/tutore e firma del genitore/tutore.']
    ];
  }
  async function findAdhesion(bytes){
    await loadK9Library('preview');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const task=pdfjsLib.getDocument({data:bytes.slice(),isEvalSupported:false});
    try{
      const doc=await task.promise;
      if(doc.numPages!==2)return false;
      const bodies=[];
      for(let n=1;n<=2;n++){
        const p=await doc.getPage(n),vp=p.getViewport({scale:1});
        if(p.rotate!==0||Math.abs(vp.width-595.28)>1||Math.abs(vp.height-841.89)>1)return false;
        if(typeof p.getAnnotations==='function'&&(await p.getAnnotations()).length)return false;
        const items=(await p.getTextContent()).items.filter(i=>typeof i.str==='string');
        const body=items.filter(i=>{const top=vp.height-i.transform[5];return top>50&&top<790;}).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim();
        if(await fingerprint(body)!==sourceFingerprints[n-1])return false;
        bodies.push(body);
        // Require all text outside the body to be the known running header/footer, not extra clauses.
        const margin=items.filter(i=>{const top=vp.height-i.transform[5];return top<=50||top>=790;}).map(i=>i.str).join(' ');
        const running=`MANTRAILING RAGIÒ DI SOLE APS - Modulo Servizio Dogsitter Pagina ${n}`;
        if(exact(margin)!==exact(running+' '+running))return false;
        // No image operators: this template is text-only. Do not discard other visual information.
        if(typeof p.getOperatorList==='function'){
          const ops=await p.getOperatorList(),ids=pdfjsLib.OPS||{};
          if(ops.fnArray.some(k=>['paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat','paintInlineImageXObjectGroup','paintImageMaskXObjectGroup','paintSolidColorImageMask','paintJpegXObject'].some(name=>ids[name]!==undefined&&k===ids[name])))return false;
        }
      }return extractSections(...bodies);
    }finally{await task.destroy();}
  }
  function tools(doc){
    const {rgb,StandardFonts}=PDFLib;
    return doc.embedFont(StandardFonts.Helvetica).then(async font=>{
      const bold=await doc.embedFont(StandardFonts.HelveticaBold),form=doc.getForm(),white=rgb(1,1,1),ink=rgb(.13,.20,.24),green=rgb(.06,.37,.32),border=rgb(.42,.60,.57),pale=rgb(.94,.98,.97);
      const rect=(p,x,top,w,h,color=white)=>p.drawRectangle({x,y:p.getHeight()-top-h,width:w,height:h,color});
      const text=(p,s,x,top,size=10,strong=false)=>{let v=String(s??'');const f=strong?bold:font;try{f.encodeText(v)}catch{v=v.replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC]/g,'?');}p.drawText(v,{x,y:p.getHeight()-top-size,size,font:f,color:strong?green:ink});};
      const field=(p,name,label,x,top,w,h=31)=>{text(p,label,x,top,10,true);const f=form.createTextField(name);f.addToPage(p,{x,y:p.getHeight()-top-15-h,width:w,height:h,font,backgroundColor:pale,borderColor:border,borderWidth:1,textColor:ink});f.setFontSize(12);return f;};
      const radios=(p,name,x,top,options,selected)=>{const f=form.createRadioGroup(name);f.enableOffToggling();for(const [value,label,dx] of options){f.addOptionToPage(value,p,{x:x+dx,y:p.getHeight()-top-21,width:21,height:21,borderColor:border,backgroundColor:white,borderWidth:1});text(p,label,x+dx+28,top+4,10,true);}if(selected)f.select(selected);return f;};
      const check=(p,name,label,x,top)=>{const f=form.createCheckBox(name);f.addToPage(p,{x,y:p.getHeight()-top-23,width:23,height:23,borderColor:border,backgroundColor:white,borderWidth:1});text(p,label,x+31,top+5,10,true);return f;};
      const signing=(p,prefix,top)=>{
        check(p,prefix+'accettazione','Confermo di aver letto e accetto le condizioni del documento.',63,top);
        field(p,prefix+'luogo','Luogo',63,top+37,295);field(p,prefix+'data','Data (GG/MM/AAAA)',375,top+37,157);
        field(p,prefix+'firma_nome','Nome e cognome del firmatario (firma digitata)',63,top+95,469,38);
        text(p,'Per firma a mano: usa la funzione di firma del lettore PDF.',63,top+154,10);
        field(p,prefix+'tutore_nome','Nome e cognome del genitore/tutore (solo se necessario)',63,top+185,469);
        field(p,prefix+'tutore_firma','Firma digitata del genitore/tutore (solo se necessario)',63,top+245,469,38);
        text(p,'Compila le caselle, salva una copia del PDF e restituiscila al mittente.',63,top+315,10);
      };
      return {form,rect,text,field,radios,check,signing,font,bold,green};
    });
  }
  // All interactive controls in one compact block, placed on the last quote page if it fits.
  function compactForm(p,t,data,top,prefix){
    const {rect,text,field,radios,check}=t;
    rect(p,35,top,525,2,t.green);
    text(p,'ADESIONE E FIRMA',35,top+9,14,true);
    text(p,'Leggi le condizioni e l’informativa allegate prima di confermare.',35,top+29,10);
    const method=normalize(data.payment_terms),selected=method==='bonifico'||method==='bonifico bancario'?'bonifico':method==='contanti'?'contanti':undefined;
    text(p,'Pagamento',35,top+52,10,true);
    radios(p,prefix+'pagamento',145,top+46,[['bonifico','Bonifico',0],['contanti','Contanti',120],['altro','Altro / concordato',240]],selected);
    text(p,'Comunicazioni promozionali',35,top+80,10,true);
    radios(p,prefix+'consenso_promozioni',243,top+74,[['si','Acconsento',0],['no','Non acconsento',139]]);
    text(p,'Fotografie e video',35,top+108,10,true);
    radios(p,prefix+'consenso_foto_video',243,top+102,[['si','Acconsento',0],['no','Non acconsento',139]]);
    check(p,prefix+'accettazione','Ho letto l’informativa e accetto le condizioni del servizio.',35,top+132);
    field(p,prefix+'luogo','Luogo',35,top+166,325,27);
    field(p,prefix+'data','Data (GG/MM/AAAA)',373,top+166,187,27);
    field(p,prefix+'firma_nome','Nome e cognome del firmatario (firma digitata)',35,top+214,525,29);
    field(p,prefix+'tutore_nome','Nome del genitore/tutore (se necessario)',35,top+264,255,27);
    field(p,prefix+'tutore_firma','Firma del genitore/tutore (se necessario)',305,top+264,255,27);
    text(p,'Salva il PDF compilato e restituiscilo al mittente. Per firma a mano, usa il lettore PDF.',35,top+312,9);
  }
  function addLegal(doc,t,data,legalSections){
    let p,y;const left=35,width=525,size=10.5,leading=12.5;
    const start=()=>{p=doc.addPage([595.28,841.89]);t.text(p,'CONDIZIONI E INFORMATIVA',left,32,17,true);t.text(p,`MANTRAILING RAGIÒ DI SOLE APS · Preventivo n. ${String(data.progressive||'—')} · V${Number(data.version||1)}`,left,54,10);t.rect(p,left,73,width,2,t.green);y=86;};
    const linesFor=value=>{const lines=[];for(const para of value.split('\n')){let line='';for(const word of para.split(/\s+/)){const next=line?line+' '+word:word;if(line&&t.font.widthOfTextAtSize(next,size)>width){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);}return lines;};
    start();
    for(const [title,value] of legalSections){const lines=linesFor(value);if(y+25+Math.min(lines.length,2)*leading>807)start();t.text(p,title,left,y,11.5,true);y+=19;for(const line of lines){if(y+leading>807)start();t.text(p,line,left,y,size);y+=leading;}y+=8;}
  }
  async function finalize(baseBlob,attachments,data,settings){
    await loadK9Library('merge');const doc=await PDFLib.PDFDocument.load(await baseBlob.arrayBuffer());
    const t=await tools(doc);let matched=false;const retained=[];
    for(const bytes of attachments){
      const src=await PDFLib.PDFDocument.load(bytes);let known=false;
      try{known=await findAdhesion(bytes);}catch(e){/* Keep attachment unchanged when detection fails. */}
      if(known&&!matched){matched=true;retained.push({known});}else retained.push({src});
    }
    if(matched){
      const top=Number(baseBlob.k9QuoteFormTop),limit=baseBlob.k9QuoteFooter===false?805:774;
      let p=doc.getPages().at(-1),formTop=top;
      if(!Number.isFinite(top)||top<35||top+330>limit){p=doc.addPage([595.28,841.89]);t.text(p,'ADESIONE AL PREVENTIVO',35,35,18,true);t.text(p,`N. ${String(data.progressive||'—')} · V${Number(data.version||1)} · Totale ${euro(data.total_amount)}`,35,62,12);formTop=94;}
      compactForm(p,t,data,formTop,'adesione_1_');
    }else{
      // Unrecognized attachments stay untouched; a standalone, fillable acceptance remains available.
      const p=doc.addPage([595.28,841.89]);
      t.text(p,settings.organization_name||'K9 Studio Dogsitter',63,44,16,true);t.text(p,'ACCETTAZIONE PREVENTIVO',63,80,20,true);
      t.text(p,`N. ${String(data.progressive||'—')} · V${Number(data.version||1)} · Totale ${euro(data.total_amount)}`,63,118,12,true);
      t.text(p,'Compila questo modulo dopo aver letto il preventivo e gli eventuali allegati.',63,155,11);
      t.signing(p,'preventivo_',192);
    }
    for(const entry of retained){if(entry.known)addLegal(doc,t,data,entry.known);else{const pages=await doc.copyPages(entry.src,entry.src.getPageIndices());pages.forEach(p=>doc.addPage(p));}}
    t.form.updateFieldAppearances(t.font);
    return new Blob([await doc.save()],{type:'application/pdf'});
  }
  window.K9QuoteForm={finalize};
})();
