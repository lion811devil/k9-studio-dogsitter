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

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase().replaceAll('-', '_');

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === 'emergency_owner_recovery') {
      const enabled = String(Deno.env.get('OWNER_RECOVERY_ENABLED') || '').toLowerCase() === 'true';
      const configuredSecret = String(Deno.env.get('OWNER_RECOVERY_SECRET') || '');
      const expiresAt = String(Deno.env.get('OWNER_RECOVERY_EXPIRES_AT') || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const suppliedSecret = String(body.recovery_code || '');
      const password = String(body.password || '');

      if (!enabled) return reply(403, { message: 'Recupero titolare disattivato.' }, requestId);
      if (configuredSecret.length < 24) return reply(500, { message: 'Secret di recupero non configurato correttamente.' }, requestId);
      if (expiresAt) {
        const expiry = Date.parse(expiresAt);
        if (!Number.isFinite(expiry) || Date.now() > expiry) return reply(403, { message: 'Procedura di recupero scaduta.' }, requestId);
      }
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return reply(400, { message: 'Email titolare non valida.' }, requestId);
      if (password.length < 12) return reply(400, { message: 'La nuova password deve contenere almeno 12 caratteri.' }, requestId);

      const constantTimeEqual = (a: string, b: string) => {
        const left = new TextEncoder().encode(a);
        const right = new TextEncoder().encode(b);
        let diff = left.length ^ right.length;
        const length = Math.max(left.length, right.length);
        for (let i = 0; i < length; i++) diff |= (left[i] || 0) ^ (right[i] || 0);
        return diff === 0;
      };
      if (!constantTimeEqual(configuredSecret, suppliedSecret)) {
        console.warn('OWNER_RECOVERY_REJECTED', { requestId, email });
        return reply(403, { message: 'Codice di recupero non valido.' }, requestId);
      }

      let targetUser: any = null;
      for (let page = 1; page <= 20 && !targetUser; page++) {
        const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        if (listError) return reply(500, { message: `Ricerca account non riuscita: ${listError.message}` }, requestId);
        targetUser = usersPage.users.find((candidate) => String(candidate.email || '').toLowerCase() === email) || null;
        if (usersPage.users.length < 100) break;
      }
      if (!targetUser) return reply(404, { message: 'Account titolare non trovato in Supabase Authentication.' }, requestId);

      const { error: updateAuthError } = await admin.auth.admin.updateUserById(targetUser.id, {
        password,
        email_confirm: true,
        ban_duration: 'none',
        user_metadata: { ...(targetUser.user_metadata || {}), recovered_owner: true },
      });
      if (updateAuthError) return reply(400, { message: `Password non aggiornata: ${updateAuthError.message}` }, requestId);

      const { data: existingProfile } = await admin.from('profiles').select('*').eq('id', targetUser.id).maybeSingle();
      const profilePayload: Record<string, unknown> = {
        ...(existingProfile || {}),
        id: targetUser.id,
        email,
        full_name: existingProfile?.full_name || targetUser.user_metadata?.full_name || email.split('@')[0],
        role: 'owner',
        active: true,
        is_owner: true,
        updated_at: new Date().toISOString(),
      };
      const { error: profileError } = await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      if (profileError) return reply(500, { message: `Password aggiornata, ma profilo titolare non ripristinato: ${profileError.message}` }, requestId);

      console.log('OWNER_RECOVERY_OK', { requestId, userId: targetUser.id, email });
      return reply(200, { message: 'Accesso del titolare ripristinato correttamente.' }, requestId);
    }

    const authorization = req.headers.get('Authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return reply(401, { message: 'Token utente mancante. Esci e accedi nuovamente.' }, requestId);
    }

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

    if (action === 'delete_user') {
      if (!callerIsOwner) {
        return reply(403, { message: 'Solo il titolare può eliminare definitivamente un account' }, requestId);
      }
      const targetId = String(body.user_id || '').trim();
      if (!targetId || targetId === user.id) {
        return reply(400, { message: 'Utente non valido. Il titolare non può eliminare il proprio account.' }, requestId);
      }

      const { data: targetRows, error: targetError } = await admin.rpc('edge_profile_lookup', {
        p_user_id: targetId,
      });
      const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;
      if (targetError || !target) return reply(404, { message: 'Utente non trovato' }, requestId);
      if (target.role === 'owner' || target.is_owner === true) {
        return reply(403, { message: 'Il titolare non può essere eliminato' }, requestId);
      }
      if (target.active === true) {
        return reply(409, { message: 'Prima disattiva l’account, poi ripeti l’eliminazione definitiva.' }, requestId);
      }

      // Il controllo viene eseguito in PostgreSQL tramite una funzione
      // SECURITY DEFINER. È più affidabile delle query REST con count/head
      // e rimane compatibile con installazioni aventi migrazioni storiche diverse.
      const { data: linkedData, error: linkedError } = await admin.rpc('edge_user_delete_link_check', {
        p_user_id: targetId,
      });
      if (linkedError) {
        console.error('USER_DELETE_LINK_CHECK_ERROR', {
          requestId,
          targetId,
          code: linkedError.code ?? null,
          message: linkedError.message ?? null,
          details: linkedError.details ?? null,
          hint: linkedError.hint ?? null,
        });
        return reply(500, {
          message: 'Controllo collegamenti non riuscito. Esegui la migrazione 12.4.2 e riprova.',
        }, requestId);
      }

      const linkedObject = (linkedData && typeof linkedData === 'object' && !Array.isArray(linkedData))
        ? linkedData as Record<string, number>
        : {};
      const labels: Record<string, string> = {
        servizi: 'servizi',
        clienti_assegnati: 'clienti assegnati',
        comunicazioni: 'comunicazioni operative',
        documenti_dipendente: 'documenti collegati',
        preventivi_creati: 'preventivi creati',
      };
      const linked = Object.entries(linkedObject)
        .filter(([, count]) => Number(count) > 0)
        .map(([key, count]) => `${labels[key] || key}: ${count}`);

      if (linked.length) {
        return reply(409, {
          message: `Account non eliminabile perché conserva dati operativi collegati (${linked.join(', ')}). Mantienilo disattivato per preservare lo storico.`,
        }, requestId);
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
      if (deleteError) {
        console.error('USER_DELETE_ERROR', { requestId, callerId: user.id, targetId, error: deleteError.message });
        return reply(400, { message: `Eliminazione non riuscita: ${deleteError.message}` }, requestId);
      }

      // In installazioni prive del trigger ON DELETE CASCADE, rimuove l'eventuale profilo residuo.
      await admin.from('profiles').delete().eq('id', targetId);
      console.log('USER_DELETE_OK', { requestId, callerId: user.id, targetId });
      return reply(200, { message: 'Account eliminato definitivamente' }, requestId);
    }

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
