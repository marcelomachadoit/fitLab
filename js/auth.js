let authMode = 'login';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000;

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
  setAuthTitle(isRegister ? ['Comece sua', 'melhor fase.'] : isForgot ? ['Recupere seu', 'acesso.'] : isReset ? ['Crie uma', 'nova senha.'] : ['Seu ritmo,', 'seu resultado.']);
  document.querySelector('#auth-submit').textContent = isRegister ? 'Criar conta' : isForgot ? 'Enviar link' : isReset ? 'Salvar nova senha' : 'Entrar';
  document.querySelector('#auth-switch').textContent = isRegister ? 'Já tenho uma conta' : isForgot || isReset ? 'Voltar para entrar' : 'Ainda não tenho uma conta';
  forgotButton.hidden = mode !== 'login';
  document.querySelector('#auth-feedback').textContent = hasSupabase() ? '' : 'Configure o Supabase para ativar sua conta.';
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
    feedback.textContent = 'Adicione a URL e a anon key em js/supabase.js.';
    return;
  }
  button.disabled = true;
  feedback.textContent = 'Aguarde...';
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
    feedback.textContent = 'Escolha uma senha que cumpra todos os requisitos indicados.';
    return;
  }
  if (authMode === 'reset' && password !== document.querySelector('#auth-confirm-password').value) {
    button.disabled = false;
    feedback.textContent = 'As senhas não coincidem.';
    return;
  }
  try {
    if (authMode === 'forgot') {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (error) throw error;
      feedback.textContent = 'Se esse e-mail existir, enviaremos um link para redefinir sua senha.';
      return;
    }
    if (authMode === 'reset') {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      feedback.textContent = 'Senha atualizada. Faça login novamente.';
      window.history.replaceState(null, '', window.location.pathname);
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
          emailRedirectTo: window.location.origin + window.location.pathname,
        },
      });
    if (result.error) {
      if (authMode === 'login' && result.error.message === 'Invalid login credentials') recordLoginFailure(email);
      feedback.textContent = translateAuthError(result.error);
      return;
    }
    if (authMode === 'register' && !result.data.session) {
      feedback.textContent = 'Cadastro criado. Verifique seu e-mail para confirmar a conta.';
      document.querySelector('#auth-form').reset();
      return;
    }
    feedback.textContent = 'Login realizado.';
    clearLoginFailures(email);
    window.location.reload();
  } catch (error) {
    feedback.textContent = 'Não foi possível conectar ao Supabase. Verifique a URL, a chave pública e sua conexão.';
  } finally {
    button.disabled = false;
  }
}

function getAttemptKey(email) { return `fitlab-login-attempts:${email}`; }

function getAttemptState(email) {
  try { return JSON.parse(localStorage.getItem(getAttemptKey(email))) || { count: 0, lockedUntil: 0 }; } catch { return { count: 0, lockedUntil: 0 }; }
}

function isLoginLocked(email) {
  return getAttemptState(email).lockedUntil > Date.now();
}

function getLockoutMessage(email) {
  const remaining = Math.ceil((getAttemptState(email).lockedUntil - Date.now()) / 60000);
  return `Muitas tentativas. Aguarde ${remaining} minuto${remaining === 1 ? '' : 's'} antes de tentar novamente.`;
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

function translateAuthError(error) {
  const messages = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado. Tente entrar.',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 8 caracteres.',
  };
  return messages[error.message] || 'Não foi possível concluir a autenticação. Tente novamente.';
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
    const rule = document.querySelector(`[data-rule="${name}"]`);
    rule.classList.toggle('valid', valid);
    rule.textContent = `${valid ? '✓' : '○'} ${rule.textContent.replace(/^[✓○] /, '')}`;
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
  document.querySelector('#user-name').textContent = name;
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-email').textContent = user.email;
  document.querySelector('#profile-name-input').value = name;
}
