import fetch from "node-fetch"

const METAS = {
  "MERCATTO EMPORIO": { meta: 650000 },
  "MERCATTO RESTAURANTE": { meta: 850000 },
  "PADARIA DELÍCIA": { meta: 720000 },
  "VILLA GOURMET": { meta: 746600 },
  "DELÍCIA GOURMET": { meta: 545000 }
}

function normalizar(txt){
  return txt
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

export default async function handler(req, res){

try{

  const { empresa } = req.query

  let url = "https://goals-continental-examinations-carrier.trycloudflare.com/resumo-dia"

  const MAPA = {
    "MERCATTO EMPORIO": "VAREJO_URL_MERCATTO_EMPORIO",
    "MERCATTO RESTAURANTE": "VAREJO_URL_MERCATTO_RESTAURANTE",
    "PADARIA DELÍCIA": "VAREJO_URL_PADARIA",
    "VILLA GOURMET": "VAREJO_URL_VILLA",
    "DELÍCIA GOURMET": "VAREJO_URL_DELICIA"
  }

  // 🔥 aplica filtro na API externa
  if(empresa && MAPA[empresa]){
    url += `?empresa=${MAPA[empresa]}`
  }

  console.log("🔗 URL:", url)

  const response = await fetch(url)
  const data = await response.json()

  if(!data){
    return res.status(500).json({ erro: "sem resposta da API" })
  }

  let faturamento = 0
  let vendas = 0
  let ticket = 0
  let empresaFinal = empresa || "GERAL"

  // 🔥 QUANDO TEM EMPRESA
  if(empresa){

    const empresaData = (data.empresas || []).find(e =>
      normalizar(e.empresa) === normalizar(empresa)
    )

    if(!empresaData){
      return res.status(404).json({
        erro: "empresa nao encontrada",
        empresa
      })
    }

    faturamento = empresaData.faturamento || 0
    vendas = empresaData.vendas || 0
    ticket = vendas > 0 ? faturamento / vendas : 0

  }

  // 🔥 GERAL
  else{

    faturamento = data.faturamento || 0
    vendas = data.vendas || 0
    ticket = data.ticket_medio || 0

  }

  // 🔥 META MENSAL (SEM ACUMULADO)
  let meta = 0
  let percentual = 0

  if(empresa && METAS[empresa]){
    meta = METAS[empresa].meta
    percentual = meta > 0
      ? (faturamento / meta) * 100
      : 0
  }

  // 🔥 RESPOSTA FINAL LIMPA
  return res.json({
    data: data.data,
    empresa: empresaFinal,
    faturamento,
    vendas,
    ticket_medio: ticket,
    meta,
    percentual
  })

}catch(e){

  console.log("❌ ERRO API VENDAS:", e)

  return res.status(500).json({
    erro: "erro ao processar vendas"
  })

}

}
