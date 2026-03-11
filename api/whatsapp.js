const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function handler(req,res){

/* ================================
VERIFICAÇÃO WEBHOOK
================================ */

if(req.method==="GET"){

const verify_token = process.env.VERIFY_TOKEN
const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode && token===verify_token){
return res.status(200).send(challenge)
}

return res.status(403).end()

}

/* ================================
RECEBER MENSAGEM
================================ */

if(req.method==="POST"){

const body=req.body

try{

const change = body.entry?.[0]?.changes?.[0]?.value

if(!change || !change.messages){
return res.status(200).end()
}

const mensagem = change.messages[0].text?.body || ""
const cliente = change.messages[0].from

console.log("Cliente:",cliente)
console.log("Mensagem:",mensagem)

/* ================================
SALVAR CONVERSA
================================ */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:mensagem,
role:"user"
})

/* ================================
BUSCAR HISTÓRICO
================================ */

const {data:historico} = await supabase
.from("conversas_whatsapp")
.select("*")
.eq("telefone",cliente)
.order("created_at",{ascending:true})
.limit(15)

const mensagens = historico.map(m=>({

role:m.role,
content:m.mensagem

}))

/* ================================
IA
================================ */

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{
role:"system",
content:`

Você é o assistente do restaurante Mercatto Delícia.

Seu trabalho é conversar naturalmente com clientes no WhatsApp.

Você pode:

• tirar dúvidas
• explicar o cardápio
• ajudar com reservas

Quando o cliente quiser reservar, você precisa descobrir:

nome
quantidade de pessoas
data
horário
área (externa ou salão)

IMPORTANTE:

Quando identificar dados de reserva, responda normalmente ao cliente
E no final da resposta inclua um bloco JSON assim:

RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":""
}

Se não tiver informação suficiente, deixe campos vazios.

`
},

...mensagens

]

})

let resposta = completion.choices[0].message.content

/* ================================
EXTRAIR JSON DA RESERVA
================================ */

let reserva=null

try{

const match = resposta.match(/RESERVA_JSON:\s*(\{[\s\S]*\})/)

if(match){

reserva = JSON.parse(match[1])

}

}catch(e){}

/* ================================
CRIAR RESERVA SE COMPLETA
================================ */

if(
reserva &&
reserva.nome &&
reserva.pessoas &&
reserva.data &&
reserva.hora &&
reserva.area
){

const mesa =
reserva.area.toLowerCase().includes("externa")
? "Área Externa"
: "Salão"

const datahora = reserva.data+"T"+reserva.hora

await supabase
.from("reservas_mercatto")
.insert({

nome:reserva.nome,
email:"",
telefone:cliente,
pessoas:Number(reserva.pessoas),
mesa:mesa,
cardapio:"",
comandaIndividual:"Não",
datahora:datahora,
observacoes:"Reserva via WhatsApp",
valorEstimado:0,
pagamentoAntecipado:0,
banco:"",
status:"Pendente"

})

resposta =
`✅ Reserva confirmada!

Nome: ${reserva.nome}

Pessoas: ${reserva.pessoas}

Data: ${reserva.data}

Hora: ${reserva.hora}

Local: ${mesa}

📍 Mercatto Delícia
Avenida Rui Barbosa 1264

Sua mesa estará reservada por 20 minutos após o horário.`

}

/* remover JSON da mensagem */

resposta = resposta.replace(/RESERVA_JSON:[\s\S]*/,"").trim()

/* ================================
SALVAR RESPOSTA
================================ */

await supabase
.from("conversas_whatsapp")
.insert({

telefone:cliente,
mensagem:resposta,
role:"assistant"

})

/* ================================
ENVIAR WHATSAPP
================================ */

const phone_number_id = change.metadata.phone_number_id

const url=`https://graph.facebook.com/v19.0/${phone_number_id}/messages`

await fetch(url,{

method:"POST",

headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},

body:JSON.stringify({

messaging_product:"whatsapp",
to:cliente,
type:"text",
text:{ body:resposta }

})

})

console.log("Resposta enviada:",resposta)

}catch(error){

console.error("ERRO:",error)

}

return res.status(200).end()

}

}
