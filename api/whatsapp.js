export default async function handler(req, res) {

  try {

    // ====================================
    // VERIFICAÇÃO DO WEBHOOK META
    // ====================================
    if (req.method === "GET") {

      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }

      return res.status(200).send("Webhook Mercatto ativo");
    }

    // ====================================
    // RECEBER EVENTO WHATSAPP
    // ====================================
    if (req.method === "POST") {

      const body = req.body;

      console.log("Webhook recebido:", JSON.stringify(body, null, 2));

      const change = body?.entry?.[0]?.changes?.[0];
      const value = change?.value;

      if (!value) {
        return res.status(200).json({ ok: true });
      }

      const phoneId = value?.metadata?.phone_number_id;

      const message = value?.messages?.[0];

      // ignora eventos sem mensagem (delivered, read etc)
      if (!message) {
        return res.status(200).json({ ok: true });
      }

      const from = message.from;
      const text = message?.text?.body || "";

      console.log("Cliente:", from);
      console.log("Mensagem:", text);

      // ====================================
      // OPENAI
      // ====================================

      const aiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content: `
Você é atendente do restaurante Mercatto Delícia.

Ajude clientes com:
- reservas
- aniversários
- horários
- cardápio
- informações do restaurante

Informações do Mercatto:
Endereço: Avenida Rui Barbosa 1264
Telefone: (77) 3613-5148
Instagram: @mercattodelicia

Responda sempre de forma curta, educada e clara.
`
              },
              {
                role: "user",
                content: text
              }
            ]
          })
        }
      );

      const aiData = await aiResponse.json();

      const reply =
        aiData?.choices?.[0]?.message?.content ||
        "Desculpe, não consegui entender. Pode repetir?";

      console.log("Resposta IA:", reply);

      // ====================================
      // ENVIAR RESPOSTA WHATSAPP
      // ====================================

const send = await fetch(
  `https://graph.facebook.com/v19.0/${phoneId}/messages`,
  {
    method:"POST",
    headers:{
      Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      messaging_product:"whatsapp",
      to:from,
      type:"text",
      text:{ body: reply }
    })
  }
)

const sendData = await send.json()

console.log("META RESPONSE:", sendData)
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: {
              body: reply
            }
          })
        }
      );

      return res.status(200).json({ ok: true });

    }

  } catch (error) {

    console.error("Erro webhook:", error);

    return res.status(500).json({
      erro: error.message
    });

  }

}
