const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function handler(req,res){

try{

const {
nome,
telefone,
pessoas,
data,
hora,
area
} = req.body

const mesa =
area.toLowerCase().includes("externa")
? "Área Externa"
: "Salão"

const datahora = data + "T" + hora

const {error} = await supabase
.from("reservas_mercatto")
.insert({

nome:nome,
email:"",
telefone:telefone,
pessoas:Number(pessoas),
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

if(error){

return res.json({
success:false
})

}

return res.json({
success:true
})

}catch(e){

return res.json({
success:false
})

}

}
