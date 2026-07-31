import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{message:'Metodo non consentito'});
  try{
    const url=Deno.env.get('SUPABASE_URL');
    const anon=Deno.env.get('SUPABASE_ANON_KEY');
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!service)return reply(500,{message:'Variabili Supabase mancanti'});
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/,'');
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
    const {data:{user},error:userErr}=await userClient.auth.getUser();
    if(userErr||!user)return reply(401,{message:'Sessione non valida'});
    const admin=createClient(url,service);
    const {data:caller,error:callerErr}=await admin.from('profiles').select('role,is_owner,active').eq('id',user.id).single();
    if(callerErr||!caller?.active||!['owner','vice_admin'].includes(caller.role))return reply(403,{message:'Permesso negato'});
    const body=await req.json();
    const email=String(body.email||'').trim().toLowerCase();
    const password=String(body.password||'');
    const full_name=String(body.full_name||'').trim();
    const role=String(body.role||'dipendente');
    const employee_code=String(body.employee_code||'').trim()||null;
    if(!email||!full_name||password.length<8)return reply(400,{message:'Email, nome e password di almeno 8 caratteri sono obbligatori'});
    if(!['dipendente','vice_admin'].includes(role))return reply(400,{message:'Ruolo non valido'});
    if(role==='vice_admin'&&!caller.is_owner)return reply(403,{message:'Solo il titolare può creare un Vice Amministratore'});
    const {data:created,error:createErr}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name}});
    if(createErr||!created.user)return reply(400,{message:createErr?.message||'Creazione utente non riuscita'});
    const {error:updateErr}=await admin.from('profiles').update({full_name,role,employee_code,active:true}).eq('id',created.user.id);
    if(updateErr){await admin.auth.admin.deleteUser(created.user.id);return reply(400,{message:updateErr.message});}
    return reply(200,{message:'Account creato',user_id:created.user.id});
  }catch(e){return reply(500,{message:e instanceof Error?e.message:'Errore inatteso'});}
});
