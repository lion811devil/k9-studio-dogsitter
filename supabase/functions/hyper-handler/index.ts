import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { message: 'Metodo non consentito' });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !service) {
      console.error('Configurazione incompleta: variabili Supabase mancanti');
      return reply(500, { message: 'Variabili Supabase mancanti' });
    }

    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) return reply(401, { message: 'Sessione non valida' });

    const userClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      console.warn('Sessione rifiutata', userErr?.message || 'utente assente');
      return reply(401, { message: 'Sessione non valida' });
    }

    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: caller, error: callerErr } = await admin
      .from('profiles')
      .select('id,role,is_owner,active')
      .eq('id', user.id)
      .maybeSingle();

    const callerIsOwner = caller?.role === 'owner' || caller?.is_owner === true;
    const callerIsVice = caller?.role === 'vice_admin';
    if (callerErr || !caller || caller.active !== true || (!callerIsOwner && !callerIsVice)) {
      console.warn('Permesso negato', {
        user_id: user.id,
        profile_found: Boolean(caller),
        role: caller?.role ?? null,
        is_owner: caller?.is_owner ?? null,
        active: caller?.active ?? null,
        profile_error: callerErr?.message ?? null,
      });
      return reply(403, { message: 'Permesso negato' });
    }

    const body = await req.json();
    const action = String(body.action || 'create_user').trim().toLowerCase().replace('-', '_');

    if (action === 'reset_password') {
      const targetId = String(body.user_id || '').trim();
      const newPassword = String(body.password || '');
      if (!targetId || newPassword.length < 8) {
        return reply(400, { message: 'Utente e password di almeno 8 caratteri sono obbligatori' });
      }

      const { data: target, error: targetErr } = await admin
        .from('profiles')
        .select('id,role,is_owner,active')
        .eq('id', targetId)
        .maybeSingle();
      if (targetErr || !target) return reply(404, { message: 'Utente non trovato' });

      const targetIsOwner = target.role === 'owner' || target.is_owner === true;
      if (targetIsOwner) {
        return reply(403, { message: 'La password del titolare non può essere modificata da questa funzione' });
      }
      if (callerIsVice && target.role !== 'dipendente') {
        return reply(403, { message: 'Il Vice Amministratore può reimpostare solo password dei dipendenti' });
      }

      const { error: resetErr } = await admin.auth.admin.updateUserById(targetId, { password: newPassword });
      if (resetErr) return reply(400, { message: resetErr.message });
      return reply(200, { message: 'Password aggiornata correttamente' });
    }

    if (action !== 'create_user') return reply(400, { message: 'Azione non valida' });

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.full_name || '').trim();
    const role = String(body.role || 'dipendente').trim();
    const employeeCode = String(body.employee_code || '').trim() || null;

    if (!email || !fullName || password.length < 8) {
      return reply(400, { message: 'Email, nome e password di almeno 8 caratteri sono obbligatori' });
    }
    if (!['dipendente', 'vice_admin'].includes(role)) {
      return reply(400, { message: 'Ruolo non valido' });
    }
    if (role === 'vice_admin' && !callerIsOwner) {
      return reply(403, { message: 'Solo il titolare può creare un Vice Amministratore' });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created.user) {
      console.error('Creazione Auth fallita', createErr?.message || 'utente non restituito');
      return reply(400, { message: createErr?.message || 'Creazione utente non riuscita' });
    }

    const profilePayload = {
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      employee_code: employeeCode,
      active: true,
      is_owner: false,
      updated_at: new Date().toISOString(),
    };

    const { error: profileErr } = await admin
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileErr) {
      console.error('Creazione profilo fallita', profileErr.message);
      await admin.auth.admin.deleteUser(created.user.id);
      return reply(400, { message: `Profilo non creato: ${profileErr.message}` });
    }

    return reply(200, {
      message: role === 'vice_admin' ? 'Vice Amministratore creato' : 'Dipendente creato',
      user_id: created.user.id,
    });
  } catch (error) {
    console.error('Errore inatteso hyper-handler', error);
    return reply(500, { message: error instanceof Error ? error.message : 'Errore inatteso' });
  }
});
