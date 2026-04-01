const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/* ================= ESTADO GLOBAL ================= */
let status = {
  rodando:false,
  total:0,
  enviados:0,
  erros:0,
  atual:null,
  progresso:0,
  finalizado:false,
  logs:[]
}


module.exports = async function(req,res){

  try{

    /* ================= GET STATUS ================= */
    if(req.method === "GET"){
      return res.json(status)
    }

    /* ================= BODY SAFE ================= */
    let body = req.body
    if(typeof body === "string") body = JSON.parse(body)

    const { template, parametros = {} } = body

    if(!template){
      return res.status(400).json({ error:"template obrigatório" })
    }

    if(status.rodando){
      return res.status(400).json({
        error:"Já existe um disparo em andamento"
      })
    }

    /* ================= CLIENTES ================= */
    const { data: clientes, error } = await supabase
      .from("memoria_clientes")
      .select("telefone, nome")
      .not("telefone","is",null)

    if(error){
      return res.status(500).json({ error:error.message })
    }

    if(!clientes.length){
      return res.json({ ok:false, mensagem:"Sem clientes" })
    }

    /* ================= RESET ================= */
    status = {
      rodando:true,
      total:clientes.length,
      enviados:0,
      erros:0,
      atual:null,
      progresso:0,
      finalizado:false,
      logs:[]
    }

    res.json({ ok:true, iniciado:true })

    const baseUrl = `https://${req.headers.host}`

    /* ================= BACKGROUND ================= */
    ;(async ()=>{

      for(const cliente of clientes){

        const telefone = cliente.telefone
        status.atual = telefone

        try{

          const resp = await fetch(`${baseUrl}/api/send-template`,{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
              telefone,
              template,
              parametros:{
                nome: cliente.nome || "Cliente",
                data: parametros.data || "20/03",
                hora: parametros.hora || "20:00",
                pessoas: parametros.pessoas || "2"
              }
            })
          })

          let result = {}

          try{
            result = await resp.json()
          }catch{
            result = { error:"Resposta inválida da API" }
          }

          if(!resp.ok || result?.error){

            status.erros++

            status.logs.push({
              telefone,
              status:"erro",
              detalhe: result?.error || "Erro desconhecido"
            })

            /* 🔥 SALVA ERRO */
            await supabase
              .from("conversas_whatsapp")
              .insert({
                telefone,
                mensagem: `[ERRO TEMPLATE: ${template}]`,
                role:"assistant",
                status:"erro"
              })

          }else{

            status.enviados++

            const messageId = result?.data?.messages?.[0]?.id || null

            status.logs.push({
              telefone,
              status:"ok"
            })

            /* 🔥 SALVA SUCESSO (IGUAL SEND-TEMPLATE) */
            await supabase
              .from("conversas_whatsapp")
              .insert({
                telefone,
                mensagem:`[TEMPLATE ENVIADO EM MASSA: ${template}]`,
                role:"assistant",
                message_id: messageId,
                status:"sent"
              })

          }

        }catch(e){

          status.erros++

          status.logs.push({
            telefone,
            status:"erro",
            detalhe: e.message
          })

          /* 🔥 SALVA ERRO CRÍTICO */
          await supabase
            .from("conversas_whatsapp")
            .insert({
              telefone,
              mensagem:`[ERRO CRÍTICO: ${template}]`,
              role:"assistant",
              status:"erro"
            })

        }

        status.progresso = Math.round(
          ((status.enviados + status.erros) / status.total) * 100
        )

        await new Promise(r => setTimeout(r, 1500))
      }

      status.finalizado = true
      status.rodando = false

    })()

  }catch(err){
    res.status(500).json({ error: err.message })
  }

}
