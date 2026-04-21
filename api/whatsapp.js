import fetch from "node-fetch"
import OpenAI from "openai"

/* ================= ENV ================= */

const VERIFY_TOKEN = process.env.VERIFY_TOKEN
const OTTO_WHATSAPP_TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const OTTO_PHONE_NUMBER_ID = process.env.OTTO_PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/* ================= OPENAI ================= */

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
})

/* ================= ADMINS ================= */

const OTTO_ADMINS = [
  "557798253249"
]

const OTTO_NUMERO_RESTAURANTE = "5577999229807"

/* ================= HANDLER ================= */

export default async function handler(req, res){

/* ======================================================
   🔐 VERIFICAÇÃO META
====================================================== */

if(req.method === "GET"){
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    console.log("✅ WEBHOOK OK")
    return res.status(200).send(challenge)
  }

  return res.sendStatus(403)
}

/* ======================================================
   📥 EVENTO
====================================================== */

if(req.method === "POST"){

  try{

    const body = req.body
    const change = body?.entry?.[0]?.changes?.[0]?.value

    if(!change) return res.sendStatus(200)

    /* ================= STATUS ================= */

    if(change.statuses){
      console.log("📩 STATUS:", change.statuses[0].status)
      return res.sendStatus(200)
    }

    /* ================= MSG ================= */

    const msg = change.messages?.[0]
    if(!msg) return res.sendStatus(200)

    const OTTO_NUMERO = msg.from
    const OTTO_TIPO = msg.type

    let OTTO_TEXTO = ""

    if(OTTO_TIPO === "text"){
      OTTO_TEXTO = msg.text.body
    } else if(OTTO_TIPO === "image"){
      OTTO_TEXTO = "O cliente enviou uma imagem"
    } else if(OTTO_TIPO === "audio"){
      OTTO_TEXTO = "O cliente enviou um áudio"
    } else {
      OTTO_TEXTO = "Mensagem não suportada"
    }

    console.log("🤖 RECEBEU:", OTTO_TEXTO)

    /* ======================================================
       🔐 BLOQUEIO
    ====================================================== */

    const OTTO_EH_ADMIN = OTTO_ADMINS.includes(OTTO_NUMERO)

    if(!OTTO_EH_ADMIN){

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

📞 (77) 99922-9807`
          }
        })
      })

      return res.sendStatus(200)
    }

    /* ======================================================
       🧠 AGENTE OTTO (OPENAI DIRETO)
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
- Seja direto
- Não invente dados
- Fale como gestor
- Responda claro e profissional
`
        },
        {
          role: "user",
          content: OTTO_TEXTO
        }
      ]
    })

    let resposta = completion.choices[0].message.content

    console.log("🧠 RESPOSTA:", resposta)

    /* ======================================================
       📤 ENVIO WHATSAPP
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
          body: resposta
        }
      })
    })

    console.log("📤 ENVIADO")

    return res.sendStatus(200)

  }catch(e){

    console.error("❌ ERRO:", e)
    return res.sendStatus(500)

  }

}

return res.sendStatus(405)
