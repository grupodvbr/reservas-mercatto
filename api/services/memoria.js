const supabase = require("../utils/supabase")

async function salvarNomeCliente(telefone,nome){

await supabase
.from("memoria_clientes")
.upsert({
telefone,
nome,
ultima_interacao:new Date().toISOString()
})

}

async function buscarMemoriaCliente(telefone){

const { data } = await supabase
.from("memoria_clientes")
.select("*")
.eq("telefone",telefone)
.maybeSingle()

return data

}

module.exports = {
salvarNomeCliente,
buscarMemoriaCliente
}
