// Despesas Hatz — assistente (função da Netlify).
// Recebe uma frase ou a foto de um cupom, pede ao Gemini para escolher uma ferramenta
// e grava ou consulta o Supabase COM O LOGIN DA PRÓPRIA PESSOA, para a proteção por linha valer.
// A chave do Gemini fica só no servidor (process.env.CHAVE_GEMINI). Nenhuma chave secreta aqui.
// Os números da resposta vêm sempre da soma do banco, nunca do modelo.

// Copiados de app/configuracao.js (dados públicos).
const SUPABASE_URL = "https://zoepfkcjgrdwvolsnaoa.supabase.co";
const SUPABASE_CHAVE_PUBLICA = "sb_publishable_jHLWynwE9aZAsn7BBq6T7w_7243Uklb";

const MODELO = "gemini-3.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

const CATEGORIAS_PADRAO = [
  "Mercado", "Farmácia", "Restaurante", "Posto de gasolina",
  "Internet", "Personal", "Condomínio", "Outros"
];

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const config = { path: "/api/assistente" };

// ---------- Ajudantes ----------

class ErroAmigavel extends Error {
  constructor(frase, status = 400) {
    super(frase);
    this.status = status;
  }
}

function responder(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function hojeSaoPaulo() {
  // "en-CA" escreve a data como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function dataValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = new Date(`${texto}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

function dataBR(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function cabecalhosSupabase(token) {
  return {
    apikey: SUPABASE_CHAVE_PUBLICA,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function erroDoSupabase(resposta) {
  let detalhe = {};
  try { detalhe = await resposta.json(); } catch { /* sem corpo */ }
  const codigo = String(detalhe.code || "");
  const texto = String(detalhe.message || "").toLowerCase();
  if (resposta.status === 401 || texto.includes("jwt")) {
    return new ErroAmigavel("Seu login venceu. Toque em Sair, entre de novo e tente outra vez.", 401);
  }
  if (codigo === "42P01" || codigo === "PGRST205" || resposta.status === 404) {
    return new ErroAmigavel("A tabela gastos não existe no Supabase. Crie a tabela no painel do Supabase e tente de novo.", 500);
  }
  if (codigo === "42501" || texto.includes("row-level security")) {
    return new ErroAmigavel("O banco recusou a operação pela proteção por linha. Confira as regras da tabela gastos no Supabase.", 403);
  }
  return new ErroAmigavel("O banco não respondeu como esperado. Tente de novo em instantes.", 502);
}

// ---------- Login ----------

async function conferirLogin(req) {
  const cabecalho = req.headers.get("authorization") || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
  if (!token) throw new ErroAmigavel("Você precisa entrar no app antes de usar o assistente.", 401);

  const resposta = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_CHAVE_PUBLICA, Authorization: `Bearer ${token}` }
  });
  if (!resposta.ok) throw new ErroAmigavel("Seu login venceu. Toque em Sair, entre de novo e tente outra vez.", 401);
  const usuario = await resposta.json();
  if (!usuario || !usuario.id) throw new ErroAmigavel("Seu login venceu. Toque em Sair, entre de novo e tente outra vez.", 401);
  return { token, usuario };
}

// ---------- Gemini ----------

function ferramentas(categorias) {
  return [{
    function_declarations: [
      {
        name: "registrar_gasto",
        description: "Lança um gasto da pessoa. Use quando ela contar um gasto ou mandar a foto de um cupom fiscal.",
        parameters: {
          type: "object",
          properties: {
            data: { type: "string", description: "Data do gasto no formato AAAA-MM-DD." },
            descricao: { type: "string", description: "Onde ou com o quê: o nome da loja ou uma descrição curta." },
            valor: { type: "number", description: "Valor em reais, com ponto decimal. Ex.: 50.9" },
            categoria: { type: "string", enum: categorias, description: "Uma das categorias da pessoa." }
          },
          required: ["data", "descricao", "valor", "categoria"]
        }
      },
      {
        name: "consultar_gastos",
        description: "Consulta quanto a pessoa gastou num período, opcionalmente numa categoria.",
        parameters: {
          type: "object",
          properties: {
            desde: { type: "string", description: "Primeiro dia do período, AAAA-MM-DD." },
            ate: { type: "string", description: "Último dia do período, AAAA-MM-DD." },
            categoria: { type: "string", enum: categorias, description: "Categoria a filtrar. Omita para todas." }
          },
          required: ["desde", "ate"]
        }
      }
    ]
  }];
}

function promptDoSistema(hoje, categorias) {
  return [
    "Você é o assistente do Despesas Hatz, um app de gastos pessoais. Fale sempre em português do Brasil, em frases curtas.",
    `Hoje é ${hoje} (horário de São Paulo). Use essa data para entender "hoje", "ontem", "esta semana" e "este mês".`,
    "A semana começa na segunda-feira.",
    `As categorias da pessoa são: ${categorias.join(", ")}. Escolha sempre uma delas; se nenhuma servir, use Outros.`,
    "Quando a pessoa contar um gasto, use registrar_gasto. Sem data dita, use hoje.",
    "Quando vier a foto de um cupom fiscal, use registrar_gasto com o VALOR TOTAL do cupom (não um item), a data de emissão do cupom e o nome da loja como descrição.",
    "Quando a pessoa perguntar quanto gastou, use consultar_gastos com o período certo. Nunca calcule nem invente totais.",
    "Se faltar o valor ou algo essencial, não use ferramenta: pergunte em uma frase o que falta.",
    "Nunca peça nem comente senha, número de conta ou de cartão."
  ].join("\n");
}

async function chamarGemini({ chave, hoje, categorias, mensagem, imagem, mime }) {
  const partes = [];
  if (mensagem) partes.push({ text: mensagem });
  if (imagem) {
    partes.push({ inline_data: { mime_type: mime || "image/jpeg", data: imagem } });
    if (!mensagem) partes.push({ text: "Lance o gasto deste cupom fiscal." });
  }

  let resposta;
  try {
    resposta = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: promptDoSistema(hoje, categorias) }] },
        contents: [{ role: "user", parts: partes }],
        tools: ferramentas(categorias),
        tool_config: { function_calling_config: { mode: "AUTO" } },
        generationConfig: { temperature: 0 }
      })
    });
  } catch {
    throw new ErroAmigavel("Não consegui falar com o assistente agora. Tente de novo em instantes ou lance à mão.", 502);
  }

  if (resposta.status === 429) {
    throw new ErroAmigavel("O assistente atingiu o limite de uso por agora. Espere um minuto e tente de novo, ou lance à mão.", 429);
  }
  if (resposta.status === 401 || resposta.status === 403) {
    throw new ErroAmigavel("A chave do Gemini foi recusada. Confira a CHAVE_GEMINI nas variáveis da Netlify.", 500);
  }
  if (resposta.status === 404) {
    throw new ErroAmigavel(`O modelo ${MODELO} não foi encontrado no Gemini. Troque o nome do modelo na função.`, 500);
  }
  if (!resposta.ok) {
    let texto = "";
    try { texto = JSON.stringify(await resposta.json()).toLowerCase(); } catch { /* sem corpo */ }
    if (texto.includes("api key") || texto.includes("api_key")) {
      throw new ErroAmigavel("A chave do Gemini foi recusada. Confira a CHAVE_GEMINI nas variáveis da Netlify.", 500);
    }
    throw new ErroAmigavel("O assistente não entendeu o pedido. Tente escrever de outro jeito ou lance à mão.", 502);
  }

  const dados = await resposta.json();
  const partesResposta = dados?.candidates?.[0]?.content?.parts || [];
  const chamada = partesResposta.find((p) => p.functionCall || p.function_call);
  if (chamada) {
    const fc = chamada.functionCall || chamada.function_call;
    return { ferramenta: fc.name, args: fc.args || {} };
  }
  const texto = partesResposta.map((p) => p.text || "").join("").trim();
  return { texto: texto || "Não entendi. Diga o valor e onde gastou, por exemplo: mercado 50 hoje." };
}

// ---------- Ferramentas ----------

async function registrarGasto({ token, usuario, args, categorias, hoje, origem }) {
  const valor = Math.round(Number(args.valor) * 100) / 100;
  if (!(valor > 0)) return "Não consegui ver o valor. Diga quanto foi, por exemplo: mercado 50 hoje.";

  const data = dataValida(args.data) ? args.data : hoje;
  const categoria = categorias.includes(args.categoria) ? args.categoria : "Outros";
  const descricao = String(args.descricao || "").trim().slice(0, 80) || categoria;

  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/gastos`, {
    method: "POST",
    headers: { ...cabecalhosSupabase(token), Prefer: "return=representation" },
    body: JSON.stringify({ dono: usuario.id, data, descricao, valor, categoria, origem })
  });
  if (!resposta.ok) throw await erroDoSupabase(resposta);

  const [gravado] = await resposta.json();
  const g = gravado || { data, descricao, valor, categoria };
  return {
    texto: `Lancei ${moeda.format(Number(g.valor))} em ${g.categoria}: ${g.descricao}, ${dataBR(g.data)}.`,
    lancou: true
  };
}

async function consultarGastos({ token, args, categorias, hoje }) {
  let desde = dataValida(args.desde) ? args.desde : `${hoje.slice(0, 8)}01`;
  let ate = dataValida(args.ate) ? args.ate : hoje;
  if (desde > ate) [desde, ate] = [ate, desde];
  const categoria = categorias.includes(args.categoria) ? args.categoria : null;

  const filtro = new URLSearchParams();
  filtro.set("select", "valor");
  filtro.append("data", `gte.${desde}`);
  filtro.append("data", `lte.${ate}`);
  if (categoria) filtro.set("categoria", `eq.${categoria}`);

  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/gastos?${filtro}`, {
    headers: cabecalhosSupabase(token)
  });
  if (!resposta.ok) throw await erroDoSupabase(resposta);

  const linhas = await resposta.json();
  // Soma em centavos, a partir do que está no banco.
  const centavos = linhas.reduce((total, l) => total + Math.round(Number(l.valor) * 100), 0);
  const total = moeda.format(centavos / 100);
  const onde = categoria ? ` com ${categoria}` : "";
  const periodo = desde === ate ? `em ${dataBR(desde)}` : `de ${dataBR(desde)} a ${dataBR(ate)}`;
  const quantos = linhas.length === 1 ? "1 gasto" : `${linhas.length} gastos`;
  return { texto: `Você gastou ${total}${onde} ${periodo} (${quantos}).`, lancou: false };
}

// ---------- Entrada da função ----------

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return responder({ erro: "Use o assistente pela tela do app." }, 405);
    }

    const chave = process.env.CHAVE_GEMINI;
    if (!chave) {
      throw new ErroAmigavel("O assistente ainda não tem a chave do Gemini. Cadastre CHAVE_GEMINI nas variáveis da Netlify e publique de novo.", 500);
    }

    const { token, usuario } = await conferirLogin(req);

    let corpo;
    try { corpo = await req.json(); } catch {
      throw new ErroAmigavel("O pedido chegou incompleto. Tente de novo.");
    }

    const mensagem = String(corpo.mensagem || "").trim().slice(0, 500);
    const imagem = typeof corpo.imagem === "string" && corpo.imagem ? corpo.imagem : null;
    const mime = typeof corpo.mime === "string" && corpo.mime.startsWith("image/") ? corpo.mime : "image/jpeg";
    const categorias = Array.isArray(corpo.categorias)
      ? corpo.categorias.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim().slice(0, 40)).slice(0, 20)
      : [];
    if (!categorias.length) categorias.push(...CATEGORIAS_PADRAO);
    if (!categorias.includes("Outros")) categorias.push("Outros");

    if (!mensagem && !imagem) {
      throw new ErroAmigavel("Escreva um gasto ou uma pergunta, ou mande a foto do cupom.");
    }

    const hoje = hojeSaoPaulo();
    const escolha = await chamarGemini({ chave, hoje, categorias, mensagem, imagem, mime });

    if (escolha.ferramenta === "registrar_gasto") {
      const r = await registrarGasto({
        token, usuario, args: escolha.args, categorias, hoje,
        origem: imagem ? "foto" : "texto"
      });
      return typeof r === "string" ? responder({ resposta: r, lancou: false }) : responder({ resposta: r.texto, lancou: r.lancou });
    }
    if (escolha.ferramenta === "consultar_gastos") {
      const r = await consultarGastos({ token, args: escolha.args, categorias, hoje });
      return responder({ resposta: r.texto, lancou: false });
    }
    return responder({ resposta: escolha.texto, lancou: false });
  } catch (erro) {
    if (erro instanceof ErroAmigavel) return responder({ erro: erro.message }, erro.status);
    return responder({ erro: "Algo deu errado no assistente. Tente de novo ou lance à mão." }, 500);
  }
};
