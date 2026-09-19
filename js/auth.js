let authMode = 'login';

function openAuthModal(mode = 'login') {
  authMode = mode;
  document.querySelector('#auth-gate').hidden = false;
  const nameField = document.querySelector('#auth-name-field');
  nameField.hidden = mode !== 'register';
  nameField.setAttribute('aria-hidden', String(mode !== 'register'));
  document.querySelector('#auth-name').required = mode === 'register';
  document.querySelector('#auth-title').innerHTML = mode === 'login' ? 'Seu ritmo,<br><strong>seu resultado.</strong>' : 'Comece sua<br><strong>melhor fase.</strong>';
  document.querySelector('#auth-submit').textContent = mode === 'login' ? 'Entrar' : 'Criar conta';
  document.querySelector('#auth-switch').textContent = mode === 'login' ? 'Ainda não tenho uma conta' : 'Já tenho uma conta';
  document.querySelector('#auth-feedback').textContent = hasSupabase() ? '' : 'Configure o Supabase para ativar sua conta.';
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
  if (authMode === 'register' && password.length < 6) {
    button.disabled = false;
    feedback.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
    return;
  }
  try {
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
      feedback.textContent = translateAuthError(result.error);
      return;
    }
    if (authMode === 'register' && !result.data.session) {
      feedback.textContent = 'Cadastro criado. Verifique seu e-mail para confirmar a conta.';
      document.querySelector('#auth-form').reset();
      return;
    }
    feedback.textContent = 'Login realizado.';
    window.location.reload();
  } catch (error) {
    feedback.textContent = 'Não foi possível conectar ao Supabase. Verifique a URL, a chave pública e sua conexão.';
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

function translateAuthError(error) {
  const messages = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado. Tente entrar.',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  };
  return messages[error.message] || error.message;
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
