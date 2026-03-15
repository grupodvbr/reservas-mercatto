const supabase = require("../utils/supabase")

async function buscarCardapio(){

const { data, error } = await supabase
.from("buffet")
.select("id,nome,tipo,descricao,preco_venda,foto_url")
.eq("cardapio", true)
.eq("ativo", true)
.order("tipo",{ascending:true})
.order("nome",{ascending:true})

if(error){
console.log("Erro cardapio:",error)
return []
}

return data || []

}

module.exports = {
buscarCardapio
}
