const perguntarIA = require("./agent/openai")
const tools = require("./agent/tools")
const supabase = require("./utils/supabase")

module.exports = async function handler(req,res){

try{

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

if(req.method==="POST"){

const body=req.body

const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!msg){
return res.status(200).end()
}

const mensagem = msg.text?.body
const cliente = msg.from

const respostaIA = await perguntarIA([
{role:"user",content:mensagem}
])

console.log("IA:",respostaIA)

return res.status(200).end()

}

}catch(e){

console.log("ERRO BOT:",e)
return res.status(200).end()

}

}
