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
  "557799761436": { nivel: 0 }, // ADMIN REAL
  "557798315510": { nivel: 0 },
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

// 🔥 BUSCAR USUÁRIO REAL NO BANCO
const { data: usuarioDB } = await supabase
  .from("usuarios_do_sistema")
  .select("*")
  .eq("telefone", numero)
  .eq("ativo", true)
 .maybeSingle()

if(!usuarioDB){
  console.log("⛔ USUÁRIO NÃO CADASTRADO OU INATIVO:", numero)

  return res.json({
    resposta: "⛔ Usuário não autorizado ou inativo"
  })
}

// 🔐 NÍVEL REAL
const NIVEL = usuarioDB.nivel_acesso

// 👤 NOME REAL
const NOME = usuarioDB.nome

// 🏢 EMPRESA
const EMPRESA = usuarioDB.empresa

console.log("👤 USUARIO:", NOME)
console.log("📱 TELEFONE:", numero)
console.log("🏢 EMPRESA:", EMPRESA)
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

const hojeISO = getDataISO(new Date())
const hora = `${get("hour")}:${get("minute")}:${get("second")}`

function getDataISO(date){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date)

  const get = t => parts.find(p => p.type === t)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}


// 🔥 ONTEM CORRETO (SEM UTC BUG)
const ontemDate = new Date()
ontemDate.setDate(ontemDate.getDate() - 1)

const ontemISO = getDataISO(ontemDate)

// 🔥 AMANHÃ
const amanhaDate = new Date()
amanhaDate.setDate(amanhaDate.getDate() + 1)

const amanhaISO = getDataISO(amanhaDate)

/* ================= AGORA SIM ================= */









const texto = pergunta.toLowerCase()
  // ================= ANALISE DE RELATÓRIO =================

if(texto === "sim"){

  // 🔥 BUSCA ÚLTIMA MENSAGEM DO BOT
const { data: ultimaAnalise } = await supabase
  .from("assistente_otto_chat")
  .select("id")
  .eq("telefone", numero)
  .eq("tipo", "analise_relatorio")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

const pediuAnalise =
  !!ultimaPergunta &&
  (!ultimaAnalise || ultimaAnalise.created_at < ultimaPergunta.created_at)

  if(!pediuAnalise){
    // 🔥 deixa seguir fluxo normal (confirmações etc)
  } else {

    // 🔥 BUSCA RELATÓRIO
    const { data: relatorio } = await supabase
      .from("assistente_otto_chat")
      .select("mensagem")
      .eq("tipo", "relatorio_admin")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if(!relatorio){
      return res.json({
        resposta: "⚠️ Não encontrei relatório recente para analisar."
      })
    }

    const analise = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Você é um analista estratégico de negócios.

Analise o relatório abaixo e gere:

- Pontos positivos
- Problemas
- Oportunidades
- Riscos
- Conclusão direta

Seja direto, estratégico e objetivo.
`
        },
        {
          role: "user",
          content: relatorio.mensagem
        }
      ]
    })

    const respostaAnalise = analise.choices[0].message.content

    await supabase
      .from("assistente_otto_chat")
      .insert({
        role: "assistant",
        mensagem: respostaAnalise,
        telefone: numero,
        usuario_id: usuarioDB.id,
        nome: NOME,
        empresa: EMPRESA
      })

    return res.json({
      resposta: respostaAnalise
    })
  }
}
/* ================= GERENCIAR PROMPTS ================= */

if(texto.includes("novo prompt")){

  if(NIVEL !== 0){
    return res.json({
      resposta: "⛔ Apenas administradores podem gerenciar prompts"
    })
  }

  // 🔥 LISTA PROMPTS ATUAIS
  const { data: lista } = await supabase
    .from("prompt_agente")
   .select("prompt, ordem")
    .eq("ativo", true)
    .order("ordem",{ascending:true})

  let resposta = "🧠 PROMPTS ATUAIS:\n\n"

  if(lista && lista.length){
lista.forEach(p => {

const nomeCurto = (p.prompt || "")
  .split(".")[0]
  .slice(0, 50)

  resposta += `#${p.ordem} → ${nomeCurto}...\n`
})
  }
  
  
  else{
    resposta += "Nenhum prompt cadastrado.\n\n"
  }

  resposta += "✍️ Envie o NOVO PROMPT no formato:\n\nPROMPT: seu texto\nPRIORIDADE: numero"

  return res.json({ resposta })
}


/* ================= NOVO PROMPT INTELIGENTE ================= */

if(
  texto.startsWith("prompt:") ||
  texto.includes("criar prompt") ||
  texto.includes("novo prompt com") ||

  // 🔥 NOVO BLOCO INTELIGENTE
  texto.includes("sempre que eu") ||
  texto.includes("a partir de agora") ||
  texto.includes("quero que voce") ||
  texto.includes("quero que você") ||
  texto.includes("regra nova") ||
  texto.includes("toda vez que")
)







{

  if(NIVEL !== 0){
    return res.json({
      resposta: "⛔ Apenas administradores podem criar prompts"
    })
  }

  const interpretacaoPrompt = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
Extraia um novo prompt e prioridade da frase.

Responda APENAS JSON:

{
  "prompt": "texto do prompt",
  "prioridade": numero
}

REGRAS:
- Converta números por extenso (ex: cinco → 5)
- Se não tiver prioridade → usar 5
- Se não tiver prompt → retornar null
`
      },
      { role: "user", content: pergunta }
    ]
  })

  let dados = null

  try{
    dados = JSON.parse(interpretacaoPrompt.choices[0].message.content)
  }catch(e){
    console.log("❌ ERRO INTERPRETAR PROMPT")
  }

  if(!dados?.prompt){
    return res.json({
      resposta: "⚠️ Não consegui entender o prompt. Tente novamente."
    })
  }


const prioridade = dados.prioridade || 5

const acao = {
  tabela: "prompt_agente",
  operacao: "insert",
  dados: {
    prompt: dados.prompt,
    ordem: prioridade,
    ativo: true
  }
}

// 🔥 SALVA A CONFIRMAÇÃO NO BANCO
await supabase
  .from("assistente_otto_chat")
  .insert({
    role: "assistant",
    mensagem: `
⚠️ CONFIRMAÇÃO DE PROMPT

📌 Prioridade: ${prioridade}

🧠 Regra:
${dados.prompt}

Digite:

✔ SIM → salvar  
✏️ ALTERAR → modificar  
❌ CANCELAR → abortar
`,
    telefone: numero,
    usuario_id: usuarioDB.id,
    nome: NOME,
    empresa: EMPRESA,
    acao_json: acao,
    aguardando_confirmacao: true
  })

// 🔥 RETORNA APENAS TEXTO
return res.json({
  resposta: `
⚠️ CONFIRMAÇÃO DE PROMPT

📌 Prioridade: ${prioridade}

🧠 Regra:
${dados.prompt}

Digite:

✔ SIM → salvar  
✏️ ALTERAR → modificar  
❌ CANCELAR → abortar
`
})
}

  

  // ================= COMANDO MANUAL RELATÓRIO ADM =================

if(
  texto.includes("enviar relatorio") ||
  texto.includes("enviar relatório") ||
  texto.includes("relatorio adm") ||
  texto.includes("relatório adm") ||
  texto.includes("manda relatorio") ||
  texto.includes("manda relatório")
){

  if(NIVEL !== 0){
    return res.json({
      resposta: "⛔ Apenas administradores nível 0 podem enviar o relatório"
    })
  }

  console.log("📤 RELATÓRIO MANUAL DISPARADO POR:", NOME)

  await executarRelatorioAutomatico()

  return res.json({
    resposta: "📊 Relatório enviado para todos administradores com sucesso"
  })
}



  

const NUMEROS_EXTENSO = {
  "um":1,"dois":2,"tres":3,"três":3,"quatro":4,"cinco":5,
  "seis":6,"sete":7,"oito":8,"nove":9,"dez":10,
  "onze":11,"doze":12,"treze":13,"quatorze":14,"quinze":15,
  "dezesseis":16,"dezessete":17,"dezoito":18,"dezenove":19,
  "vinte":20,"vinte e um":21,"vinte e dois":22,"vinte e tres":23,"vinte e três":23,
  "vinte e quatro":24,"vinte e cinco":25,"vinte e seis":26,"vinte e sete":27,
  "vinte e oito":28,"vinte e nove":29,"trinta":30,"trinta e um":31
}










  
let dataFiltro = hojeISO

function formatarData(date){
  return date.toISOString().slice(0,10)
}

const hojeDate = new Date(`${hojeISO}T00:00:00`)

// 🔥 NORMALIZA TEXTO
let textoNormalizado = texto
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")

// 🔥 CONVERTE EXTENSO → NÚMERO
const palavrasOrdenadas = Object.keys(NUMEROS_EXTENSO)
  .sort((a,b)=>b.length - a.length) // 🔥 MUITO IMPORTANTE

for(const palavra of palavrasOrdenadas){
  const valor = NUMEROS_EXTENSO[palavra]

  textoNormalizado = textoNormalizado.replace(
    new RegExp(`\\b${palavra}\\b`, "g"),
    valor
  )
}


  
// 🔥 AGORA SIM INTERPRETA

if(textoNormalizado.includes("hoje")){
  dataFiltro = hojeISO
}

else if(textoNormalizado.includes("ontem")){
  const d = new Date(hojeDate)
  d.setDate(d.getDate() - 1)
dataFiltro = toISO(d)
}

else if(textoNormalizado.match(/(\d{1,2})\D+(?:de\s*)?(\d{1,2})/)){

  const match = textoNormalizado.match(/(\d{1,2})\D+(?:de\s*)?(\d{1,2})/)

  const dia = match[1].padStart(2,"0")
  const mes = match[2].padStart(2,"0")

  dataFiltro = `${hojeISO.slice(0,4)}-${mes}-${dia}`
}

else if(textoNormalizado.match(/dia\s+(\d{1,2})/)){

  const match = textoNormalizado.match(/dia\s+(\d{1,2})/)

  const dia = match[1].padStart(2,"0")
  const mesAtual = hojeISO.slice(5,7)

  dataFiltro = `${hojeISO.slice(0,4)}-${mesAtual}-${dia}`
}

console.log("📅 DATA FINAL USADA:", dataFiltro)
// ================= INTELIGÊNCIA GLOBAL =================

const interpretacao = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  temperature: 0,
  messages: [
    {
      role: "system",
      content: `
Classifique a intenção do usuário.

Retorne apenas JSON:

{
  "tipo": "vendas | reservas | pedidos | buffet | clientes | relatorio | outro",
  "empresa": "string ou null"
}

Não crie regras.
Não explique.
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


// NIVEL 2 → BLOQUEIA EMPRESA
if(NIVEL === 2){
  empresaFiltro = EMPRESA
}else{

let normal = texto
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")

// 🔥 CORREÇÃO DE FALA (STT / ÁUDIO)
if(
  classificacao.tipo === "vendas" && (
    normal.includes("mercado") ||
    normal.includes("merkado") ||
    normal.includes("mercad") ||
    normal.includes("mercatto") ||
    normal.includes("mercato")
  )
){
  console.log("🧠 CORREÇÃO: mercado → mercatto (contexto vendas)")
  normal = normal.replace(/mercado|merkado|mercad|mercato/g, "mercatto")
}

  

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
  // 🔥 CONTINUA SOMANDO, MAS SEM POLUIR NOME
  empresaFiltro = "MERCATTO"
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




  // 🔥 BLOQUEIO GLOBAL DE TAREFAS
if(tipoConsulta === "tarefas" && NIVEL !== 0){
  return res.json({
    resposta: "⛔ Apenas administradores nível 0 podem criar tarefas"
  })
}
// 🔥 DETECTAR TAREFA
if(
  texto.includes("lembra") ||
  texto.includes("lembrete") ||
  texto.includes("agenda") ||
  texto.includes("avisar") ||
  texto.includes("me lembra")
){
  tipoConsulta = "tarefas"
}




  
const tipoAcao = classificacao.intencao || "consulta"
if(tipoAcao !== "consulta"){
  console.log("🛠️ AÇÃO DETECTADA:", tipoAcao)
}

  











  
// 🔥 NÃO FORÇAR TIPO — DEIXAR GPT DECIDIR

if(!tipoConsulta || tipoConsulta === "outro"){
  tipoConsulta = "geral"
}
/* ================= BLOQUEIO CUPONS ================= */

if(tipoConsulta === "vendas" && ![0,1].includes(NIVEL)){
  return res.json({
    resposta: "⛔ Apenas usuários nível 0 e 1 podem acessar dados de vendas"
  })
}


  
/* ================= CONTROLE POR NIVEL ================= */


  

if(NIVEL === 3){

  // 🔥 BLOQUEIO TAREFAS
if(tipoConsulta === "tarefas" && NIVEL !== 0){
  return res.json({
    resposta: "⛔ Apenas administradores podem criar tarefas"
  })
}

  
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
.from("assistente_otto_chat")
.select("acao_json")
.eq("telefone", numero)
.eq("aguardando_confirmacao", true) // 🔥 GARANTE AÇÃO PENDENTE
.order("created_at",{ascending:false})
.limit(1)
.maybeSingle()

if(last?.acao_json){
confirmar = last.acao_json
}


}

/* ================= CONFIRMAR AÇÃO ================= */
if(confirmar){

const acao = confirmar // 🔥 PRIMEIRO DEFINE

// 🔥 TAREFAS
if(acao.tabela === "assistente_otto_tarefas"){

  // 🔥 GARANTE USUÁRIO CORRETO
  const dadosTarefa = {
    ...acao.dados,
    usuario_id: usuarioDB.id, // 🔥 FORÇA O ID CORRETO
    telefone: numero // 🔥 garante consistência
  }

  const { error } = await supabase
    .from("assistente_otto_tarefas")
    .insert(dadosTarefa)

  if(error){
    console.error("Erro tarefa:", error)
    throw error
  }

  return res.json({
    resposta:"✅ Tarefa criada com sucesso"
  })
}
  

  
// 🔒 BLOQUEIO TOTAL
if(NIVEL !== 0){
  return res.json({
    resposta: "⛔ Você não tem permissão para alterar dados"
  })
}

  
try{

const acaoExec = confirmar// remove campos proibidos
if(acaoExec.dados && acaoExec.dados.created_at){
delete acaoExec.dados.created_at
}
if(acaoExec.operacao === "insert"){

// 🔥 CORREÇÃO CRÍTICA PARA RESERVAS
if(acaoExec.tabela === "reservas_mercatto"){

  if(!acaoExec.dados.email){
    acaoExec.dados.email = "nao_informado@mercatto.com"
  }

  if(!acaoExec.dados.status){
    acaoExec.dados.status = "Pendente"
  }

  if(!acaoExec.dados.comandaIndividual){
    acaoExec.dados.comandaIndividual = "Não"
  }

  if(!acaoExec.dados.valorEstimado){
    acaoExec.dados.valorEstimado = 0
  }

  if(!acaoExec.dados.pagamentoAntecipado){
    acaoExec.dados.pagamentoAntecipado = 0
  }

  if(!acaoExec.dados.banco){
    acaoExec.dados.banco = ""
  }

  if(!acaoExec.dados.observacoes){
    acaoExec.dados.observacoes = ""
  }

}

const { data, error } = await supabase
.from(acaoExec.tabela)
.insert(acaoExec.dados)
.select()

if(error){
console.error("Erro insert:", error)
throw error
}

}

if(acaoExec.operacao === "update"){

const { data, error } = await supabase
.from(acaoExec.tabela)
.update(acaoExec.dados)
.match(acaoExec.filtro)
.select()

if(acaoExec){
console.error("Erro update:", error)
throw error
}

}

if(acaoExec.operacao === "delete"){

const { error } = await supabase
.from(acaoExec.tabela)
.delete()
.match(acaoExec.filtro)

if(error){
console.error("Erro delete:", error)
throw error
}

}

await supabase
.from("assistente_otto_chat")
.insert({
  role:"assistant",
  mensagem:"✅ Ação executada com sucesso"
})

// 🔥 LIMPA CONFIRMAÇÃO (LOCAL EXATO)
await supabase
.from("assistente_otto_chat")
.update({ aguardando_confirmacao: false })
.eq("telefone", numero)
.eq("aguardando_confirmacao", true)
  
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

const { error: erroInsert } = await supabase
.from("assistente_otto_chat")
.insert({
  role: "user",
  mensagem: pergunta,
  mensagem_limpa: textoNormalizado,
  telefone: numero,
  usuario_id: usuarioDB.id,
  nome: NOME,
  empresa: EMPRESA,
  tipo: tipoConsulta,
  intencao: tipoAcao
})

if(erroInsert){
  console.error("❌ ERRO AO SALVAR PERGUNTA:", erroInsert)
}
/* ================= HISTÓRICO ================= */

const {data:historico, error: erroHistorico} = await supabase
.from("assistente_otto_chat")
.select("*")
.eq("telefone", numero)
.order("created_at",{ascending:false})
.limit(30)

if(erroHistorico){
  console.error("❌ ERRO HISTORICO:", erroHistorico)
}


  

const mensagens = (historico || [])
.reverse()
.map(m => ({
  role: ["system","user","assistant"].includes(m.role) ? m.role : "user",
  content: (m.mensagem || "") + (
    m.acao_json
      ? `\n\nAÇÃO_JSON:\n${JSON.stringify(m.acao_json)}`
      : ""
  )
}))
// 🔥 CRIA CONTEXTO ANTES DE QUALQUER USO
const contextos = []
// ================= MEMÓRIA DO USUÁRIO =================

const { data: ultimaMemoria } = await supabase
.from("assistente_otto_chat")
.select("memoria_extraida")
.eq("telefone", numero)
.not("memoria_extraida","is",null)
.order("created_at",{ascending:false})
.limit(1)
.maybeSingle()

if(ultimaMemoria?.memoria_extraida){
  contextos.push({
    role: "system",
    content: "MEMORIA_USUARIO:\n" + JSON.stringify(ultimaMemoria.memoria_extraida)
  })
}





  
// ================= ESTADO DA CONVERSA =================

const { data: ultimoEstado } = await supabase
.from("assistente_otto_chat")
.select("etapa_fluxo, contexto")
.eq("telefone", numero)
.not("etapa_fluxo", "is", null)
.order("created_at", { ascending: false })
.limit(1)
.maybeSingle()

if(ultimoEstado){
  contextos.push({
    role: "system",
    content: "ESTADO_CONVERSA:\n" + JSON.stringify(ultimoEstado)
  })
}

  
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



// ================= DADOS EXTERNOS (VENDAS API) =================

let dadosExternos = {}

try{

  const API = "https://democracy-thesaurus-forms-roland.trycloudflare.com"

  const [dia, mes, analitico] = await Promise.all([
    fetch(`${API}/resumo-dia?data=${dataFiltro}`).then(r=>r.json()),
    fetch(`${API}/resumo-mes`).then(r=>r.json()),
    fetch(`${API}/cupons-analitico?data=${dataFiltro}`).then(r=>r.json())
  ])

  dadosExternos = {
    resumo_dia: dia,
    resumo_mes: mes,
    analitico: analitico
  }
// 🔥 ENVIA DADOS PARA O GPT (OBRIGATÓRIO)
contextos.push({
  role: "system",
  content: "DADOS_VENDAS_COMPLETO:\n" + JSON.stringify(dadosExternos)
})

  
}catch(e){

  console.log("❌ ERRO API:", e)

  contextos.push({
    role: "system",
    content: "ERRO_API_VENDAS: true"
  })
}








  

// 🔥 CONTEXTO DO USUÁRIO (LOCAL EXATO)
contextos.push({
  role: "system",
  content: `USUARIO_ATUAL:
${JSON.stringify({
  nome: NOME,
  telefone: numero,
  empresa: EMPRESA,
  nivel: NIVEL
})}`
})

// 🔥 BUSCAR USUÁRIOS DO SISTEMA (PARA TAREFAS)
const { data: usuariosSistema } = await supabase
  .from("usuarios_do_sistema")
  .select("id,nome,telefone,empresa,setor,cargo,descricao_funcao")
  .eq("ativo", true)

// 🔥 MANDA PARA O GPT
contextos.push({
  role: "system",
  content: "USUARIOS_SISTEMA:\n" + JSON.stringify(usuariosSistema || [])
})



  
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
  "DELÍCIA GOURMET": { prata: 545000, ouro: 650000 },
  "MERCATTO EMPORIO": { prata: 650000, ouro: 780000 },
  "MERCATTO RESTAURANTE": { prata: 850000, ouro: 1000000 },
  "PADARIA DELÍCIA": { prata: 720000, ouro: 850000 },
  "VILLA GOURMET": { prata: 746600, ouro: 900000 }
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

  // 🔥 SE VIER DATE → CONVERTE
  if(dataISO instanceof Date){
    return dataISO.toISOString().slice(0,10)
  }

  // 🔥 SE NÃO FOR STRING → EVITA QUEBRAR
  if(typeof dataISO !== "string"){
    console.log("⚠️ formatarData recebeu inválido:", dataISO)
    return null
  }

  // 🔥 SE FOR STRING VÁLIDA
  if(dataISO.includes("-")){
    const [ano, mes, dia] = dataISO.split("-")
    return `${dia}/${mes}/${ano}`
  }

  return dataISO
}

  function toISO(date){
  return date.toISOString().slice(0,10)
}

function toBR(dataISO){
  if(typeof dataISO !== "string") return "-"
  const [ano, mes, dia] = dataISO.split("-")
  return `${dia}/${mes}/${ano}`
}
  



const API_CUPONS = "https://democracy-thesaurus-forms-roland.trycloudflare.com"

if(tipoConsulta === "vendas" || tipoConsulta === "relatorio"){
  console.log("📅 DATA FINAL USADA:", dataFiltro)
  try{

    console.log("🔥 CONSULTA INTELIGENTE DE VENDAS")

    let url = ""
    let tipoBusca = "dia"

// ================= DECISÃO INTELIGENTE =================

// 🔥 DIAGNÓSTICO / RELATÓRIO (PRIORIDADE MÁXIMA)
const ehDiagnostico =
  texto.includes("diagnostico") ||
  texto.includes("diagnóstico") ||
  texto.includes("relatorio") ||
  texto.includes("relatório") ||
  texto.includes("resumo")

const ehMes =
  texto.includes("mes") || texto.includes("mês")

const ehHoje =
  !ehMes && (
    texto.includes("hoje") ||
    dataFiltro === hojeISO
  )
// 🔥 DIAGNÓSTICO TEM PRIORIDADE TOTAL
if(ehDiagnostico){
  console.log("🧠 MODO DIAGNÓSTICO → FORÇANDO RESUMO DIA")

  empresaFiltro = null
  url = `${API_CUPONS}/resumo-dia?data=${dataFiltro}`
  tipoBusca = "dia"
}

// ================= MÊS =================
else if(ehMes){

  console.log("📊 MODO MÊS + HOJE")

  tipoBusca = "mes_completo"

  const resMes = await fetch(`${API_CUPONS}/resumo-mes`)
  const dataMes = await resMes.json()

  const resDia = await fetch(`${API_CUPONS}/resumo-dia`)
  const dataDia = await resDia.json()

  let empresaMes = null
  let empresaHoje = null

  if(empresaFiltro){
    empresaMes = dataMes.empresas?.find(e => e.empresa === empresaFiltro)
    empresaHoje = dataDia.empresas?.find(e => e.empresa === empresaFiltro)
  }else{
    empresaMes = {
      faturamento_mes: dataMes.empresas.reduce((a,e)=>a + (e.faturamento_mes || 0),0),
      vendas_mes: dataMes.empresas.reduce((a,e)=>a + (e.vendas_mes || 0),0)
    }

    empresaHoje = {
      faturamento: dataDia.faturamento,
      vendas: dataDia.vendas
    }
  }

  const faturamentoMes = Number(empresaMes?.faturamento_mes || 0)
  const faturamentoHoje = Number(empresaHoje?.faturamento || 0)

  const vendasMes = Number(empresaMes?.vendas_mes || 0)
  const vendasHoje = Number(empresaHoje?.vendas || 0)

  const total = faturamentoMes + faturamentoHoje

  const metaInfo = empresaFiltro
    ? calcularMeta(empresaFiltro, total)
    : { meta:0, percentual:0 }

  contextos.push({
    role:"system",
    content: "RESUMO_MES_COMPLETO:\n" + JSON.stringify({
      empresa: empresaFiltro || "GERAL",
      ate_ontem: {
        faturamento: faturamentoMes,
        vendas: vendasMes
      },
      hoje: {
        faturamento: faturamentoHoje,
        vendas: vendasHoje
      },
      total: {
        faturamento: total,
        vendas: vendasMes + vendasHoje
      },
      meta: metaInfo.meta,
      percentual_meta: metaInfo.percentual
    })
  })
}

// ================= ANALÍTICO =================
else if(
  texto.includes("forma") ||
  texto.includes("pagamento") ||
  texto.includes("pix") ||
  texto.includes("cartao") ||
  texto.includes("cartão")
){
  url = `${API_CUPONS}/cupons-analitico?data=${dataFiltro}`
  tipoBusca = "analitico"
}

// ================= LISTA =================
else if(
  texto.includes("lista") ||
  texto.includes("cupons") ||
  texto.includes("vendas detalhadas")
){
  url = `${API_CUPONS}/cupons?data=${dataFiltro}`
  tipoBusca = "lista"
}

// ================= PADRÃO =================
else{
  url = `${API_CUPONS}/resumo-dia?data=${dataFiltro}`
  tipoBusca = "dia"
}
    


    console.log("🌐 URL:", url)

let data = null

if(tipoBusca !== "mes_completo"){
  console.log("🌐 URL:", url)

  const resApi = await fetch(url)
  data = await resApi.json()
}

    // ================= RESUMO DIA =================
if(tipoBusca === "dia"){

  if(!empresaFiltro){
    contextos.push({
      role:"system",
      content: "RESUMO_EMPRESAS_DIA:\n" + JSON.stringify(data.empresas || [])
    })
  }

  // 🔥 TOTAL DAS EMPRESAS
  contextos.push({
    role:"system",
    content: "TOTAL_EMPRESAS_DIA:\n" + JSON.stringify({
      faturamento_total: (data.empresas || []).reduce((a,e)=>a + (e.faturamento || 0),0),
      vendas_total: (data.empresas || []).reduce((a,e)=>a + (e.vendas || 0),0)
    })
  })

  // 🔥 AGORA FICA DENTRO (ANTES ESTAVA FORA ❌)
  let empresaData = null

  if(empresaFiltro === "MERCATTO"){

    const empresas = data.empresas || []

    const emporio = empresas.find(e => e.empresa === "MERCATTO EMPORIO")
    const restaurante = empresas.find(e => e.empresa === "MERCATTO RESTAURANTE")

    const faturamento =
      Number(emporio?.faturamento || 0) +
      Number(restaurante?.faturamento || 0)

    const vendas =
      Number(emporio?.vendas || 0) +
      Number(restaurante?.vendas || 0)

    const ticket = vendas > 0
      ? Number((faturamento / vendas).toFixed(2))
      : 0

    empresaData = { faturamento, vendas, ticket_medio: ticket }

  } else if(empresaFiltro){

    empresaData = data.empresas?.find(
      e => e.empresa === empresaFiltro
    )

    if(!empresaData){
      return res.json({
        resposta: `⚠️ Não encontrei dados de vendas para ${empresaFiltro} no dia ${dataFiltro}`
      })
    }

  } else {

    empresaData = data

  }

  const faturamento = Number(empresaData.faturamento || 0)
  const vendas = Number(empresaData.vendas || 0)

  const ticketCalculado =
    vendas > 0
      ? Number((faturamento / vendas).toFixed(2))
      : 0

  resumoDia = {
    data: data.data,
    faturamento,
    vendas,
    ticket_medio: empresaData.ticket_medio || ticketCalculado,
    empresa: empresaFiltro
  }
}


    // ================= ANALÍTICO =================
if(tipoBusca === "analitico" && data){

  const finalizadoras = data.empresas || data

  contextos.push({
    role:"system",
    content: "CUPONS_ANALITICO:\n" + JSON.stringify(finalizadoras)
  })

}

    // ================= LISTA =================
if(tipoBusca === "lista" && Array.isArray(data)){
  contextos.push({
    role:"system",
    content: "CUPONS_LISTA:\n" + JSON.stringify(data.slice(0,100))
  })
}
    

    // ================= MÊS =================
    if(tipoBusca === "mes" && data){
      contextos.push({
        role:"system",
        content: "RESUMO_MES:\n" + JSON.stringify(data)
      })
    }

  } catch(e){

    console.log("❌ ERRO CUPONS:", e)

    return res.json({
      resposta: "Erro ao consultar vendas"
    })

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

const ctxReservas = addContext("RESERVAS", reservas)
if(ctxReservas) contextos.push(ctxReservas)

const ctxPedidos = addContext("PEDIDOS", pedidos)
if(ctxPedidos) contextos.push(ctxPedidos)

const ctxClientes = addContext("CLIENTES", clientes)
if(ctxClientes) contextos.push(ctxClientes)

const ctxProdutos = addContext("PRODUTOS", produtos)
if(ctxProdutos) contextos.push(ctxProdutos)




  
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

  if(lista && lista.length){
    contextos.push({
      role:"system",
      content: "RESUMO_REAL_BUFFET:\n" + JSON.stringify(lista)
    })
  }

} // ✅ FECHAMENTO QUE FALTAVA
  
if(musicos.length){

  
  contextos.push({
    role:"system",
    content: "AGENDA_MUSICOS:\n" + JSON.stringify(musicos)
  })
}
if(resumoDia && resumoDia.faturamento !== undefined){



let faturamentoMesTotal = resumoDia.faturamento

try{

  const resMes = await fetch(`${API_CUPONS}/resumo-mes`)
  const dataMes = await resMes.json()

  if(resumoDia.empresa){

    const empresaMes = dataMes.empresas?.find(
      e => e.empresa === resumoDia.empresa
    )

    if(empresaMes){
faturamentoMesTotal =
  Number(empresaMes?.faturamento_mes || 0)
    }

  }else{

faturamentoMesTotal =
  dataMes.empresas.reduce(
    (acc, e) => acc + Number(e.faturamento_mes || 0),
    0
  )

  }

}catch(e){
  console.log("⚠️ erro ao buscar mês, fallback ativo")
}










  

// 🔥 cálculo correto da meta
let metaInfo = null

if(resumoDia.empresa){
  metaInfo = calcularMeta(resumoDia.empresa, faturamentoMesTotal)
}else{

  const SOMA_METAS = Object.values(METAS)
    .reduce((acc, m) => acc + (m.prata || 0), 0)

  metaInfo = {
    meta: SOMA_METAS,
    percentual: (faturamentoMesTotal / SOMA_METAS) * 100
  }
}

    

  contextos.push({
    role:"system",
    content: "RESUMO_CUPONS_DIA:\n" + JSON.stringify({
      data: resumoDia.data,
      empresa: resumoDia.empresa || "GERAL",


      
faturamento_dia: Number(resumoDia.faturamento || 0),
faturamento: faturamentoMesTotal,


      
      vendas: Number(resumoDia.vendas || 0),
      ticket_medio: Number(resumoDia.ticket_medio || 0),
      meta: metaInfo?.meta || 0,
      percentual_meta: metaInfo
  ? (faturamentoMesTotal / metaInfo.meta) * 100
  : 0
    })
  })

}





const pediuGrafico =
  texto.includes("grafico") ||
  texto.includes("gráfico") ||
  texto.includes("chart")

if(
  !pediuGrafico && (
    texto.includes("relatorio") ||
    texto.includes("relatório") ||
    texto.includes("vendas") ||
    texto.includes("faturamento") ||
    texto.includes("resumo") ||
    texto.includes("meta")
  )
){
  contextos.push({
    role: "system",
    content: `
O usuário está solicitando um RELATÓRIO.

Use obrigatoriamente os modelos definidos.
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
content: `
🚨 SISTEMA DE REGRAS (PRIORIDADE MÁXIMA):

${promptAgente}

REGRAS CRÍTICAS:

// ================= PRIORIDADE =================

- Se o texto contiver palavras como:
  gráfico, grafico, chart, visualizar

→ responder SOMENTE com GRAFICO_JSON
→ nunca responder texto
→ nunca gerar relatório junto


- Caso contrário:

  - Se houver dados de vendas no contexto:
    → gerar relatório completo


    
  → NUNCA responder texto simples
  → SEMPRE usar formato estruturado

- Se o usuário perguntar qualquer coisa sobre:
  vendas, faturamento, valores, resumo, metas
  → responder como relatório

- Nunca inventar dados
- Usar apenas dados do contexto

- Se não houver dados:
  → responder: "⚠️ Sem dados disponíveis para o período"







// ================= GRÁFICOS =================

- Se o usuário pedir gráfico, chart, visualizar dados:

→ Responder com JSON no formato:

GRAFICO_JSON:
{
  "tipo": "bar",
  "titulo": "titulo do gráfico",
  "labels": ["label1","label2"],
  "dados": [100,200]
}

REGRAS:
- labels = nomes das empresas ou categorias
- dados = valores correspondentes
- nunca inventar dados
- usar somente dados do contexto











  

`
},



...contextos,
...mensagens
]

})

let resposta = completion.choices[0].message.content
// 🔥 BLOQUEIO TOTAL DE INVENÇÃO

// ================= DETECTAR GRAFICO =================

const matchGrafico = resposta.match(/GRAFICO_JSON:\s*([\s\S]*)/)

if(matchGrafico){

  try{

    let jsonTexto = matchGrafico[1]
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim()

    const inicio = jsonTexto.indexOf("{")
    const fim = jsonTexto.lastIndexOf("}")

    if(inicio !== -1 && fim !== -1){
      jsonTexto = jsonTexto.substring(inicio, fim + 1)
    }

    const grafico = JSON.parse(jsonTexto)

    const chartConfig = {
      type: grafico.tipo || "bar",
      data: {
        labels: grafico.labels,
        datasets: [{
          label: grafico.titulo,
          data: grafico.dados
        }]
      }
    }

    const url = "https://quickchart.io/chart?c=" + encodeURIComponent(JSON.stringify(chartConfig))

    return res.json({
      resposta: grafico.titulo,
      grafico_url: url
    })

  }catch(e){
    console.log("❌ ERRO GRAFICO:", e)
  }
}








  
// ================= MEMÓRIA AUTOMÁTICA =================

const memoriaExtraida = {
  ultima_intencao: tipoConsulta,
  ultima_empresa: empresaFiltro,
  ultima_data: dataFiltro
}


const { data: ultima } = await supabase
.from("assistente_otto_chat")
.select("id")
.eq("telefone", numero)
.order("created_at",{ascending:false})
.limit(1)
.maybeSingle()

if(ultima){
  await supabase
  .from("assistente_otto_chat")
  .update({
    memoria_extraida: memoriaExtraida
  })
  .eq("id", ultima.id)
}



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

// 🔥 DETECTAR TAREFA
const matchTarefa = resposta.match(/TAREFA_JSON:\s*([\s\S]*)/)

if(matchTarefa && NIVEL === 0){

  try{

    let jsonTexto = matchTarefa[1]

    jsonTexto = jsonTexto
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim()

    const inicio = jsonTexto.indexOf("{")
    const fim = jsonTexto.lastIndexOf("}")

    if(inicio !== -1 && fim !== -1){
      jsonTexto = jsonTexto.substring(inicio, fim + 1)
    }

    acao = JSON.parse(jsonTexto)

    if(!resposta.includes("Confirme")){
      resposta += "\n\n⚠️ Confirme para agendar esta tarefa."
    }

  }catch(e){
    console.log("Erro parse tarefa:", matchTarefa[1])
  }
}



// 🔥 DETECTAR ALTERAÇÃO GENÉRICA
const matchAcao = resposta.match(/ALTERAR_REGISTRO_JSON:\s*([\s\S]*)/)

if(matchAcao && NIVEL === 0){

  try{

    let jsonTexto = matchAcao[1]

    jsonTexto = jsonTexto
      .replace(/```json/g,"")
      .replace(/```/g,"")
      .trim()

    const inicio = jsonTexto.indexOf("{")
    const fim = jsonTexto.lastIndexOf("}")

    if(inicio !== -1 && fim !== -1){
      jsonTexto = jsonTexto.substring(inicio, fim + 1)
    }

    acao = JSON.parse(jsonTexto)

    // 🔥 FORÇA CONFIRMAÇÃO
    if(!resposta.toLowerCase().includes("confirma")){
      resposta += "\n\n⚠️ Confirme para executar esta ação."
    }

  }catch(e){
    console.log("Erro parse ação:", matchAcao[1])
  }
}
/* ================= SALVAR RESPOSTA ================= */

await supabase
.from("assistente_otto_chat")
.insert({
  role: "assistant",
  mensagem: resposta,
  telefone: numero,
  usuario_id: usuarioDB.id,
  nome: NOME,
  empresa: EMPRESA,
  acao_json: acao,
  aguardando_confirmacao: acao ? true : false
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
  "DELÍCIA GOURMET": { prata: 545000, ouro: 650000 },
  "MERCATTO EMPORIO": { prata: 650000, ouro: 780000 },
  "MERCATTO RESTAURANTE": { prata: 850000, ouro: 1000000 },
  "PADARIA DELÍCIA": { prata: 720000, ouro: 850000 },
  "VILLA GOURMET": { prata: 746600, ouro: 900000 }
}

  const admins = Object.entries(USUARIOS)
    .filter(([_, u]) => u.nivel === 0)
    .map(([numero]) => numero)

let dataDia = null
let dataMes = null

try {

  const API_CUPONS = "https://democracy-thesaurus-forms-roland.trycloudflare.com"

  const hoje = new Date(
    new Date().toLocaleString("en-US",{ timeZone:"America/Bahia" })
  )

  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)

  const dataOntem = ontem.toISOString().slice(0,10)

  const [resDia, resMes] = await Promise.all([
    fetch(`${API_CUPONS}/resumo-dia?data=${dataOntem}`),
    fetch(`${API_CUPONS}/resumo-mes`)
  ])

  if(!resDia.ok || !resMes.ok){
    throw new Error("Erro ao buscar APIs")
  }

  dataDia = await resDia.json()
  dataMes = await resMes.json()

} catch(e) {

  console.error("❌ ERRO AO BUSCAR API:", e)

  dataDia = { empresas: [] }
  dataMes = { empresas: [] }

}
if(!dataDia || !dataDia.empresas || dataDia.empresas.length === 0){
  console.log("⚠️ SEM DADOS PARA RELATÓRIO")
  return
}

function formatar(v){
  return Number(v || 0).toLocaleString("pt-BR",{minimumFractionDigits:2})
}

  

const hoje = new Date(
  new Date().toLocaleString("en-US",{ timeZone:"America/Bahia" })
)

// 🔥 CORREÇÃO REAL
const ontem = new Date(hoje)
ontem.setDate(ontem.getDate() - 1)

const dataFormatada = ontem.toLocaleDateString("pt-BR")

// 🔥 JUNÇÃO DIA + MÊS (LOCAL EXATO)
for(const empresa of dataDia.empresas){

  const mes = (dataMes.empresas || [])
    .find(e => e.empresa === empresa.empresa)

  empresa.faturamento_mes = mes?.faturamento_mes || 0
  empresa.vendas_mes = mes?.vendas_mes || 0

}
  
let mensagem = `
*Bom dia, Sr. Leonardo*

📅 ${dataFormatada}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊  RELATÓRIO EXECUTIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`


  

for(const empresa of dataDia.empresas){

  // 🔥 CORREÇÃO DO TICKET (LOCAL EXATO)
  const ticketDia =
    Number(empresa.ticket_medio) > 0
      ? Number(empresa.ticket_medio)
      : (
          Number(empresa.vendas) > 0
            ? Number(empresa.faturamento) / Number(empresa.vendas)
            : 0
        )

  // 🔥 TOTAL REAL DO MÊS
  const faturamentoTotalMes = 
    Number(empresa.faturamento_mes || 0) + 
    Number(empresa.faturamento || 0)

// 🎯 METAS
const metaPrata = METAS[empresa.empresa]?.prata || 0
const metaOuro = METAS[empresa.empresa]?.ouro || 0

// 📊 PERCENTUAIS
const percentualPrata = metaPrata > 0
  ? ((faturamentoTotalMes / metaPrata) * 100).toFixed(2)
  : 0

const percentualOuro = metaOuro > 0
  ? ((faturamentoTotalMes / metaOuro) * 100).toFixed(2)
  : 0

let status = "Estável"

if((empresa.variacao_semana || 0) > 5){
  status = `📈 +${empresa.variacao_semana}%`
}
else if((empresa.variacao_semana || 0) < -5){
  status = `📉 ${empresa.variacao_semana}%`
}
mensagem += `
━━━━━━━━━━━━━━━━━━
🏢 *${empresa.empresa.toUpperCase()}*
━━━━━━━━━━━━━━━━━━

💰 Dia        : R$ ${formatar(empresa.faturamento)}
📅 Mês        : R$ ${formatar(faturamentoTotalMes)}
💳 Ticket     : R$ ${formatar(ticketDia)}
🎯 Meta Prata : R$ ${formatar(metaPrata)}
📊 Atingido   : ${percentualPrata}%

🥇 Meta Ouro  : R$ ${formatar(metaOuro)}
📊 Atingido   : ${percentualOuro}%

📊 Desempenho : ${status}

`
}


// ================= TOTAL MERCATTO =================

const empresas = dataDia.empresas || []

const emporio = empresas.find(e => e.empresa === "MERCATTO EMPORIO")
const restaurante = empresas.find(e => e.empresa === "MERCATTO RESTAURANTE")

if(emporio && restaurante){

  // 💰 DIA
  const faturamentoDia =
    Number(emporio.faturamento || 0) +
    Number(restaurante.faturamento || 0)

  // 📅 MÊS
  const faturamentoMes =
    Number(emporio.faturamento_mes || 0) +
    Number(restaurante.faturamento_mes || 0) +
    faturamentoDia

  // 🎯 METAS
  const metaPrata =
    (METAS["MERCATTO EMPORIO"]?.prata || 0) +
    (METAS["MERCATTO RESTAURANTE"]?.prata || 0)

  const metaOuro =
    (METAS["MERCATTO EMPORIO"]?.ouro || 0) +
    (METAS["MERCATTO RESTAURANTE"]?.ouro || 0)

  // 📊 % ATINGIDO
  const percPrata = metaPrata > 0
    ? ((faturamentoMes / metaPrata) * 100).toFixed(2)
    : 0

  const percOuro = metaOuro > 0
    ? ((faturamentoMes / metaOuro) * 100).toFixed(2)
    : 0

  // ================= META ESPERADA =================

  const hoje = new Date(
    new Date().toLocaleString("en-US",{ timeZone:"America/Bahia" })
  )

  const diaAtual = hoje.getDate()

  const ultimoDiaMes = new Date(
    hoje.getFullYear(),
    hoje.getMonth() + 1,
    0
  ).getDate()

  const proporcao = diaAtual / ultimoDiaMes

  const metaEsperada = metaPrata * proporcao

  const status =
    faturamentoMes >= metaEsperada
      ? "🟢 ACIMA DO ESPERADO"
      : "🔴 ABAIXO DO ESPERADO"

  // ================= BLOCO VISUAL =================

  mensagem += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 *TOTAL MERCATTO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 Dia        : R$ ${formatar(faturamentoDia)}
📅 Mês        : R$ ${formatar(faturamentoMes)}

🎯 Meta Prata : R$ ${formatar(metaPrata)}
📊 Atingido   : ${percPrata}%

🥇 Meta Ouro  : R$ ${formatar(metaOuro)}
📊 Atingido   : ${percOuro}%

📈 Esperado até hoje : R$ ${formatar(metaEsperada)}

📊 Status     : ${status}
`
}






  
mensagem += `
━━━━━━━━━━━━━━━━━━
*Relatório automático • Carneiro Holding*
`




  

  function gerarGraficoURL(empresas){

  const labels = empresas.map(e => e.empresa)
  const dados = empresas.map(e => Number(e.faturamento))

  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Faturamento por Empresa",
        data: dados,
        backgroundColor: [
          "#22c55e",
          "#3b82f6",
          "#f59e0b",
          "#ef4444",
          "#8b5cf6"
        ]
      }]
    },
    options: {
      plugins: {
        legend: { display: false }
      }
    }
  }

  return "https://quickchart.io/chart?c=" + encodeURIComponent(JSON.stringify(chartConfig))
}

const graficoURL = gerarGraficoURL(dataDia.empresas)

console.log("📊 GRAFICO:", graficoURL)

// 🔥 SALVA RELATÓRIO PARA ANÁLISE
await supabase
  .from("assistente_otto_chat")
  .insert({
    role: "assistant",
    mensagem: mensagem,
    tipo: "relatorio_admin",
    telefone: "sistema"
  })

const perguntaAnalise = `📊 Deseja que eu faça uma análise estratégica deste relatório?

✔ SIM → análise completa  
❌ NÃO → encerrar`

await supabase
  .from("assistente_otto_chat")
  .insert({
    role: "assistant",
    mensagem: perguntaAnalise,
    tipo: "pergunta_analise",
    telefone: "sistema"
  })







  
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
type: "image",
image: {
  link: graficoURL,
  caption: mensagem
}
    })
  }
)

    const result = await response.json()

    if(result.error){
      console.error("❌ ERRO WHATS:", result.error)
    }else{
      console.log("✅ ENVIADO:", numero)
      await fetch(
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
      text: {
        body: `📊 Deseja que eu faça uma análise estratégica deste relatório?\n\n✔ SIM → análise completa\n❌ NÃO → encerrar`
      }
    })
  }
)

      
    }
  }

  console.log("✅ RELATÓRIO FINALIZADO")
}
