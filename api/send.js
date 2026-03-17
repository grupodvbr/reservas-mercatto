export default async function handler(req,res){

  if(req.method!=="POST"){
    return res.status(405).end();
  }

  try{

    const { numero, mensagem } = req.body;

    const PHONE_ID = process.env.PHONE_NUMBER_ID;
    const TOKEN = process.env.WHATSAPP_TOKEN;

    if(!PHONE_ID){
      return res.status(500).json({ error:"PHONE_NUMBER_ID não definido" });
    }

    if(!TOKEN){
      return res.status(500).json({ error:"WHATSAPP_TOKEN não definido" });
    }

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

    if(!response.ok){
      console.log("ERRO WHATSAPP:", data);
      return res.status(500).json(data);
    }

    return res.json({ success:true });

  } catch(e){
    console.log(e);
    return res.status(500).json({ error:e.message });
  }
}
