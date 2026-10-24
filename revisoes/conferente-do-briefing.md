# Conferência do app contra o BRIEFING.md (Despesas Hatz / Meu Bolso)

Li o `BRIEFING.md` inteiro e os quatro arquivos pedidos: `app/index.html`, `app/estilo.css`, `app/app.js` e `app/configuracao.js`. Não abri o app, não rodei nada e não olhei a pasta `revisoes`. Onde só o app aberto responde, está escrito.

## Os 5 testes dos Observáveis

| Teste | Resultado | Motivo |
|---|---|---|
| 1. Cinco segundos (390 px, sem rolar, vejo mês, semana, dia e cada categoria) | **SÓ DÁ PARA SABER ABRINDO O APP** | A ordem está certa: `index.html` põe o cartão "Totais" (`#total-mes`, `#total-semana`, `#total-dia`) e logo abaixo "Por categoria" (`#barras`), com as 8 categorias sempre listadas, mesmo as zeradas (`desenharBarras` em `app.js`). Se tudo cabe sem rolar depende da altura da tela do celular. Pela soma dos tamanhos em `estilo.css` (`.total-mes` de 2.6rem, 8 barras de cerca de 44 px cada), dá uns 690 px de altura. Cabe num celular alto, mas pode passar do limite num celular baixo (por exemplo 667 px de altura). |
| 2. Dois toques (valor + 1 categoria + 1 Salvar, nenhum toque a mais) | **NÃO CUMPRE** (por pouco) | Os toques de categoria e Salvar estão certos. `descricao` e `data` são opcionais: `salvarGasto` só exige valor e categoria, e a data assume hoje. O problema é que o campo do valor não nasce pronto para digitar. Em `index.html`, `<input id="valor" ...>` não tem `autofocus`, e `app.js` nunca chama `.focus()` ao abrir (só dentro do erro de valor vazio). Então há um toque a mais para abrir o teclado. Além disso, o formulário fica abaixo dos totais e das categorias, então é preciso rolar para chegar nele. |
| 3. Soma certa (10,00 Mercado + 5,50 Farmácia + 4,50 Mercado = +20,00; Mercado 14,50) | **CUMPRE** (pelo código) | `somar()` em `app.js` soma em centavos (`Math.round(Number(g.valor) * 100)`), sem erro de arredondamento. Mês, semana e dia filtram a mesma lista, e as categorias somam por nome. `lerValor` aceita "10,00" e "4,50". Depois de salvar, `await carregarGastos()` redesenha tudo. Falta só confirmar com o banco real que a tabela `gastos` existe e aceita o `insert`. |
| 4. Controle na lista (gasto novo no topo, com data, categoria e valor; continua depois de fechar e abrir) | **CUMPRE** (pelo código) | `carregarGastos` ordena por `data` e depois por `criado_em`, ambos do mais novo para o mais velho. `desenharLista` mostra `dd/mm · categoria` e o valor em moeda. Os dados vêm do Supabase, não da memória do navegador, e a sessão do Supabase persiste por padrão. A persistência real só se prova abrindo o app. |
| 5. Erro em português (sem internet, ao salvar) | **CUMPRE** (pelo código) | O `catch` de `salvarGasto` chama `frase(erro)`. Essa função reconhece "failed to fetch", "network" e "load failed" e devolve "Sem conexão com a internet. Confira o Wi-Fi ou os dados móveis e tente de novo." Nenhuma mensagem técnica chega à tela. Só dá para ver a frase aparecendo desligando a internet com o app aberto. |

Resumo: 3 cumprem pelo código, 1 não cumpre por pouco, 1 só se sabe abrindo o app.

## Categorias (`window.MEU_BOLSO.CATEGORIAS` em `app/configuracao.js`)

**Iguais ao briefing.** São 8, com a mesma grafia e acentos: Mercado, Farmácia, Restaurante, Posto de gasolina, Internet, Personal, Condomínio, Outros. Não sobra nem falta nenhuma. "Personal" está sem o "(personal trainer)", que no briefing é só uma explicação.

## Outras partes do briefing

| Item | Resultado | Motivo |
|---|---|---|
| Toques máximos | Parcial | Veja o teste 2: categoria e Salvar estão em 1 toque cada. Falta o campo do valor já vir pronto. |
| Campo do valor com teclado numérico | CUMPRE | `inputmode="decimal"`. |
| Botões de categoria grandes para o polegar | CUMPRE, a confirmar no celular | `.categoria` tem `padding: 13px 8px`, em grade de 2 colunas, com 1 toque escolhendo e marcando. Se fica confortável só se vê no celular. |
| Totais: mês grande, semana e dia "ao lado, menores" | Parcial | O mês é grande (2.6rem) e semana e dia são menores (1.25rem). Mas semana e dia ficam embaixo do total do mês, lado a lado entre si, e não ao lado dele. A leitura rápida não parece prejudicada. |
| Categorias logo abaixo dos totais | CUMPRE | O cartão "Por categoria" vem logo depois de "Totais". |
| Ordem da tela | Pequena diferença | O briefing põe o assistente por último. No app ele vem antes da "Gastos do mês". |
| Lista do mês, do mais recente ao mais antigo, com data, categoria e valor | CUMPRE | Ver teste 4. |
| Depois de salvar, totais atualizam na hora | CUMPRE | `await carregarGastos()` chama `desenhar()`. |
| Espaço do assistente, "chega em breve" até a sexta | Mudou, e faz sentido | O cartão "Assistente" já está funcionando: campo de frase, botões Enviar e Foto do cupom, chamada a `/api/assistente`. Já não há aviso de "em breve", o que é coerente se a sexta já chegou. A função do servidor `/api/assistente` não está em `app/`, então não pude conferi-la. Sobrou a classe `.selo` no CSS, sem uso. |
| Cores: fundo azul-marinho quase preto, números brancos, detalhes verdes | CUMPRE | `--fundo: #0b1426`, `--texto: #ffffff`, `--verde: #22c55e`. O total do mês, de hoje e da semana são brancos. Barras, botão Salvar e categoria marcada são verdes. |
| Nome do app | CUMPRE no app, inconsistente no projeto | `<title>` e `<h1>` dizem "Despesas Hatz", como o briefing. O `CLAUDE.md` ainda chama o app de "Meu Bolso". |
| Sensação de controle / difícil de ler os totais | SÓ DÁ PARA SABER ABRINDO O APP | É uma impressão. O código tem tipografia com números alinhados e destaque ao total, mas isso se julga na tela. |

## O que o app nunca faz

| Regra | Resultado | Motivo |
|---|---|---|
| Não pede, guarda ou mostra senha de banco, conta ou cartão | CUMPRE | A única senha pedida é a de entrada do próprio app (e-mail e senha, `#senha`). Nenhum campo de conta, banco ou cartão. |
| Não guarda a foto do cupom | CUMPRE no navegador, resto não verificável | `reduzirFoto` só usa memória e canvas, e o `insert` em `gastos` não leva imagem. A foto segue para `/api/assistente`, e se o servidor guarda ou não está fora de `app/`. |
| Não envia e-mail ou mensagem | CUMPRE | Nenhum código de envio. O Supabase pode mandar e-mail de confirmação se essa opção estiver ligada no painel, mas o app avisa para desligá-la. |
| Não usa dado de outra pessoa | SÓ DÁ PARA SABER ABRINDO O APP / NO SUPABASE | O app grava `dono: usuario.id`, mas as consultas não filtram por dono. A separação depende da proteção por linha (RLS) no banco, que não dá para ver nesses arquivos. |

## O que falta para ficar como o briefing pediu

1. Fazer o campo do valor já nascer pronto para digitar (foco automático ao abrir e depois de salvar), para o lançamento ficar em valor + 1 categoria + 1 Salvar, sem toque extra.
2. Conferir no celular de 390 px, sem rolar, se mês, semana, dia e as 8 categorias cabem na primeira tela. Se não couberem, compactar as barras ou reduzir o espaço do topo.
3. Colocar o formulário de lançamento mais perto do topo, ou deixá-lo acessível sem rolar, já que o briefing diz que o uso é em pé, com uma mão, logo depois de pagar.
4. Testar de verdade os testes 3, 4 e 5 com o app aberto e conectado ao Supabase (os três gastos de teste, fechar e abrir, internet desligada), pois pelo código estão certos mas ainda não foram vistos funcionando.
5. Confirmar no Supabase que a proteção por linha está ativa em `gastos` e `resumos`, para garantir que nenhum dado de outra pessoa apareça.
6. Colocar semana e dia realmente "ao lado" do total do mês, se for importante seguir o briefing ao pé da letra. Hoje ficam abaixo.
7. Alinhar a ordem da tela (assistente por último, como no briefing) e atualizar o `CLAUDE.md` para o nome "Despesas Hatz". Decidir também se o assistente já funcionando substitui de vez o aviso "chega em breve".
8. Remover a classe `.selo` do `app/estilo.css`, que ficou sem uso.
