# Rifa Digital

Projeto Next.js com Tailwind CSS e Supabase para rifa digital com reserva de números em tempo real e envio para WhatsApp.

## Rodar localmente

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Abra http://localhost:3000.

## Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor.
3. Cole e execute o arquivo `sql/supabase.sql`.
4. Copie a Project URL e a anon public key para `.env.local`.

## Deploy na Vercel

Adicione as mesmas variáveis do `.env.local.example` em Project Settings > Environment Variables.

## Observação

O painel admin usa senha simples no frontend para facilitar. Para produção real, o ideal é proteger com autenticação do Supabase.
