module.exports = async function(req,res){

  const { telefone, template } = req.body

  const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`

  const TEMPLATE_IDIOMAS = {
    confirmao_de_reserva: "en_US",
    reserva_especial: "en_US",
    hello_world: "en_US"
  }

  const resp = await fetch(url,{
    method:"POST",
    headers:{
      Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      messaging_product:"whatsapp",
      to: telefone,
      type:"template",
      template:{
        name: template,
        language:{ code: TEMPLATE_IDIOMAS[template] },
        components:[
          {
            type:"body",
            parameters:[
              { type:"text", text:"Cliente" }
            ]
          }
        ]
      }
    })
  })

  const data = await resp.json()

  console.log("📩 TEMPLATE RESPONSE:", data)

  res.json({ok:true})
}
