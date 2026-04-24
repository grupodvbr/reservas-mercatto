const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)





// ================= MEMÓRIA =================

global.contextoUsuarios = global.contextoUsuarios || {}
global.acoesPendentes = global.acoesPendentes || {}




/* ================= NORMALIZA ================= */

function normalize(str){
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}











/* ================= HANDLER ================= */

module.exports = async function handler(req, res){

  try{

    const { pergunta, usuario } = req.body


const numero = usuario.telefone || "default"

let contextoAtual = global.contextoUsuarios[numero] || {
  cantor: null,
  data: null,
  hora: null,
  valor: null
}

let acaoPendente = global.acoesPendentes[numero] || null














    
    const empresa = usuario.empresa
    const texto = pergunta.toLowerCase()

/* ================= CONFIRMAÇÃO ================= */

if(acaoPendente){

  if(["sim","isso","confirmo"].includes(texto)){

    console.log("✅ CONFIRMADO")

    if(acaoPendente.tipo === "update"){

      await supabase
        .from("agenda_musicos")
        .update(acaoPendente.dados)
        .eq("id", acaoPendente.id)

      delete global.acoesPendentes[numero]

      return res.json({
        resposta: `✅ ${acaoPendente.cantor} atualizado com sucesso.`
      })
    }
  }

  if(["não","cancelar"].includes(texto)){

    delete global.acoesPendentes[numero]

    return res.json({
      resposta: "❌ Operação cancelada."
    })
  }
}






    
    console.log("📩 PERGUNTA:", pergunta)
    console.log("🏢 EMPRESA:", empresa)

    /* ================= DATA ================= */

    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bahia"
    })

    const mesAtual = hoje.slice(0,7)

    console.log("📅 HOJE:", hoje)
    console.log("📅 MÊS:", mesAtual)

    /* ================= BUSCA TOTAL ================= */

    const { data: raw, error } = await supabase
      .from("agenda_musicos")
      .select("*")

    if(error){
      console.log("❌ ERRO BANCO:", error)
    }

    /* ================= FILTRO EMPRESA ================= */

    const empresaNorm = normalize(empresa)

    const base = (raw || []).filter(m =>
      normalize(m.empresa).includes(empresaNorm)
    )

    console.log("📊 TOTAL EMPRESA:", base.length)

    /* ================= HOJE ================= */

    if(texto.includes("hoje") || texto === "oi" || texto === "ola"){

      const lista = base.filter(m => m.data === hoje)

      console.log("📅 HOJE ENCONTRADOS:", lista.length)

      if(lista.length === 0){
        return res.json({ resposta: "📭 Nenhum músico hoje." })
      }

      const resposta = lista.map(m =>
        `🎤 ${m.cantor.trim()} - ${m.hora}`
      ).join("\n")

      return res.json({
        resposta: `📅 Músicos de hoje:\n\n${resposta}`
      })
    }

    /* ================= MÊS ================= */

    if(texto.includes("mes")){

      const lista = base.filter(m => m.data.startsWith(mesAtual))

      console.log("📅 MÊS ENCONTRADOS:", lista.length)

      if(lista.length === 0){
        return res.json({ resposta: "📭 Nenhum músico no mês." })
      }

      const resposta = lista.map(m =>
        `${m.data} - 🎤 ${m.cantor.trim()} (${m.hora})`
      ).join("\n")

      return res.json({
        resposta: `📅 Músicos do mês:\n\n${resposta}`
      })
    }

    /* ================= AGENDA COMPLETA ================= */

    if(texto.includes("agenda")){

      const resposta = base.map(m =>
        `${m.data} - 🎤 ${m.cantor.trim()} (${m.hora})`
      ).join("\n")

      return res.json({
        resposta: `📅 Agenda completa:\n\n${resposta}`
      })
    }

    /* ================= DELETE ================= */

    if(texto.includes("deletar")){

      const nome = pergunta.replace(/deletar/i,"").trim()

      const encontrados = base.filter(m =>
        normalize(m.cantor).includes(normalize(nome))
      )

      if(encontrados.length === 0){
        return res.json({ resposta: "❌ Nenhum encontrado." })
      }

      if(encontrados.length === 1){

        const m = encontrados[0]

        await supabase
          .from("agenda_musicos")
          .delete()
          .eq("id", m.id)

        return res.json({
          resposta: `🗑️ ${m.cantor} removido.`
        })
      }

      const lista = encontrados.map(m =>
        `${m.cantor} - ${m.data}`
      ).join("\n")

      return res.json({
        resposta: `⚠️ Mais de um encontrado:\n\n${lista}\n\nInforme a data.`
      })
    }


/* ================= INSERT ================= */

if(
  texto.includes("adiciona") ||
  texto.includes("adicionar") ||
  texto.includes("inserir")
){

  console.log("🧠 INTENÇÃO: INSERIR")

  // tenta extrair dados da conversa
  const nomeMatch = pergunta.match(/(?:adiciona|adicionar|inserir)\s+(.*?)(?:\s+para|\s+dia|$)/i)
  const dataMatch = pergunta.match(/\b(\d{2}\/\d{2})\b/)
  const horaMatch = pergunta.match(/\b(\d{1,2}:\d{2})\b/)
  const valorMatch = pergunta.match(/\b(\d+)\s*(reais|r\$)?\b/i)

  let cantor = nomeMatch ? nomeMatch[1].trim() : null
  let data = dataMatch ? dataMatch[1] : null
  let hora = horaMatch ? horaMatch[1] : null
  let valor = valorMatch ? Number(valorMatch[1]) : 0

  // trata data dd/mm → yyyy-mm-dd
  if(data){
    const [dia, mes] = data.split("/")
    data = `${hoje.slice(0,4)}-${mes}-${dia}`
  }

  console.log("📥 EXTRAIDO:", { cantor, data, hora, valor })

  // valida
  if(!cantor || !data || !hora){
    return res.json({
      resposta: "⚠️ Preciso de nome, data e hora para inserir."
    })
  }

  // insere
  await supabase.from("agenda_musicos").insert({
    empresa,
    cantor,
    data,
    hora,
    valor: valor || 0,
    estilo: "Não definido"
  })

  return res.json({
    resposta: `✅ ${cantor} adicionado em ${data} às ${hora}.`
  })
}





/* ================= UPDATE INTELIGENTE ================= */

/* ================= UPDATE REAL COM MEMÓRIA ================= */

if(
  texto.includes("atualiza") ||
  texto.includes("alterar") ||
  texto.includes("muda") ||
  texto.includes("coloca")
){

  console.log("🧠 UPDATE REAL")

  // detectar nome automaticamente pela base
  const nomes = base.map(m => m.cantor.toLowerCase())

  let nomeDetectado = nomes.find(n =>
    texto.includes(normalize(n))
  )

  if(nomeDetectado){
    contextoAtual.cantor = nomeDetectado
  }

  // data
  const dataMatch = pergunta.match(/\b(\d{2}\/\d{2})\b/)
  if(dataMatch){
    const [dia, mes] = dataMatch[1].split("/")
    contextoAtual.data = `${hoje.slice(0,4)}-${mes}-${dia}`
  }

  // hora
  const horaMatch = pergunta.match(/\b(\d{1,2}:\d{2})\b/)
  if(horaMatch){
    contextoAtual.hora = horaMatch[1]
  }

  // valor
  const valorMatch = pergunta.match(/\b(\d+)\b/)
  if(valorMatch){
    contextoAtual.valor = Number(valorMatch[1])
  }

  // salva contexto
  global.contextoUsuarios[numero] = contextoAtual

  console.log("📌 CONTEXTO:", contextoAtual)

  if(!contextoAtual.cantor){
    return res.json({ resposta: "⚠️ Qual músico?" })
  }

  const encontrados = base.filter(m =>
    normalize(m.cantor).includes(normalize(contextoAtual.cantor))
  )

  if(encontrados.length === 0){
    return res.json({ resposta: "❌ Músico não encontrado." })
  }

  let alvo = contextoAtual.data
    ? encontrados.find(m => m.data === contextoAtual.data)
    : encontrados[0]

  if(!alvo){
    return res.json({
      resposta: "❌ Não encontrei esse show nessa data."
    })
  }

  const updateData = {}

  if(contextoAtual.hora) updateData.hora = contextoAtual.hora
  if(contextoAtual.valor !== null) updateData.valor = contextoAtual.valor

  if(Object.keys(updateData).length === 0){
    return res.json({
      resposta: "⚠️ O que deseja alterar?"
    })
  }

  // salva ação pendente
  global.acoesPendentes[numero] = {
    tipo: "update",
    id: alvo.id,
    dados: updateData,
    cantor: alvo.cantor
  }

  return res.json({
    resposta: `Confirma alterar ${alvo.cantor} para ${JSON.stringify(updateData)}?`
  })
}













    






    
    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
       {
      role: "system",
      content: `
Você é o GERENTE INTELIGENTE da agenda de músicos da empresa ${empresa}.

DATA ATUAL: ${hoje}

---

📊 BASE DE DADOS (VERDADE ABSOLUTA):
${JSON.stringify(base.slice(0,50), null, 2)}

---

🎯 SUA FUNÇÃO

Você NÃO é um chatbot comum.
Você é responsável por:

- Interpretar pedidos
- Usar os dados acima como fonte única
- Ajudar o usuário de forma direta
- Complementar o sistema quando necessário

---

⚠️ REGRAS CRÍTICAS

1. NUNCA invente dados
2. NUNCA pergunte algo que já está na base
3. NUNCA diga "não sei" se a resposta está nos dados
4. NUNCA ignore o contexto da conversa

---

🧠 INTELIGÊNCIA DE INTERPRETAÇÃO

Você deve entender comandos como:

- "hoje" → usar ${hoje}
- "mês" → filtrar por ${mesAtual}
- "agenda" → listar tudo
- "aquele músico" → usar contexto anterior
- "ele" → referenciar último músico citado

---

⚙️ IMPORTANTE SOBRE AÇÕES

- Inserir, atualizar e deletar JÁ SÃO tratados pelo sistema
- Você NÃO executa ações diretamente
- Você apenas ORIENTA e COMPLEMENTA

---

📌 COMPORTAMENTO

Se o usuário já deu dados incompletos (ex: "Pedro dia 30/04"):

→ você deve pedir APENAS o que falta
→ nunca ignorar a intenção

Se o usuário deu tudo:

→ confirme de forma natural

---

🧾 FORMATO DE RESPOSTA

Sempre:

- claro
- direto
- profissional
- sem enrolação

Exemplo:

📅 Agenda:

🎤 Pedro - 30/04 às 15:00

---

🎯 OBJETIVO FINAL

Ser rápido, inteligente e útil.
Agir como um gerente real, não como um assistente genérico.
`
    },
        { role: "user", content: pergunta }
      ]
    })

    const resposta = completion.choices[0].message.content

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO:", e)

    return res.json({
      resposta: "Erro interno"
    })
  }
}
