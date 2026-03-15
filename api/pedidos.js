const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function handler(req,res){

try{

if(req.method !== "POST"){
return res.status(405).json({erro:"Método inválido"})
}

const body =
typeof req.body === "string"
? JSON.parse(req.body)
: req.body

const pedido = body.pedido

if(!pedido){
return res.status(400).json({erro:"Pedido vazio"})
}

/* ================= CALCULAR TOTAL ================= */

const valorTotal = (pedido.itens || []).reduce((s,i)=>{

const preco = Number(i.preco || 0)
const qtd = Number(i.quantidade || 1)

return s + (preco * qtd)

},0)

/* ================= SALVAR PEDIDO ================= */

const { data, error } = await supabase
.from("pedidos")
.insert({

cliente_nome: pedido.nome,
cliente_telefone: pedido.telefone,

cliente_endereco: pedido.endereco || "",
cliente_bairro: pedido.bairro || "",

tipo: pedido.tipo || "entrega",

itens: pedido.itens || [],

valor_total: valorTotal,

forma_pagamento: pedido.pagamento || "",
observacao: pedido.observacao || "",

status: "novo"

})
.select()
.single()

if(error){
console.log("Erro pedido:",error)
return res.status(500).json({
sucesso:false,
erro:"Erro ao salvar pedido"
})
}

return res.json({
sucesso:true,
pedido_id:data.id
})

}catch(err){

console.log("ERRO API PEDIDOS:",err)

return res.status(500).json({
sucesso:false,
erro:"Erro interno"
})

}

}
