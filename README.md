# FitLab

PWA mobile-first para contagem de calorias e acompanhamento nutricional. Usa HTML, CSS e JavaScript puro e foi preparado para hospedagem estática no Cloudflare Pages.

## Rodar localmente

Abra a pasta no VS Code e use a extensão Live Server ou outro servidor HTTP local. O Service Worker não funciona corretamente com `file://`.

## Supabase

O aplicativo agora exige uma sessão do Supabase antes de revelar o dashboard. Configure a URL e a chave `anon public` em `js/supabase.js` (ou defina `window.FITLAB_SUPABASE_URL` e `window.FITLAB_SUPABASE_ANON_KEY` antes desse script). A `service_role key` nunca deve ser usada no frontend.

Em um site estático do Cloudflare Pages, variáveis `.env` não são injetadas automaticamente no JavaScript do navegador. A URL e a anon key são credenciais públicas destinadas ao frontend; a proteção dos dados vem do Auth e das políticas RLS do banco. Nunca publique a service role key.

No Supabase, em **Authentication > URL Configuration**, defina **Site URL** como a URL do Cloudflare Pages e adicione essa mesma URL em **Redirect URLs**. Execute todo o arquivo `supabase.sql` no SQL Editor para ativar RLS e criar o perfil automaticamente no cadastro.

## Cloudflare Pages

Envie o projeto para GitHub, conecte o repositório no Cloudflare Pages, deixe o comando de build vazio e use a raiz como diretório de saída.

## iPhone

Abra a URL publicada no Safari, toque em Compartilhar e escolha **Adicionar à Tela de Início**. O manifest, o apple-touch-icon e as meta tags já estão configurados para o FitLab.

## Estado atual

- Tela de login/cadastro obrigatória antes do dashboard.
- Supabase Auth, busca de alimentos e leitura/exclusão de refeições preparados.
- Dashboard mobile-first com totais nutricionais calculados a partir das refeições.
- RLS definido em `supabase.sql` para que cada usuário veja apenas seus próprios registros.

## Próxima etapa

Adicionar o formulário de seleção de alimento, quantidade e tipo de refeição para completar o fluxo de criação de registros.
