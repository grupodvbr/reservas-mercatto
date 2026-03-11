import OpenAI from "openai"

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req,res){

const {mensagem} = req.body

const completion = await openai.chat.completions.create({
model:"gpt-4.1",
messages:[
{
role:"system",
content:`Você é o assistente de reservas do restaurante Mercatto Delícia.

Seu trabalho é entender mensagens de clientes e ajudar a criar reservas.

Locais disponíveis:
Sala VIP 1
Sala VIP 2
Sacada
Salão Central`
},
{
role:"user",
content:mensagem
}
]
})

const resposta = completion.choices[0].message.content

res.json({resposta})

}
