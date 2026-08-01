import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>, requestId: string) =>
  new Response(JSON.stringify({ ...body, request_id: requestId }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'X-Request-Id': requestId },
  });

Deno.serve(async (req) => {
  const requestId = req.headers.get('X-Request-Id') || crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { message: 'Metodo non consentito' }, requestId);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return reply(500, { message: 'Configurazione server incompleta' }, requestId);
    }

    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return reply(401, { message: 'Token utente mancante. Esci e accedi nuovamente.' }, requestId);
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      console.warn('AUTH_REJECTED', { requestId, reason: authError?.message ?? 'user missing' });
      return reply(401, { message: 'Sessione non valida o scaduta. Esci e accedi nuovamente.' }, requestId);
    }

    // Usa una funzione SECURITY DEFINER dedicata: evita che policy RLS o grant
    // incoerenti impediscano alla Edge Function di leggere il profilo chiamante.
    const { data: callerRows, error: callerError } = await admin.rpc('edge_profile_lookup', {
      p_user_id: user.id,
    });
    const caller = Array.isArray(callerRows) ? callerRows[0] : callerRows;

    if (callerError) {
      console.error('PROFILE_LOOKUP_ERROR', { requestId, userId: user.id, error: callerError.message });
      return reply(500, { message: `Errore lettura profilo: ${callerError.message}` }, requestId);
    }
    if (!caller) {
      console.warn('PROFILE_NOT_FOUND', { requestId, userId: user.id, email: user.email });
      return reply(403, { message: 'Profilo amministrativo non trovato per l’utente autenticato.' }, requestId);
    }

    const callerIsOwner = caller.role === 'owner' || caller.is_owner === true;
    const callerIsVice = caller.role === 'vice_admin';
    if (caller.active !== true || (!callerIsOwner && !callerIsVice)) {
      console.warn('PROFILE_NOT_AUTHORIZED', {
        requestId,
        userId: user.id,
        role: caller.role,
        isOwner: caller.is_owner,
        active: caller.active,
      });
      return reply(403, {
        message: 'Permesso negato: il profilo autenticato non risulta titolare o vice amministratore attivo.',
      }, requestId);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase().replaceAll('-', '_');

    if (action === 'reset_password') {
      const targetId = String(body.user_id || '').trim();
      const password = String(body.password || '');
      if (!targetId || password.length < 8) {
        return reply(400, { message: 'Utente e password di almeno 8 caratteri sono obbligatori' }, requestId);
      }

      const { data: targetRows, error: targetError } = await admin.rpc('edge_profile_lookup', {
        p_user_id: targetId,
      });
      const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;
      if (targetError || !target) return reply(404, { message: 'Utente non trovato' }, requestId);
      if (target.role === 'owner' || target.is_owner === true) {
        return reply(403, { message: 'La password del titolare è protetta' }, requestId);
      }
      if (callerIsVice && target.role !== 'dipendente') {
        return reply(403, { message: 'Il Vice Amministratore può modificare solo password dei dipendenti' }, requestId);
      }

      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) return reply(400, { message: error.message }, requestId);
      console.log('PASSWORD_RESET_OK', { requestId, callerId: user.id, targetId });
      return reply(200, { message: 'Password aggiornata correttamente' }, requestId);
    }

    if (action !== 'create_user') return reply(400, { message: 'Azione non valida' }, requestId);

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.full_name || '').trim();
    const role = String(body.role || 'dipendente').trim();
    const employeeCode = String(body.employee_code || '').trim() || null;

    if (!email || !fullName || password.length < 8) {
      return reply(400, { message: 'Email, nome e password di almeno 8 caratteri sono obbligatori' }, requestId);
    }
    if (!['dipendente', 'vice_admin'].includes(role)) {
      return reply(400, { message: 'Ruolo non valido' }, requestId);
    }
    if (role === 'vice_admin' && !callerIsOwner) {
      return reply(403, { message: 'Solo il titolare può creare un Vice Amministratore' }, requestId);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) {
      return reply(400, { message: createError?.message || 'Creazione utente non riuscita' }, requestId);
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      employee_code: employeeCode,
      active: true,
      is_owner: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      console.error('PROFILE_CREATE_ERROR', { requestId, error: profileError.message });
      return reply(400, { message: `Profilo non creato: ${profileError.message}` }, requestId);
    }

    console.log('USER_CREATE_OK', { requestId, callerId: user.id, createdId: created.user.id, role });
    return reply(200, {
      message: role === 'vice_admin' ? 'Vice Amministratore creato' : 'Dipendente creato',
      user_id: created.user.id,
    }, requestId);
  } catch (error) {
    console.error('UNEXPECTED_ERROR', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return reply(500, { message: error instanceof Error ? error.message : 'Errore inatteso' }, requestId);
  }
});
