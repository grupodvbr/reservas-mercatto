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

/* ================= VERIFY ================= */

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

/* ================= POST ================= */

if(req.method==="POST"){

const body=req.body

try{

const change = body.entry?.[0]?.changes?.[0]?.value
if(!change) return res.status(200).end()

if(!change.messages) return res.status(200).end()

const msg = change.messages[0]

const mensagem = msg.text?.body
const cliente = msg.from
const message_id = msg.id

if(!mensagem) return res.status(200).end()

console.log("Cliente:",cliente)
console.log("Mensagem:",mensagem)

/* ================= DUPLICIDADE ================= */

const { data: jaProcessada } = await supabase
.from("mensagens_processadas")
.select("*")
.eq("message_id", message_id)
.single()

if(jaProcessada){
console.log("duplicada")
return res.status(200).end()
}

await supabase
.from("mensagens_processadas")
.insert({ message_id })

/* ================= CONFIRMAR RESERVA ================= */

if(mensagem.toLowerCase().includes("confirmar")){

const { data: pre } = await supabase
.from("pre_reservas")
.select("*")
.eq("telefone",cliente)
.single()

if(pre){

const r = pre.dados

let dataISO = r.data

if(r.data.includes("/")){
const [dia,mes] = r.data.split("/")
const ano = new Date().getFullYear()
dataISO = `${ano}-${mes}-${dia}`
}

let mesa="Salão"
if(r.area.toLowerCase().includes("extern")) mesa="Área Externa"

const datahora = dataISO+"T"+r.hora

await supabase
.from("reservas_mercatto")
.insert({

nome:r.nome,
email:"",
telefone:cliente,
pessoas:Number(r.pessoas),
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

await supabase
.from("pre_reservas")
.delete()
.eq("telefone",cliente)

const resposta=
`✅ Reserva confirmada!

Nome: ${r.nome}
Pessoas: ${r.pessoas}
Data: ${dataISO}
Hora: ${r.hora}
Área: ${mesa}

📍 Mercatto Delícia
Avenida Rui Barbosa 1264`

return await enviarWhatsapp(change,resposta)
}

}

/* ================= SALVAR MENSAGEM ================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:mensagem,
role:"user"
})

/* ================= HISTÓRICO ================= */

const {data:historico} = await supabase
.from("conversas_whatsapp")
.select("*")
.eq("telefone",cliente)
.order("created_at",{ascending:true})
.limit(20)

const mensagens = historico.map(m=>({
role:m.role,
content:m.mensagem
}))

/* ================= OPENAI ================= */

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{
role:"system",
content:`

Você é o assistente oficial do restaurante Mercatto Delícia.

Converse naturalmente.

Para reservas colete:

nome
pessoas
data
hora
area

Quando tiver todos os dados gere:

PRE_RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":""
}

Nunca gere RESERVA_JSON ainda.
`

},

...mensagens

]

})

let resposta = completion.choices[0].message.content

console.log(resposta)

/* ================= PRE RESERVA ================= */

const match = resposta.match(/PRE_RESERVA_JSON:\s*({[\s\S]*?})/)

if(match){

const reserva = JSON.parse(match[1])

await supabase
.from("pre_reservas")
.upsert({
telefone:cliente,
dados:reserva
})

resposta=
`Só para confirmar sua reserva:

Nome: ${reserva.nome}
Pessoas: ${reserva.pessoas}
Data: ${reserva.data}
Hora: ${reserva.hora}
Área: ${reserva.area}

Digite *CONFIRMAR* para finalizar ou envie a correção.`

}

/* ================= SALVAR RESPOSTA ================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:resposta,
role:"assistant"
})

await enviarWhatsapp(change,resposta)

}catch(e){

console.log("erro",e)

}

return res.status(200).end()

}

}

/* ================= FUNÇÃO ENVIO ================= */

async function enviarWhatsapp(change,resposta){

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
to:change.messages[0].from,
type:"text",
text:{body:resposta}

})

})

}
