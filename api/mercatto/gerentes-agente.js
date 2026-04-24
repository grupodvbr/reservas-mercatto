const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

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

    const empresa = usuario.empresa
    const texto = pergunta.toLowerCase()

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












    
    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
Empresa: ${empresa}
Data atual: ${hoje}

DADOS:
${JSON.stringify(base.slice(0,50), null, 2)}

Use apenas esses dados.
Nunca invente.
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
