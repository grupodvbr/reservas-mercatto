const supabase = require("../utils/supabase")

async function enviarRelatorioAutomatico(){

const hoje = new Date().toISOString().split("T")[0]

const {data:reservas} = await supabase
.from("reservas_mercatto")
.select("*")
.gte("datahora", hoje+"T00:00")
.lte("datahora", hoje+"T23:59")

let resposta = "📊 *Relatório automático de reservas*\n\n"

if(!reservas?.length){

resposta += "Nenhuma reserva encontrada."

}else{

let totalPessoas=0

reservas.forEach((r,i)=>{

const hora = r.datahora?.split("T")[1]?.substring(0,5) || "--:--"

resposta += `${i+1}️⃣\n`
resposta += `Nome: ${r.nome}\n`
resposta += `Pessoas: ${r.pessoas}\n`
resposta += `Hora: ${hora}\n`
resposta += `Mesa: ${r.mesa}\n\n`

totalPessoas += Number(r.pessoas || 0)

})

resposta += `👥 Total de pessoas reservadas: ${totalPessoas}`

}

return resposta

}

module.exports = { enviarRelatorioAutomatico }
