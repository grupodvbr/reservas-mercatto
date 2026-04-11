import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {

  // 🔥 ================= PROCESSADOR =================
  if (req.query.processar === "true") {

    console.log("🚀 PROCESSANDO FILA");

    const limite = new Date(Date.now() - 5000).toISOString();

    const { data: mensagens } = await supabase
      .from("fila_mensagens")
      .select("*")
      .eq("processado", false)
      .lte("created_at", limite)
      .order("created_at", { ascending: true });

    if (!mensagens || !mensagens.length) {
      return res.json({ ok: true });
    }

    const grupos = {};

    for (const m of mensagens) {
      if (!grupos[m.telefone]) grupos[m.telefone] = [];
      grupos[m.telefone].push(m);
    }

    for (const telefone in grupos) {

      const lista = grupos[telefone];
      const textoFinal = lista.map(m => m.mensagem).join("\n");

      console.log("📦 AGRUPADO:", textoFinal);

      // 🤖 GPT (UMA VEZ SÓ)
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Você é atendente do Mercatto Delícia, responda de forma simpática e objetiva." },
            { role: "user", content: textoFinal }
          ]
        })
      }).then(r => r.json());

      const resposta = ai.choices[0].message.content;

      // 💬 ENVIA
      await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefone,
          type: "text",
          text: { body: resposta }
        })
      });

      // 💾 SALVA RESPOSTA
      await supabase.from("mensagens").insert({
        numero: telefone,
        mensagem: resposta,
        origem: "bot"
      });

      // 🔥 MARCA PROCESSADO
      await supabase
        .from("fila_mensagens")
        .update({ processado: true })
        .in("id", lista.map(m => m.id));
    }

    return res.json({ ok: true });
  }

  // 🔐 VERIFICAÇÃO META
  if (req.method === "GET") {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    if (
      req.query["hub.mode"] === "subscribe" &&
      req.query["hub.verify_token"] === VERIFY_TOKEN
    ) {
      return res.status(200).send(req.query["hub.challenge"]);
    }

    return res.sendStatus(403);
  }

  // 📩 RECEBER MENSAGEM
  if (req.method === "POST") {

    try {

      const msg =
        req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!msg) return res.sendStatus(200);

      const from = msg.from;
      const text = msg.text?.body || "";

      // 💾 SALVA NORMAL
      await supabase.from("mensagens").insert({
        numero: from,
        mensagem: text,
        origem: "cliente"
      });

      // 🔥 SALVA NA FILA (NOVO)
      await supabase.from("fila_mensagens").insert({
        telefone: from,
        mensagem: text
      });

      console.log("📥 FILA:", text);

      // 🚫 NÃO RESPONDE AQUI
      return res.sendStatus(200);

    } catch (err) {
      console.error(err);
      return res.sendStatus(500);
    }
  }
}
