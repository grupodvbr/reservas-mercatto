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

/* =================================
VERIFICAR WEBHOOK
================================= */

if(req.method==="GET"){

const verify_token = process.env.VERIFY_TOKEN

const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode && token===verify_token){

console.log("Webhook verificado")

return res.status(200).send(challenge)

}

return res.status(403).end()

}

/* =================================
RECEBER MENSAGEM
================================= */

if(req.method==="POST"){

const body=req.body

console.log("Webhook recebido:",JSON.stringify(body,null,2))

try{

const change = body.entry?.[0]?.changes?.[0]?.value

if(!change){
return res.status(200).end()
}

/* IGNORAR STATUS */

if(!change.messages){

console.log("Evento sem mensagem")

return res.status(200).end()

}

const mensagem = change.messages?.[0]?.text?.body
const cliente = change.messages?.[0]?.from

if(!mensagem){
return res.status(200).end()
}

console.log("Cliente:",cliente)
console.log("Mensagem:",mensagem)

/* =================================
SALVAR CONVERSA
================================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:mensagem,
role:"user"
})

/* =================================
BUSCAR ESTADO DA RESERVA
================================= */

let {data:estado} = await supabase
.from("estado_reserva")
.select("*")
.eq("telefone",cliente)
.single()

if(!estado){

await supabase
.from("estado_reserva")
.insert({
telefone:cliente
})

const r = await supabase
.from("estado_reserva")
.select("*")
.eq("telefone",cliente)
.single()

estado=r.data

}

/* =================================
LOGICA DE RESERVA
================================= */

const texto = mensagem.toLowerCase()

let resposta=""

/* CLIENTE QUER RESERVAR */

if(
texto.includes("reserva") ||
texto==="2"
){

if(!estado.nome){

resposta="Perfeito! Para iniciar sua reserva me diga seu *nome*."

}

else if(!estado.pessoas){

resposta="Para quantas pessoas será a reserva?"

}

else if(!estado.data){

resposta="Qual a *data da reserva*?"

}

else if(!estado.hora){

resposta="Qual o *horário desejado*?"

}

else if(!estado.area){

resposta="Prefere *Área Externa* ou *Salão*?"

}

}

/* =================================
CAPTURAR DADOS
================================= */

if(!estado.nome){

await supabase
.from("estado_reserva")
.update({nome:mensagem})
.eq("telefone",cliente)

resposta="Para quantas pessoas será a reserva?"

}

else if(!estado.pessoas){

const pessoas=parseInt(mensagem)

if(!isNaN(pessoas)){

await supabase
.from("estado_reserva")
.update({pessoas:pessoas})
.eq("telefone",cliente)

resposta="Qual a data da reserva?"

}

}

else if(!estado.data){

await supabase
.from("estado_reserva")
.update({data:mensagem})
.eq("telefone",cliente)

resposta="Qual horário?"

}

else if(!estado.hora){

await supabase
.from("estado_reserva")
.update({hora:mensagem})
.eq("telefone",cliente)

resposta="Prefere Área Externa ou Salão?"

}

else if(!estado.area){

await supabase
.from("estado_reserva")
.update({area:mensagem})
.eq("telefone",cliente)

/* =================================
CRIAR RESERVA
================================= */

const datahora = estado.data+"T"+estado.hora

await supabase
.from("reservas_mercatto")
.insert({

nome:estado.nome,
telefone:cliente,
pessoas:estado.pessoas,
mesa:estado.area,
datahora:datahora,

email:"",
cardapio:"",
comandaIndividual:"Não",

observacoes:"Reserva via WhatsApp",

valorEstimado:0,
pagamentoAntecipado:0,
banco:"",
status:"Pendente"

})

/* LIMPAR ESTADO */

await supabase
.from("estado_reserva")
delete()
.eq("telefone",cliente)

resposta=
`✅ *Reserva registrada!*

Nome: ${estado.nome}

Pessoas: ${estado.pessoas}

Data: ${estado.data}

Hora: ${estado.hora}

Local: ${estado.area}

Aguardamos você no Mercatto Delícia!`

}

/* =================================
OPENAI
================================= */

if(!resposta){

try{

const {data:historico}=await supabase
.from("conversas_whatsapp")
.select("*")
.eq("telefone",cliente)
.order("created_at",{ascending:true})
.limit(10)

const mensagens = historico.map(m=>({

role:m.role,
content:m.mensagem

}))

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{
role:"system",
content:`Você é o assistente do restaurante Mercatto Delícia.

Ajude clientes com reservas, cardápio e dúvidas.

Endereço:
Avenida Rui Barbosa 1264

Telefone:
(77) 3613-5148`
},

...mensagens

]

})

resposta = completion.choices[0].message.content

}catch(e){

resposta=
`👋 Bem-vindo ao *Mercatto Delícia*

Escolha uma opção:

1️⃣ Ver cardápio  
2️⃣ Fazer reserva  
3️⃣ Endereço`

}

}

/* =================================
SALVAR RESPOSTA
================================= */

await supabase
.from("conversas_whatsapp")
.insert({

telefone:cliente,
mensagem:resposta,
role:"assistant"

})

/* =================================
ENVIAR WHATSAPP
================================= */

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

text:{
body:resposta
}

})

})

console.log("Resposta enviada:",resposta)

}

catch(error){

console.error("ERRO GERAL:",error)

}

return res.status(200).end()

}

}
