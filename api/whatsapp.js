export default async function handler(req, res) {

if (req.method === "GET") {

const mode = req.query["hub.mode"];
const token = req.query["hub.verify_token"];
const challenge = req.query["hub.challenge"];

if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
return res.status(200).send(challenge);
}

return res.sendStatus(403);
}

if (req.method === "POST") {

console.log("Mensagem recebida:", JSON.stringify(req.body,null,2));

return res.sendStatus(200);

}

}
