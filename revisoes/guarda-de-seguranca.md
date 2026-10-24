# Relatório do guarda de segurança — Meu Bolso (Despesas Hatz)

Examinei todos os arquivos do projeto, menos a pasta `.git`. Só li, não alterei nada. Os trechos citados mostram só os 6 primeiros caracteres.

## Resultado

| Arquivo | O que encontrou | Gravidade | O que fazer |
|---|---|---|---|
| `app/configuracao.js` (linha 6) | Chave pública do Supabase (`sb_pub…`). É o lugar permitido para ela. | BAIXA | Nada. É uma chave feita para ficar no app. A proteção por linha é que garante os dados. |
| `netlify/functions/assistente.mjs` (linha 9) | A mesma chave pública (`sb_pub…`), no topo do arquivo. É o lugar permitido. | BAIXA | Nada. |
| `netlify/functions/assistente.mjs` (linhas 4, 175, 184, 260) | `process.env.CHAVE_GEMINI` e a palavra `api_key`. É só o nome da variável. A chave do Gemini não está escrita. | BAIXA | Nada. A chave deve continuar só nas variáveis da Netlify. |
| `netlify/functions/assistente.mjs` e `app/app.js` | A palavra `token` aparece como variável do login da pessoa (`access_token`), lido na hora. Não há valor escrito. | BAIXA | Nada. |
| `app/app.js`, `app/index.html` | A palavra `senha` aparece só no campo de entrada e nas mensagens de erro. Não há senha escrita. | BAIXA | Nada. |
| `supabase/*.sql` | Nenhuma chave, senha, token ou dado pessoal. Só tabelas, regras de proteção por linha e agendamentos. | BAIXA | Nada. |
| `.gitignore` | Tem `.env`, `.netlify` e `node_modules`. | OK | Nada. |
| Arquivos `.env` | Não existe nenhum `.env` no projeto. | OK | Nada. |

## Conferências feitas

- **Chave secreta**: não achei `sb_secret`, `service_role`, `AIza`, `eyJ`. Também não achei variável de segredo com valor escrito.
- **Senha**: nenhuma senha escrita em arquivo.
- **Token**: nenhum `ghp_` nem `github_pat_`, e nenhum token de acesso escrito.
- **Dado pessoal**: não achei CPF, cartão, conta, telefone, endereço ou e-mail em nenhum arquivo.
- **Chave pública do Supabase**: aparece só em `app/configuracao.js` e no topo de `netlify/functions/assistente.mjs`. Nos dois lugares é permitida.
- **`.gitignore`**: tem `.env` e `.netlify`.

## Resumo

Não há nenhum achado de gravidade ALTA ou MÉDIA. Só há itens BAIXA, que são nomes ou usos normais, sem segredo escrito.

PODE ENVIAR
