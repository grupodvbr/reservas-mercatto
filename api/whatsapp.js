const tools = require("../agent/tools")
const perguntarIA = require("../agent/openai")

module.exports = async function handler(req,res){

try{

if(req.method==="POST"){

const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!msg){
return res.status(200).end()
}

const texto = msg.text?.body

const resposta = await perguntarIA([
{role:"user",content:texto}
])

console.log("IA:",resposta)

}

}catch(e){

console.log("ERRO BOT:",e)

}

return res.status(200).end()

}
