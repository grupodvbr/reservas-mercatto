import fetch from "node-fetch"

/* ================= METAS MENSAIS ================= */

const METAS = {
  "MERCATTO EMPORIO": { meta: 650000 },
  "MERCATTO RESTAURANTE": { meta: 850000 },
  "PADARIA DELÍCIA": { meta: 720000 },
  "VILLA GOURMET": { meta: 746600 },
  "DELÍCIA GOURMET": { meta: 545000 }
}

/* ================= NORMALIZAÇÃO ================= */

function normalizar(txt){
  return txt
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

/* ================= DATA BRASIL ================= */

function getHoje(){
  const agora = new Date(
    new Date().toLocaleString("en-US",{ timeZone:"America/Bahia" })
  )
  return agora
}

/* ================= META PROPORCIONAL ================= */

function calcularMetaProporcional(metaMensal){

  const hoje = getHoje()

  const diaAtual = hoje.getDate()

  const ultimoDia = new Date(
    hoje.getFullYear(),
    hoje.getMonth() + 1,
    0
  ).getDate()

  const metaDia = (metaMensal / ultimoDia) * diaAtual

  return {
    metaMensal,
    metaAteHoje: metaDia
  }
}

/* ================= HANDLER ================= */

export default async function handler(req, res){

try{

  const { empresa } = req.query

  /* ================= URL BASE ================= */

  let url = "https://goals-continental-examinations-carrier.trycloudflare.com/resumo-dia"

  const MAPA = {
    "MERCATTO EMPORIO": "VAREJO_URL_MERCATTO_EMPORIO",
    "MERCATTO RESTAURANTE": "VAREJO_URL_MERCATTO_RESTAURANTE",
    "PADARIA DELÍCIA": "VAREJO_URL_PADARIA",
    "VILLA GOURMET": "VAREJO_URL_VILLA",
    "DELÍCIA GOURMET": "VAREJO_URL_DELICIA"
  }

  /* ================= FILTRO ================= */

  if(empresa && MAPA[empresa]){
    url += `?empresa=${MAPA[empresa]}`
  }

  console.log("📡 URL FINAL:", url)

  /* ================= FETCH ================= */

  const response = await fetch(url)

  if(!response.ok){
    console.log("❌ ERRO HTTP:", response.status)
    throw new Error("Erro na API externa")
  }

  const data = await response.json()

  console.log("📊 RESPOSTA:", JSON.stringify(data))

  if(!data){
    return res.status(500).json({ erro: "sem resposta da API" })
  }

  /* ================= VARIÁVEIS ================= */

  let faturamento = 0
  let vendas = 0
  let ticket = 0
  let empresaFinal = empresa || "GERAL"

  /* ================= EMPRESA ================= */

  if(empresa){

    const empresaData = (data.empresas || []).find(e =>
      normalizar(e.empresa) === normalizar(empresa)
    )

    if(!empresaData){
      console.log("❌ EMPRESA NÃO ENCONTRADA:", empresa)
      return res.status(404).json({
        erro: "empresa nao encontrada",
        empresa
      })
    }

    faturamento = empresaData.faturamento || 0
    vendas = empresaData.vendas || 0
    ticket = vendas > 0 ? faturamento / vendas : 0

  }

  /* ================= GERAL ================= */

  else{

    faturamento = data.faturamento || 0
    vendas = data.vendas || 0
    ticket = data.ticket_medio || 0

  }

  /* ================= META ================= */

  let metaMensal = 0
  let metaAteHoje = 0
  let percentual = 0

  if(empresa && METAS[empresa]){

    metaMensal = METAS[empresa].meta

    const metaCalc = calcularMetaProporcional(metaMensal)

    metaAteHoje = metaCalc.metaAteHoje

    percentual = metaAteHoje > 0
      ? (faturamento / metaAteHoje) * 100
      : 0
  }

  /* ================= RESPOSTA FINAL ================= */

  return res.json({
    data: data.data,
    empresa: empresaFinal,
    faturamento,
    vendas,
    ticket_medio: ticket,

    meta_mensal: metaMensal,
    meta_ate_hoje: metaAteHoje,
    percentual
  })

}catch(e){

  console.log("❌ ERRO API VENDAS:", e)

  return res.status(500).json({
    erro: "erro ao processar vendas"
  })

}

}
