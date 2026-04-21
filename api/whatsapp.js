const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))
const OpenAI = require("openai")

/* ================= ENV ================= */

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const OTTO_WHATSAPP_TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const OTTO_PHONE_NUMBER_ID = process.env.OTTO_PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/* ================= OPENAI ================= */

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
})

/* ================= CONFIG ================= */

const OTTO_ADMINS = [
  "557798253249"
]

// evita loop (se vier do próprio número)
const OTTO_IGNORAR_NUMERO = process.env.OTTO_PHONE_NUMBER_ID

/* ================= FUNÇÃO ENVIO ================= */

async function enviarWhatsApp(para, mensagem, tentativas = 0){
  try{

    await fetch(`https://graph.facebook.com/v19.0/${OTTO_PHONE_NUMBER_ID}/messages`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${OTTO_WHATSAPP_TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        messaging_product:"whatsapp",
        to: para,
        text:{ body: mensagem }
      })
    })

    console.log("📤 ENVIADO:", mensagem)

  }catch(e){

    console.error("❌ ERRO ENVIO:", e)

    // retry automático
    if(tentativas < 2){
      console.log("🔁 REENVIANDO...")
      await enviarWhatsApp(para, mensagem, tentativas + 1)
    }

  }
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

/* ======================================================
   🔐 VERIFICAÇÃO META
====================================================== */

if(req.method === "GET"){
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    console.log("✅ WEBHOOK VALIDADO")
    return res.status(200).send(challenge)
  }

  return res.status(403).end()
}

/* ======================================================
   📥 EVENTO
====================================================== */

if(req.method === "POST"){

  try{

    const body = req.body
    const change = body?.entry?.[0]?.changes?.[0]?.value

    if(!change) return res.status(200).end()

    /* ================= STATUS ================= */

    if(change.statuses){
      console.log("📩 STATUS:", change.statuses[0].status)
      return res.status(200).end()
    }

    /* ================= MSG ================= */

    const msg = change.messages?.[0]
    if(!msg) return res.status(200).end()

    const OTTO_NUMERO = msg.from
    const OTTO_TIPO = msg.type

    // 🔥 ANTI LOOP
    if(OTTO_NUMERO === OTTO_IGNORAR_NUMERO){
      console.log("♻️ IGNORADO (loop)")
      return res.status(200).end()
    }

    let OTTO_TEXTO = ""

    if(OTTO_TIPO === "text"){
      OTTO_TEXTO = msg.text.body
    } else if(OTTO_TIPO === "image"){
      OTTO_TEXTO = "Cliente enviou uma imagem"
    } else if(OTTO_TIPO === "audio"){
      OTTO_TEXTO = "Cliente enviou um áudio"
    } else {
      OTTO_TEXTO = "Mensagem não suportada"
    }

    console.log("🤖 RECEBEU:", OTTO_TEXTO)
    console.log("📱 DE:", OTTO_NUMERO)

    /* ======================================================
       🔐 BLOQUEIO NÃO ADMIN
    ====================================================== */

    const OTTO_EH_ADMIN = OTTO_ADMINS.includes(OTTO_NUMERO)

    if(!OTTO_EH_ADMIN){

      await enviarWhatsApp(
        OTTO_NUMERO,
`Olá! 👋

Para atendimento, fale com o Mercatto Delícia:

📞 (77) 99922-9807`
      )

      return res.status(200).end()
    }

    /* ======================================================
       🧠 AGENTE OTTO
    ====================================================== */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Você é OTTO, administrador do Mercatto Delícia.

Regras:
- Responda direto
- Não invente dados
- Seja profissional
`
        },
        {
          role: "user",
          content: OTTO_TEXTO
        }
      ]
    })

    const resposta = completion.choices[0].message.content

    console.log("🧠 RESPOSTA:", resposta)

    /* ======================================================
       📤 ENVIO
    ====================================================== */

    await enviarWhatsApp(OTTO_NUMERO, resposta)

    return res.status(200).end()

  }catch(e){

    console.error("❌ ERRO GERAL:", e)
    return res.status(500).end()

  }

}

return res.status(405).end()

}
