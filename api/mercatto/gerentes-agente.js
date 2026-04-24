const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

/* ================= MEMORIA ================= */

const TABELA_MEMORIA = "conversas_gerentes_mercatto"

/* ================= SALVAR ================= */

async function salvarMensagem({ telefone, mensagem, role, usuario }){

  await supabase.from(TABELA_MEMORIA).insert({
    telefone,
    mensagem,
    role,
    nome_usuario: usuario?.nome,
    empresa: usuario?.empresa
  })

}

/* ================= HISTORICO ================= */

async function buscarHistorico(telefone){

  const { data } = await supabase
    .from(TABELA_MEMORIA)
    .select("mensagem, role")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(30)

  return (data || []).reverse()
}

/* ================= CRUD MUSICOS ================= */

async function listarMusicos(empresa){

  const { data } = await supabase
    .from("agenda_musicos")
    .select("*")
    .eq("empresa", empresa)
    .order("data", { ascending: true })

  return data || []
}

async function inserirMusico(dados){
  return await supabase.from("agenda_musicos").insert(dados)
}

async function atualizarMusico(id, dados){
  return await supabase
    .from("agenda_musicos")
    .update(dados)
    .eq("id", id)
}

async function deletarMusico(id){
  return await supabase
    .from("agenda_musicos")
    .delete()
    .eq("id", id)
}

/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

  try{

    const { pergunta, numero, usuario } = req.body

    const nivel = usuario?.nivel_acesso || 0
    const empresa = usuario?.empresa

    /* ================= SALVA USER ================= */

    await salvarMensagem({
      telefone: numero,
      mensagem: pergunta,
      role: "user",
      usuario
    })

    /* ================= HISTORICO ================= */

    const historico = await buscarHistorico(numero)

    const contexto = historico.map(m => ({
      role: m.role,
      content: m.mensagem
    }))

    /* ================= PROMPT ================= */

    const systemPrompt = `
Você é um GERENTE do sistema Mercatto.

Você tem acesso TOTAL à agenda de músicos da empresa ${empresa}.

Funções:
- Listar agenda
- Inserir músico
- Atualizar músico
- Deletar músico

Regras:

- Nunca invente dados
- Sempre confirme antes de deletar
- Sempre use a empresa ${empresa}
- Responda de forma objetiva

Se o usuário enviar imagem:
Pergunte:
"Deseja usar essa imagem como poster do músico?"
`

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...contexto,
        { role: "user", content: pergunta }
      ]
    })

    let resposta = completion.choices[0].message.content

    const texto = pergunta.toLowerCase()

    /* ================= LISTAR ================= */

    if(texto.includes("agenda") || texto.includes("listar")){

      const dados = await listarMusicos(empresa)

      resposta = `📅 Agenda ${empresa}:\n\n` + dados.map(m =>
        `${m.data} - ${m.cantor} (${m.hora})`
      ).join("\n")
    }

    /* ================= INSERIR ================= */

    if(texto.includes("inserir") && nivel >= 1){

      await inserirMusico({
        empresa,
        cantor: "Novo músico",
        data: new Date(),
        hora: "20:00",
        valor: 0,
        estilo: "A definir"
      })

      resposta = "✅ Músico inserido com sucesso"
    }

    /* ================= ATUALIZAR ================= */

    if(texto.includes("atualizar") && nivel >= 1){

      resposta = "✏️ Informe o ID do músico e os novos dados."
    }

    /* ================= DELETAR ================= */

    if(texto.includes("deletar") && nivel >= 1){

      resposta = "⚠️ Confirme o ID do músico para exclusão."
    }

    /* ================= SALVA RESPOSTA ================= */

    await salvarMensagem({
      telefone: numero,
      mensagem: resposta,
      role: "assistant",
      usuario
    })

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO GERENTE:", e)

    return res.json({
      resposta: "Erro interno no agente gerente"
    })
  }
}
