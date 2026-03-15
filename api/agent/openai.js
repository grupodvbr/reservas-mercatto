const OpenAI = require("openai")
const tools = require("./tools")

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
})

async function perguntarIA(messages){

const completion = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages

})

return completion.choices[0].message.content

}

module.exports = perguntarIA
