import fetch from "node-fetch";

export default async function handler(req, res){

  if(req.method !== "POST"){
    return res.status(405).end();
  }

  try{

    const { numero, mensagem } = req.body;

    const PHONE_ID = process.env.PHONE_NUMBER_ID;
    const TOKEN = process.env.WHATSAPP_TOKEN;

    console.log("Enviando para:", numero);
    console.log("PHONE_ID:", PHONE_ID);

    /* ================= ENVIO NORMAL ================= */

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
      {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${TOKEN}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          messaging_product:"whatsapp",
          to: numero,
          type:"text",
          text:{ body: mensagem }
        })
      }
    );

    const data = await response.json();

    /* ================= SE DEU ERRO ================= */

    if(!response.ok){

      console.log("Erro envio normal:", data);

      const code = data?.error?.code;

      /* 🔥 ERRO 24H → ENVIA TEMPLATE */
      if(code === 131047){

        console.log("⚠️ 24h expirado → enviando template");

        const templateRes = await fetch(
          `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`,
          {
            method:"POST",
            headers:{
              "Authorization":`Bearer ${TOKEN}`,
              "Content-Type":"application/json"
            },
            body: JSON.stringify({
              messaging_product:"whatsapp",
              to: numero,
              type:"template",
              template:{
                name:"hello_world", // 🔥 troca depois
                language:{ code:"en_US" }
              }
            })
          }
        );

        const templateData = await templateRes.json();

        if(!templateRes.ok){
          console.log("Erro template:", templateData);
          return res.status(500).json({
            error:"Erro template",
            detalhe: templateData
          });
        }

        return res.json({
          success:true,
          modo:"template"
        });
      }

      return res.status(500).json(data);
    }

    /* ================= SUCESSO NORMAL ================= */

    return res.json({
      success:true,
      modo:"normal"
    });

  } catch(e){

    console.log("ERRO GERAL:", e);

    return res.status(500).json({
      error:e.message
    });
  }
}
