const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function handler(req, res) {

  /* =========================
     VERIFICAÇÃO DO WEBHOOK
  ========================= */

  if (req.method === "GET") {

    const verify_token = process.env.VERIFY_TOKEN
    const mode = req.query["hub.mode"]
    const token = req.query["hub.verify_token"]
    const challenge = req.query["hub.challenge"]

    if (mode && token === verify_token) {
      console.log("Webhook verificado")
      return res.status(200).send(challenge)
    }

    return res.status(403).end()
  }

  /* =========================
     RECEBER MENSAGEM
  ========================= */

  if (req.method === "POST") {

    const body = req.body

    console.log("Webhook recebido:", JSON.stringify(body,null,2))

    try {

      const change = body.entry?.[0]?.changes?.[0]?.value

      if (!change) {
        console.log("Evento inválido")
        return res.status(200).end()
      }

      /* =========================
         IGNORAR STATUS
      ========================= */

      if (!change.messages) {
        console.log("Evento recebido sem mensagem (status)")
        return res.status(200).end()
      }

      const mensagem = change.messages?.[0]?.text?.body
      const cliente = change.messages?.[0]?.from

      if (!mensagem) {
        console.log("Mensagem vazia")
        return res.status(200).end()
      }

      console.log("Cliente:", cliente)
      console.log("Mensagem:", mensagem)

      /* =========================
         SALVAR MENSAGEM CLIENTE
      ========================= */

      await supabase
      .from("conversas_whatsapp")
      .insert({
        telefone: cliente,
        mensagem: mensagem,
        role: "user"
      })

      /* =========================
         BUSCAR HISTÓRICO
      ========================= */

      const { data: historico } = await supabase
      .from("conversas_whatsapp")
      .select("*")
      .eq("telefone", cliente)
      .order("created_at", { ascending: true })
      .limit(10)

      const mensagens = historico.map(m => ({
        role: m.role,
        content: m.mensagem
      }))

      let resposta = ""

      /* =========================
         OPENAI COM MEMÓRIA
      ========================= */

      try {

        const completion = await openai.chat.completions.create({

          model: "gpt-5-nano",

          messages: [

            {
              role: "system",
              content: `
Você é o assistente oficial do restaurante Mercatto Delícia.

Ajude clientes com:

• reservas
• cardápio
• horários
• aniversários

Informações:

Rodízio italiano
Rodízio oriental

Endereço:
Avenida Rui Barbosa 1264

Telefone:
(77) 3613-5148

Instagram:
@mercattodelicia_

Responda curto, educado e natural.
`
            },

            ...mensagens

          ]

        })

        resposta = completion.choices[0].message.content

        console.log("Resposta OpenAI:", resposta)

      }

      catch(e){

        console.log("ERRO OPENAI:", e)
        console.log("OpenAI falhou, ativando menu automático")

        const texto = mensagem.toLowerCase().trim()

        if(texto === "1"){

          resposta =
`📖 *CARDÁPIO MERCATTO*

Acesse:

https://mercattodelicia.com/cardapio`

        }

        else if(texto === "2"){

          resposta =
`📅 *RESERVAS MERCATTO*

Reserve aqui:

https://reservas-mercatto.vercel.app/novo-agendamento.html`

        }

        else if(texto === "3"){

          resposta =
`📍 *ENDEREÇO*

Avenida Rui Barbosa 1264

Telefone:
(77) 3613-5148

Instagram:
@mercattodelicia_`

        }

        else{

          resposta =
`👋 *Bem-vindo ao Mercatto Delícia*

Escolha uma opção:

1️⃣ Ver cardápio  
2️⃣ Fazer reserva  
3️⃣ Endereço / contato  

Digite o número da opção.`

        }

      }

      /* =========================
         SALVAR RESPOSTA IA
      ========================= */

      await supabase
      .from("conversas_whatsapp")
      .insert({
        telefone: cliente,
        mensagem: resposta,
        role: "assistant"
      })

      console.log("Resposta enviada:", resposta)

      /* =========================
         ENVIAR WHATSAPP
      ========================= */

      const phone_number_id = change.metadata.phone_number_id

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

    }

    catch (error) {

      console.error("ERRO GERAL:", error)

    }

    return res.status(200).end()
  }

}
