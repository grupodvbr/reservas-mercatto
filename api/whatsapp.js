const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)


/* ================= RELATORIO AUTOMATICO ================= */

async function enviarRelatorioAutomatico(){

const ADMIN_NUMERO = "557798253249"

const hoje = new Date().toISOString().split("T")[0]

const {data:reservas} = await supabase
.from("reservas_mercatto")
.select("*")
.gte("datahora", hoje+"T00:00")
.lte("datahora", hoje+"T23:59")
.order("datahora",{ascending:true})

let resposta = "📊 *Relatório automático de reservas (Hoje)*\n\n"

if(!reservas || !reservas.length){

resposta += "Nenhuma reserva encontrada para hoje."

}else{

let totalPessoas = 0

reservas.forEach((r,i)=>{

const hora = r.datahora.split("T")[1].substring(0,5)

resposta += `${i+1}️⃣\n`
resposta += `Nome: ${r.nome}\n`
resposta += `Pessoas: ${r.pessoas}\n`
resposta += `Hora: ${hora}\n`
resposta += `Mesa: ${r.mesa}\n\n`

totalPessoas += Number(r.pessoas || 0)

})

resposta += `👥 Total de pessoas reservadas: ${totalPessoas}\n`
resposta += `📅 Total de reservas: ${reservas.length}`

}

return resposta

}

/* ================= AGENDA MUSICOS ================= */

async function buscarAgendaDoDia(dataISO){

const { data, error } = await supabase
.from("agenda_musicos")
.select("*")
.eq("data", dataISO)
.order("hora",{ascending:true})

if(error){
console.log("Erro agenda:",error)
return []
}

return data || []

}

function calcularCouvert(musicos){

if(!musicos.length) return 0

let maior = 0

musicos.forEach(m=>{
const valor = Number(m.valor) || 0
if(valor > maior) maior = valor
})

return maior

}

function pegarPoster(musicos){

const comFoto = musicos.find(m=>m.foto)

return comFoto ? comFoto.foto : null

}

/* ================= AGENDA PERIODO ================= */

async function buscarAgendaPeriodo(dataInicio,dataFim){

const { data, error } = await supabase
.from("agenda_musicos")
.select("*")
.gte("data",dataInicio)
.lte("data",dataFim)
.order("data",{ascending:true})
.order("hora",{ascending:true})

if(error){
console.log("Erro agenda período:",error)
return []
}

return data || []

}


module.exports = async function handler(req,res){
/* ================= CRON RELATORIO ================= */

if(req.query.cron === "relatorio"){

const phone_number_id = process.env.WHATSAPP_PHONE_ID

const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`

const resposta = await enviarRelatorioAutomatico()

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:"557798253249",
type:"text",
text:{body:resposta}
})
})

return res.status(200).send("Relatório enviado")

}
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
const ADMIN_NUMERO = "557798253249"
const message_id = msg.id
const phone_number_id = change.metadata.phone_number_id
const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`
if(!mensagem){
console.log("Mensagem vazia")
return res.status(200).end()
}

console.log("Cliente:",cliente)
console.log("Mensagem:",mensagem)


const texto = mensagem.toLowerCase()
if(
texto === "sim" ||
texto === "ok" ||
texto === "confirmar" ||
texto === "pode confirmar"
){
console.log("CONFIRMAÇÃO SIMPLES IGNORADA")
return res.status(200).end()
}
/* ================= RELATORIO ADMIN ================= */

if(cliente === ADMIN_NUMERO && texto.includes("relatorio_reservas_dia")){

const hoje = new Date().toISOString().split("T")[0]

const {data:reservas} = await supabase
.from("reservas_mercatto")
.select("*")
.gte("datahora", hoje+"T00:00")
.lte("datahora", hoje+"T23:59")
.order("datahora",{ascending:true})

let resposta = "📊 *Reservas do dia*\n\n"

if(!reservas || !reservas.length){
resposta += "Nenhuma reserva encontrada."
}else{

reservas.forEach((r,i)=>{

const hora = r.datahora?.split("T")[1]?.substring(0,5) || "—"
const data = r.datahora?.split("T")[0] || "—"

resposta += `${i+1}️⃣\n`
resposta += `Nome: ${r.nome || "-"}\n`
resposta += `Telefone: ${r.telefone || "-"}\n`
resposta += `Pessoas: ${r.pessoas || "-"}\n`
resposta += `Data: ${data}\n`
resposta += `Hora: ${hora}\n`
resposta += `Mesa: ${r.mesa || "-"}\n`
resposta += `Status: ${r.status || "-"}\n`
resposta += `Comanda individual: ${r.comandaIndividual || "-"}\n`
resposta += `Origem: ${r.origem || "-"}\n`
resposta += `Observações: ${r.observacoes || "-"}\n\n`

})

}

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
text:{body:resposta}
})
})

return res.status(200).end()

}
let assuntoMusica = false

if(
texto.includes("tocando") ||
texto.includes("quem toca") ||
texto.includes("quem canta") ||
texto.includes("banda") ||
texto.includes("show") ||
texto.includes("dj") ||
texto.includes("música")
){
assuntoMusica = true
}

  
/* ================= CONTROLE MUSICA ================= */

const { data: estadoMusica } = await supabase
.from("estado_conversa")
.select("*")
.eq("telefone",cliente)
.eq("tipo","musica")
.maybeSingle()

const jaFalouMusica = !!estadoMusica
console.log("JA ENVIOU PROGRAMAÇÃO:", jaFalouMusica)
let dataConsulta = new Date()

if(texto.includes("amanhã")){
dataConsulta.setDate(dataConsulta.getDate()+1)
}

if(texto.includes("ontem")){
dataConsulta.setDate(dataConsulta.getDate()-1)
}
let textoDia = "hoje"

if(texto.includes("ontem")){
textoDia = "ontem"
}

if(texto.includes("amanhã")){
textoDia = "amanhã"
}
const dataISO = dataConsulta.toISOString().split("T")[0]

const agendaDia = await buscarAgendaDoDia(dataISO)
const agora = new Date()

const horaAtual =
agora.getHours().toString().padStart(2,"0") +
":" +
agora.getMinutes().toString().padStart(2,"0")
const couvertHoje = calcularCouvert(agendaDia)

const posterHoje = pegarPoster(agendaDia)

/* ================= AGENDA PARA IA ================= */

const hoje = new Date()
const hojeISO = hoje.toISOString().split("T")[0]

const seteDias = new Date()
seteDias.setDate(hoje.getDate()+7)

const seteDiasISO = seteDias.toISOString().split("T")[0]

const agendaSemana = await buscarAgendaPeriodo(hojeISO,seteDiasISO)

let agendaTexto = ""

agendaSemana.forEach(m => {

agendaTexto += `
DATA: ${m.data}
ARTISTA: ${m.cantor}
HORARIO: ${m.hora}
ESTILO: ${m.estilo}
COUVERT: ${m.valor}
POSTER: ${m.foto || "sem"}
----------------------------------
`

})

let agendaHojeTexto = "SEM SHOW HOJE"

if(agendaDia.length){

agendaHojeTexto = ""

agendaDia.forEach(m => {

agendaHojeTexto += `
ARTISTA: ${m.cantor}
HORARIO: ${m.hora}
ESTILO: ${m.estilo}
COUVERT: ${m.valor}
`

})

}
/* ================= INTENÇÕES ================= */

const querReserva =
texto.includes("reserv") ||
texto.includes("mesa")

const querCardapio =
texto.includes("cardap") ||
texto.includes("menu")

const querVideo =
texto.includes("video") ||
texto.includes("vídeo")

const querFotos =
texto.includes("foto") ||
texto.includes("imagem")

const querEndereco =
texto.includes("onde fica") ||
texto.includes("endereço") ||
texto.includes("localização")

const querMusica =
texto.includes("musica") ||
texto.includes("música") ||
texto.includes("cantor") ||
texto.includes("cantora") ||
texto.includes("banda") ||
texto.includes("show") ||
texto.includes("ao vivo") ||
texto.includes("dj") ||
texto.includes("quem canta") ||
texto.includes("quem vai cantar") ||
texto.includes("quem vai tocar") ||
texto.includes("quem toca") ||
texto.includes("tocando") ||
texto.includes("quem está tocando") ||
texto.includes("quem ta tocando") ||
texto.includes("tem musica") ||
texto.includes("tem música") ||
texto.includes("tem banda") ||
texto.includes("tem show") ||
texto.includes("vai ter musica") ||
texto.includes("vai ter música") ||
texto.includes("programação") ||
texto.includes("programacao") ||
texto.includes("agenda") ||
texto.includes("quem canta hoje") ||
texto.includes("qual o couvert") ||
texto.includes("couvert")



  
console.log("DETECTOU MUSICA:", querMusica)
assuntoMusica = querMusica

if(querMusica){
console.log("FORÇANDO ASSUNTO MUSICA")
}
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

/* ================= SALVAR MENSAGEM CLIENTE ================= */

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:mensagem,
role:"user"
})

if(querEndereco){

const resposta = `📍 Estamos localizados em:

Mercatto Delícia
Avenida Rui Barbosa 1264
Barreiras - BA

Mapa:
https://maps.app.goo.gl/mQcEjj8s21ttRbrQ8`

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
text:{body:resposta}
})
})
await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:resposta,
role:"assistant"
})
return res.status(200).end()

}
  

/* ================= MUSICA AO VIVO ================= */

if(querMusica && !jaFalouMusica){

console.log("RESPONDENDO AUTOMATICO MUSICA")

let resposta=""

if(agendaDia.length){

if(textoDia==="ontem"){
resposta = `🎶 Ontem tivemos música ao vivo no Mercatto:\n\n`
}
else if(textoDia==="amanhã"){
resposta = `🎶 Música ao vivo amanhã no Mercatto:\n\n`
}
else{
resposta = `🎶 Música ao vivo hoje no Mercatto:\n\n`
}
agendaDia.forEach(m=>{

resposta += `🎤 ${m.cantor}\n`
resposta += `🕒 ${m.hora}\n`
resposta += `🎵 ${m.estilo}\n\n`

})

resposta += `💰 Couvert artístico: R$ ${couvertHoje.toFixed(2)}`
}else{

if(textoDia==="ontem"){
resposta = "Ontem não tivemos música ao vivo no Mercatto."
}
else if(textoDia==="amanhã"){
resposta = "Ainda não temos música ao vivo programada para amanhã."
}
else{
resposta = "Hoje não temos música ao vivo programada."
}
}

/* ENVIA POSTER */

if(posterHoje && posterHoje.startsWith("http")){
await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"image",
image:{
link:posterHoje,
caption:`🎶 Música ao vivo ${textoDia} no Mercatto`
}
})
})

}

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
text:{body:resposta}
})
})
await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:resposta,
role:"assistant"
})
await supabase
.from("estado_conversa")
.upsert({
telefone:cliente,
tipo:"musica"
})
return res.status(200).end()

}

if(querVideo){
  
await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"video",
video:{
link:"https://dxkszikemntfusfyrzos.supabase.co/storage/v1/object/public/MERCATTO/WhatsApp%20Video%202026-03-10%20at%2021.08.40.mp4",
caption:"Conheça o Mercatto Delícia"
}
})
})
await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:"[VIDEO DO RESTAURANTE ENVIADO]",
role:"assistant"
})
return res.status(200).end()

}
  

  
  
if(querCardapio){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body:JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"document",
document:{
link:"https://SEU_CARDAPIO.pdf",
filename:"Cardapio_Mercatto.pdf"
}
})
})

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
text:{body:"Aqui está nosso cardápio completo 😊"}
})
})
await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:"[CARDAPIO ENVIADO]",
role:"assistant"
})
return res.status(200).end()

} 


/* ================= HISTÓRICO ================= */

const {data:historico} = await supabase
.from("conversas_whatsapp")
.select("*")
.eq("telefone",cliente)
.order("created_at",{ascending:false})
.limit(20)

const mensagens = (historico || [])
.reverse()
.map(m=>({
role:m.role,
content:m.mensagem
}))
  
if(assuntoMusica){
mensagens.unshift({
role:"system",
content:"ATENÇÃO: A mensagem atual do cliente é sobre música ao vivo. Ignore reservas e responda usando a agenda fornecida."
})
}
let resposta=""

/* ================= OPENAI ================= */

try{

const agora = new Date()

const dataAtual = agora.toLocaleDateString("pt-BR")
const horaAtualSistema =
agora.getHours().toString().padStart(2,"0") +
":" +
agora.getMinutes().toString().padStart(2,"0")
const dataAtualISO = agora.toISOString().split("T")[0]
const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[
{
role:"system",
content: assuntoMusica 
? "A pergunta atual do cliente é sobre música ao vivo. Ignore reservas e responda apenas sobre a agenda de música."
: "A pergunta atual do cliente não é sobre música."
},

  
{
role:"system",
content:`

DATA ATUAL DO SISTEMA

Hoje é: ${dataAtual}
Hora atual: ${horaAtualSistema}
Data ISO: ${dataISO}
Fuso horário: Brasil (UTC-3)

Use essas informações como referência para interpretar datas relativas.

---------------------------------------

IDENTIDADE

Você é o assistente oficial do restaurante Mercatto Delícia.

Seu papel é atender clientes pelo WhatsApp como um atendente real do restaurante.

Seu objetivo principal é ajudar clientes.

Se a pergunta for sobre música ao vivo, responda sobre música.

Se a pergunta for sobre reservas, ajude a criar a reserva.

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
comandaIndividual (Sim ou Não)

---------------------------------------


HORÁRIO DE FUNCIONAMENTO

O restaurante funciona nos seguintes horários:

Segunda a quinta:
11:00 às 15:00  
Retorna às 17:00.

Sexta, sábado e domingo:
11:00 até o fechamento.

---------------------------------------

MÚSICA AO VIVO

O Mercatto Delícia possui música ao vivo em alguns dias.
ASSUNTO DA MENSAGEM

O cliente está perguntando sobre música ao vivo?

${assuntoMusica}

REGRA ABSOLUTA:

Se a variável acima for **true**, a pergunta é sobre música ao vivo.

NESTE CASO:

• Ignore completamente reservas
• Ignore salas VIP
• Ignore qualquer outro assunto
• Responda APENAS sobre música usando a agenda fornecida

Nunca peça dados de reserva quando o assunto for música.
---------------------------------------

AGENDA REAL DE MÚSICA AO VIVO

Use a agenda abaixo para responder perguntas sobre:

• quem canta sexta
• quem canta sábado
• agenda do final de semana
• programação musical
• próximo show
• quem está tocando agora

AGENDA DE HOJE

${agendaHojeTexto}

AGENDA DOS PRÓXIMOS DIAS

${agendaTexto}

REGRAS:

• Use sempre os dados da agenda acima
• Se houver mais de um cantor no dia, liste todos
• Informe cantor, horário, estilo e couvert
• O couvert artístico é o maior valor entre os músicos do dia mas não fala isso para o cliente
• Se não houver programação para o dia solicitado, informe que ainda não há agenda confirmada
Quando o cliente perguntar sobre:

• música
• música ao vivo
• cantor
• show
• quem canta hoje
• programação

Informe:

• cantor
• horário
• estilo musical
• valor do couvert artístico

O valor do couvert é o maior valor entre os músicos do dia mas não fala isso para o cliente

Se houver mais de um músico no dia, liste todos.

Sempre mencione que o valor é de couvert artístico.
REGRAS DE RESERVA

• As reservas só podem ser feitas até às 19:00.

• Nunca permita reservas após 19:00.

Se o cliente pedir horário após 19:00, informe educadamente:

"As reservas podem ser feitas apenas até às 19:00."

Peça para escolher outro horário antes das 19:00.

Nunca gere RESERVA_JSON para horários após 19:00.

---------------------------------------

CONTATOS DA GERÊNCIA

O restaurante possui gerentes responsáveis por diferentes setores.

Gerente Geral
Dheure França
WhatsApp: +55 77 9 8253-3249

Gerente de Eventos
Yure Teicheira
WhatsApp: +55 77 9 9988-0000

Gerente de Reservas
Cristiane
WhatsApp: +55 77 9 9900-0000

REGRAS IMPORTANTES

• Nunca envie os números dos gerentes automaticamente.
• Nunca ofereça o telefone de um gerente sem o cliente pedir.
• Só envie o contato se o cliente pedir explicitamente.

Exemplos de perguntas válidas:

falar com gerente  
telefone do gerente  
contato da gerência  
quero falar com responsável  
telefone do responsável  
quero falar com gerente  

Nesses casos, responda educadamente e envie o número correspondente.

Exemplo de resposta ideal:

"Claro! Você pode falar diretamente com nosso gerente.

Nalbert
📞 +55 77 9 8253-3249"

Se o assunto for evento ou sala VIP, priorize o gerente de eventos.

Se o cliente apenas reclamar ou pedir ajuda, direcione para o gerente geral.

Nunca invente contatos.
Use apenas os contatos fornecidos acima.
---------------------------------------

COMANDOS ADMINISTRATIVOS (USO INTERNO)

Existe um comando especial usado apenas pela gerência do restaurante.

Esse comando só pode ser utilizado se a mensagem vier do número autorizado.

NÚMERO AUTORIZADO:

557798253249

Se qualquer outro número tentar usar esse comando, ignore completamente.

---------------------------------------

COMANDO ADMIN

RELATORIO_RESERVAS_DIA

Quando esse comando for recebido do número autorizado, gere um relatório completo
de todas as reservas do dia atual.

O relatório deve conter:

• Nome
• Pessoas
• Data
• Hora
• Área / Mesa
• Status

Formato do relatório:

RELATORIO_RESERVAS:
1️⃣
Nome:
Pessoas:
Hora:
Mesa:

2️⃣
Nome:
Pessoas:
Hora:
Mesa:

---------------------------------------

EDIÇÃO DE RESERVAS PELO ADMIN

O número autorizado também pode alterar reservas diretamente.

Exemplos de comandos:

ALTERAR_RESERVA 1
ALTERAR_RESERVA 2

Quando receber esse comando, identifique o número da reserva e permita alteração.

Campos que podem ser alterados:

• nome
• pessoas
• hora
• mesa

Formato esperado:

ALTERAR_RESERVA_ADMIN_JSON:
{
"id":"",
"nome":"",
"pessoas":"",
"hora":"",
"mesa":""
}

Nunca permita que clientes normais usem esses comandos.

Esses comandos são exclusivos da gerência.
---------------------------------------

LOCALIZAÇÃO DO RESTAURANTE

Se o cliente perguntar qualquer coisa relacionada à localização do restaurante,
responda sempre com o endereço completo e o link do mapa.

Reconheça perguntas como:

onde fica  
onde é  
qual o endereço  
endereço  
localização  
manda a localização  
manda o endereço  
como chegar  
como faço para chegar  
onde está o restaurante  
qual a localização  
google maps  
maps  
me manda a localização  
onde vocês ficam  
onde fica o mercatto  

Sempre responda assim:

Estamos localizados em:

Mercatto Delícia  
Avenida Rui Barbosa 1264  
Barreiras - BA

📍 Localização no mapa:
https://maps.app.goo.gl/mQcEjj8s21ttRbrQ8

Sempre envie o endereço escrito e também o link da localização.

Nunca envie apenas o link.
Sempre inclua o endereço junto.

---------------------------------------

SALAS VIP DO RESTAURANTE

O Mercatto Delícia possui duas salas VIP privadas:

• Sala Paulo Augusto 1  
• Sala Paulo Augusto 2  

Essas são salas reservadas ideais para:

• aniversários
• reuniões
• comemorações
• encontros privados

IMPORTANTE:

Para os clientes sempre utilize os nomes:

Sala Paulo Augusto 1  
Sala Paulo Augusto 2  

Nunca use os nomes internos do sistema.

---------------------------------------

REGRA DE REGISTRO INTERNO

Quando gerar o JSON de reserva da sala VIP:

Sala Paulo Augusto 1 → salvar como "Sala VIP 1"  
Sala Paulo Augusto 2 → salvar como "Sala VIP 2"

---------------------------------------

Quando o cliente pedir reserva de sala VIP:

1️⃣ pergunte qual sala prefere  
2️⃣ confirme data e horário  
3️⃣ confirme quantidade de pessoas  

---------------------------------------
---------------------------------------

INFORMAÇÕES DETALHADAS DAS SALAS VIP

Oferecemos uma estrutura completa para tornar eventos inesquecíveis.

Estrutura disponível nas salas VIP:

🎤 Microfone  
📺 TV 86”  
🔊 Som ambiente  
❄️ Ar-condicionado  
🪑 Formatos de mesas conforme preferência  
🍽️ Mesa posta com:
faca, garfo, colher, guardanapos e sousplats

---------------------------------------

VALORES DAS SALAS VIP

Não cobramos aluguel do espaço.

Trabalhamos apenas com consumação mínima.

Valores:

Sala Paulo Augusto 1  
(consumação mínima)

R$ 5.000,00

Sala Paulo Augusto 2  
(consumação mínima)

R$ 3.700,00

---------------------------------------

TIPOS DE EVENTOS QUE ATENDEMOS

Podemos montar o evento conforme o perfil do cliente.

Exemplos:

☕ Coffee Break  
🥂 Happy Hour  
🍴 Almoço  
🍰 Café da tarde  
🌙 Jantar

---------------------------------------

IMPORTANTE

Quando o cliente perguntar sobre sala VIP:

explique:

• estrutura do espaço  
• consumação mínima  
• tipos de evento possíveis  

Depois ofereça mostrar fotos.

Exemplo de resposta ideal:

"Temos duas salas VIP privadas ideais para eventos.

Elas possuem TV 86”, som ambiente, microfone, ar-condicionado e montagem completa de mesa.

Não cobramos aluguel do espaço.
Trabalhamos apenas com consumação mínima.

Sala Paulo Augusto 1: R$ 5.000  
Sala Paulo Augusto 2: R$ 3.700

Posso te mostrar fotos das salas?"

ENVIAR_FOTOS_SALA_VIP

---------------------------------------

SE O CLIENTE DEMONSTRAR INTERESSE

Se o cliente quiser reservar ou saber disponibilidade da sala VIP:

peça:

• nome
• quantidade de pessoas
• data
• horário
• qual sala prefere
• comanda individual (Sim ou Não)

---------------------------------------
ENVIO DE MÍDIA

Você pode enviar arquivos de mídia quando for útil para ajudar o cliente.

Use os seguintes comandos especiais.

ENVIAR CARDÁPIO:

Se o cliente pedir:

cardápio
menu
ver cardápio
o que tem para comer

Responda com o texto normal e adicione no final:

ENVIAR_CARDAPIO

---------------------------------------

ENVIAR FOTOS DO RESTAURANTE

Se o cliente pedir:

fotos
imagens
como é o restaurante
quero ver o restaurante

Responda normalmente e adicione:

ENVIAR_FOTOS

---------------------------------------

ENVIAR FOTOS DA SALA VIP

Se o cliente pedir:

sala vip
fotos da sala vip
como é a sala vip
quero ver a sala vip

Responda normalmente e adicione no final:

ENVIAR_FOTOS_SALA_VIP

---------------------------------------
ENVIAR VÍDEO DO RESTAURANTE

Se o cliente pedir:

vídeo
video
quero ver um vídeo
mostra o restaurante

Responda normalmente e adicione:

ENVIAR_VIDEO

---------------------------------------

IMPORTANTE

Os comandos devem aparecer **sozinhos no final da mensagem**.

Exemplo:

"Claro! Vou te mostrar um pouco do nosso restaurante."

ENVIAR_FOTOS

---------------------------------------

ENVIAR POSTER DA MÚSICA

Se o cliente pedir:

poster do show
foto do cantor
cartaz do show
imagem do show
agenda visual
poster da música
cartaz da música ao vivo

Responda normalmente e adicione no final:

ENVIAR_POSTER

---------------------------------------

MUDANÇA DE ASSUNTO DO CLIENTE

O cliente pode mudar de assunto a qualquer momento.

Exemplo:

Cliente: "Tem vídeo do restaurante?"
Cliente depois: "Quero reservar uma mesa às 16h"

Nesse caso o cliente mudou de assunto.

Sempre priorize a mensagem mais recente do cliente.

Ignore completamente o assunto anterior se o cliente iniciar um novo pedido.

Se o cliente falar sobre reserva, inicie imediatamente o fluxo de reserva.

Nunca continue falando de cardápio, fotos ou vídeos se o cliente já estiver falando de reserva.

---------------------------------------


INTENÇÃO DO CLIENTE

Sempre identifique a intenção da última mensagem do cliente.

As intenções possíveis são:

• reserva
• ver cardápio
• ver fotos
• ver vídeo
• localização
• dúvida geral

Se a intenção for reserva, comece imediatamente o processo de reserva.

---------------------------------------





COLETA DE INFORMAÇÕES

Quando o cliente quiser reservar peça os dados de forma direta.

Pergunta padrão:

Para fazer sua reserva preciso de:

• Nome
• Quantidade de pessoas
• Data
• Horário
• Local (Salão, Sacada ou Sala VIP)
• Comanda individual (Sim ou Não)

Peça apenas o que estiver faltando.
Se o cliente já informar algum dado, não pergunte novamente.

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

PERGUNTAS SOBRE MÚSICA

Se o cliente perguntar coisas como:

quem canta sexta
quem canta sábado
agenda do final de semana
programação musical
próximo show
quem está tocando agora
vai ter música hoje
quem toca hoje

Use sempre os dados da agenda fornecida.

---------------------------------------

INTERPRETAÇÃO DE HORÁRIOS DOS SHOWS

Use a agenda fornecida para interpretar o horário atual.

Considere a hora atual do sistema.

Com base nisso você deve conseguir responder:

• quem está tocando agora
• quem toca depois
• quem foi o último cantor
• se o show já começou
• quanto tempo falta para o próximo show

REGRAS:

1️⃣ Quem está tocando agora

Se a hora atual for maior ou igual ao horário de um cantor
e menor que o próximo cantor da lista,
então esse cantor está tocando agora.

2️⃣ Quem toca depois

Se existir um cantor com horário maior que o horário atual,
esse é o próximo show.

3️⃣ Último cantor

Se a hora atual for maior que o horário de um cantor,
ele foi o último a tocar.

4️⃣ Show já começou

Se a hora atual for maior ou igual ao horário do primeiro cantor do dia,
então o show já começou.

5️⃣ Tempo para o próximo show

Se existir um cantor com horário maior que a hora atual,
calcule aproximadamente quanto tempo falta.

Exemplo:

Agora são 19:30
Próximo cantor 21:00

Resposta:

"O próximo show começa em aproximadamente 1h30."

Sempre responda de forma natural como um atendente.



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

ALTERAÇÃO DE RESERVAS

O cliente pode pedir alterações em uma reserva já criada.

IMPORTANTE — REGRAS INTERNAS (não diga isso ao cliente):

• Alterações só podem ser feitas se faltarem mais de 6 horas para o horário da reserva.
• Se faltar menos de 6 horas para a reserva, NÃO altere a reserva.
• Nesse caso informe ao cliente que o gerente entrará em contato para ajudar.

---------------------------------------

CAMPOS QUE NÃO PODEM SER ALTERADOS

Os seguintes campos NUNCA podem ser alterados pelo assistente:

• data
• hora
• local / área

Se o cliente pedir alteração de qualquer um desses campos:

não altere a reserva.

Explique educadamente que:

"Alterações de data, horário ou local precisam ser feitas diretamente com nossa equipe."

Informe que o gerente entrará em contato.

---------------------------------------

CAMPOS QUE PODEM SER ALTERADOS

Os seguintes campos podem ser alterados:

• nome
• quantidade de pessoas
• comanda individual

---------------------------------------

PROCESSO DE ALTERAÇÃO

Quando o cliente pedir alteração de reserva:

1️⃣ atualize apenas o campo solicitado  
2️⃣ mantenha todos os outros dados da reserva  
3️⃣ nunca reinicie o fluxo da reserva  

---------------------------------------

CONFIRMAÇÃO DA ALTERAÇÃO

Sempre mostre o resumo atualizado da reserva antes de aplicar a alteração.

Exemplo:

"Atualizei sua reserva. Segue o resumo:

Nome:
Pessoas:
Data:
Hora:
Área:

Posso confirmar essa atualização?"

A alteração só deve ser aplicada após confirmação do cliente.

---------------------------------------

FORMATO DO JSON PARA ALTERAÇÃO

Quando o cliente confirmar a alteração, gere exatamente:

ALTERAR_RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":"",
"comandaIndividual":""
}

IMPORTANTE:

• Gere esse JSON apenas após confirmação do cliente
• Nunca gere antes da confirmação
• Nunca altere data, hora ou área

---------------------------------------

RESUMO DA RESERVA

Quando todos os dados da reserva estiverem definidos, mostre um resumo claro:

Nome:
Pessoas:
Data:
Hora:
Área:

Após mostrar o resumo, sempre pergunte claramente ao cliente se pode confirmar a reserva.

Exemplo de mensagem:

"Segue o resumo da sua reserva:

Nome:
Pessoas:
Data:
Hora:
Área:

Posso confirmar essa reserva para você?"

A reserva só deve ser confirmada após o cliente responder positivamente.

---------------------------------------

Evite repetir confirmação várias vezes.

---------------------------------------

CONFIRMAÇÃO DA RESERVA

A reserva só deve ser confirmada quando o cliente responder positivamente à pergunta de confirmação.

Exemplos de respostas que indicam confirmação:

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

gere imediatamente o JSON da reserva no formato RESERVA_JSON.

Nunca gere o JSON antes da confirmação do cliente.


---------------------------------------

FORMATO DO JSON

Quando a reserva for confirmada gere exatamente:

RESERVA_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"area":"",
"comandaIndividual":""
}

---------------------------------------

RESERVA DA SALA VIP

Quando o cliente confirmar reserva da sala VIP gere:

RESERVA_SALA_VIP_JSON:
{
"nome":"",
"pessoas":"",
"data":"",
"hora":"",
"sala":"",
"comandaIndividual":""
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
/* ================= DETECTAR MIDIA ================= */

if(resposta.includes("ENVIAR_CARDAPIO")){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"document",
document:{
link:"https://SEU_CARDAPIO.pdf",
filename:"Cardapio_Mercatto.pdf"
}
})
})

resposta = resposta.replace(/ENVIAR_CARDAPIO/g,"").trim()
}

if(resposta.includes("ENVIAR_FOTOS")){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"image",
image:{
link:"https://dxkszikemntfusfyrzos.supabase.co/storage/v1/object/public/MERCATTO/images%20(1).jpg",
caption:"Mercatto Delícia"
}
})
})

await supabase
.from("conversas_whatsapp")
.insert({
telefone:cliente,
mensagem:"[FOTOS DO RESTAURANTE ENVIADAS]",
role:"assistant"
})

resposta = resposta.replace(/ENVIAR_FOTOS/g,"").trim()

}
if(resposta.includes("ENVIAR_FOTOS_SALA_VIP")){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"image",
image:{
link:"https://dxkszikemntfusfyrzos.supabase.co/storage/v1/object/public/MERCATTO/salas_vip/sala1.jpg",
caption:"Sala VIP Mercatto Delícia"
}
})
})

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"image",
image:{
link:"https://dxkszikemntfusfyrzos.supabase.co/storage/v1/object/public/MERCATTO/salas_vip/sala2.jpg",
caption:"Ambiente da Sala VIP"
}
})
})

resposta = resposta.replace(/ENVIAR_FOTOS_SALA_VIP/g,"").trim()

}

if(resposta.includes("ENVIAR_POSTER")){

if(posterHoje){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"image",
image:{
link:posterHoje,
caption:"🎶 Música ao vivo no Mercatto"
}
})
})

}

resposta = resposta.replace(/ENVIAR_POSTER/g,"").trim()

}

  
if(resposta.includes("ENVIAR_VIDEO")){

await fetch(url,{
method:"POST",
headers:{
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
"Content-Type":"application/json"
},
body: JSON.stringify({
messaging_product:"whatsapp",
to:cliente,
type:"video",
video:{
link:"https://dxkszikemntfusfyrzos.supabase.co/storage/v1/object/public/MERCATTO/WhatsApp%20Video%202026-03-10%20at%2021.08.40.mp4",
caption:"Conheça o Mercatto Delícia"
}
})
})

resposta = resposta.replace(/ENVIAR_VIDEO/g,"").trim()
}
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

/* ================= RESERVA SALA VIP ================= */

const vipMatch = resposta?.match(/RESERVA_SALA_VIP_JSON:\s*({[\s\S]*?})/)
if(vipMatch){

let reservaVip

try{
reservaVip = JSON.parse(vipMatch[1])
}catch(err){
console.log("Erro JSON VIP", err)
}

if(reservaVip){

let salaBanco = "Sala VIP 1"
/* ================= VALIDAR DATA ================= */

const [ano, mes, dia] = reservaVip.data.split("-").map(Number)

const dataTest = new Date(ano, mes - 1, dia)

console.log("VALIDANDO DATA VIP:", reservaVip.data, reservaVip.hora)

/* VERIFICAR SE DATA EXISTE */

if(
dataTest.getFullYear() !== ano ||
dataTest.getMonth() + 1 !== mes ||
dataTest.getDate() !== dia
){

console.log("DATA IMPOSSIVEL:", reservaVip.data)

resposta = "⚠️ Essa data não existe no calendário. Pode confirmar a data novamente?"

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

return res.status(200).end()

}
/* BLOQUEAR DATA PASSADA */

const agora = new Date()

if(dataTest < agora){
console.log("DATA PASSADA")

resposta = "⚠️ Não é possível reservar para uma data passada. Pode escolher outra data?"

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

return res.status(200).end()
}

/* BLOQUEAR HORÁRIO APÓS 19:00 */

const horaReserva = parseInt(reservaVip.hora.split(":")[0])

if(horaReserva > 19){
console.log("HORARIO INVALIDO")

resposta = "⚠️ As reservas podem ser feitas apenas até às 19:00. Pode escolher outro horário?"

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

return res.status(200).end()
}


if(reservaVip.sala?.toLowerCase().includes("2")){
salaBanco = "Sala VIP 2"
}

console.log("Reserva VIP detectada:", reservaVip)

/* SALVAR NO SUPABASE */

const datahora = reservaVip.data + "T" + reservaVip.hora

const { error } = await supabase
.from("reservas_mercatto")
.insert({

acao: "cadastrar",
status: "Pendente",

nome: reservaVip.nome,
email: "",
telefone: cliente,

pessoas: parseInt(reservaVip.pessoas) || 1,

mesa: salaBanco,
cardapio: "",

observacoes: "Reserva sala VIP via WhatsApp",

datahora: datahora,

valorEstimado: 0,
pagamentoAntecipado: 0,
valorFinalPago: 0,

banco: "",

comandaindividual: false,
comandaIndividual: reservaVip.comandaIndividual || "Não",

origem: "whatsapp"

})

if(error){
console.log("ERRO AO SALVAR VIP:", error)
}else{
console.log("Reserva VIP salva com sucesso")
}

/* DATA FORMATADA */

const [anoVip, mesVip, diaVip] = reservaVip.data.split("-")

const dataCliente = `${diaVip}/${mesVip}/${anoVip}`
/* RESPOSTA PARA CLIENTE */

resposta = `✅ *Pré-reserva da sala confirmada!*

Nome: ${reservaVip.nome}
Sala: ${salaBanco}
Pessoas: ${reservaVip.pessoas}
Data: ${dataCliente}
Hora: ${reservaVip.hora}

📍 Mercatto Delícia
Avenida Rui Barbosa 1264

Nossa equipe entrará em contato para finalizar a reserva da sala VIP.`

}

}
try{
const alterarMatch = resposta.match(/ALTERAR_RESERVA_JSON:\s*({[\s\S]*?})/)

if(alterarMatch){

let reserva

try{
reserva = JSON.parse(alterarMatch[1])
}catch(err){
console.log("Erro JSON alteração:", err)
}

/* BLOQUEAR ALTERAÇÃO VAZIA */

if(
!reserva.nome &&
!reserva.pessoas &&
!reserva.data &&
!reserva.hora &&
!reserva.area &&
!reserva.comandaIndividual
){
console.log("ALTERAÇÃO IGNORADA - JSON VAZIO")
return res.status(200).end()
}

console.log("Alteração detectada:", reserva)

await supabase
.from("reservas_mercatto")
.update({
nome: reserva.nome,
pessoas: parseInt(reserva.pessoas) || 1,
comandaIndividual: reserva.comandaIndividual || "Não"
})
.eq("telefone", cliente)
.eq("status","Pendente")
.order("datahora",{ascending:false})
.limit(1)

resposta = `✅ *Reserva atualizada!*

Nome: ${reserva.nome}
Pessoas: ${reserva.pessoas}
Data: ${reserva.data}
Hora: ${reserva.hora}

Sua reserva foi atualizada.`

}
const match = resposta.match(/RESERVA_JSON:\s*({[\s\S]*?})/)
if(match){

let reserva

try{
  reserva = JSON.parse(match[1])
}
catch(err){
  console.log("Erro ao interpretar JSON da reserva:", match[1])
  resposta = "Desculpe, tive um problema ao processar sua reserva. Pode confirmar novamente?"
}
console.log("Reserva detectada:",reserva)

/* NORMALIZAR DATA */

let dataISO = reserva.data

if(reserva.data && reserva.data.includes("/")){
const [dia,mes] = reserva.data.split("/")
const ano = new Date().toISOString().slice(0,4)
dataISO = `${ano}-${mes}-${dia}`

}

/* NORMALIZAR AREA */

let mesa="Salão Central"
const areaTexto=(reserva.area || "").toLowerCase()

if(
areaTexto.includes("extern") ||
areaTexto.includes("fora") ||
areaTexto.includes("sacada")
){
mesa="Área Externa"
}

if(
areaTexto.includes("vip") ||
areaTexto.includes("paulo augusto 1")
){
mesa="Sala VIP 1"
}

if(
areaTexto.includes("vip 2") ||
areaTexto.includes("paulo augusto 2")
){
mesa="Sala VIP 2"
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
pessoas: parseInt(reserva.pessoas) || 1,
mesa:mesa,
cardapio:"",
comandaIndividual: reserva.comandaIndividual || "Não",
  datahora:datahora,
observacoes:"Reserva via WhatsApp",
valorEstimado:0,
pagamentoAntecipado:0,
banco:"",
status:"Pendente"

})

if(!error){


const [anoR, mesR, diaR] = dataISO.split("-")

const dataClienteReserva = `${diaR}/${mesR}/${anoR}`

resposta =
`✅ *Reserva confirmada!*

Nome: ${reserva.nome}
Pessoas: ${reserva.pessoas}
Data: ${dataClienteReserva}
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

return res.status(200).end()

}

return res.status(200).end()

}

}
