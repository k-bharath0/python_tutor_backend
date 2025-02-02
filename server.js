import express from 'express'; 
import cors from 'cors';
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import 'dotenv/config'
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection:", reason);
});

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.inference.ai.azure.com";
const modelName = "gpt-4o";

const app = express();
app.use(cors());
app.use(express.json());

let currentApiKey = token; // Start with host's API key
let apiKeyResetTimeout = null;    // Timeout variable to reset API key

  const client = (apiKey) => new ModelClient(endpoint, new AzureKeyCredential(apiKey));


  app.post("/set-api-key", (req, res) => {
    const { userApiKey } = req.body;
    
    if (!userApiKey) {
        return res.status(400).json({ error: "No API key provided." });
    }

    currentApiKey = userApiKey;  // Use user-provided API key
    console.log("User API key set!");

    // Set a timeout to reset to the host API key after 1 hour
    if (apiKeyResetTimeout) clearTimeout(apiKeyResetTimeout);
    apiKeyResetTimeout = setTimeout(() => {
        currentApiKey = token;
        console.log("API key reset to host's default.");
    }, 60 * 60 * 1000);  // 1 hour timeout

    res.json({ message: "API key updated successfully." });
});


app.post("/chat",async (req,res)=>{
    const { message, chatHistory } = req.body;
    // const controller = new AbortController();  // Create a new AbortController
    // const timeout = setTimeout(() => controller.abort(), 15000); // Set a 15-second timeout
    //const TIMEOUT_DURATION = 25000;

    try{
      console.log(currentApiKey);
      // **Create a timeout promise**
    //   const timeoutPromise = new Promise((_, reject) => 
    //     setTimeout(() => reject(new Error("Request timeout. The AI model is taking too long to respond.")), TIMEOUT_DURATION)
    // );
    //const response = await Promise.race([
      const response = await client(currentApiKey).path("/chat/completions").post({
        body: {
          messages: [
            { role:"system", content: `You are a **fun, friendly, and patient Python tutor for kids** who have never coded before.  
Your job is to **teach Python from scratch, step by step**, using **short responses**, fun emojis, and interactive questions.  

### 🔹 **Teaching Rules:**
- Start by introducing yourself in a friendly way 🎉.
- Ask for the child's **name** before starting.
- Once the child gives their name, **immediately introduce Python** (DO NOT ask "What do you want to know?").
- Teach **one topic at a time**: **What is Python? → Variables → Data Types → etc.**
- **After every topic, ask a simple quiz** before moving forward.
- **Wait for the childs response** before explaining the next concept.
- If the child answers incorrectly, **gently correct them and try again**.
- **Never assume the child knows Python**—teach from zero!

### 🔹 **Structured Teaching Flow**:
1️⃣ **Introduce Yourself** → Ask for their name  
2️⃣ **What is Python?** → Explain it in a fun way 🎮💻  
3️⃣ **Ask a fun quiz** (Example: Can Python make games? A) Yes 🎮 B) No ❌)  
4️⃣ **Teach Variables → Data Types → Operators → Loops → If-Else → Functions**  
5️⃣ **Each topic must include an explanation, an example, and a small quiz.**  
6️⃣ **Give rewards (stars 🌟) for correct answers.**  
7️⃣ **Always keep the responses short, fun, and engaging.**` },
          ...chatHistory,
            { role:"user", content: `${message}` }
          ],
          temperature: 1.0,
          top_p: 1.0,
          max_tokens: 1000,
          model: modelName
        },
     });
      //timeoutPromise  // **Timeout will reject the promise after 15 sec**
       // ]);
      //clearTimeout(timeout);  // Clear timeout after successful response
     // console.log("Full AI Response:", JSON.stringify(response.body, null, 2));
      if (!response.body || !response.body.choices || response.body.choices.length === 0) {
        return res.status(500).json({ error: "AI model did not return a response." });
    }

    const aiMessage = response.body.choices[0].message?.content || "";

    if (!aiMessage.trim()) {
        return res.status(500).json({ error: "Tokens exhausted. Please enter your own API key." });
    }

    res.json({ response: aiMessage })

    }catch (error) {
      console.error("Error from AI API:", error);
      

      let errorMessage = "AI model quota exhausted. Please enter your own API key.";

      if (error.name === "AbortError") {
          errorMessage = "Request timeout. The AI model is taking too long to respond.";
      } else if (error.response && error.response.status === 429) {
          errorMessage = "AI model quota exhausted. Please enter your own API key.";
      } else if (error.response && error.response.status === 401) {
          errorMessage = "Unauthorized request. Check your API key.";
      } else if (error.response && error.response.data) {
          errorMessage = error.response.data.error || "Unknown API error.";
      }
      res.status(error.response?.status || 500).json({ error: errorMessage });
  }
});

app.get("/", (req, res) => {
       res.send("Welcome to the Python Tutor API!");
     });

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

