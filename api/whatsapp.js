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

/* ================= WEBHOOK VERIFY ================= */

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

/* ================= RECEBER MENSAGEM ================= */

if(req.method==="POST"){

const body=req.body

console.log("Webhook recebido:",JSON.stringify(body,null,2))

try{

const change = body.entry?.[0]?.changes?.[0]?.value

if(!change){
console.log("Evento inválido")
return res.status(200).end()
}

/* IGNORA EVENTOS DE STATUS */

if(!change.messages){
console.log("Evento sem mensagem (status)")
return res.status(200).end()
}

const msg = change.messages[0]

const mensagem = msg.text?.body
const cliente = msg.from
const message_id = msg.id

if(!mensagem){
console.log("Mensagem vazia")
return res.status(200).end()
}

console.log("Cliente:",cliente)
console.log("Mensagem:",mensagem)

/* ================= BLOQUEAR DUPLICIDADE ================= */

const { data: jaProcessada } = await supabase
.from("mensagens_processadas")
.select("*")
.eq("message_id", message_id)
.single()

if(jaProcessada){
console.log("Mensagem duplicada ignorada")
return res.status(200).end()
}

await supabase
.from("mensagens_processadas")
.insert({ message_id })

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
.limit(15)

const mensagens = historico.map(m=>({
role:m.role,
content:m.mensagem
}))

let resposta=""

/* ================= OPENAI ================= */

try{

const agora = new Date()

const dataAtual = agora.toLocaleDateString("pt-BR")
const horaAtual = agora.toLocaleTimeString("pt-BR")
const dataISO = agora.toISOString().split("T")[0]

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{
{
role:"system",
content:`

DATA ATUAL DO SISTEMA

Hoje é: ${dataAtual}
Hora atual: ${horaAtual}
Data ISO: ${dataISO}
Fuso horário: Brasil (UTC-3)

---------------------------------------

Você é o assistente oficial do restaurante Mercatto Delícia.

Seu trabalho é atender clientes e organizar reservas de mesa.

Converse de forma natural, educada e objetiva.

Nunca repita respostas idênticas.
Nunca ignore uma correção do cliente.

---------------------------------------

SISTEMA DE RESERVAS

Uma reserva possui estes campos, pode mandar a lista dos campos:

nome
pessoas
data
hora
area (interna ou externa)

---------------------------------------

COLETA DE DADOS

Se o cliente pedir reserva, colete os dados que faltam.

Se faltar algum campo, pergunte apenas o que falta.

---------------------------------------

PRÉ-CONFIRMAÇÃO

Quando tiver todos os dados, mostre o resumo:

Nome:
Pessoas:
Data:
Hora:
Área:

Pergunte:

"Está correto ou deseja alterar algo?"

---------------------------------------

EDIÇÃO DE RESERVA

Se o cliente pedir alteração, atualize o dado solicitado.

Exemplos de alteração:

"mudar a data"
"trocar horário"
"corrigir nome"
"alterar quantidade"
"mudar área"

Quando ocorrer alteração:

1) atualize o campo
2) mostre o novo resumo
3) pergunte novamente se está correto

---------------------------------------

CONFIRMAÇÃO FINAL

Somente quando o cliente disser:

CONFIRMAR
ou
PODE CONFIRMAR

gere o JSON final no formato:

RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":""
}

---------------------------------------

REGRAS IMPORTANTES

Nunca gere RESERVA_JSON antes da confirmação.

Sempre permita editar os dados antes de confirmar.

---------------------------------------

FORMATO DE DATA

Converta datas para:

YYYY-MM-DD

Exemplo:

16/03 → 2026-03-16

---------------------------------------

ÁREA

"interna", "salão", "dentro"
→ interna

"externa", "fora"
→ externa
`
},

...mensagens

]

})

resposta = completion.choices[0].message.content

console.log("Resposta IA:",resposta)

}catch(e){

console.log("ERRO OPENAI",e)

resposta=
`👋 Bem-vindo ao Mercatto Delícia

Digite:

1️⃣ Cardápio
2️⃣ Reservas
3️⃣ Endereço`

}

/* ================= DETECTAR JSON ================= */

try{

const match = resposta.match(/RESERVA_JSON:\s*({[\s\S]*?})/)

if(match){

const reserva = JSON.parse(match[1])

console.log("Reserva detectada:",reserva)

/* NORMALIZAR DATA */

let dataISO = reserva.data

if(reserva.data.includes("/")){

const [dia,mes] = reserva.data.split("/")
const ano = new Date().toISOString().slice(0,4)
dataISO = `${ano}-${mes}-${dia}`

}

/* NORMALIZAR AREA */

let mesa="Salão"

const areaTexto=reserva.area.toLowerCase()

if(
areaTexto.includes("extern") ||
areaTexto.includes("fora")
){
mesa="Área Externa"
}

/* DATAHORA */

const datahora = dataISO+"T"+reserva.hora

/* SALVAR RESERVA */

const {error} = await supabase
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

if(!error){

resposta=
`✅ *Reserva confirmada!*

Nome: ${reserva.nome}
Pessoas: ${reserva.pessoas}
Data: ${dataISO}
Hora: ${reserva.hora}
Área: ${mesa}

📍 Mercatto Delícia
Avenida Rui Barbosa 1264

Sua mesa estará reservada.
Aguardamos você!`

}

}

}catch(e){

console.log("Erro ao processar reserva:",e)

}

/* ================= SALVAR RESPOSTA ================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:resposta,
role:"assistant"
})

/* ================= ENVIAR WHATSAPP ================= */

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

}catch(error){

console.log("ERRO GERAL:",error)

}

return res.status(200).end()

}

}
