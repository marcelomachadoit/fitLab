# FitLab

PWA mobile-first para contagem de calorias e acompanhamento nutricional. Usa HTML, CSS e JavaScript puro e foi preparado para hospedagem estática no Cloudflare Pages.

## Rodar localmente

Abra a pasta no VS Code e use a extensão Live Server ou outro servidor HTTP local. O Service Worker não funciona corretamente com `file://`.

## Supabase

A integração será adicionada na Fase 2. Copie `.env.example` para `.env.local` e configure URL e chave anon pública. A `service_role key` nunca deve ser usada no frontend.

## Cloudflare Pages

Envie o projeto para GitHub, conecte o repositório no Cloudflare Pages, deixe o comando de build vazio e use a raiz como diretório de saída.

## iPhone

Abra a URL publicada no Safari, toque em Compartilhar e escolha **Adicionar à Tela de Início**. O manifest, o apple-touch-icon e as meta tags já estão configurados para o FitLab.

## Próximas fases

- Fase 2: cadastro, login e Supabase Auth.
- Fase 3: alimentos e refeições persistidos no PostgreSQL com RLS.
- Fase 4: refinamento offline e ícones dedicados 192/512.
- Fase 5: deploy e testes finais em iPhone.
