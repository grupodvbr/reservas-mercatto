const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))
const fs = require("fs")

const OpenAI = require("openai")
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/* ================= SUPABASE ================= */

const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/* ================= AGENTES ================= */

const adminAgente = require("./admin-agente")

function carregarAgente(nome){
  try{
    return require(`./${nome}-agente`)
  }catch(e){
    console.log(`⚠️ agente ${nome} não encontrado`)
    return null
  }
}
/* ================= ENV ================= */

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const PHONE_ID = process.env.OTTO_PHONE_NUMBER_ID
const ADMIN_TOKEN = process.env.ADMIN_TOKEN

const ADMIN_ALERTA = "557798253249"

/* ================= UTILS ================= */

function normalizar(numero){
  return (numero || "").replace(/\D/g, "")
}

/* ================= BUSCAR USUARIO ================= */

async function buscarUsuarioPorTelefone(numero){

  const { data, error } = await supabase
    .from("usuarios_do_sistema")
    .select("*")
    .eq("telefone", numero)
    .eq("ativo", true)
    .single()

  if(error){
    console.log("❌ ERRO BUSCAR USUARIO:", error)
    return null
  }

  return data
}

/* ================= ENVIO WHATSAPP ================= */

async function enviarMensagem(para, texto){
  try{

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: para,
          type: "text",
          text: { body: texto }
        })
      }
    )

    const data = await response.json()

    console.log("📤 ENVIO:", {
      para,
      sucesso: response.ok,
      respostaMeta: data
    })

  }catch(e){
    console.error("❌ ERRO ENVIO:", e)
  }
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

/* ================= VERIFY ================= */

if(req.method === "GET"){
  if(
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ){
    console.log("✅ WEBHOOK VALIDADO")
    return res.status(200).send(req.query["hub.challenge"])
  }

  return res.status(403).end()
}

/* ================= POST ================= */

if(req.method === "POST"){
  try{

    const change = req.body?.entry?.[0]?.changes?.[0]?.value
    if(!change) return res.status(200).end()

    // ignora status
    if(change.statuses){
      return res.status(200).end()
    }

    const msg = change.messages?.[0]
    if(!msg) return res.status(200).end()

    const numero = normalizar(msg.from).slice(-13)

    let texto = msg.text?.body || null

    /* ================= AUDIO ================= */

    if(msg.type === "audio"){

      console.log("🎤 AUDIO RECEBIDO")

      const mediaId = msg.audio.id

      const mediaRes = await fetch(
        `https://graph.facebook.com/v19.0/${mediaId}`,
        {
          headers: { Authorization: `Bearer ${TOKEN}` }
        }
      )

      const mediaJson = await mediaRes.json()

      const audioBuffer = await fetch(mediaJson.url, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }).then(r => r.arrayBuffer())

      const filePath = "/tmp/audio.ogg"
      fs.writeFileSync(filePath, Buffer.from(audioBuffer))

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "gpt-4o-mini-transcribe"
      })

      texto = transcription.text || "Não consegui entender o áudio"
    }

    if(!texto || texto.trim() === ""){
      texto = "Não consegui entender a mensagem"
    }

    console.log("📩 RECEBIDO:", texto)
    console.log("📱 NUMERO:", numero)

    /* ================= BUSCA USUARIO ================= */

    const usuario = await buscarUsuarioPorTelefone(numero)

    if(!usuario){

      console.log("⛔ USUÁRIO NÃO CADASTRADO")

      await enviarMensagem(
        ADMIN_ALERTA,
`🚨 USUÁRIO NÃO CADASTRADO

📱 ${numero}
💬 ${texto}`
      )

      return res.status(200).end()
    }


    
    const nivel = usuario.nivel_acesso

    console.log("👤 USUARIO:", usuario.nome)
    console.log("🔑 NIVEL:", nivel)
   console.log("🤖 AGENTE:", usuario.agente || "admin")

let agenteSelecionado = null

// 🔥 NIVEL 0 SEMPRE ADMIN
if(usuario.nivel_acesso === 0){
  agenteSelecionado = adminAgente
}else{
  agenteSelecionado = carregarAgente(usuario.agente || "admin")
}


    
  if(!agenteSelecionado){
  console.log("⚠️ agente inválido, usando ADMIN como fallback")
  agenteSelecionado = adminAgente
}

    /* ================= PREPARA REQ ================= */

    let resposta = "Erro ao processar"

    const fakeReq = {
      method: "POST",
      query: {},
      headers: {
        authorization: "Bearer " + ADMIN_TOKEN
      },
      body: {
        pergunta: texto,
        numero: numero,
        usuario: usuario,
        nivel: nivel
      }
    }

    const fakeRes = {
      json: (data) => {
        resposta = data?.resposta || resposta
      },
      status: () => ({
        json: () => {}
      })
    }

    /* ================= EXECUTA AGENTE ================= */

    await agenteSelecionado(fakeReq, fakeRes)

    console.log("🧠 RESPOSTA:", resposta)

    /* ================= ENVIA RESPOSTA ================= */

    await enviarMensagem(numero, resposta)

    console.log("✅ RESPONDIDO")

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO GERAL:", e)
    return res.status(500).end()
  }
}

/* ================= FALLBACK ================= */

return res.status(405).end()
}
