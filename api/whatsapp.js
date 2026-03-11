const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)
/* =========================
   CONVERTER DATA BR
========================= */

function formatarDataBR(data){

  if(data.includes("/")){

    const partes = data.split("/")

    const dia = partes[0].padStart(2,"0")
    const mes = partes[1].padStart(2,"0")

    const ano = new Date().getFullYear()

    return `${ano}-${mes}-${dia}`

  }

  return data

}
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

      if (!change || !change.messages) {
        return res.status(200).end()
      }

      const mensagem = change.messages?.[0]?.text?.body || ""
      const cliente = change.messages?.[0]?.from

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
      .limit(15)

      const mensagens = historico.map(m => ({
        role: m.role,
        content: m.mensagem
      }))

      let resposta = ""

      /* =========================
         OPENAI
      ========================= */

      const completion = await openai.chat.completions.create({

        model:"gpt-5-nano",

        messages:[

          {
            role:"system",
            content:`
Você é o assistente oficial do restaurante Mercatto Delícia.

Converse naturalmente com clientes.

Ajude com:

• reservas
• cardápio
• horários
• aniversários

Informações do restaurante:

Rodízio italiano
Rodízio oriental

Endereço:
Avenida Rui Barbosa 1264

Telefone:
(77) 3613-5148

Instagram:
@mercattodelicia_

Quando o cliente quiser reservar, descubra:

nome
pessoas
data
hora
area

Quando tiver todas as informações, adicione no final da resposta:

RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":""
}

Se faltar dados deixe vazio.

Responda normalmente ao cliente.
`
          },

          ...mensagens

        ]

      })

      resposta = completion.choices[0].message.content

      console.log("Resposta IA:", resposta)

      /* =========================
         EXTRAIR JSON
      ========================= */

      let reserva = null

      try{

        const match = resposta.match(/RESERVA_JSON:\s*(\{[\s\S]*\})/)

        if(match){
          reserva = JSON.parse(match[1])
        }

      }catch(e){}

      /* =========================
         REGISTRAR RESERVA
      ========================= */

      if(
        reserva &&
        reserva.nome &&
        reserva.pessoas &&
        reserva.data &&
        reserva.hora &&
        reserva.area
      ){

        try{

const dataConvertida = formatarDataBR(reserva.data)
console.log("CHAMANDO API RESERVA", reserva)

const api = await fetch(
  process.env.RESERVA_API_URL,
  {
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      nome:reserva.nome,
      telefone:cliente,
      pessoas:reserva.pessoas,
      data:dataConvertida,
      hora:reserva.hora,
      area:reserva.area
    })
  }
)

          const resultado = await api.json()

          if(resultado.success){

            resposta =
`✅ Reserva confirmada!

Nome: ${reserva.nome}
Pessoas: ${reserva.pessoas}
Data: ${reserva.data}
Hora: ${reserva.hora}
Local: ${reserva.area}

Mercatto Delícia
Avenida Rui Barbosa 1264

Sua mesa será mantida por 20 minutos após o horário.`

          }else{

            resposta =
`Não conseguimos registrar sua reserva agora.

Faça sua reserva aqui:

https://reservas-mercatto.vercel.app`

          }

        }catch(e){

          resposta =
`Não conseguimos registrar sua reserva agora.

Faça sua reserva aqui:

https://reservas-mercatto.vercel.app`

        }

      }

      /* =========================
         REMOVER JSON
      ========================= */

      resposta = resposta.replace(/RESERVA_JSON:[\s\S]*/,"").trim()

      /* =========================
         SALVAR RESPOSTA
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

        method:"POST",

        headers:{
          Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type":"application/json"
        },

        body:JSON.stringify({

          messaging_product:"whatsapp",
          to:cliente,
          type:"text",
          text:{
            body:resposta
          }

        })

      })

      const data = await response.json()

      console.log("META RESPONSE:", data)

    }

    catch(error){

      console.error("ERRO GERAL:", error)

    }

    return res.status(200).end()

  }

}
