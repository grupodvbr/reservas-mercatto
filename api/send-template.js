module.exports = async function(req, res){

  try {

    const { telefone, template } = req.body

    if(!telefone || !template){
      return res.status(400).json({
        error: "telefone ou template não enviado"
      })
    }

    const PHONE_ID = process.env.PHONE_NUMBER_ID || "1047101948485043"
    const TOKEN = process.env.WHATSAPP_TOKEN

    if(!TOKEN){
      return res.status(500).json({
        error: "WHATSAPP_TOKEN não configurado"
      })
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

    console.log("📤 TEMPLATE:", template)
    console.log("📞 TELEFONE:", telefone)

    /* ================= TEMPLATE CONFIG ================= */

    let templateData = null

    /* ===== TEMPLATE 1: CONFIRMAÇÃO ===== */

    if(template === "confirmao_de_reserva"){

      templateData = {
        name: template,
        language: { code: "en_US" },
        components: [
          {
            type: "body",
            parameters: [
              { type:"text", text:"Nalbert" },   // {{1}}
              { type:"text", text:"20/03" },     // {{2}}
              { type:"text", text:"20:00" },     // {{3}}
              { type:"text", text:"4" }          // {{4}}
            ]
          }
        ]
      }

    }

    /* ===== TEMPLATE 2: RESERVA ESPECIAL (VÍDEO) ===== */

    else if(template === "reserva_especial"){

      templateData = {
        name: template,
        language: { code: "en_US" },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "video",
                video: {
                  link: "https://www.w3schools.com/html/mov_bbb.mp4"
                }
              }
            ]
          }
        ]
      }

    }

    /* ===== TEMPLATE 3: HELLO WORLD ===== */

    else if(template === "hello_world"){

      templateData = {
        name: template,
        language: { code: "en_US" }
      }

    }

    else{
      return res.status(400).json({
        error: "Template não configurado no backend"
      })
    }

    /* ================= PAYLOAD ================= */

    const payload = {
      messaging_product: "whatsapp",
      to: telefone,
      type: "template",
      template: templateData
    }

    console.log("📦 PAYLOAD:", JSON.stringify(payload, null, 2))

    /* ================= ENVIO ================= */

    const resp = await fetch(url,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify(payload)
    })

    const data = await resp.json()

    console.log("📩 META RESPONSE:", data)

    if(data.error){
      return res.status(500).json({
        error: data.error
      })
    }

    return res.json({
      ok:true,
      enviado:true,
      data
    })

  } catch (err){

    console.error("🔥 ERRO:", err)

    return res.status(500).json({
      error: err.message
    })
  }
}
