module.exports = async function handler(req, res){

  try{

    const { pergunta, numero, usuario } = req.body

    const empresa = usuario.empresa
    const nivel = usuario.nivel_acesso
    const texto = pergunta.toLowerCase()

    await salvar({ telefone: numero, mensagem: pergunta, role: "user", usuario })

    const hist = await historico(numero)

    /* ================= DATA HOJE ================= */

    const hoje = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Bahia"
    })

    /* ================= HOJE ================= */

    if(texto.includes("hoje")){

      const { data } = await supabase
        .from("agenda_musicos")
        .select("*")
        .eq("empresa", empresa)
        .eq("data", hoje)

      if(!data || data.length === 0){
        return res.json({
          resposta: "📅 Nenhum músico hoje."
        })
      }

      const lista = data.map(m =>
        `🎤 ${m.cantor.trim()} - ${m.hora}`
      ).join("\n")

      return res.json({
        resposta: `📅 Músicos de hoje:\n\n${lista}`
      })
    }

    /* ================= AGENDA COMPLETA ================= */

    if(texto.includes("agenda") || texto.includes("completa")){

      const { data } = await supabase
        .from("agenda_musicos")
        .select("*")
        .eq("empresa", empresa)
        .order("data", { ascending: true })

      if(!data || data.length === 0){
        return res.json({ resposta: "📭 Agenda vazia." })
      }

      const lista = data.map(m =>
        `${m.data} - 🎤 ${m.cantor.trim()} (${m.hora})`
      ).join("\n")

      return res.json({
        resposta: `📅 Agenda completa:\n\n${lista}`
      })
    }

    /* ================= BUSCA POR NOME ================= */

    if(texto.includes("musico") || texto.includes("cantor")){

      const nome = pergunta.replace(/musico|cantor/gi,"").trim()

      if(nome.length > 2){

        const { data } = await supabase
          .from("agenda_musicos")
          .select("*")
          .eq("empresa", empresa)
          .ilike("cantor", `%${nome}%`)

        if(!data || data.length === 0){
          return res.json({ resposta: "❌ Não encontrado." })
        }

        const lista = data.map(m =>
          `${m.data} - ${m.cantor}`
        ).join("\n")

        return res.json({ resposta: lista })
      }
    }

    /* ================= DELETE ================= */

    if(texto.includes("deletar") && nivel >= 1){

      const nome = pergunta.replace(/deletar/i,"").trim()

      const lista = await buscarMusico(empresa, nome)

      if(lista.length === 0){
        return res.json({ resposta: "❌ Nenhum encontrado." })
      }

      if(lista.length === 1){

        const m = lista[0]

        await deletar(m.id)

        await salvar({
          telefone: numero,
          mensagem: "delete",
          role: "assistant",
          usuario,
          acao: "delete",
          dados: m
        })

        return res.json({
          resposta: `🗑️ ${m.cantor} removido.`
        })
      }

      const msg = lista.map(m =>
        `${m.cantor} - ${m.data}`
      ).join("\n")

      return res.json({
        resposta: `⚠️ Mais de um:\n\n${msg}\n\nInforme a data.`
      })
    }

    /* ================= REVERSÃO ================= */

    if(texto.includes("reverter") || texto.includes("desfazer")){

      const ultima = [...hist].reverse().find(m => m.acao)

      if(!ultima){
        return res.json({ resposta: "❌ Nada para reverter." })
      }

      await inserir(ultima.dados_acao)

      return res.json({
        resposta: "♻️ Revertido com sucesso."
      })
    }

    /* ================= IA (SÓ SE PRECISAR) ================= */

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
  {
  role: "system",
  content: `
Você é o cérebro operacional da gestão de agenda de músicos da empresa ${empresa}.

Você NÃO é um chatbot comum.
Você é responsável por ENTENDER, DECIDIR e EXECUTAR ações no sistema.

---

📅 DATA ATUAL DO SISTEMA:
${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Bahia" })}

---

📊 DADOS REAIS DA AGENDA (FONTE DA VERDADE):

${JSON.stringify(await supabase
  .from("agenda_musicos")
  .select("*")
  .eq("empresa", empresa)
, null, 2)}

---

🎯 SUA MISSÃO

Você deve:
- Entender o que o usuário quer
- Tomar decisão
- Responder diretamente com base nos dados acima
- NÃO perguntar o óbvio
- NÃO pedir confirmação desnecessária

---

🧠 COMPORTAMENTO INTELIGENTE

1. Se o usuário disser "hoje":
→ use a DATA ATUAL
→ filtre automaticamente

2. Se disser "agenda":
→ mostre tudo organizado

3. Se disser "deletar":
→ encontre o registro
→ se único → confirmar e executar
→ se múltiplos → listar opções

4. Se disser "reverter":
→ restaurar última ação

---

🚫 PROIBIDO

- perguntar "qual data é hoje?"
- pedir informação que já está no sistema
- responder de forma genérica
- inventar dados

---

🧾 FORMATO DE RESPOSTA

- direto
- organizado
- objetivo

Exemplo:

📅 Músicos de hoje:

🎤 Leandro Reis - 18:00
🎤 Daniel Cruz - 21:00

---

⚙️ EXECUÇÃO

Você não executa diretamente o banco.

Você deve retornar intenções claras:

Tipos de ação:
- LISTAR
- INSERIR
- ATUALIZAR
- DELETAR
- NENHUMA

Se for ação, deixe claro no texto.

---

🎯 OBJETIVO FINAL

Ser um gerente inteligente, rápido, preciso e que usa os dados do sistema como verdade absoluta.

Você é o cérebro do sistema.
Não aja como assistente comum.
`
},
        { role: "user", content: pergunta }
      ]
    })

    const resposta = completion.choices[0].message.content

    await salvar({ telefone: numero, mensagem: resposta, role: "assistant", usuario })

    return res.json({ resposta })

  }catch(e){

    console.error("❌ ERRO:", e)

    return res.json({
      resposta: "Erro interno"
    })
  }
}
