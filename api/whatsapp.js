import fetch from "node-fetch"

/* ================= ENV ================= */

// 🔹 VERIFY separado
const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN

// 🔹 OTTO ISOLADO (NÃO USA OS ANTIGOS)
const OTTO_WHATSAPP_TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const OTTO_PHONE_NUMBER_ID = process.env.OTTO_PHONE_NUMBER_ID

const OTTO_ADMIN_TOKEN = process.env.OTTO_ADMIN_TOKEN
const OTTO_AGENT_URL = process.env.OTTO_AGENT_URL

/* ================= ADMINS ================= */

const OTTO_ADMINS = [
  "557798253249"
]

// 🔹 número fallback
const OTTO_NUMERO_RESTAURANTE = "5577999229807"

/* ================= HANDLER ================= */

export default async function handler(req, res){

/* ======================================================
   🔐 VERIFICAÇÃO META (GET)
====================================================== */

if(req.method === "GET"){
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    console.log("✅ OTTO WEBHOOK VALIDADO")
    return res.status(200).send(challenge)
  }

  console.log("❌ VERIFY TOKEN INVALIDO")
  return res.sendStatus(403)
}

/* ======================================================
   📥 EVENTO WHATSAPP (POST)
====================================================== */

if(req.method === "POST"){

  try{

    const body = req.body
    const change = body?.entry?.[0]?.changes?.[0]?.value

    if(!change) return res.sendStatus(200)

    /* ================= STATUS ================= */

    if(change.statuses){
      console.log("📩 OTTO STATUS:", change.statuses[0].status)
      return res.sendStatus(200)
    }

    /* ================= MENSAGEM ================= */

    const msg = change.messages?.[0]
    if(!msg) return res.sendStatus(200)

    const OTTO_NUMERO = msg.from
    const OTTO_TIPO = msg.type

    let OTTO_TEXTO = ""

    if(OTTO_TIPO === "text"){
      OTTO_TEXTO = msg.text.body
    } else if(OTTO_TIPO === "image"){
      OTTO_TEXTO = "[imagem enviada]"
    } else if(OTTO_TIPO === "audio"){
      OTTO_TEXTO = "[audio enviado]"
    } else {
      OTTO_TEXTO = "[mensagem não suportada]"
    }

    console.log("🤖 OTTO RECEBEU:", OTTO_TEXTO)
    console.log("📱 DE:", OTTO_NUMERO)

    /* ======================================================
       🔐 BLOQUEIO NÃO ADMIN
    ====================================================== */

    const OTTO_EH_ADMIN = OTTO_ADMINS.includes(OTTO_NUMERO)

    if(!OTTO_EH_ADMIN){

      console.log("⛔ BLOQUEADO:", OTTO_NUMERO)

      await fetch(`https://graph.facebook.com/v19.0/${OTTO_PHONE_NUMBER_ID}/messages`,{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${OTTO_WHATSAPP_TOKEN}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          messaging_product:"whatsapp",
          to: OTTO_NUMERO,
          text:{
            body:
`Olá! 👋

Para atendimento, fale com o Mercatto Delícia:

📞 (77) 99922-9807

Obrigado!`
          }
        })
      })

      return res.sendStatus(200)
    }

    /* ======================================================
       🧠 CHAMAR AGENTE
    ====================================================== */

    console.log("🧠 CHAMANDO AGENTE...")

    const respostaAPI = await fetch(OTTO_AGENT_URL,{
      method:"POST",
      headers:{
        "Authorization":"Bearer "+OTTO_ADMIN_TOKEN,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        pergunta: OTTO_TEXTO
      })
    })

    const json = await respostaAPI.json()

    let OTTO_RESPOSTA = json?.resposta || "Ok"

    console.log("🧠 RESPOSTA:", OTTO_RESPOSTA)

    /* ======================================================
       📤 ENVIAR RESPOSTA
    ====================================================== */

    await fetch(`https://graph.facebook.com/v19.0/${OTTO_PHONE_NUMBER_ID}/messages`,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${OTTO_WHATSAPP_TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        messaging_product:"whatsapp",
        to: OTTO_NUMERO,
        text:{
          body: OTTO_RESPOSTA
        }
      })
    })

    console.log("📤 ENVIADO")

    return res.sendStatus(200)

  }catch(e){

    console.error("❌ ERRO OTTO:", e)
    return res.sendStatus(500)

  }

}

return res.sendStatus(405)

}
