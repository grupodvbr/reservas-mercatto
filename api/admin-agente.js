const OpenAI = require("openai")
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args))
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)




const LOGOS = {
  "MERCATTO DELÍCIA": "COLOQUE_LINK_AQUI",
  "VILLA GOURMET": "COLOQUE_LINK_AQUI",
  "EMPORIO MERCATTO": "COLOQUE_LINK_AQUI",
  "M.KIDS": "COLOQUE_LINK_AQUI",
  "PADARIA DELÍCIA": "COLOQUE_LINK_AQUI",
  "DELÍCIA GOURMET": "COLOQUE_LINK_AQUI"
}





const ADMIN_TOKEN = process.env.ADMIN_TOKEN

/* ================= NÍVEIS DE ACESSO ================= */

const USUARIOS = {
  "557798253249": { nivel: 0 }, // ADMIN REAL
  "5577997614": { nivel: 0 }, // ADMIN REAL
  "778888888888": { nivel: 1 },
  "777777777777": { nivel: 2, empresa: "MERCATTO DELÍCIA" },
  "776666666666": { nivel: 3 }
}




module.exports = async function handler(req, res){

try{
// 🔥 CRON AUTOMÁTICO (RELATÓRIO 05:00)
if(req.query.cron === "true"){

  console.log("⏰ CRON DISPARADO")

  await executarRelatorioAutomatico()

  return res.json({ ok: true })
}
/* ================= AUTORIZAÇÃO ================= */

if(req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`){
return res.status(403).json({erro:"acesso negado"})
}

/* ================= BODY ================= */

const body =
typeof req.body === "string"
? JSON.parse(req.body)
: req.body

const pergunta = body?.pergunta || ""


/* ================= IDENTIFICA USUÁRIO ================= */

const numero = body?.numero

if(!numero){
  console.log("❌ NUMERO NÃO INFORMADO")
  return res.json({ resposta: "Erro interno: número não identificado" })
}

const usuario = USUARIOS[numero]

if(!usuario){
  console.log("⛔ ACESSO NEGADO:", numero)
  return res.json({ resposta: "⛔ Usuário sem acesso" })
}

const NIVEL = usuario.nivel

console.log("👤 USUARIO:", numero)
console.log("🔐 NIVEL:", NIVEL)










  

  
/* ================= DATAS PRIMEIRO ================= */

const agora = new Date()

const formatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Bahia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
})

const parts = formatter.formatToParts(agora)
const get = type => parts.find(p => p.type === type)?.value

const hojeISO = `${get("year")}-${get("month")}-${get("day")}`
const hora = `${get("hour")}:${get("minute")}:${get("second")}`

const ontem = new Date(`${hojeISO}T00:00:00`)
ontem.setDate(ontem.getDate() - 1)

const ontemISO = ontem.toISOString().split("T")[0]
const amanha = new Date(`${hojeISO}T00:00:00`)
amanha.setDate(amanha.getDate() + 1)

const amanhaISO = amanha.toISOString().split("T")[0]
/* ================= AGORA SIM ================= */









  
let dataFiltro = hojeISO

const texto = pergunta.toLowerCase()

// ================= INTELIGÊNCIA GLOBAL =================

const interpretacao = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  temperature: 0,
  messages: [
    {
      role: "system",
      content: `
Você é o cérebro de um assistente administrativo.

Retorne apenas JSON:

{
  "tipo": "vendas | reservas | pedidos | buffet | clientes | relatorio | acao | desconhecido",
  "empresa": "MERCATTO EMPORIO | MERCATTO RESTAURANTE | PADARIA DELÍCIA | VILLA GOURMET | DELÍCIA GOURMET | null",
  "geral": true/false,
  "intencao": "consulta | criacao | edicao | exclusao"
}

REGRAS:

🔥 INTERPRETAÇÃO NATURAL:
- "como foi hoje" → vendas
- "movimento" → vendas
- "agenda de hoje" → musicos
- "tem reserva hoje?" → reservas
- "quem comprou" → pedidos
- "buffet de hoje" → buffet

🔥 AÇÕES:
- "criar", "registrar" → criacao
- "editar", "alterar" → edicao
- "excluir", "apagar" → exclusao

🔥 EMPRESA:
- "mercatto" sozinho → null
- "emporio" → MERCATTO EMPORIO
- "restaurante" → MERCATTO RESTAURANTE

🔥 GERAL:
- "todas", "geral", "total" → geral = true

⚠️ NÃO EXPLICAR
⚠️ RESPONDER APENAS JSON
`
    },
    {
      role: "user",
      content: pergunta
    }
  ]
})

let classificacao = {}

try {
  classificacao = JSON.parse(interpretacao.choices[0].message.content)
} catch (e) {
  console.log("❌ ERRO CLASSIFICAÇÃO")
}

console.log("🧠 CLASSIFICAÇÃO:", classificacao)
let empresaFiltro = classificacao.empresa || null

if(classificacao.geral){
  empresaFiltro = null
}


// NIVEL 2 → BLOQUEIA EMPRESA
if(NIVEL === 2){
  empresaFiltro = usuario.empresa
}else{

// 🔥 NORMALIZA TEXTO
const normal = texto
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")

// 🔥 DETECÇÃO INTELIGENTE MERCATTO
const isMercatto = normal.includes("mercatto")
const isEmporio = normal.includes("emporio")
const isRestaurante = normal.includes("restaurante")

// 🔥 ESCOLHA DO USUÁRIO (caso ele responda depois)
let escolhaMercatto = null

if(normal.includes("1") || normal.includes("emporio")){
  escolhaMercatto = "EMPORIO"
}

if(normal.includes("2") || normal.includes("restaurante")){
  escolhaMercatto = "RESTAURANTE"
}

if(
  normal.includes("3") ||
  normal.includes("total") ||
  normal.includes("geral")
){
  escolhaMercatto = "TOTAL"
}

// 🔥 DECISÃO DE EMPRESA
if(isMercatto){

  if(isEmporio){
    empresaFiltro = "MERCATTO EMPORIO"
  }

  else if(isRestaurante){
    empresaFiltro = "MERCATTO RESTAURANTE"
  }

  else{
empresaFiltro = null
  }

}
else if(normal.includes("padaria")){
  empresaFiltro = "PADARIA DELÍCIA"
}
else if(normal.includes("villa")){
  empresaFiltro = "VILLA GOURMET"
}
else if(normal.includes("kids")){
  empresaFiltro = "M.KIDS"
}
else if(
  normal.includes("delicia") ||
  normal.includes("gourmet")
){
  empresaFiltro = "DELÍCIA GOURMET"
}

}


  
let tipoConsulta = classificacao.tipo || "geral"
const tipoAcao = classificacao.intencao || "consulta"
if(tipoAcao !== "consulta"){
  console.log("🛠️ AÇÃO DETECTADA:", tipoAcao)
}

  
const isCupom =
  texto.includes("cupom") ||
  texto.includes("venda") ||
  texto.includes("vendas") ||
  texto.includes("faturamento") ||
  texto.includes("quanto vendeu") ||
  texto.includes("resumo de vendas") ||
  texto.includes("resumo das vendas") ||
  texto.includes("resumo vendas") ||
  texto.includes("vendas de hoje")











  
if(texto.includes("reserva")){
  tipoConsulta = "reservas"
}

if(texto.includes("pedido")){
  tipoConsulta = "pedidos"
}

if(texto.includes("buffet")){
  tipoConsulta = "buffet"
}

if(texto.includes("cliente")){
  tipoConsulta = "clientes"
}
if(texto.includes("relatorio")){
  tipoConsulta = "relatorio"
}

/* ================= BLOQUEIO CUPONS ================= */

if(tipoConsulta === "vendas" && ![0,1].includes(NIVEL)){
  return res.json({
    resposta: "⛔ Apenas usuários nível 0 e 1 podem acessar dados de vendas"
  })
}


  
/* ================= CONTROLE POR NIVEL ================= */


  

if(NIVEL === 3){
  if(tipoConsulta !== "relatorio"){
    return res.json({
      resposta: "⛔ Seu acesso permite apenas relatórios"
    })
  }
}








  

  



  
let confirmar = body?.confirmar || null
/* ================= CONFIRMAR COM "SIM" ================= */

if(pergunta && pergunta.toLowerCase() === "sim"){

const { data:last } = await supabase
.from("administrador_chat")
.select("acao_json")
.not("acao_json","is",null)
.order("created_at",{ascending:false})
.limit(1)

if(last && last[0]){
confirmar = last[0].acao_json
}

}

/* ================= CONFIRMAR AÇÃO ================= */

if(confirmar){

// 🔒 BLOQUEIO TOTAL
if(NIVEL !== 0){
  return res.json({
    resposta: "⛔ Você não tem permissão para alterar dados"
  })
}

  
try{

const acao = confirmar
// remove campos proibidos
if(acao.dados && acao.dados.created_at){
delete acao.dados.created_at
}
if(acao.operacao === "insert"){

// 🔥 CORREÇÃO CRÍTICA PARA RESERVAS
if(acao.tabela === "reservas_mercatto"){

  if(!acao.dados.email){
    acao.dados.email = "nao_informado@mercatto.com"
  }

  if(!acao.dados.status){
    acao.dados.status = "Pendente"
  }

  if(!acao.dados.comandaIndividual){
    acao.dados.comandaIndividual = "Não"
  }

  if(!acao.dados.valorEstimado){
    acao.dados.valorEstimado = 0
  }

  if(!acao.dados.pagamentoAntecipado){
    acao.dados.pagamentoAntecipado = 0
  }

  if(!acao.dados.banco){
    acao.dados.banco = ""
  }

  if(!acao.dados.observacoes){
    acao.dados.observacoes = ""
  }

}

const { data, error } = await supabase
.from(acao.tabela)
.insert(acao.dados)
.select()

if(error){
console.error("Erro insert:", error)
throw error
}

}

if(acao.operacao === "update"){

const { data, error } = await supabase
.from(acao.tabela)
.update(acao.dados)
.match(acao.filtro)
.select()

if(error){
console.error("Erro update:", error)
throw error
}

}

if(acao.operacao === "delete"){

const { error } = await supabase
.from(acao.tabela)
.delete()
.match(acao.filtro)

if(error){
console.error("Erro delete:", error)
throw error
}

}

await supabase
.from("administrador_chat")
.insert({
role:"assistant",
mensagem:"✅ Ação executada com sucesso"
})

return res.json({
resposta:"✅ Ação executada com sucesso"
})

}catch(e){

console.error("Erro executar ação:",e)

return res.json({
resposta:"Erro ao executar ação"
})

}

}

/* ================= SALVAR PERGUNTA ================= */

await supabase
.from("administrador_chat")
.insert({
role:"user",
mensagem:pergunta
})

/* ================= HISTÓRICO ================= */

const {data:historico} = await supabase
.from("administrador_chat")
.select("*")
.order("created_at",{ascending:false})
.limit(20)

const mensagens = (historico || [])
.reverse()
.map(m => ({
  role: m.role,
  content: m.mensagem + (m.acao_json ? `\n\nAÇÃO_JSON:\n${JSON.stringify(m.acao_json)}` : "")
}))

mensagens.push({
role:"user",
content: pergunta
})



/* ================= BUSCA INTELIGENTE ================= */


  

let reservas = []
let pedidos = []
let clientes = []
let produtos = []
let buffetLancamentos = []
let musicos = []
let cupons = []
  let resumoDia = null
/* ================= RESERVAS ================= */

if(tipoConsulta === "reservas" || tipoConsulta === "relatorio"){

let query = supabase
.from("reservas_mercatto")
.select("*")
.gte("datahora", dataFiltro + " 00:00:00")
.lte("datahora", dataFiltro + " 23:59:59")

if(empresaFiltro){
  query = query.eq("empresa", empresaFiltro)
}

const { data } = await query.limit(100)

  
  reservas = data || []
}

/* ================= PEDIDOS ================= */

if(tipoConsulta === "pedidos"){

  const { data } = await supabase
  .from("pedidos")
  .select("*")
  .order("created_at",{ ascending:false })
  .limit(100)

  pedidos = data || []
}

const METAS = {
  "DELÍCIA GOURMET": { prata: 545000 },
  "MERCATTO EMPORIO": { prata: 650000 },
  "MERCATTO RESTAURANTE": { prata: 850000 },
  "PADARIA DELÍCIA": { prata: 720000 },
  "VILLA GOURMET": { prata: 746600 }
}

function calcularMeta(empresa, valor){
  const meta = METAS[empresa]
  if(!meta) return { meta:0, percentual:0 }

  return {
    meta: meta.prata,
    percentual: (valor / meta.prata) * 100
  }
}

function formatar(v){
  return Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})
}

function formatarData(dataISO){
  const [ano, mes, dia] = dataISO.split("-")
  return `${dia}/${mes}/${ano}`
}

  

if(isCupom){

  try{

    console.log("🔥 CONSULTANDO API DE VENDAS...")

    let url = "https://goals-continental-examinations-carrier.trycloudflare.com/resumo-dia"

  const MAPA_EMPRESAS = {
  "MERCATTO EMPORIO": "VAREJO_URL_MERCATTO_EMPORIO",
  "MERCATTO RESTAURANTE": "VAREJO_URL_MERCATTO_RESTAURANTE",
  "PADARIA DELÍCIA": "VAREJO_URL_PADARIA",
  "VILLA GOURMET": "VAREJO_URL_VILLA",
  "DELÍCIA GOURMET": "VAREJO_URL_DELICIA"
}

if(empresaFiltro){

  const chave = MAPA_EMPRESAS[empresaFiltro]

  if(chave){
    url += `?empresa=${chave}`
    console.log("🏢 FILTRO APLICADO:", empresaFiltro, "→", chave)
  }else{
    console.log("⚠️ EMPRESA SEM MAPA:", empresaFiltro)
  }

}else{
  console.log("🌎 SEM FILTRO (GERAL)")
}

    const resApi = await fetch(url)
    const data = await resApi.json()

    console.log("📊 RESPOSTA API:", JSON.stringify(data, null, 2))

 function normalizar(txt){
  return txt
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

// 🔥 CORREÇÃO DEFINITIVA
if(empresaFiltro){

  console.log("🏢 USANDO DADOS DIRETOS DA API:", empresaFiltro)

  // 👉 API já está filtrada
function normalizar(txt){
  return txt
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

// 🔥 BUSCAR EMPRESA CORRETA DENTRO DO ARRAY
const empresaData = (data.empresas || []).find(e =>
  normalizar(e.empresa) === normalizar(empresaFiltro)
)

if(!empresaData){
  console.log("❌ EMPRESA NÃO ENCONTRADA:", empresaFiltro)
  return res.json({ resposta: "Empresa não encontrada na API" })
}

// 🔥 CALCULAR TICKET REAL DA EMPRESA
const ticket = empresaData.vendas > 0
  ? empresaData.faturamento / empresaData.vendas
  : 0

resumoDia = {
  data: data.data,
  faturamento: empresaData.faturamento,
  vendas: empresaData.vendas,
  ticket_medio: ticket,
  tipo: "EMPRESA",
  empresa: empresaFiltro
}

  

}else{

  console.log("🌎 USANDO DADOS GERAIS (TODAS EMPRESAS)")

  // 👉 Aqui sim usa total
  resumoDia = {
    data: data.data,
    faturamento: data.faturamento,
    vendas: data.vendas,
    ticket_medio: data.ticket_medio,
    tipo: "GERAL"
  }

}



 // ✅ CORRETO — BASE + GPT ANALISANDO

if(resumoDia){

  console.log("🧠 SOMENTE IA")

  const analise = await openai.chat.completions.create({
    model:"gpt-4.1-mini",
    temperature:0.3,
   messages: [
  {
    role: "system",

content: `
Você é um CONSULTOR EXECUTIVO premium.

FORMATO OBRIGATÓRIO:

📊 *Resumo do dia*

🏢 Empresa: NOME  
💰 Faturamento: R$ VALOR  
🧾 Vendas: NUMERO  
💳 Ticket médio: R$ VALOR  
🎯 Meta: XX%  

📈 *Diagnóstico*
Texto direto e profissional.

🚀 *Ações*
- Curto
- Prático
- Direto

⚠️ REGRAS:
- NÃO usar linhas longas
- NÃO usar box ASCII
- NÃO quebrar layout
- Resposta estilo WhatsApp premium




⚠️ REGRAS:

- NÃO inventar números
- NÃO alterar valores
- NÃO recalcular dados
- NÃO fugir da estrutura
- NÃO escrever texto fora do padrão

Seja direto, profissional e estratégico.
`
  },
  {
    role: "user",
    content: `
DADOS REAIS:

Empresa: ${resumoDia.empresa || "GERAL"}
Faturamento: ${resumoDia.faturamento}
Vendas: ${resumoDia.vendas}
Ticket médio: ${resumoDia.ticket_medio}
Meta: ${calcularMeta(resumoDia.empresa, resumoDia.faturamento).meta}
Percentual da meta: ${calcularMeta(resumoDia.empresa, resumoDia.faturamento).percentual}
`
  }
]
  })

const respostaIA = analise.choices[0].message.content

function criarResumoPremium(texto){

  return `
━━━━━━━━━━━━━━━━━━
📊 *RESUMO DO DIA*
━━━━━━━━━━━━━━━━━━

${texto}

━━━━━━━━━━━━━━━━━━
`
}

const respostaFormatada = criarResumoPremium(respostaIA)

  
return res.json({
  resposta: respostaFormatada
})
}
    

  }catch(e){
    console.log("❌ ERRO:", e)
    return res.json({ resposta: "Erro ao buscar vendas" })
  }
}
/* ================= CLIENTES ================= */


  

if(tipoConsulta === "clientes"){

  const { data } = await supabase
  .from("memoria_clientes")
  .select("*")
  .limit(100)

  clientes = data || []
}

/* ================= PRODUTOS ================= */

if(tipoConsulta === "buffet"){

  const { data } = await supabase
  .from("produtos")
  .select("*")
  .limit(100)

  produtos = data || []
}

/* ================= BUFFET ================= */

if(tipoConsulta === "buffet"){

  let query = supabase
    .from("buffet_lancamentos")
    .select("*")
    .eq("data", dataFiltro)

  if(empresaFiltro){
    query = query.eq("empresa", empresaFiltro)
  }

  const { data } = await query.limit(100)

  buffetLancamentos = data || []
}








  
// 🔥 fallback automático CORRETO
if(!buffetLancamentos || buffetLancamentos.length === 0){

  let queryOntem = supabase
    .from("buffet_lancamentos")
    .select("*")
    .eq("data", ontemISO)

  if(empresaFiltro){
    queryOntem = queryOntem.eq("empresa", empresaFiltro)
  }

  const { data:ontemData } = await queryOntem

  buffetLancamentos = ontemData || []
}

  /* ================= MUSICOS ================= */

if(texto.includes("cantor") || texto.includes("musico") || texto.includes("agenda")){

  const inicioMes = hojeISO.slice(0,7) + "-01"

  const fimMesDate = new Date(inicioMes)
  fimMesDate.setMonth(fimMesDate.getMonth() + 1)
  fimMesDate.setDate(0)

  const fimMes = fimMesDate.toISOString().split("T")[0]

  let query = supabase
    .from("agenda_musicos")
    .select("*")
    .gte("data", inicioMes)
    .lte("data", fimMes)

  if(empresaFiltro){
    query = query.eq("empresa", empresaFiltro)
  }

  const { data } = await query

  musicos = data || []
}
  
/* ================= BUSCAR PROMPTS DO AGENTE ================= */

const {data:promptTabela} = await supabase
.from("prompt_agente")
.select("*")
.order("ordem",{ascending:true})

  
/* ================= BUSCAR PROMPT DO AGENTE ================= */

const { data: prompts } = await supabase
.from("prompt_agente")
.select("prompt")
.eq("ativo", true)
.order("ordem",{ascending:true})

const promptAgente = (prompts || [])
.map(p => p.prompt)
.join("\n\n")

/* ================= CONTEXTO INTELIGENTE ================= */

function addContext(label, data){
if(!data || data.length === 0) return null
const limite = Array.isArray(data) ? data.slice(0, 100) : data
  
  return {















    
    role:"system",
    content:`${label}:\n${JSON.stringify(limite)}`
  }
}

const contextos = []

if(reservas.length){
  contextos.push(addContext("RESERVAS", reservas))
}

if(pedidos.length){
  contextos.push(addContext("PEDIDOS", pedidos))
}

if(clientes.length){
  contextos.push(addContext("CLIENTES", clientes))
}

if(produtos.length){
  contextos.push(addContext("PRODUTOS", produtos))
}

if(buffetLancamentos.length){




  
  const resumo = {}

  buffetLancamentos.forEach(item => {
    const nome = item.produto_nome || "SEM NOME"
    const qtd = parseFloat(item.quantidade) || 0
    const tipo = item.tipo || "OUTRO"

    const chave = `${nome}__${tipo}`

    if(!resumo[chave]){
      resumo[chave] = {
        nome,
        tipo,
        total: 0,
        unidade: item.unidade || "KG"
      }
    }

    resumo[chave].total += qtd
  })

  const lista = Object.values(resumo)

  contextos.push({
    role:"system",
    content: "RESUMO_REAL_BUFFET:\n" + JSON.stringify(lista)
  })
}
  
if(musicos.length){

  
  contextos.push({
    role:"system",
    content: "AGENDA_MUSICOS:\n" + JSON.stringify(musicos)
  })
}
if(resumoDia){

  const metaInfo = resumoDia.empresa
    ? calcularMeta(resumoDia.empresa, resumoDia.faturamento)
    : null

  contextos.push({
    role:"system",
    content: `
RESUMO_CUPONS_DIA:
${JSON.stringify({
  data: resumoDia.data,
  empresa: resumoDia.empresa || "GERAL",
  faturamento: resumoDia.faturamento,
  vendas: resumoDia.vendas,
  ticket_medio: resumoDia.ticket_medio,
  meta: metaInfo?.meta || 0,
  percentual_meta: metaInfo?.percentual || 0
})}
`
  })

}
  
/* ================= OPENAI ================= */

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",
  temperature:0,

  
messages:[



{
role:"system",
content:`
📊 DADOS REAIS DE RESERVAS:

reservas_hoje: ${reservas.length}

clientes_hoje: ${new Set(reservas.map(r => r.telefone)).size}

faturamento_hoje: ${reservas.reduce((acc,r)=>
  acc + (r.valorFinalPago || r.valorEstimado || 0)
,0)}

ticket_medio_hoje: ${
  reservas.length > 0
  ? reservas.reduce((acc,r)=>
      acc + (r.valorFinalPago || r.valorEstimado || 0)
    ,0) / reservas.length
  : 0
}

variacao_percentual: 0

⚠️ REGRA:
Use apenas esses dados. Não inventar.
`
},


{
role:"system",
content:`
🔥 MÓDULO DE INTELIGÊNCIA — CONSULTA DE VENDAS (VERSÃO PROFISSIONAL)

Você é responsável por identificar perguntas relacionadas a vendas, faturamento e resultados financeiros.

Sua função NÃO é responder com criatividade.
Sua função é CLASSIFICAR corretamente a intenção.

---

📊 1. IDENTIFICAÇÃO DE CONSULTA DE VENDAS

Considere como consulta de vendas QUALQUER pergunta relacionada a:

- faturamento
- vendas
- receita
- caixa
- movimento
- resultado financeiro
- quanto vendeu
- quanto fez
- quanto entrou
- quanto faturou
- quanto deu
- resumo do dia

---

📌 2. VARIAÇÕES DE PERGUNTAS (TODAS SÃO VENDAS)

Você deve reconhecer automaticamente:

- quanto vendeu hoje
- quanto o mercatto vendeu hoje
- quanto fez hoje
- quanto entrou hoje
- faturamento de hoje
- vendas de hoje
- resultado de hoje
- movimento de hoje
- como está o caixa hoje
- quanto deu hoje
- resumo de vendas
- quanto foi hoje
- quanto saiu hoje
- quanto arrecadou hoje

Mesmo sem a palavra "venda", considere como vendas.

---

📌 3. DETECÇÃO DE EMPRESA

Identifique a empresa na pergunta:

- "mercatto" → MERCATTO DELÍCIA
- "padaria" → PADARIA DELÍCIA
- "villa" → VILLA GOURMET
- "delicia" ou "gourmet" → DELÍCIA GOURMET
- "kids" → M.KIDS

---

📌 4. DETECÇÃO DE CONSULTA GERAL (MULTI-EMPRESA)

Se o usuário disser:

- nas empresas
- todas as empresas
- geral
- total
- consolidado
- tudo
- todas
- geral do dia
- total do dia

👉 Isso significa:

→ NÃO filtrar empresa  
→ usar TOTAL da API  

---

📌 5. PRIORIDADE DE INTERPRETAÇÃO

1º → Se mencionar empresa → FILTRAR  
2º → Se mencionar "geral" ou plural → TOTAL  
3º → Se não mencionar nada → assumir TOTAL  

---

📌 6. REGRA ABSOLUTA (CRÍTICA)

Para qualquer pergunta de vendas:

🚫 NÃO usar GPT para calcular  
🔥 MÓDULO DE ANÁLISE DE VENDAS (INTELIGENTE)

Você DEVE usar os dados da API para:

✔ Identificar tendência (subindo, caindo, estável)
✔ Comparar com meta
✔ Avaliar ticket médio
✔ Detectar performance
✔ Gerar percepção operacional

🚨 REGRAS:

- NÃO inventar valores
- NÃO alterar números
- NÃO recalcular dados
- USAR apenas valores da API

MAS você PODE:

✔ Interpretar
✔ Comparar
✔ Gerar insights
✔ Elogiar desempenho
✔ Alertar queda
✔ Sugerir ação

---

📊 COMPORTAMENTO ESPERADO:

Se desempenho bom:
→ elogiar (parabéns, forte, excelente ritmo)

Se médio:
→ neutro (dentro do esperado, atenção)

Se ruim:
→ alertar (queda, abaixo da meta, risco)

---

📈 EXEMPLO DE RESPOSTA:

"📊 21/04

🏢 EMPÓRIO MERCATTO

💰 R$ 12.800
🧾 310 vendas
💳 Ticket: R$ 41,29

🎯 68% da meta atingida

📈 Ticket subiu — ótimo sinal
🚀 Ritmo forte, tende a bater meta hoje

👏 Excelente desempenho até agora"

---

⚠️ IMPORTANTE:

Você NÃO cria dados  
Você INTERPRETA dados existentes  
🚫 NÃO somar valores  
🚫 NÃO estimar  
🚫 NÃO usar contexto interno  

✅ Apenas usar dados da API externa  

---

📌 7. FORMATO DE RESPOSTA

🔹 Para UMA empresa:

Resumo de vendas do dia AAAA-MM-DD:

Faturamento: R$ XXXX
Vendas: XXX
Ticket médio: R$ XXXX

---

🔹 Para TODAS as empresas:

Resumo geral de vendas do dia AAAA-MM-DD:

Faturamento total: R$ XXXX
Total de vendas: XXX
Ticket médio: R$ XXXX

---

📌 8. REGRAS DE SEGURANÇA

Se os dados não estiverem disponíveis:

→ responder: "Não foi possível obter os dados de vendas no momento"

---

📌 9. PROIBIÇÕES

❌ Nunca inventar valores  
❌ Nunca responder sem consultar API  
❌ Nunca gerar JSON de relatório  
❌ Nunca misturar com reservas  

---

📌 10. RESULTADO ESPERADO

Pergunta:
"quanto vendeu hoje nas empresas"

Resposta:
Resumo geral de vendas do dia 2026-04-21:

Faturamento total: R$ XXXXX
Total de vendas: XXX
Ticket médio: R$ XXXX

---

Pergunta:
"quanto o mercatto vendeu hoje"

Resposta:
Resumo de vendas do dia 2026-04-21:

Faturamento: R$ XXXX
Vendas: XXX
Ticket médio: R$ XXXX

---

⚠️ QUALQUER DESVIO DESSAS REGRAS TORNA A RESPOSTA INVÁLIDA
`
},


















  
{
role:"system",
content:`
🚨 RELATÓRIO DE RESERVAS

Use os dados fornecidos.

reservas = reservas_hoje  
clientes = clientes_hoje  
faturamento = faturamento_hoje  
ticket_medio = ticket_medio_hoje  

Se variacao < 0 → CAINDO  
Se variacao > 0 → SUBINDO  
`
},

  {
role:"system",
content:`

🎤 REGRA CRÍTICA — AGENDA DE MÚSICOS

Tabela: agenda_musicos

Campos:
- empresa
- data
- cantor
- hora
- valor
- estilo

REGRAS:

1. Você DEVE usar APENAS os dados reais recebidos
2. NUNCA inventar cantor
3. NUNCA inventar horários
4. NUNCA criar agenda falsa

5. Resposta correta:

Se houver dados:

"Agenda musical do dia ${dataFiltro}:

- Guthierry — 21:00 (Internacional)"

6. Se não houver:

"Não há músicos cadastrados para essa data"

7. Para CRIAR:

GERAR:

ALTERAR_REGISTRO_JSON:
{
"operacao":"insert",
"tabela":"agenda_musicos",
"dados":{
  "empresa":"",
  "data":"",
  "cantor":"",
  "hora":"",
  "valor":0,
  "estilo":""
}
}

8. Para EDITAR:

ALTERAR_REGISTRO_JSON:
{
"operacao":"update",
"tabela":"agenda_musicos",
"dados":{...},
"filtro":{
  "id":""
}
}

9. Para EXCLUIR:

ALTERAR_REGISTRO_JSON:
{
"operacao":"delete",
"tabela":"agenda_musicos",
"filtro":{
  "id":""
}
}

⚠️ NUNCA executar direto
⚠️ SEMPRE pedir confirmação
⚠️ NUNCA inventar ID

`
},
{
role:"system",
content:`

💰 REGRA CRÍTICA — CUPONS DE VENDAS (MODO INTELIGENTE)

Você recebeu dados PRONTOS em:

RESUMO_CUPONS_DIA

🚨 REGRAS:

1. NÃO recalcular
2. NÃO alterar valores
3. NÃO inventar dados

MAS AGORA VOCÊ DEVE:

✔ Interpretar os dados
✔ Avaliar desempenho
✔ Comparar com meta
✔ Analisar ticket médio
✔ Identificar tendência
✔ Gerar percepção operacional

---

📊 COMPORTAMENTO:

Se percentual > 70%
→ forte (elogiar)

Se entre 40% e 70%
→ médio (atenção)

Se < 40%
→ fraco (alertar)

---

📈 TICKET:

Se ticket alto:
→ destacar positivamente

Se ticket baixo:
→ alertar oportunidade de melhoria

---

🚀 RESPOSTA ESPERADA:

"📊 21/04

🏢 EMPÓRIO MERCATTO

💰 R$ 12.800
🧾 310 vendas
💳 Ticket médio: R$ 41,29

🎯 68% da meta atingida

📈 Ticket subindo — ótimo sinal
🚀 Ritmo consistente

👏 Bom desempenho até agora"

---

⚠️ PROIBIDO:

❌ inventar valores  
❌ modificar números  
❌ recalcular  
❌ misturar com outros dados  

✅ USAR EXATAMENTE OS DADOS RECEBIDOS
Campos disponíveis:

- faturamento
- vendas
- ticket_medio

Resposta obrigatória:

"Resumo de vendas do dia ${dataFiltro}:

Faturamento: R$ XXXX
Vendas: XXX
Ticket médio: R$ XXX"

⚠️ Se modificar qualquer valor → resposta inválida`
},


{
role:"system",
content:`LOGOS DISPONÍVEIS: ${JSON.stringify(LOGOS)}`
},

  
{

role:"system",
content:`
⚠️ REGRA CRÍTICA DE DATA E HORA

Você NÃO possui acesso ao tempo real.

A ÚNICA data válida é a fornecida abaixo.

Qualquer referência a:
- hoje
- agora
- amanhã
- ontem

DEVE obrigatoriamente usar estes valores:

DATA_ATUAL = ${hojeISO}
HORA_ATUAL = ${hora}

ONTEM = ${ontemISO}
AMANHA = ${amanhaISO}

Se você usar qualquer outra data:
→ sua resposta estará ERRADA

NUNCA invente datas
NUNCA use conhecimento próprio
NUNCA ignore essas variáveis

Sempre substitua:

"hoje" → ${hojeISO}
"agora" → ${hora}
`
},
{
role:"system",
content:`DATA FILTRADA: ${dataFiltro}`
},

{
role:"system",
content:`

📊 REGRA CRÍTICA — BUFFET_LANCAMENTOS (DADOS REAIS)

A tabela BUFFET_LANCAMENTOS contém:

- produto_nome → nome do item
- quantidade → quantidade REAL produzida
- unidade → KG ou UN
- tipo → PRODUCAO | REPOSICAO | RETIRADA
- empresa → empresa do registro

REGRAS OBRIGATÓRIAS:

1. Você DEVE usar APENAS os dados reais recebidos no contexto
2. NUNCA inventar produtos
3. NUNCA repetir itens que não existem
4. NUNCA gerar lista fictícia de cardápio

5. Para responder:

→ Agrupar por produto_nome
→ Somar quantidade por produto
→ Mostrar no formato:

"ALCATRA (CHURRASCO) — 1.520 KG (Reposição)"

6. Se houver múltiplos registros do mesmo item:
→ SOMAR quantidades

7. Se não houver registros:
→ dizer claramente:
"Não houve lançamentos de buffet para essa data"

8. Se houver dados:

→ Responder assim:

"Buffet do dia ${dataFiltro} — ${empresaFiltro || 'todas as empresas'}:

- ALCATRA — 1.520 KG (Reposição)
- ARROZ — 2.300 KG (Produção)"

⚠️ PROIBIDO:
- inventar pratos
- usar 0.001 kg sem existir no banco
- gerar lista grande falsa

⚠️ SEMPRE usar produto_nome e quantidade reais
`
},



  
{
role:"system",
content:`

📦 RELAÇÃO DE DADOS DO CARDÁPIO

Tabela: buffet
→ representa os PRATOS

Tabela: itens_buffet
→ representa os INGREDIENTES de cada prato

Ligação:
itens_buffet.buffet_id = buffet.id

Tabela: produtos
→ contém custo_unitario dos ingredientes

Ligação:
itens_buffet.produto_id = produtos.id

📊 COMO CALCULAR CUSTO (CMV):

Para cada item do prato:

custo = quantidade * custo_unitario

CMV do prato = soma de todos os ingredientes

⚠️ REGRAS:
- Nunca inventar custo
- Sempre usar produtos.custo_unitario
- Sempre multiplicar pela quantidade
`
},






  {
role:"system",
content:`

📜 HISTÓRICO DE RESERVAS

Tabela: HIST_RESERVAS

Essa tabela contém o histórico completo de ações:

- INSERT (criação de reserva)
- UPDATE (edições)
- DELETE (exclusões)

Cada registro representa uma ação feita no sistema.

Use essa tabela para:

- Saber quem criou uma reserva
- Saber quem alterou
- Saber quem excluiu
- Ver histórico completo de mudanças

⚠️ REGRAS:

- Nunca inventar histórico
- Sempre usar os dados da tabela HIST_RESERVAS
- Sempre considerar a ordem cronológica (created_at)
`
},
{
role:"system",
content:`




🔥 RESERVAS — FLUXO OBRIGATÓRIO


Se o usuário disser algo como:

"registra reserva Nalbert amanhã sacada"

Você deve automaticamente identificar:

nome = Nalbert  
data = amanhã  
mesa = Sacada  

E perguntar apenas o que falta.


Se o usuário pedir para criar reserva:

ANTES de gerar qualquer JSON, você DEVE validar se possui TODOS os dados obrigatórios:

DADOS OBRIGATÓRIOS:
- nome
- pessoas (quantidade)
- data
- horário
- comanda individual (Sim ou Não)
- local (Sacada | Salão Principal | Sala VIP 1 | Sala VIP 2)

REGRAS:

1. Se QUALQUER dado estiver faltando:
→ NÃO gerar JSON
→ NÃO criar reserva
→ RESPONDER perguntando APENAS o que falta

Exemplo:
"Para criar a reserva preciso de:
- quantidade de pessoas
- horário

Pode me informar?"

2. Quando TODOS os dados obrigatórios estiverem preenchidos:
→ Perguntar:

"Deseja adicionar alguma observação?"

3. Se responder com observação:
→ incluir no campo observacoes

4. Se responder "não":
→ seguir sem observações

5. SOMENTE após tudo completo:
→ gerar o RESERVA_JSON

FORMATO:

RESERVA_JSON:
{
"operacao":"insert",
"tabela":"reservas_mercatto",
"dados":{
  "nome":"",
  "telefone":"",
  "email":"whatsapp_otto@mercatto.com",
  "pessoas":1,
  "mesa":"Sacada | Salão Principal | Sala VIP 1 | Sala VIP 2",
  "cardapio":"",
  "comandaIndividual":"Sim | Não",
  "datahora":"",
  "valorEstimado":0,
  "pagamentoAntecipado":0,
  "banco":"",
  "observacoes":"",
  "status":"Pendente"
}
}

⚠️ NUNCA gerar JSON incompleto
⚠️ NUNCA assumir dados
⚠️ USE sempre o email whatsapp_otto@mercatto.com e não peça esse dado
⚠️ SEMPRE perguntar o que falta
`
},
{
role:"system",
content:`REGRAS DO AGENTE:

${promptAgente}

Todas as regras acima são obrigatórias e devem ser seguidas rigorosamente.
`
},
{
role:"system",
content:`

🔥 CONTROLE TOTAL DO SISTEMA

Você pode criar, editar ou excluir QUALQUER registro em QUALQUER tabela.

Para isso use:

ALTERAR_REGISTRO_JSON:
{
"operacao":"insert | update | delete",
"tabela":"nome_da_tabela",
"dados":{...},
"filtro":{...}
}

REGRAS:
- Sempre usar confirmação antes de executar
- Nunca executar sem confirmação
- Nunca inventar dados
- Sempre usar dados existentes como base
`
},
{
role:"system",
content:`
TABELA: reservas_mercatto

Você já recebeu os dados completos da tabela RESERVAS no contexto acima.

Se uma reserva não aparecer nesses dados:
→ significa que ela NÃO EXISTE no sistema.

Regras obrigatórias:

- Nunca inventar reservas
- Nunca deduzir reservas
- Nunca criar dados que não estejam no contexto
- Sempre responder baseado na tabela RESERVAS fornecida

Use apenas os dados reais já enviados anteriormente.
`},

{
role:"system",
content:`

Você pode criar, editar ou apagar prompts da tabela "prompt_agente".

Estrutura da tabela:

prompt_agente
- id
- prompt
- ordem
- ativo
- created_at

Se o usuário pedir para alterar ou criar prompts, gere uma ação usando:

ALTERAR_REGISTRO_JSON:
{
"operacao":"insert | update | delete",
"tabela":"prompt_agente",
"dados":{...},
"filtro":{...}
}

Exemplo criar prompt:

ALTERAR_REGISTRO_JSON:
{
"operacao":"insert",
"tabela":"prompt_agente",
"dados":{
"prompt":"Sempre enviar a foto do prato antes da descrição.",
"ordem":10,
"ativo":true
}
}

Exemplo editar prompt:

ALTERAR_REGISTRO_JSON:
{
"operacao":"update",
"tabela":"prompt_agente",
"dados":{
"prompt":"texto atualizado"
},
"filtro":{
"id":5
}
}

Se o usuário pedir para criar, editar ou apagar um prompt:

1. Gere obrigatoriamente a ação ALTERAR_REGISTRO_JSON.
2. Não explique nada antes.
3. Não escreva texto adicional.
4. Apenas retorne o JSON da ação.

Se não gerar o JSON a ação será ignorada.
`
},


...contextos,
...mensagens
]

})

let resposta = completion.choices[0].message.content
// 🔥 BLOQUEIO TOTAL DE INVENÇÃO


  






/* ================= DETECTAR RESERVA ================= */

const matchReserva = resposta.match(/RESERVA_JSON:\s*([\s\S]*)/)

if(matchReserva){

  try{

    let jsonTexto = matchReserva[1]

    // 🔥 LIMPA LIXO DO GPT
    jsonTexto = jsonTexto
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim()

    // 🔥 GARANTE JSON COMPLETO
    const inicio = jsonTexto.indexOf("{")
    const fim = jsonTexto.lastIndexOf("}")

    if(inicio !== -1 && fim !== -1){
      jsonTexto = jsonTexto.substring(inicio, fim + 1)
    }

    console.log("📦 JSON LIMPO:", jsonTexto)

    const acaoReserva = JSON.parse(jsonTexto)

    const dados = {

      nome: acaoReserva.dados.nome || "Cliente",
      telefone: acaoReserva.dados.telefone || "ADMIN",
      email: "whatsapp_otto@mercatto.com",
      pessoas: parseInt(acaoReserva.dados.pessoas) || 1,
      mesa: acaoReserva.dados.mesa || "Salão",
      cardapio: acaoReserva.dados.cardapio || "",
      datahora: acaoReserva.dados.datahora,
      observacoes: acaoReserva.dados.observacoes || "",
      status: acaoReserva.dados.status || "Pendente",
      valorEstimado: 0,
      pagamentoAntecipado: 0,
      banco: "",
      comandaIndividual: acaoReserva.dados.comandaIndividual || "Não"
    }

    delete dados.comandaindividual

    const { error } = await supabase
      .from("reservas_mercatto")
      .insert(dados)

    if(error){
      console.error("❌ ERRO REAL AO SALVAR:", error)
      throw new Error(error.message)
    }

    resposta = "✅ Reserva criada com sucesso"

}catch(e){
  console.error("❌ ERRO RESERVA:", e)
  resposta = "❌ Erro ao interpretar a reserva. Tente novamente."
}
}








  
/* ================= DETECTAR AÇÃO ================= */













  
let acao = null

const match = resposta.match(/ALTERAR_REGISTRO_JSON:\s*(\{[\s\S]*\})/)

if(match && NIVEL === 0){

  try{

    let jsonTexto = match[1]

    jsonTexto = jsonTexto
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim()

    acao = JSON.parse(jsonTexto)

    if(!resposta.includes("Confirme")){
      resposta += "\n\n⚠️ Confirme para executar esta ação."
    }

  }catch(e){
    console.log("Erro parse JSON ação:", match[1])
  }

}

/* ================= SALVAR RESPOSTA ================= */

await supabase
.from("administrador_chat")
.insert({
role:"assistant",
mensagem:resposta,
acao_json:acao
})

return res.json({
resposta,
acao
})

}catch(e){

console.error("ERRO GERAL:",e)

return res.status(500).json({
erro:"erro interno"
})

}

}
// ================= RELATÓRIO AUTOMÁTICO =================

async function executarRelatorioAutomatico(){

  console.log("🌅 GERANDO RELATÓRIO AUTOMÁTICO...")

  const METAS = {
    "DELÍCIA GOURMET": { prata: 545000 },
    "MERCATTO EMPORIO": { prata: 650000 },
    "MERCATTO RESTAURANTE": { prata: 850000 },
    "PADARIA DELÍCIA": { prata: 720000 },
    "VILLA GOURMET": { prata: 746600 }
  }

  const admins = Object.entries(USUARIOS)
    .filter(([_, u]) => u.nivel === 0)
    .map(([numero]) => numero)

  const resApi = await fetch("https://goals-continental-examinations-carrier.trycloudflare.com/resumo-dia")
  const data = await resApi.json()

  let mensagem = `🌅 *RELATÓRIO FINANCEIRO*\n━━━━━━━━━━━━━━━━━━\n`

  for(const empresa of data.empresas){

    const meta = METAS[empresa.empresa]?.prata || 0

    const percentual = meta > 0
      ? ((empresa.faturamento_mes / meta) * 100).toFixed(0)
      : 0

    const ticketMes = empresa.vendas_mes > 0
      ? empresa.faturamento_mes / empresa.vendas_mes
      : 0

    let status = "➡️ Estável"

    if(empresa.variacao_semana > 5){
      status = `📈 +${empresa.variacao_semana}%`
    } else if(empresa.variacao_semana < -5){
      status = `📉 ${empresa.variacao_semana}%`
    }

    mensagem += `
🏢 *${empresa.empresa}*
💰 Dia: R$ ${formatar(empresa.faturamento)}
📅 Mês: R$ ${formatar(empresa.faturamento_mes)}
🎯 Meta: ${percentual}%
💳 Ticket: R$ ${formatar(empresa.ticket_medio)}
${status}

`
  }

  mensagem += `━━━━━━━━━━━━━━━━━━\n🤖 Sistema DV`

  for(const numero of admins){

    console.log("📤 ENVIANDO PARA:", numero)

    const response = await fetch(
  `https://graph.facebook.com/v19.0/${process.env.OTTO_PHONE_NUMBER_ID}/messages`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OTTO_WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: numero,
      type: "text",
      text: { body: mensagem }
    })
  }
)

    const result = await response.json()

    if(result.error){
      console.error("❌ ERRO WHATS:", result.error)
    }else{
      console.log("✅ ENVIADO:", numero)
    }
  }

  console.log("✅ RELATÓRIO FINALIZADO")
}
