import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

const openai = new OpenAI({
apiKey:process.env.OPENAI_API_KEY
})

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

export default async function handler(req,res){

const {texto,telefone} = req.body

const prompt = `
Você é o assistente de reservas do restaurante Mercatto Delícia.

Extraia informações da mensagem.

Locais disponíveis:
Sala VIP 1
Sala VIP 2
Sacada
Salão Central

Mensagem:
${texto}

Retorne JSON:
{
nome,
pessoas,
mesa,
datahora
}
`

const completion = await openai.chat.completions.create({
model:"gpt-4.1",
messages:[{role:"user",content:prompt}]
})

let dados

try{
dados = JSON.parse(completion.choices[0].message.content)
}catch{
return res.json({resposta:"Não entendi sua reserva."})
}

if(!dados.datahora){

return res.json({
resposta:"Qual data e horário deseja reservar?"
})

}

// cria reserva
await supabase.from("reservas_mercatto").insert({

nome:dados.nome || telefone,
telefone:telefone,
pessoas:dados.pessoas,
mesa:dados.mesa,
datahora:dados.datahora,
status:"Pendente"

})

res.json({

resposta:`
Reserva registrada!

Local: ${dados.mesa}
Pessoas: ${dados.pessoas}
Data: ${dados.datahora}

Mercatto Delícia
`

})

}
