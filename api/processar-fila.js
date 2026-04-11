import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export default async function handler(req, res){

  console.log("🚀 PROCESSADOR FILA INICIADO")

  try{

    // 🔥 BUSCA MENSAGENS NÃO PROCESSADAS COM 5s DE ATRASO
    const limiteTempo = new Date(Date.now() - 5000).toISOString()

    const { data: mensagens } = await supabase
    .from("fila_mensagens")
    .select("*")
    .eq("processado", false)
    .lte("created_at", limiteTempo)
    .order("created_at",{ ascending:true })

    if(!mensagens || !mensagens.length){
      console.log("⚠️ Nada pra processar")
      return res.json({ ok:true, msg:"fila vazia" })
    }

    // 🔥 AGRUPA POR TELEFONE
    const grupos = {}

    for(const m of mensagens){
      if(!grupos[m.telefone]){
        grupos[m.telefone] = []
      }
      grupos[m.telefone].push(m)
    }

    const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`

    // 🔥 PROCESSA CADA CLIENTE
    for(const telefone in grupos){

      const lista = grupos[telefone]

      const textoFinal = lista
        .map(m => m.mensagem)
        .join("\n")

      console.log("📦 MENSAGEM AGRUPADA:", textoFinal)

      // 🔥 GPT
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role:"system",
            content:"Responda de forma natural como atendente de restaurante. Seja direto."
          },
          {
            role:"user",
            content: textoFinal
          }
        ]
      })

      const resposta = completion.choices[0].message.content

      console.log("🤖 RESPOSTA:", resposta)

      // 🔥 ENVIA WHATSAPP
      await fetch(url,{
        method:"POST",
        headers:{
          Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          messaging_product:"whatsapp",
          to: telefone,
          type:"text",
          text:{ body: resposta }
        })
      })

      // 🔥 MARCA COMO PROCESSADO
      await supabase
      .from("fila_mensagens")
      .update({ processado:true })
      .in("id", lista.map(m => m.id))

    }

    return res.json({ ok:true })

  }catch(err){
    console.log("❌ ERRO:", err)
    return res.json({ ok:false, erro: err.message })
  }
}
