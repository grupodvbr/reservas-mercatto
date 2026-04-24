const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const TABELA_MEMORIA = "conversas_gerentes_mercatto"

/* ================= MEMORIA ================= */

async function salvar({ telefone, mensagem, role, usuario, acao=null, dados=null }) {
  await supabase.from(TABELA_MEMORIA).insert({
    telefone,
    mensagem,
    role,
    nome_usuario: usuario.nome,
    empresa: usuario.empresa,
    acao,
    dados_acao: dados
  })
}

async function historico(telefone){
  const { data } = await supabase
    .from(TABELA_MEMORIA)
    .select("*")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(40)

  return (data || []).reverse()
}

/* ================= BANCO ================= */

async function buscarMusico(empresa, nome){
  const { data } = await supabase
    .from("agenda_musicos")
    .select("*")
    .eq("empresa", empresa)
    .ilike("cantor", `%${nome}%`)

  return data || []
}

async function inserir(d){
  return await supabase.from("agenda_musicos").insert(d)
}

async function update(id, d){
  return await supabase.from("agenda_musicos").update(d).eq("id", id)
}

async function deletar(id){
  return await supabase.from("agenda_musicos").delete().eq("id", id)
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

  try{

    const { pergunta, numero, usuario } = req.body

    const empresa = usuario.empresa
    const nivel = usuario.nivel_acesso
    const texto = pergunta.toLowerCase()

    await salvar({ telefone: numero, mensagem: pergunta, role: "user", usuario })

    const hist = await historico(numero)

    /* ================= REVERSÃO ================= */

    if(texto.includes("reverter") || texto.includes("desfazer")){

      const ultima = [...hist].reverse().find(m => m.acao)

      if(!ultima){
        return res.json({ resposta: "❌ Nada para reverter." })
      }

      if(ultima.acao === "delete"){
        await inserir(ultima.dados_acao)
      }

      if(ultima.acao === "insert"){
        await deletar(ultima.dados_acao.id)
      }

      if(ultima.acao === "update"){
        await update(ultima.dados_acao.id, ultima.dados_acao.old)
      }

      const resposta = "♻️ Ação revertida com sucesso."

      await salvar({ telefone: numero, mensagem: resposta, role: "assistant", usuario })

      return res.json({ resposta })
    }

    /* ================= DELETE INTELIGENTE ================= */

    if(texto.includes("deletar") && nivel >= 1){

      const nome = pergunta.replace(/deletar/i,"").trim()

      const lista = await buscarMusico(empresa, nome)

      if(lista.length === 0){
        return res.json({ resposta: "❌ Nenhum músico encontrado." })
      }

      if(lista.length === 1){

        const m = lista[0]

        await deletar(m.id)

        await salvar({
          telefone: numero,
          mensagem: `delete ${m.cantor}`,
          role: "assistant",
          usuario,
          acao: "delete",
          dados: m
        })

        return res.json({ resposta: `🗑️ ${m.cantor} removido.` })
      }

      const msg = lista.map(m =>
        `${m.cantor} - ${m.data}`
      ).join("\n")

      return res.json({
        resposta: `⚠️ Mais de um encontrado:\n\n${msg}\n\nInforme a data.`
      })
    }

    /* ================= INSERT INTELIGENTE ================= */

    if(texto.includes("adicionar") || texto.includes("inserir")){

      if(nivel < 1){
        return res.json({ resposta: "❌ Sem permissão." })
      }

      const novo = {
        empresa,
        cantor: "Novo músico",
        data: new Date(),
        hora: "20:00",
        valor: 0,
        estilo: "A definir"
      }

      await inserir(novo)

      await salvar({
        telefone: numero,
        mensagem: "insert",
        role: "assistant",
        usuario,
        acao: "insert",
        dados: novo
      })

      return res.json({ resposta: "✅ Inserido com sucesso." })
    }

    /* ================= IA ================= */

    const contexto = hist.map(m => ({
      role: m.role,
      content: m.mensagem
    }))

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
Você é gerente da empresa ${empresa}.

Você gerencia agenda de músicos.

Responda direto, sem enrolar.
Nunca invente dados.
`
        },
        ...contexto,
        { role: "user", content: pergunta }
      ]
    })

    const resposta = completion.choices[0].message.content

    await salvar({ telefone: numero, mensagem: resposta, role: "assistant", usuario })

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO:", e)

    return res.json({
      resposta: "Erro interno no agente"
    })
  }
}
