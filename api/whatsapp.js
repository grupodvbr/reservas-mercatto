const OpenAI = require("openai")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

module.exports = async function handler(req, res) {

  if (req.method === "GET") {

    const verify_token = process.env.VERIFY_TOKEN
    const mode = req.query["hub.mode"]
    const token = req.query["hub.verify_token"]
    const challenge = req.query["hub.challenge"]

    if (mode && token === verify_token) {
      return res.status(200).send(challenge)
    }

    return res.status(403).end()
  }

  if (req.method === "POST") {

    const body = req.body

    console.log("Webhook recebido:", JSON.stringify(body,null,2))

    try {

      const mensagem =
        body.entry[0].changes[0].value.messages[0].text.body

      const cliente =
        body.entry[0].changes[0].value.messages[0].from

      console.log("Cliente:", cliente)
      console.log("Mensagem:", mensagem)

      let resposta = ""

      try{

        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: `
Você é o assistente de reservas do restaurante Mercatto Delícia.

Ajude clientes com:

• reservas
• cardápio
• horários
• aniversários

Responda de forma curta e educada.
`
            },
            {
              role: "user",
              content: mensagem
            }
          ]
        })

        resposta = completion.choices[0].message.content

      }catch(e){

        console.log("OpenAI falhou, ativando menu automático")

        const texto = mensagem.toLowerCase()

        if(texto === "1"){

          resposta =
`📖 CARDÁPIO MERCATTO

Acesse nosso cardápio completo:

https://mercattodelicia.com/cardapio`

        }

        else if(texto === "2"){

          resposta =
`📅 RESERVAS MERCATTO

Faça sua reserva online:

https://reservas-mercatto.vercel.app/novo-agendamento.html`

        }

        else if(texto === "3"){

          resposta =
`📍 ENDEREÇO

Avenida Rui Barbosa 1264

Reservas:
(77) 3613-5148

Instagram:
@mercattodelicia_`

        }

        else{

          resposta =
`👋 Bem-vindo ao *Mercatto Delícia*

Escolha uma opção:

1️⃣ Ver cardápio  
2️⃣ Fazer reserva  
3️⃣ Endereço / contato  

Digite o número da opção.`

        }

      }

      console.log("Resposta enviada:", resposta)

      const phone_number_id =
        body.entry[0].changes[0].value.metadata.phone_number_id

      const url =
        `https://graph.facebook.com/v19.0/${phone_number_id}/messages`

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cliente,
          type: "text",
          text: {
            body: resposta
          }
        })
      })

      const data = await response.json()

      console.log("META RESPONSE:", data)

    } catch (error) {

      console.error("ERRO:", error)

    }

    return res.status(200).end()
  }

}
