<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>WhatsApp • Mercatto</title>

<meta name="viewport" content="width=device-width, initial-scale=1">

<meta http-equiv="Cache-Control" content="no-store" />

<style>
body{margin:0;font-family:Arial;background:#0b0f14;color:#fff}
.container{display:flex;height:100vh}
.sidebar{width:280px;background:#111}
.lista{overflow:auto}
.item{padding:12px;border-bottom:1px solid #222;cursor:pointer}
.item:hover{background:#222}
.chat{flex:1;display:flex;flex-direction:column}
.messages{flex:1;overflow:auto;padding:10px}
.msg{padding:10px;margin:5px;border-radius:10px}
.user{background:#333}
.bot{background:#16a34a;align-self:flex-end}
.input{display:flex}
input{flex:1;padding:10px}
button{padding:10px}
#status{font-size:12px;color:#aaa;padding:5px}
</style>
</head>

<body>

<div class="container">

<div class="sidebar">
<div id="lista"></div>
</div>

<div class="chat">

<div class="messages" id="msgs"></div>

<div id="status"></div>

<div class="input">
<input id="txt">
<button onclick="enviar()">Enviar</button>
</div>

</div>

</div>

<script>

let numeroAtual="";

function log(msg){
  console.log(msg);
  document.getElementById("status").innerText=msg;
}

async function carregar(){

  const res = await fetch("/api/conversas?ts="+Date.now(),{cache:"no-store"});
  const lista = await res.json();

  const div = document.getElementById("lista");
  div.innerHTML="";

  lista.forEach(n=>{
    const el=document.createElement("div");
    el.className="item";
    el.innerText=n;

    el.onclick=()=>abrir(n);

    div.appendChild(el);
  });
}

async function abrir(n){

  numeroAtual=n;

  const res = await fetch(`/api/conversas?numero=${n}&ts=${Date.now()}`,{cache:"no-store"});
  const msgs = await res.json();

  const div = document.getElementById("msgs");
  div.innerHTML="";

  msgs.forEach(m=>{
    const el=document.createElement("div");
    el.className="msg "+(m.role==="user"?"user":"bot");
    el.innerText=m.mensagem;
    div.appendChild(el);
  });

  div.scrollTop=div.scrollHeight;
}

async function enviar(){

  const texto=document.getElementById("txt").value;

  if(!texto || !numeroAtual){
    log("Selecione conversa");
    return;
  }

  log("Enviando...");

  const res = await fetch("/api/send",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      numero: numeroAtual,
      mensagem: texto
    })
  });

  const data = await res.json();

  if(!res.ok){
    log("Erro: "+JSON.stringify(data));
    return;
  }

  log("Enviado ✅");

  document.getElementById("txt").value="";

  abrir(numeroAtual);
}

setInterval(()=>{
  carregar();
  if(numeroAtual) abrir(numeroAtual);
},3000);

carregar();

</script>

</body>
</html>
