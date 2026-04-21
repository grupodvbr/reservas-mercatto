const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args))
const OpenAI = require("openai")

/* ================= ENV ================= */

const VERIFY_TOKEN = process.env.OTTO_VERIFY_TOKEN
const TOKEN = process.env.OTTO_WHATSAPP_TOKEN
const PHONE_ID = process.env.OTTO_PHONE_NUMBER_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

/* ================= VERIFY ================= */

if(req.method === "GET"){
  const mode = req.query["hub.mode"]
  const token = req.query["hub.verify_token"]
  const challenge = req.query["hub.challenge"]

  if(mode === "subscribe" && token === VERIFY_TOKEN){
    return res.status(200).send(challenge)
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

    const numero = msg.from

    let texto = ""

    if(msg.type === "text"){
      texto = msg.text.body
    } else {
      texto = "Cliente enviou outra mensagem"
    }

    console.log("📩 RECEBIDO:", texto)

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Responda de forma simples, clara e direta."
        },
        {
          role: "user",
          content: texto
        }
      ]
    })

    const resposta = completion.choices[0].message.content

    console.log("🧠 RESPOSTA:", resposta)

    /* ================= ENVIO ================= */

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,{
      method:"POST",
      headers:{
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: numero,
        text: { body: resposta }
      })
    })

    console.log("📤 ENVIADO")

    return res.status(200).end()

  }catch(e){
    console.error("❌ ERRO:", e)
    return res.status(500).end()
  }
}

/* ================= FALLBACK ================= */

return res.status(405).end()
}
