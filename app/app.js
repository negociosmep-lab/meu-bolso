// Despesas Hatz — lógica do app.
// Única biblioteca: o cliente do Supabase, carregado pela CDN no index.html.

(function () {
  "use strict";

  const cfg = window.MEU_BOLSO || {};
  const $ = (id) => document.getElementById(id);

  const telaAbrindo = $("tela-abrindo");
  const telaEntrada = $("tela-entrada");
  const telaApp = $("tela-app");
  const ESPERA_ABERTURA = 8000;

  let cliente = null;
  let usuario = null;
  let gastos = [];
  let falhouAoCarregar = false;
  let categoriaEscolhida = null;

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long" });

  // ---------- Datas (sempre no horário local) ----------

  function dataISO(d) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  function periodos() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    // Semana começa na segunda-feira.
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
    return {
      hoje: dataISO(hoje),
      inicioMes: dataISO(inicioMes),
      fimMes: dataISO(fimMes),
      inicioSemana: dataISO(inicioSemana),
      nomeMes: nomeMes.format(hoje)
    };
  }

  function dataCurta(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}`;
  }

  // ---------- Erros em português ----------

  function frase(erro) {
    const m = String((erro && (erro.message || erro.error_description)) || erro || "").toLowerCase();
    if (m.includes("failed to fetch") || m.includes("network") || m.includes("load failed")) {
      return "Sem conexão com a internet. Confira o Wi-Fi ou os dados móveis e tente de novo.";
    }
    if (m.includes("invalid login")) {
      return "E-mail ou senha não conferem. Confira e tente de novo, ou toque em Criar conta.";
    }
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("already exists")) {
      return "Este e-mail já tem conta. Toque em Entrar.";
    }
    if (m.includes("password") && (m.includes("least") || m.includes("short") || m.includes("6"))) {
      return "A senha precisa ter pelo menos 6 caracteres.";
    }
    if (m.includes("email not confirmed")) {
      return "Este e-mail ainda não foi confirmado. No Supabase, desligue a confirmação de e-mail e tente de novo.";
    }
    if (m.includes("email") && (m.includes("invalid") || m.includes("valid"))) {
      return "Este e-mail não parece válido. Confira e tente de novo.";
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    }
    if (m.includes("jwt") || m.includes("session")) {
      return "Sua sessão expirou. Toque em Sair e entre de novo.";
    }
    if (m.includes("row-level security") || m.includes("permission denied")) {
      return "O banco recusou a operação. Toque em Sair, entre de novo e tente outra vez.";
    }
    return "Algo deu errado. Tente de novo; se continuar, toque em Sair e entre de novo.";
  }

  function avisar(elemento, texto, ok) {
    elemento.textContent = texto;
    elemento.classList.toggle("ok", Boolean(ok));
    elemento.hidden = !texto;
  }

  // ---------- Entrada ----------

  function lerCredenciais() {
    const email = $("email").value.trim();
    const senha = $("senha").value;
    if (!email || !senha) {
      avisar($("aviso-entrada"), "Preencha o e-mail e a senha.");
      return null;
    }
    if (senha.length < 6) {
      avisar($("aviso-entrada"), "A senha precisa ter pelo menos 6 caracteres.");
      return null;
    }
    return { email, password: senha };
  }

  function travarEntrada(travar) {
    $("botao-entrar").disabled = travar;
    $("botao-criar").disabled = travar;
  }

  async function entrar(evento) {
    evento.preventDefault();
    const cred = lerCredenciais();
    if (!cred) return;
    avisar($("aviso-entrada"), "");
    travarEntrada(true);
    try {
      const { error } = await cliente.auth.signInWithPassword(cred);
      if (error) throw error;
    } catch (erro) {
      avisar($("aviso-entrada"), frase(erro));
    } finally {
      travarEntrada(false);
    }
  }

  async function criarConta() {
    const cred = lerCredenciais();
    if (!cred) return;
    avisar($("aviso-entrada"), "");
    travarEntrada(true);
    try {
      const { data, error } = await cliente.auth.signUp(cred);
      if (error) throw error;
      // Quando o e-mail já existe, o Supabase devolve um usuário sem identidades.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        avisar($("aviso-entrada"), "Este e-mail já tem conta. Toque em Entrar.");
        return;
      }
      if (!data.session) {
        avisar($("aviso-entrada"), "Conta criada, mas o Supabase pediu confirmação de e-mail. Desligue a confirmação no painel do Supabase e toque em Entrar.");
      }
    } catch (erro) {
      avisar($("aviso-entrada"), frase(erro));
    } finally {
      travarEntrada(false);
    }
  }

  async function sair() {
    try {
      await cliente.auth.signOut();
    } catch (erro) {
      // Mesmo sem internet, volta para a tela de entrada.
      mostrarEntrada();
    }
  }

  function mostrarEntrada() {
    usuario = null;
    gastos = [];
    telaAbrindo.hidden = true;
    telaApp.hidden = true;
    telaEntrada.hidden = false;
    $("senha").value = "";
  }

  function mostrarApp(user) {
    const trocouDeUsuario = !usuario || usuario.id !== user.id;
    usuario = user;
    telaAbrindo.hidden = true;
    telaEntrada.hidden = true;
    telaApp.hidden = false;
    avisar($("aviso-entrada"), "");
    if (trocouDeUsuario) {
      $("data").value = periodos().hoje;
      prepararValor();
      carregarGastos();
      carregarResumo();
    }
  }

  function prepararValor() {
    // Deixa o campo do valor pronto para digitar.
    // No iPhone, o sistema só abre o teclado depois de um toque no campo.
    $("valor").focus({ preventScroll: true });
  }

  // ---------- Gastos ----------

  async function carregarGastos() {
    const p = periodos();
    // Busca desde o que vier primeiro: início do mês ou início da semana.
    const desde = p.inicioSemana < p.inicioMes ? p.inicioSemana : p.inicioMes;
    avisar($("aviso-lista"), "");
    const botaoTentar = $("botao-tentar");
    botaoTentar.disabled = true;
    try {
      const { data, error } = await cliente
        .from("gastos")
        .select("id, data, descricao, valor, categoria, origem, criado_em")
        .gte("data", desde)
        .lte("data", p.fimMes)
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) throw error;
      gastos = data || [];
      falhouAoCarregar = false;
    } catch (erro) {
      // Sem os gastos, não mostra R$ 0,00 nem "nenhum gasto": avisa no topo.
      falhouAoCarregar = true;
      $("texto-falha").textContent = `Não consegui carregar os gastos. ${frase(erro)}`;
    } finally {
      botaoTentar.disabled = false;
    }
    $("falha-carga").hidden = !falhouAoCarregar;
    desenhar();
  }

  function somar(lista) {
    // Soma em centavos para não errar por arredondamento.
    const centavos = lista.reduce((total, g) => total + Math.round(Number(g.valor) * 100), 0);
    return centavos / 100;
  }

  function desenhar() {
    const p = periodos();
    const doMes = gastos.filter((g) => g.data >= p.inicioMes && g.data <= p.fimMes);
    const daSemana = gastos.filter((g) => g.data >= p.inicioSemana && g.data <= p.hoje);
    const deHoje = gastos.filter((g) => g.data === p.hoje);

    const mostrar = (lista) => (falhouAoCarregar ? "—" : moeda.format(somar(lista)));
    $("nome-mes").textContent = `Total de ${p.nomeMes}`;
    $("total-mes").textContent = mostrar(doMes);
    $("total-semana").textContent = mostrar(daSemana);
    $("total-dia").textContent = mostrar(deHoje);

    desenharBarras(doMes);
    desenharLista(doMes);
  }

  function desenharBarras(doMes) {
    const categorias = cfg.CATEGORIAS || [];
    const totais = categorias.map((nome) => ({
      nome,
      total: somar(doMes.filter((g) => g.categoria === nome))
    }));
    // Gastos com categoria fora da lista entram em Outros.
    const fora = doMes.filter((g) => !categorias.includes(g.categoria));
    const outros = totais.find((t) => t.nome === "Outros");
    if (outros && fora.length) outros.total = (Math.round(outros.total * 100) + Math.round(somar(fora) * 100)) / 100;

    totais.sort((a, b) => b.total - a.total);
    const maior = Math.max(...totais.map((t) => t.total), 0);

    const ul = $("barras");
    ul.replaceChildren();
    totais.forEach((t) => {
      const li = document.createElement("li");
      if (t.total === 0) li.className = "zero";

      const cabeca = document.createElement("div");
      cabeca.className = "barra-cabeca";
      const nome = document.createElement("span");
      nome.textContent = t.nome;
      const valor = document.createElement("strong");
      valor.textContent = falhouAoCarregar ? "—" : moeda.format(t.total);
      cabeca.append(nome, valor);

      const trilho = document.createElement("div");
      trilho.className = "barra-trilho";
      const cheia = document.createElement("div");
      cheia.className = "barra-cheia";
      cheia.style.width = !falhouAoCarregar && maior > 0 ? `${(t.total / maior) * 100}%` : "0%";
      trilho.append(cheia);

      li.append(cabeca, trilho);
      ul.append(li);
    });
  }

  function desenharLista(doMes) {
    const ul = $("lista");
    ul.replaceChildren();
    $("lista-vazia").hidden = falhouAoCarregar || doMes.length > 0;
    if (falhouAoCarregar) return;

    doMes.forEach((g) => {
      const li = document.createElement("li");

      const texto = document.createElement("div");
      texto.className = "item-texto";
      const titulo = document.createElement("p");
      titulo.textContent = g.descricao || g.categoria;
      const detalhe = document.createElement("p");
      detalhe.className = "item-detalhe";
      detalhe.textContent = `${dataCurta(g.data)} · ${g.categoria}`;
      texto.append(titulo, detalhe);

      const valor = document.createElement("span");
      valor.className = "item-valor";
      valor.textContent = moeda.format(Number(g.valor));

      const apagar = document.createElement("button");
      apagar.type = "button";
      apagar.className = "botao-apagar";
      apagar.textContent = "✕";
      apagar.setAttribute("aria-label", `Apagar ${titulo.textContent} de ${valor.textContent}`);
      apagar.addEventListener("click", () => apagarGasto(g, apagar));

      li.append(texto, valor, apagar);
      ul.append(li);
    });
  }

  async function apagarGasto(gasto, botao) {
    const nome = gasto.descricao || gasto.categoria;
    if (!window.confirm(`Apagar "${nome}" de ${moeda.format(Number(gasto.valor))}?`)) return;
    botao.disabled = true;
    avisar($("aviso-lista"), "");
    try {
      const { error } = await cliente.from("gastos").delete().eq("id", gasto.id);
      if (error) throw error;
      gastos = gastos.filter((g) => g.id !== gasto.id);
      desenhar();
    } catch (erro) {
      botao.disabled = false;
      avisar($("aviso-lista"), frase(erro));
    }
  }

  // ---------- Lançar à mão ----------

  function desenharCategorias() {
    const caixa = $("categorias");
    caixa.replaceChildren();
    (cfg.CATEGORIAS || []).forEach((nome) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "categoria";
      b.textContent = nome;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.addEventListener("click", () => {
        categoriaEscolhida = nome;
        caixa.querySelectorAll(".categoria").forEach((outro) => {
          outro.setAttribute("aria-checked", String(outro === b));
        });
      });
      caixa.append(b);
    });
  }

  function lerValor(texto) {
    // Aceita "12,50", "12.50", "1.234,56" e "R$ 12,50".
    let limpo = texto.replace(/[^\d.,]/g, "");
    if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
    const numero = Number(limpo);
    return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : NaN;
  }

  async function salvarGasto(evento) {
    evento.preventDefault();
    const aviso = $("aviso-gasto");
    const valor = lerValor($("valor").value);
    const data = $("data").value || periodos().hoje;

    if (!(valor > 0)) {
      avisar(aviso, "Digite o valor do gasto, por exemplo 12,50.");
      $("valor").focus();
      return;
    }
    if (!categoriaEscolhida) {
      avisar(aviso, "Toque em uma categoria antes de salvar.");
      return;
    }

    const botao = $("botao-salvar");
    botao.disabled = true;
    avisar(aviso, "");
    try {
      const { error } = await cliente.from("gastos").insert({
        dono: usuario.id,
        data,
        descricao: $("descricao").value.trim() || null,
        valor,
        categoria: categoriaEscolhida,
        origem: "manual"
      });
      if (error) throw error;

      avisar(aviso, `Salvo: ${moeda.format(valor)} em ${categoriaEscolhida}.`, true);
      $("valor").value = "";
      $("descricao").value = "";
      $("data").value = periodos().hoje;
      categoriaEscolhida = null;
      $("categorias").querySelectorAll(".categoria").forEach((b) => b.setAttribute("aria-checked", "false"));
      prepararValor();
      await carregarGastos();
    } catch (erro) {
      avisar(aviso, frase(erro));
    } finally {
      botao.disabled = false;
    }
  }

  // ---------- Resumo da semana ----------

  async function carregarResumo() {
    const cartao = $("cartao-resumo");
    try {
      const { data, error } = await cliente
        .from("resumos")
        .select("texto, criado_em")
        .order("criado_em", { ascending: false })
        .limit(1);
      if (error) throw error;
      const texto = data && data[0] && data[0].texto;
      $("texto-resumo").textContent = texto || "";
      cartao.hidden = !texto;
    } catch (erro) {
      // Sem resumo disponível, o cartão simplesmente fica escondido.
      cartao.hidden = true;
    }
  }

  // ---------- Assistente ----------

  const LADO_MAXIMO = 1600;

  function reduzirFoto(arquivo) {
    // Reduz para no máximo 1600 px no lado maior e converte em JPEG.
    // A foto só existe na memória do navegador; nada é guardado.
    return new Promise((resolver, rejeitar) => {
      const endereco = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
        const largura = Math.round(img.naturalWidth * escala);
        const altura = Math.round(img.naturalHeight * escala);
        const tela = document.createElement("canvas");
        tela.width = largura;
        tela.height = altura;
        tela.getContext("2d").drawImage(img, 0, 0, largura, altura);
        URL.revokeObjectURL(endereco);
        const dataUrl = tela.toDataURL("image/jpeg", 0.82);
        resolver(dataUrl.slice(dataUrl.indexOf(",") + 1));
      };
      img.onerror = () => {
        URL.revokeObjectURL(endereco);
        rejeitar(new Error("foto"));
      };
      img.src = endereco;
    });
  }

  function travarAssistente(travar) {
    $("botao-enviar").disabled = travar;
    $("botao-foto").disabled = travar;
  }

  async function perguntarAoAssistente(mensagem, imagem) {
    const aviso = $("aviso-assistente");
    travarAssistente(true);
    avisar(aviso, imagem ? "Lendo o cupom…" : "Pensando…", true);
    try {
      const { data } = await cliente.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (!token) {
        avisar(aviso, "Seu login venceu. Toque em Sair e entre de novo.");
        return;
      }

      let resposta;
      try {
        resposta = await fetch("/api/assistente", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            mensagem,
            imagem: imagem || null,
            mime: imagem ? "image/jpeg" : null,
            categorias: cfg.CATEGORIAS || []
          })
        });
      } catch (erro) {
        avisar(aviso, frase(erro));
        return;
      }

      let corpo = null;
      try { corpo = await resposta.json(); } catch (erro) { corpo = null; }
      if (!corpo) {
        avisar(aviso, "O assistente não respondeu. Ele só funciona no app publicado na Netlify; tente de novo lá.");
        return;
      }
      if (!resposta.ok || corpo.erro) {
        avisar(aviso, corpo.erro || "O assistente não conseguiu agora. Tente de novo ou lance à mão.");
        return;
      }

      avisar(aviso, corpo.resposta, true);
      if (corpo.lancou) {
        $("frase").value = "";
        await carregarGastos();
      }
    } finally {
      travarAssistente(false);
    }
  }

  function enviarFrase(evento) {
    evento.preventDefault();
    const mensagem = $("frase").value.trim();
    if (!mensagem) {
      avisar($("aviso-assistente"), "Escreva um gasto ou uma pergunta, por exemplo: mercado 50 hoje.");
      return;
    }
    perguntarAoAssistente(mensagem, null);
  }

  async function enviarFoto() {
    const campo = $("arquivo-foto");
    const arquivo = campo.files && campo.files[0];
    campo.value = "";
    if (!arquivo) return;
    let imagem;
    try {
      imagem = await reduzirFoto(arquivo);
    } catch (erro) {
      avisar($("aviso-assistente"), "Não consegui abrir essa foto. Tire outra foto do cupom ou escolha uma imagem JPG ou PNG.");
      return;
    }
    perguntarAoAssistente($("frase").value.trim(), imagem);
  }

  // ---------- Início ----------

  function iniciar() {
    $("form-entrada").addEventListener("submit", entrar);
    $("botao-criar").addEventListener("click", criarConta);
    $("botao-sair").addEventListener("click", sair);
    $("botao-tentar").addEventListener("click", carregarGastos);
    $("form-gasto").addEventListener("submit", salvarGasto);
    $("form-assistente").addEventListener("submit", enviarFrase);
    $("botao-foto").addEventListener("click", () => $("arquivo-foto").click());
    $("arquivo-foto").addEventListener("change", enviarFoto);
    desenharCategorias();

    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_CHAVE_PUBLICA) {
      telaAbrindo.hidden = true;
      telaEntrada.hidden = false;
      avisar($("aviso-entrada"), "Não consegui carregar o app. Confira a internet e recarregue a página.");
      travarEntrada(true);
      return;
    }

    cliente = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_CHAVE_PUBLICA);

    // Se o login não responder a tempo, sai da tela de abertura com uma frase.
    setTimeout(() => {
      if (telaAbrindo.hidden) return;
      mostrarEntrada();
      avisar($("aviso-entrada"), "Não consegui conectar. Confira a internet e toque em Entrar de novo.");
    }, ESPERA_ABERTURA);

    // O setTimeout evita travar o Supabase, que não aceita consultas dentro deste aviso.
    cliente.auth.onAuthStateChange((_evento, sessao) => {
      setTimeout(() => {
        if (sessao && sessao.user) mostrarApp(sessao.user);
        else mostrarEntrada();
      }, 0);
    });

    // Ao voltar para o app num outro dia, os totais se ajustam à data nova.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && usuario) carregarGastos();
    });
  }

  iniciar();
})();
