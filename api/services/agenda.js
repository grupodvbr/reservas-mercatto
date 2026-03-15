const supabase = require("../utils/supabase")

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

if(valor > maior){
maior = valor
}

})

return maior

}

module.exports = {
buscarAgendaDoDia,
calcularCouvert
}
