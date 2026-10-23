# BRIEFING — Despesas Hatz

Resultado da entrevista de 8 perguntas. Este é o pedido completo do app, no formato CLARO. As regras do CLAUDE.md continuam valendo.

## C — Contexto

- **Nome do app:** Despesas Hatz.
- **Quem usa:** só eu, no celular (principal) e no computador.
- **Onde lanço:** na hora, **logo depois de pagar**, em pé, com o celular em uma mão (caixa do mercado, farmácia, posto).
- **Sensação ao abrir:** **controle**.
- **Cores:** fundo escuro azul-marinho quase preto, números em branco, detalhes em verde.

## L — Limites

- **Toques máximos para lançar um gasto:** digitar o valor + **1 toque na categoria + 1 toque em salvar**.
- O app **nunca**:
  - pede, guarda ou mostra senha de banco, número de conta ou cartão;
  - guarda a foto do cupom;
  - envia e-mail ou mensagem;
  - usa dado de outra pessoa.
- **O que me faria abandonar na primeira semana:** o app não passar sensação de controle, errar a soma, ou ser difícil de lançar um gasto ou de ler os totais.

## A — Ação

Uma tela só, de cima para baixo:

1. **O que aparece em cinco segundos**
   - Em destaque, grande: o **total do mês**.
   - Ao lado, menores: o **total da semana** e o **total do dia**.
   - Logo abaixo: o **total do mês em cada categoria**.

2. **Lançamento à mão**
   - Campo do valor já pronto para digitar, com teclado numérico.
   - Botões das categorias, grandes para o polegar.
   - Botão **Salvar**.
   - Depois de salvar, todos os totais se atualizam na hora.

3. **Lista do mês**
   - Os gastos do mês, do mais recente para o mais antigo, com data, categoria e valor.

4. **Categorias (com os meus nomes)**
   - Mercado
   - Farmácia
   - Restaurante
   - Posto de gasolina
   - Internet
   - Personal (personal trainer)
   - Condomínio
   - Outros

5. **Espaço do assistente (chega na sexta)**
   - Um lugar reservado na tela para, na sexta, lançar o gasto por uma frase ou pela foto do cupom.
   - Até lá, fica visível, mas avisando que chega em breve.

## R — Resultado

Ao abrir o app, em cinco segundos eu respondo: **"Quanto já gastei este mês, nesta semana e hoje, e em quê?"** — o total do mês em destaque, semana e dia ao lado, e o total de cada categoria logo abaixo.

## O — Observáveis (5 testes que provam que o app está pronto)

1. **Cinco segundos:** abro o app no celular (390 px) e, sem rolar a tela, vejo o total do mês, da semana, do dia e de cada categoria.
2. **Dois toques:** lanço um gasto digitando o valor, tocando na categoria e tocando em Salvar; não há nenhum toque a mais.
3. **Soma certa:** lanço três gastos de teste (por exemplo, 10,00 no Mercado, 5,50 na Farmácia e 4,50 no Mercado); o total do dia, da semana e do mês aumenta exatamente 20,00, e Mercado mostra 14,50.
4. **Controle na lista:** o gasto que acabei de salvar aparece no topo da lista do mês, com data, categoria e valor certos, e continua lá depois de fechar e abrir o app.
5. **Erro em português:** sem internet, tento salvar um gasto e aparece uma frase em português dizendo o que fazer; nada de mensagem técnica.
