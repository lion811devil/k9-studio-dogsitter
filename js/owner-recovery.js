'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const show = (element, visible) => element?.classList.toggle('hidden', !visible);

  function configured() {
    return Boolean(window.C?.SUPABASE_URL && window.C?.SUPABASE_ANON_KEY);
  }

  function openOwnerRecovery() {
    const login = $('#loginForm');
    const passwordRecovery = $('#passwordRecoveryForm');
    const ownerRecovery = $('#ownerRecoveryForm');
    const authError = $('#authError');
    if (!ownerRecovery) {
      if (authError) authError.textContent = 'Modulo Recupero titolare non disponibile.';
      return;
    }
    show(login, false);
    show(passwordRecovery, false);
    show(ownerRecovery, true);
    const loginEmail = $('#loginEmail')?.value?.trim();
    const ownerEmail = $('#ownerRecoveryEmail');
    if (loginEmail && ownerEmail && !ownerEmail.value) ownerEmail.value = loginEmail;
    const error = $('#ownerRecoveryError');
    if (error) error.textContent = '';
    ownerEmail?.focus();
  }

  function closeOwnerRecovery() {
    show($('#ownerRecoveryForm'), false);
    show($('#passwordRecoveryForm'), false);
    show($('#loginForm'), true);
    const error = $('#ownerRecoveryError');
    if (error) error.textContent = '';
  }

  async function submitOwnerRecovery(event) {
    event.preventDefault();
    const error = $('#ownerRecoveryError');
    const button = event.currentTarget.querySelector('button.primary');
    try {
      if (error) error.textContent = '';
      if (!configured()) throw new Error('Configura config.js.');
      const email = $('#ownerRecoveryEmail')?.value?.trim().toLowerCase() || '';
      const recoveryCode = $('#ownerRecoveryCode')?.value || '';
      const password = $('#ownerRecoveryPassword')?.value || '';
      const confirmPassword = $('#ownerRecoveryPasswordConfirm')?.value || '';
      if (!email) throw new Error('Inserisci l’email del titolare.');
      if (recoveryCode.length < 24) throw new Error('Il codice di recupero deve contenere almeno 24 caratteri.');
      if (password.length < 12) throw new Error('La nuova password deve contenere almeno 12 caratteri.');
      if (password !== confirmPassword) throw new Error('Le due password non coincidono.');
      if (!confirm('Confermi il recupero di emergenza dell’account Titolare?')) return;
      if (button) {
        button.disabled = true;
        button.textContent = 'Ripristino in corso…';
      }
      const response = await fetch(`${window.C.SUPABASE_URL}/functions/v1/hyper-handler`, {
        method: 'POST',
        headers: {
          apikey: window.C.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'emergency_owner_recovery',
          email,
          recovery_code: recoveryCode,
          password
        })
      });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
      if (!response.ok) throw new Error(data?.message || `Recupero titolare non riuscito (${response.status}).`);
      closeOwnerRecovery();
      const loginEmail = $('#loginEmail');
      const loginPassword = $('#loginPassword');
      const authError = $('#authError');
      if (loginEmail) loginEmail.value = email;
      if (loginPassword) loginPassword.value = '';
      if (authError) authError.textContent = 'Accesso del Titolare ripristinato. Inserisci la nuova password.';
    } catch (err) {
      if (error) error.textContent = err?.message || 'Recupero titolare non riuscito.';
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Ripristina accesso titolare';
      }
    }
  }

  function bind() {
    const openButton = $('#emergencyOwnerRecovery');
    const cancelButton = $('#cancelOwnerRecovery');
    const form = $('#ownerRecoveryForm');
    if (openButton && !openButton.dataset.recoveryBound) {
      openButton.dataset.recoveryBound = '1';
      openButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!configured()) {
          const authError = $('#authError');
          if (authError) authError.textContent = 'Configura config.js.';
          return;
        }
        openOwnerRecovery();
      }, true);
    }
    if (cancelButton && !cancelButton.dataset.recoveryBound) {
      cancelButton.dataset.recoveryBound = '1';
      cancelButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeOwnerRecovery();
      }, true);
    }
    if (form && !form.dataset.recoveryBound) {
      form.dataset.recoveryBound = '1';
      form.addEventListener('submit', submitOwnerRecovery, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
  window.addEventListener('pageshow', bind);
})();
