const supabase = require("../utils/supabase")

async function salvarPedidoPendente(telefone,pedido){

await supabase
.from("pedidos_pendentes")
.insert({
telefone,
pedido
})

}

async function confirmarPedido(telefone,pedido){

const valorTotal = (pedido.itens || []).reduce((s,i)=>{

const preco = Number(i.preco || 0)
const qtd = Number(i.quantidade || 1)

return s + (preco*qtd)

},0)

await supabase
.from("pedidos")
.insert({

cliente_nome:pedido.nome,
cliente_telefone:telefone,

itens:pedido.itens,

valor_total:valorTotal,

status:"novo"

})

}

module.exports = {
salvarPedidoPendente,
confirmarPedido
}
