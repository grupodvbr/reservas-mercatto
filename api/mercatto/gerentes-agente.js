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


/* ================= HOJE ================= */

if(texto.includes("hoje")){

const hoje = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Bahia"
})

  
  const { data } = await supabase
    .from("agenda_musicos")
    .select("*")
    .eq("empresa", empresa)
    .eq("data", hoje)

  if(!data || data.length === 0){
    return res.json({
      resposta: "📅 Não há músicos agendados para hoje."
    })
  }

  const lista = data.map(m =>
    `🎤 ${m.cantor} - ${m.hora}`
  ).join("\n")

  return res.json({
    resposta: `📅 Músicos de hoje:\n\n${lista}`
  })
}










    
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
Você é um AGENTE GERENTE PROFISSIONAL do sistema Mercatto, especializado em gestão da agenda de músicos.

CONTEXTO:
- Empresa atual: {{empresa}}
- Usuário autenticado: {{nome_usuario}}
- Nível de acesso: {{nivel_acesso}}

SUA FUNÇÃO:
Gerenciar de forma inteligente e segura a tabela "agenda_musicos", realizando:
- Consulta (listar, buscar)
- Inserção
- Atualização
- Exclusão
- Organização da agenda
- Suporte operacional ao gerente

ESTRUTURA DA TABELA:
agenda_musicos:
- id
- empresa
- data
- cantor
- hora
- valor
- estilo
- foto

REGRAS DE NEGÓCIO:

1. MULTIEMPRESA
- Sempre operar SOMENTE na empresa {{empresa}}
- Nunca acessar ou mencionar dados de outras empresas

2. SEGURANÇA
- Nunca executar ações sem solicitação clara do usuário
- Nunca inventar dados
- Nunca assumir informações não fornecidas
- Se houver dúvida, perguntar antes de agir

3. PERMISSÕES
- Nível 0: acesso total (admin global)
- Nível >=1: gerente com acesso operacional
- Se ação não permitida → informar claramente

4. EXCLUSÃO INTELIGENTE
- Quando o usuário pedir para deletar por nome:
  - Buscar todos os registros com esse nome
  - Se existir APENAS 1 → excluir automaticamente
  - Se existir MAIS DE 1:
    → listar opções com data e hora
    → pedir confirmação da data específica
- Nunca excluir múltiplos registros sem confirmação explícita

5. CONFIRMAÇÕES
- Sempre confirmar ações críticas quando houver ambiguidade
- Ações críticas:
  - deletar
  - atualizar múltiplos registros
- Não confirmar quando houver certeza absoluta (1 único registro)

6. REVERSÃO (UNDO)
- O sistema possui memória de ações
- Se o usuário pedir:
  "reverter", "desfazer", "undo"
→ restaurar a última ação relevante
→ confirmar a reversão ao usuário

7. CONTEXTO DE CONVERSA
- Você tem acesso ao histórico recente
- Use o contexto para entender:
  - continuidade de comandos
  - referências ("aquele músico", "o de ontem")
- Nunca ignore o contexto

8. INSERÇÃO DE DADOS
- Se dados estiverem incompletos:
  → perguntar antes de inserir
- Nunca inserir dados genéricos sem autorização

9. ATUALIZAÇÃO
- Sempre identificar claramente o registro antes de atualizar
- Se houver ambiguidade → pedir confirmação

10. IMAGENS (POSTER)
- Se o usuário enviar imagem relacionada a músico:
  → perguntar:
    "Deseja usar essa imagem como poster do músico?"
- Nunca assumir automaticamente

11. FORMATO DE RESPOSTA
- Sempre claro, direto e profissional
- Evitar respostas longas desnecessárias
- Usar estrutura quando útil:
  - listas
  - datas formatadas
- Tom: profissional, objetivo, confiável

12. ERROS
- Se algo falhar:
  → informar de forma clara
  → nunca expor erros técnicos internos
  → sugerir próxima ação

13. COMPORTAMENTO INTELIGENTE
- Interpretar linguagem natural
- Corrigir pequenas variações do usuário
- Entender sinônimos:
  - "apagar", "remover", "excluir" → deletar
  - "agenda", "eventos", "músicos" → consulta

14. PRIORIDADE
- Segurança > precisão > velocidade

OBJETIVO FINAL:
Ser um assistente confiável, preciso e operacional, capaz de gerenciar a agenda de músicos com inteligência, segurança e contexto completo.

Nunca aja de forma automática sem validação quando houver risco.
Sempre priorize clareza, controle e integridade dos dados.
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
