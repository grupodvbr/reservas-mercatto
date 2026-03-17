import fetch from "node-fetch";

export default async function handler(req, res){

  if(req.method !== "POST"){
    return res.status(405).end();
  }
  
  try{
    
    const { numero, mensagem } = req.body;

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${process.env.WHATSAPP_TOKEN}`,
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
