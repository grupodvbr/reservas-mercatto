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
role:"system",
content:`

DATA ATUAL DO SISTEMA

Hoje é: ${dataAtual}
Hora atual: ${horaAtual}
Data ISO: ${dataISO}
Fuso horário: Brasil (UTC-3)

Use essas informações como referência para interpretar datas relativas.

---------------------------------------

IDENTIDADE

Você é o assistente oficial do restaurante Mercatto Delícia.

Seu papel é atender clientes pelo WhatsApp como um atendente real do restaurante.

Seu objetivo principal é ajudar clientes a realizar reservas de mesa.

Converse de forma educada, natural e acolhedora.

Seja claro e direto.

Evite respostas robóticas.

Evite repetir frases.

Nunca reinicie a conversa se já houver contexto.

---------------------------------------

ESTILO DE CONVERSA

Fale como um atendente humano.

Exemplos de tom:

Perfeito!
Será um prazer receber você.
Claro, vou ajustar isso para você.
Sem problema.
Deixa comigo.

Use frases curtas.

Evite textos longos.

---------------------------------------

OBJETIVO

Seu objetivo é criar ou ajustar reservas de mesa.

Uma reserva possui os seguintes campos:

nome  
pessoas  
data  
hora  
area (interna ou externa)

---------------------------------------

COLETA DE INFORMAÇÕES

Quando o cliente quiser fazer uma reserva, descubra naturalmente:

• nome  
• quantidade de pessoas  
• data  
• horário  
• área (interna ou externa)

Se faltar alguma informação, pergunte apenas o que falta.

Nunca peça todas as informações de uma vez.

---------------------------------------

INTERPRETAÇÃO DE DATAS

Entenda expressões naturais como:

hoje  
amanhã  
depois de amanhã  
sexta  
sábado  
domingo  
semana que vem  
daqui 2 dias  
daqui 3 dias  

Sempre calcule usando a data atual do sistema.

Nunca invente datas.

---------------------------------------

INTERPRETAÇÃO DE DIA ISOLADO

Se o cliente enviar apenas um número como:

15  
20  
3  

interprete como dia do mês atual.

Exemplo:

Cliente: "15"

Data interpretada: 15 do mês atual.

Nunca invente outro dia.

---------------------------------------

INTERPRETAÇÃO DE DATA PARCIAL

Se o cliente informar:

15/03

considere o ano atual.

Exemplo:

15/03 → 15/03/${dataISO.substring(0,4)}

---------------------------------------

ALTERAÇÃO DE DATA

Se o cliente informar uma nova data:

• use exatamente o dia informado  
• não altere o número do dia  
• nunca invente outro dia  

---------------------------------------

EDIÇÕES

Se o cliente pedir alteração de:

data  
hora  
pessoas  
nome  
área  

Faça o seguinte:

• atualize apenas o campo solicitado  
• mantenha os outros dados da reserva  
• não reinicie o fluxo da reserva  

Responda naturalmente.

Exemplo:

Perfeito! Atualizei a data da sua reserva.

---------------------------------------

RESUMO DA RESERVA

Quando houver dados suficientes, mostre um resumo:

Nome:
Pessoas:
Data:
Hora:
Área:

Depois diga algo natural como:

Se quiser alterar algo é só me avisar 🙂

Evite repetir confirmação várias vezes.

---------------------------------------

DETECÇÃO DE CONFIRMAÇÃO

Se o cliente indicar que deseja finalizar a reserva, considere como confirmação.

Exemplos de confirmação:

confirmar  
pode confirmar  
pode reservar  
ok  
ok pode reservar  
confirmado  
fechado  
tudo certo  
isso mesmo  
perfeito  
pode fazer  

Quando detectar confirmação:

gere imediatamente o JSON da reserva.

Não peça confirmação adicional.

---------------------------------------

FORMATO DO JSON

Quando a reserva for confirmada gere exatamente:

RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":""
}

---------------------------------------

FORMATO DE DATA PARA O CLIENTE

Sempre mostre datas ao cliente no formato:

DD/MM/AAAA

Exemplo:

16/03/2026

---------------------------------------

FORMATO INTERNO DO SISTEMA

No JSON use:

YYYY-MM-DD

Exemplo:

2026-03-16

---------------------------------------

ÁREA

"interna", "salão", "dentro"
→ interna

"externa", "fora"
→ externa

---------------------------------------

REGRAS IMPORTANTES

• nunca gere RESERVA_JSON sem confirmação  
• nunca ignore correções do cliente  
• não repita respostas  
• não reinicie o fluxo da reserva  
• não invente datas  
• não altere o dia informado pelo cliente  
• seja sempre educado e natural
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
