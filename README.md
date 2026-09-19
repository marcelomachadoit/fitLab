# FitLab

PWA mobile-first para contagem de calorias e acompanhamento nutricional. Usa HTML, CSS e JavaScript puro e foi preparado para hospedagem estática no Cloudflare Pages.

## Rodar localmente

Abra a pasta no VS Code e use a extensão Live Server ou outro servidor HTTP local. O Service Worker não funciona corretamente com `file://`.

## Supabase

O aplicativo agora exige uma sessão do Supabase antes de revelar o dashboard. Configure a URL e a chave `anon public` em `js/supabase.js` (ou defina `window.FITLAB_SUPABASE_URL` e `window.FITLAB_SUPABASE_ANON_KEY` antes desse script). A `service_role key` nunca deve ser usada no frontend.

Em um site estático do Cloudflare Pages, variáveis `.env` não são injetadas automaticamente no JavaScript do navegador. A URL e a anon key são credenciais públicas destinadas ao frontend; a proteção dos dados vem do Auth e das políticas RLS do banco. Nunca publique a service role key.

No Supabase, em **Authentication > URL Configuration**, defina **Site URL** como a URL do Cloudflare Pages e adicione essa mesma URL em **Redirect URLs**. Execute todo o arquivo `supabase.sql` no SQL Editor para ativar RLS e criar o perfil automaticamente no cadastro.

Em **Authentication > Password Security**, defina o tamanho mínimo da senha como `8` e mantenha a proteção contra senhas vazadas habilitada. O frontend também exige uma letra maiúscula, uma minúscula, um número e um caractere especial antes de chamar o cadastro.

O login bloqueia novas tentativas por 15 minutos depois de 5 falhas no mesmo navegador para o mesmo e-mail. Essa é uma camada adicional: a proteção principal contra força bruta deve continuar sendo o rate limit do Supabase Auth. O link **Esqueci minha senha** usa `resetPasswordForEmail`; configure a URL do Cloudflare Pages em **Authentication > URL Configuration > Redirect URLs** para que o link de recuperação retorne ao app.

## Alimentos e receitas do usuário

Além da base compartilhada, cada conta pode criar os próprios alimentos e receitas pela aba **Alimentos**:

- **Adicionar alimento** grava nome, unidade (`g`, `ml` ou `un`), a quantidade base de referência e os valores correspondentes a ela — calorias, proteína, carboidratos e gordura. A base é livre: dá para cadastrar "por 30 g", "por 250 ml" ou "por 1 unidade", não só por 100. O alimento recebe `user_id` e aparece na lista com o selo "Meu", com botões de editar e excluir.
- **Adicionar receita** monta uma combinação fixa de alimentos com quantidade (ex.: "Almoço 1" = 100 g de arroz + 100 g de feijão + 150 g de carne), somando calorias e macros automaticamente. Serve para quem repete as mesmas refeições.

O seletor de alimento tem uma busca por texto que filtra o catálogo carregado em memória, sem ir ao servidor. Ela ignora acentos e maiúsculas — "acucar" encontra "Açúcar", "pao" encontra os quatro pães — e mostra a contagem de resultados ao lado do rótulo.

Ao incluir um ingrediente dá para escolher a medida: a unidade base do alimento (`g`, `ml` ou `un`) ou a porção prática, quando o alimento tem `portion_amount` — "1 unidade média (90 g)", "1 copo (200 ml)". O app converte para a unidade base antes de salvar, então `recipe_items.quantity` está sempre na mesma escala dos valores nutricionais. Medidas sem conversão conhecida não são oferecidas: transformar g em ml exigiria a densidade do alimento, e o resultado seria um número inventado. Para liberar a medida por unidade em um alimento seu, preencha "Peso de 1 unidade" no cadastro dele.

Ambos são privados: a RLS entrega a um usuário apenas a base compartilhada (`foods.user_id is null`) e as próprias linhas. Um usuário não consegue ler, editar nem apagar o conteúdo de outro, e também não consegue alterar a base compartilhada — ela só muda pelo SQL Editor.

Excluir um alimento o remove das receitas em que aparece (`on delete cascade`). Se ele já estiver em uma refeição registrada, o banco recusa a exclusão e o app avisa, para não apagar histórico.

## Base de alimentos

A tabela `public.foods` é compartilhada por todos os usuários: qualquer conta autenticada lê, e ninguém escreve pelo aplicativo (a RLS só tem policy de `select`). A carga é feita pelo SQL Editor do Supabase.

Depois de rodar `supabase.sql`, execute `supabase-foods.sql` para inserir os 166 itens da base nutricional (150 alimentos, 15 bebidas alcoólicas e 1 energético). O script é idempotente: ele faz `upsert` pelo nome, então rodar de novo atualiza os valores sem duplicar registros e sem alterar os `id` já referenciados em `public.meals`.

Os valores vêm de `data/tabela-nutricional.txt`, que é a fonte da verdade — para corrigir um alimento, edite o `.txt` e gere o SQL de novo. Cada item guarda:

- `calories`, `protein`, `carbohydrates` e `fat` correspondentes a `serving_size` na unidade de `base_unit` (`g`, `ml` ou `un`). Na base compartilhada `serving_size` é sempre 100; nos alimentos do usuário é livre;
- `portion_label` e `portion_amount` com a porção comum aproximada (ex.: `1 xícara (150 g)` / `150`), nula nas bebidas alcoólicas;
- quantidades intermediárias são calculadas por regra de três em `calculateNutrition()`.

## Cloudflare Pages

Envie o projeto para GitHub, conecte o repositório no Cloudflare Pages, deixe o comando de build vazio e use a raiz como diretório de saída.

## iPhone

Abra a URL publicada no Safari, toque em Compartilhar e escolha **Adicionar à Tela de Início**. O manifest, o apple-touch-icon e as meta tags já estão configurados para o FitLab.

## Estado atual

- Tela de login/cadastro obrigatória antes do dashboard.
- Supabase Auth, busca de alimentos e leitura/exclusão de refeições preparados.
- Base nutricional com 166 itens em `supabase-foods.sql`, com macros por 100 g/ml e porção comum.
- Dashboard mobile-first com totais nutricionais calculados a partir das refeições.
- RLS definido em `supabase.sql` para que cada usuário veja apenas seus próprios registros.
- Interface com design system em `css/style.css` (tokens de cor, raio, sombra e movimento), ícones SVG inline e tema claro/escuro. O tema segue a preferência do sistema e pode ser alternado no botão da barra superior; a escolha fica salva em `localStorage`.

## Próxima etapa

Adicionar o formulário de seleção de alimento, quantidade e tipo de refeição para completar o fluxo de criação de registros.
