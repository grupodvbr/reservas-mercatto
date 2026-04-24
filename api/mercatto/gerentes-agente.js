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

    /* ================= TOOLS ================= */

    const tools = [
      {
        type: "function",
        function: {
          name: "listar_musicos",
          description: "Lista músicos por data ou todos",
          parameters: {
            type: "object",
            properties: {
              data: { type: "string" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deletar_musico",
          description: "Remove músico por id",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string" }
            },
            required: ["id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "inserir_musico",
          description: "Insere novo músico",
          parameters: {
            type: "object",
            properties: {
              cantor: { type: "string" },
              data: { type: "string" },
              hora: { type: "string" }
            },
            required: ["cantor", "data", "hora"]
          }
        }
      }
    ]

    /* ================= IA ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
Você é o cérebro da gestão de agenda de músicos da empresa ${empresa}.

Data atual: ${new Date().toLocaleDateString("pt-BR", {
            timeZone: "America/Bahia"
          })}

REGRAS:
- Se pedir "hoje", use a data atual
- Se pedir agenda → listar
- Se pedir deletar → usar função deletar
- Se pedir inserir → usar função inserir

NUNCA pergunte o óbvio.
NUNCA peça data se já estiver implícita.
`
        },
        { role: "user", content: pergunta }
      ],
      tools,
      tool_choice: "auto"
    })

    const msg = completion.choices[0].message

    /* ================= EXECUÇÃO ================= */

    if(msg.tool_calls){

      const call = msg.tool_calls[0]
      const name = call.function.name
      const args = JSON.parse(call.function.arguments || "{}")

      /* ===== LISTAR ===== */

      if(name === "listar_musicos"){

        const dataFiltro = args.data ||
          new Date().toLocaleDateString("en-CA", {
            timeZone: "America/Bahia"
          })

        const { data } = await supabase
          .from("agenda_musicos")
          .select("*")
          .eq("empresa", empresa)
          .eq("data", dataFiltro)

        if(!data || data.length === 0){
          return res.json({ resposta: "📭 Nenhum músico." })
        }

        const lista = data.map(m =>
          `🎤 ${m.cantor.trim()} - ${m.hora}`
        ).join("\n")

        return res.json({
          resposta: `📅 Agenda:\n\n${lista}`
        })
      }

      /* ===== DELETE ===== */

      if(name === "deletar_musico"){

        await supabase
          .from("agenda_musicos")
          .delete()
          .eq("id", args.id)

        return res.json({
          resposta: "🗑️ Removido com sucesso."
        })
      }

      /* ===== INSERT ===== */

      if(name === "inserir_musico"){

        await supabase.from("agenda_musicos").insert({
          empresa,
          cantor: args.cantor,
          data: args.data,
          hora: args.hora,
          valor: 0
        })

        return res.json({
          resposta: "✅ Inserido com sucesso."
        })
      }
    }

    /* ================= RESPOSTA NORMAL ================= */

    return res.json({
      resposta: msg.content || "OK"
    })

  }catch(e){

    console.error(e)

    return res.json({
      resposta: "Erro interno"
    })
  }
}
