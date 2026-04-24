const OpenAI = require("openai")
const { createClient } = require("@supabase/supabase-js")

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

module.exports = async function handler(req, res){

  try{

    const { pergunta, usuario } = req.body

    const empresa = usuario.empresa
    const texto = pergunta.toLowerCase()

    console.log("🧠 PERGUNTA:", pergunta)
    console.log("🏢 EMPRESA:", empresa)

    /* ================= DATA ================= */

    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bahia"
    })

    console.log("📅 DATA HOJE:", hoje)

    /* ================= BUSCA ================= */

    const { data, error } = await supabase
      .from("agenda_musicos")
      .select("*")
      .eq("empresa", empresa)

    if(error){
      console.log("❌ ERRO BANCO:", error)
    }

    console.log("📊 TOTAL REGISTROS:", data?.length || 0)

    console.log("📦 DADOS BRUTOS:")
    console.log(JSON.stringify(data, null, 2))

    /* ================= FILTRO HOJE ================= */

    const hojeFiltrado = (data || []).filter(m => m.data === hoje)

    console.log("📅 REGISTROS HOJE:", hojeFiltrado.length)

    /* ================= RESPOSTA INTELIGENTE ================= */

    if(texto.includes("oi") || texto.includes("olá") || texto.trim().length <= 3){

      if(hojeFiltrado.length === 0){
        return res.json({
          resposta: "📅 Não há músicos hoje."
        })
      }

      const lista = hojeFiltrado.map(m =>
        `🎤 ${m.cantor.trim()} - ${m.hora}`
      ).join("\n")

      return res.json({
        resposta: `📅 Músicos de hoje:\n\n${lista}`
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

DADOS REAIS:
${JSON.stringify(data.slice(0,20), null, 2)}

Use esses dados para responder.
Nunca invente.
`
        },
        { role: "user", content: pergunta }
      ]
    })

    const resposta = completion.choices[0].message.content

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO GERAL:", e)

    return res.json({
      resposta: "Erro interno"
    })
  }
}
