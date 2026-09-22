let authMode = 'login';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000;

// Aberto como file://, o navegador reporta origin "null" e não existe endereço de retorno
// válido: o link do e-mail apontaria para "null/C:/..." e o Supabase recusa com
// "requested path is invalid". Manifest e service worker também não carregam assim.
function isFileProtocol() {
  return window.location.protocol === 'file:';
}

const FILE_PROTOCOL_MESSAGE = 'Abra o app por um servidor local (Live Server, em http://127.0.0.1:5500) em vez de abrir o arquivo direto. Em file:// o link do e-mail, o manifest e o modo offline não funcionam.';

// Para onde o link do e-mail devolve o usuário. Precisa estar liberada em
// Authentication > URL Configuration > Redirect URLs, senão o Supabase responde
// "requested path is invalid" antes mesmo de chegar até aqui.
function authRedirectUrl() {
  return window.location.origin + window.location.pathname;
}

// O Supabase devolve os parâmetros no hash (fluxo implícito) ou na query (fluxo PKCE),
// e usa os mesmos campos para avisar que o link expirou.
function readAuthRedirect() {
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search || '');
  const pick = (name) => hash.get(name) || query.get(name);
  return {
    type: pick('type'),
    error: pick('error_description') || pick('error'),
  };
}

function translateRedirectError(message) {
  const texto = String(message || '').toLowerCase();
  if (texto.includes('expired') || texto.includes('otp_expired')) {
    return t('O link do e-mail expirou ou já foi usado. Peça um novo abaixo.');
  }
  if (texto.includes('invalid')) {
    return t('O link do e-mail não é válido. Peça um novo abaixo.');
  }
  return t('Não foi possível validar o link do e-mail. Peça um novo abaixo.');
}

// Limpa o token da barra de endereços depois de usá-lo.
function clearAuthRedirect() {
  window.history.replaceState(null, '', window.location.pathname);
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  document.querySelector('#auth-gate').hidden = false;
  const nameField = document.querySelector('#auth-name-field');
  const passwordRules = document.querySelector('#password-rules');
  const passwordField = document.querySelector('#auth-password-field');
  const confirmPasswordField = document.querySelector('#auth-confirm-password-field');
  const forgotButton = document.querySelector('#forgot-password');
  nameField.hidden = mode !== 'register';
  nameField.setAttribute('aria-hidden', String(mode !== 'register'));
  document.querySelector('#auth-name').required = mode === 'register';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const isForgot = mode === 'forgot';
  passwordRules.hidden = !isRegister && !isReset;
  passwordRules.setAttribute('aria-hidden', String(!isRegister && !isReset));
  passwordField.hidden = isForgot;
  passwordField.setAttribute('aria-hidden', String(isForgot));
  document.querySelector('#auth-password').required = !isForgot;
  confirmPasswordField.hidden = !isReset;
  confirmPasswordField.setAttribute('aria-hidden', String(!isReset));
  document.querySelector('#auth-confirm-password').required = isReset;
  document.querySelector('#auth-password').autocomplete = isRegister || isReset ? 'new-password' : 'current-password';
  setAuthTitle(isRegister ? [t('Comece sua'), t('melhor fase.')] : isForgot ? [t('Recupere seu'), t('acesso.')] : isReset ? [t('Crie uma'), t('nova senha.')] : [t('Seu ritmo,'), t('seu resultado.')]);
  document.querySelector('#auth-submit').textContent = isRegister ? t('Criar conta') : isForgot ? t('Enviar link') : isReset ? t('Salvar nova senha') : t('Entrar');
  document.querySelector('#auth-switch').textContent = isRegister ? t('Já tenho uma conta') : isForgot || isReset ? t('Voltar para entrar') : t('Ainda não tenho uma conta');
  forgotButton.hidden = mode !== 'login';
  document.querySelector('#auth-feedback').textContent = hasSupabase() ? '' : t('Configure o Supabase para ativar sua conta.');
}

function setAuthTitle(lines) {
  const title = document.querySelector('#auth-title');
  title.replaceChildren();
  title.append(document.createTextNode(lines[0]));
  if (lines[1]) {
    title.append(document.createElement('br'));
    const emphasis = document.createElement('strong');
    emphasis.textContent = lines[1];
    title.append(emphasis);
  }
}

function closeAuthModal() {
  document.querySelector('#auth-gate').hidden = true;
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const feedback = document.querySelector('#auth-feedback');
  const button = document.querySelector('#auth-submit');
  if (!hasSupabase()) {
    feedback.textContent = t('Adicione a URL e a anon key em js/supabase.js.');
    return;
  }
  // Cadastro, recuperação e redefinição dependem de uma URL de retorno válida.
  if (isFileProtocol() && authMode !== 'login') {
    feedback.textContent = t(FILE_PROTOCOL_MESSAGE);
    return;
  }
  button.disabled = true;
  feedback.textContent = t('Aguarde...');
  const name = document.querySelector('#auth-name').value.trim();
  const email = document.querySelector('#auth-email').value.trim().toLowerCase();
  const password = document.querySelector('#auth-password').value;
  if (authMode === 'login' && isLoginLocked(email)) {
    button.disabled = false;
    feedback.textContent = getLockoutMessage(email);
    return;
  }
  if ((authMode === 'register' || authMode === 'reset') && !isStrongPassword(password)) {
    button.disabled = false;
    feedback.textContent = t('Escolha uma senha que cumpra todos os requisitos indicados.');
    return;
  }
  if (authMode === 'reset' && password !== document.querySelector('#auth-confirm-password').value) {
    button.disabled = false;
    feedback.textContent = t('As senhas não coincidem.');
    return;
  }
  if (authMode === 'forgot' || authMode === 'register') {
    const espera = remainingEmailCooldown(email);
    if (espera > 0) {
      button.disabled = false;
      feedback.textContent = t('Já enviamos um e-mail para este endereço. Aguarde {0} segundos antes de pedir outro.', Math.ceil(espera / 1000));
      return;
    }
  }
  try {
    if (authMode === 'forgot') {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
      if (error) throw error;
      markEmailSent(email);
      feedback.textContent = t('Se esse e-mail existir, enviaremos um link para redefinir sua senha.');
      return;
    }
    if (authMode === 'reset') {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      feedback.textContent = t('Senha atualizada. Faça login novamente.');
      clearAuthRedirect();
      openAuthModal('login');
      return;
    }
    const result = authMode === 'login'
      ? await supabaseClient.auth.signInWithPassword({ email, password })
      : await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: authRedirectUrl(),
        },
      });
    if (result.error) {
      if (authMode === 'login' && result.error.message === 'Invalid login credentials') recordLoginFailure(email);
      feedback.textContent = translateAuthError(result.error);
      return;
    }
    if (authMode === 'register' && !result.data.session) {
      markEmailSent(email);
      feedback.textContent = t('Cadastro criado. Verifique seu e-mail para confirmar a conta.');
      document.querySelector('#auth-form').reset();
      return;
    }
    feedback.textContent = t('Login realizado.');
    clearLoginFailures(email);
    window.location.reload();
  } catch (error) {
    feedback.textContent = translateAuthError(error);
  } finally {
    button.disabled = false;
  }
}

// Cada pedido de e-mail consome cota do projeto. Segurar o reenvio por um minuto aqui
// evita queimar o limite com cliques repetidos e receber 429 do servidor.
const EMAIL_COOLDOWN_MS = 60 * 1000;

function getEmailCooldownKey(email) { return `nutritrack-email-sent:${email}`; }

function remainingEmailCooldown(email) {
  try {
    const last = Number(localStorage.getItem(getEmailCooldownKey(email))) || 0;
    return Math.max(0, EMAIL_COOLDOWN_MS - (Date.now() - last));
  } catch {
    return 0;
  }
}

function markEmailSent(email) {
  try { localStorage.setItem(getEmailCooldownKey(email), String(Date.now())); } catch {}
}

function getAttemptKey(email) { return `nutritrack-login-attempts:${email}`; }

function getAttemptState(email) {
  try { return JSON.parse(localStorage.getItem(getAttemptKey(email))) || { count: 0, lockedUntil: 0 }; } catch { return { count: 0, lockedUntil: 0 }; }
}

function isLoginLocked(email) {
  return getAttemptState(email).lockedUntil > Date.now();
}

function getLockoutMessage(email) {
  const remaining = Math.ceil((getAttemptState(email).lockedUntil - Date.now()) / 60000);
  return t('Muitas tentativas. Aguarde {0} minuto{1} antes de tentar novamente.', remaining, remaining === 1 ? '' : 's');
}

function recordLoginFailure(email) {
  const state = getAttemptState(email);
  state.count += 1;
  if (state.count >= MAX_LOGIN_ATTEMPTS) state.lockedUntil = Date.now() + LOCKOUT_TIME_MS;
  try { localStorage.setItem(getAttemptKey(email), JSON.stringify(state)); } catch {}
}

function clearLoginFailures(email) {
  try { localStorage.removeItem(getAttemptKey(email)); } catch {}
}

// Traduz tanto o erro devolvido pelo SDK quanto a exceção lançada na chamada.
// O texto bruto entra no fim quando o caso não é conhecido: uma frase genérica esconde
// justamente a informação necessária para corrigir a configuração do projeto.
function translateAuthError(error) {
  const messages = {
    'Invalid login credentials': t('E-mail ou senha incorretos.'),
    'User already registered': t('Este e-mail já está cadastrado. Tente entrar.'),
    'Password should be at least 6 characters': t('A senha precisa ter pelo menos 8 caracteres.'),
    'Email not confirmed': t('Confirme seu e-mail antes de entrar. Procure a mensagem de confirmação na caixa de entrada.'),
  };
  if (messages[error && error.message]) return messages[error.message];

  const texto = String((error && error.message) || '').toLowerCase();
  const status = (error && (error.status || error.code)) || '';

  if (texto.includes('redirect')) {
    return t('A URL de retorno não está liberada no projeto. Adicione este endereço em Authentication > URL Configuration > Redirect URLs.');
  }
  if (status === 429 || texto.includes('rate limit') || texto.includes('for security purposes') || texto.includes('too many')) {
    // O próprio Supabase costuma dizer quantos segundos faltam: repassa o número.
    const espera = texto.match(/after (\d+) seconds?/);
    const quando = espera ? t('{0} segundos', espera[1]) : t('alguns minutos');
    return t('Limite de envio de e-mails atingido. Aguarde {0} antes de pedir outro. O serviço de e-mail padrão do Supabase tem cota baixa; para uso real configure um SMTP próprio em Authentication > Emails.', quando);
  }
  if (texto.includes('sending') && texto.includes('mail')) {
    return t('O Supabase não conseguiu enviar o e-mail. Verifique o provedor de e-mail do projeto em Authentication > Emails.');
  }
  if (texto.includes('failed to fetch') || texto.includes('networkerror') || texto.includes('load failed')) {
    return t('Sem conexão com o Supabase. Verifique sua internet e a URL do projeto em js/supabase.js.');
  }
  if (texto.includes('should be different') || texto.includes('same password')) {
    return t('A nova senha precisa ser diferente da anterior.');
  }
  if (texto.includes('session') || texto.includes('jwt')) {
    return t('A sessão do link expirou. Peça um novo e-mail de redefinição.');
  }
  const detalhe = (error && error.message) || t('sem detalhes');
  return t('Não foi possível concluir a autenticação: {0}{1}', detalhe, status ? ` (${status})` : '');
}

function isStrongPassword(password) {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function updatePasswordRules(password) {
  const rules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  Object.entries(rules).forEach(([name, valid]) => {
    document.querySelector(`[data-rule="${name}"]`).classList.toggle('valid', valid);
  });
}

async function signOut() {
  if (hasSupabase()) await supabaseClient.auth.signOut();
  window.location.reload();
}

async function getCurrentUser() {
  if (!hasSupabase()) return null;
  const { data } = await supabaseClient.auth.getUser();
  return data.user;
}

function showAuthenticatedApp(user) {
  document.querySelector('#auth-gate').hidden = true;
  document.querySelector('#app-shell').hidden = false;
  const name = user.user_metadata?.name || user.email.split('@')[0];
  const initials = getInitials(name);
  document.querySelector('#user-name').textContent = name;
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#profile-name-input').value = name;
  document.querySelector('[data-action="profile"]').textContent = initials;
  document.querySelector('#profile-avatar').textContent = initials;
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'FL';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] || '';
  return `${first}${last}`.toUpperCase();
}

// No fluxo PKCE o link de recuperação volta apenas como ?code=..., sem type=recovery.
// Este evento dispara em qualquer um dos fluxos assim que a sessão de recuperação é criada.
if (hasSupabase()) {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') openAuthModal('reset');
  });
}
