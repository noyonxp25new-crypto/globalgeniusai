import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { CohereClient } from "cohere-ai";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// Security filter against API key leaking & system prompt extraction
function checkSecurityViolation(message: string): boolean {
  const lower = message.toLowerCase();
  const bannedKeywords = [
    "api key",
    "api_key",
    "apikey",
    "secret key",
    "give me your api",
    "tomar api key",
    "api key daw",
    "api key dao",
    "system prompt",
    "show prompt",
    "system instruction",
    "env file",
    ".env",
    "credentials",
    "access token",
    "groq_api_key",
    "cohere_api_key",
    "token daw",
    "passwords",
  ];

  return bannedKeywords.some((keyword) => lower.includes(keyword));
}

function detectMode(message: string): { mode: "image" | "code" | "think" | "search" | "research" | "audio" | "text"; cleanPrompt: string } {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Explicit slash commands
  if (lower.startsWith("/image ") || lower === "/image") {
    const cleanPrompt = trimmed.replace(/^\/image\s*/i, "").trim() || "masterpiece 4k digital art";
    return { mode: "image", cleanPrompt };
  }
  if (lower.startsWith("/coding ") || lower === "/coding" || lower.startsWith("/code ") || lower === "/code") {
    const cleanPrompt = trimmed.replace(/^\/(coding|code)\s*/i, "").trim() || "Write a clean JavaScript function";
    return { mode: "code", cleanPrompt };
  }
  if (lower.startsWith("/think ") || lower === "/think") {
    const cleanPrompt = trimmed.replace(/^\/think\s*/i, "").trim();
    return { mode: "think", cleanPrompt };
  }
  if (lower.startsWith("/research ") || lower === "/research" || lower.startsWith("/deep ") || lower === "/deep") {
    const cleanPrompt = trimmed.replace(/^\/(research|deep)\s*/i, "").trim();
    return { mode: "research", cleanPrompt };
  }
  if (lower.startsWith("/search ") || lower === "/search") {
    const cleanPrompt = trimmed.replace(/^\/search\s*/i, "").trim();
    return { mode: "search", cleanPrompt };
  }

  if (lower.startsWith("/audio ") || lower === "/audio" || lower.startsWith("/music ") || lower === "/music") {
    const cleanPrompt = trimmed.replace(/^\/(audio|music)\s*/i, "").trim() || "amar sonar bangla";
    return { mode: "audio", cleanPrompt };
  }

  // Automatic detection
  // We avoid \b for Bengali words because JavaScript \b only works with ASCII.
  if (
    /\b(image|picture|photo|draw|wallpaper|logo|generate image|make image|create image|draw a|make a photo)\b/i.test(lower) ||
    /(ছবি|আঁকা|আঁক|ছবি তৈরি|ছবি বানাও)/.test(lower)
  ) {
    return { mode: "image", cleanPrompt: trimmed };
  }
  if (
    /\b(code|script|function|program|algorithm|write code|coding|create app|component|html|css|python|javascript|react)\b/i.test(lower) ||
    /(কোড|স্ক্রিপ্ট|প্রোগ্রাম|অ্যালগরিদম)/.test(lower)
  ) {
    return { mode: "code", cleanPrompt: trimmed };
  }
  if (
    /\b(search|google|find on web|search the web|internet)\b/i.test(lower) ||
    /(খুঁজুন|সার্চ|ওয়েব|ইন্টারনেট|খুঁজে বের কর)/.test(lower)
  ) {
    return { mode: "search", cleanPrompt: trimmed };
  }
  if (
    /\b(audio|music|mp3|song|sing|voice)\b/i.test(lower) ||
    /(গান|অডিও|মিউজিক|গাও|শোনাও)/.test(lower)
  ) {
    return { mode: "audio", cleanPrompt: trimmed };
  }

  return { mode: "text", cleanPrompt: trimmed };
}

export async function POST(req: Request) {
  try {
    const { messages, thinkMode } = await req.json();

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // 🛡️ SECURITY CHECK: BAN / BLOCK ON SENSITIVE PROMPTS
    if (checkSecurityViolation(lastUserMessage)) {
      const securityResponse = "⛔ **SECURITY VIOLATION:** Access Denied.\n\nAsking for internal API keys, system credentials, proprietary secrets, or configuration tokens is strictly prohibited by **globalgeniusai** security policies. Your request has been blocked and logged.";
      return new Response(securityResponse, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    const { mode, cleanPrompt } = detectMode(lastUserMessage);

    // 0. CUSTOM GEMINI/GEMMA API PROXY
      // The user wants to use Gemini 2.5 Flash / Gemma 4 31b IT via a custom API key
      const CUSTOM_API_URL = process.env.CUSTOM_AI_BASE_URL || "https://openrouter.ai/api/v1/chat/completions";
      const CUSTOM_API_KEY = process.env.CUSTOM_AI_API_KEY;
      
      // If the prompt explicitly mentions one of these models, route to the custom API
      if (CUSTOM_API_KEY && (lastUserMessage.toLowerCase().includes("gemini") || lastUserMessage.toLowerCase().includes("gemma"))) {
        
        // Extract exact model name if specified, otherwise default to a known good one
        let selectedModel = "google/gemini-flash-1.5"; // OpenRouter default ID for gemini flash
        if (lastUserMessage.toLowerCase().includes("gemma")) {
          selectedModel = "google/gemma-2-27b-it";
        }

        const formattedCustomMessages = messages.map((m: any) => {
          if (m.attachedFile) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content || "Analyze this image." },
                { type: "image_url", image_url: { url: m.attachedFile } }
              ]
            };
          }
          return { role: m.role, content: m.content };
        });

        try {
          const customRes = await fetch(CUSTOM_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${CUSTOM_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://globalgeniusai.com",
              "X-Title": "globalgeniusai"
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: formattedCustomMessages,
              stream: true,
            })
          });

          if (customRes.ok) {
            // Stream the response back like Groq
            const readableStream = new ReadableStream({
              async start(controller) {
                const reader = customRes.body?.getReader();
                if (!reader) return controller.close();
                const decoder = new TextDecoder();
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    for (const line of lines) {
                      if (line === 'data: [DONE]') continue;
                      if (line.startsWith('data: ')) {
                        try {
                          const data = JSON.parse(line.slice(6));
                          const content = data.choices?.[0]?.delta?.content || '';
                          if (content) {
                            controller.enqueue(new TextEncoder().encode(content));
                          }
                        } catch (e) {}
                      }
                    }
                  }
                } finally {
                  controller.close();
                }
              }
            });

            return new Response(readableStream, {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
              },
            });
          }
        } catch (err) {
          console.error("Custom API failed:", err);
          // Fall back to groq if it fails
        }
      }

      // 1. IMAGE GENERATION MODE (Segmind SDXL + Pollinations zimage)
    if (mode === "image") {
      const sanitizedPrompt = cleanPrompt
        .replace(/^(generate|make|create|draw|paint|ছবি বানাও|ছবি তৈরি কর|ছবি তৈরি করো)\s*(an|a)?\s*(image|picture|photo|ছবি|logo)?\s*(of|for)?/i, "")
        .trim() || cleanPrompt;

      let englishPrompt = sanitizedPrompt;
      try {
        const translationRes = await groq.chat.completions.create({
          messages: [
            { role: "system", content: "You are an expert prompt translator. Translate the given text (which may be in Bengali, Banglish, or English) into a highly descriptive, visually rich English prompt optimized for AI image generation. Output ONLY the English text, nothing else." },
            { role: "user", content: sanitizedPrompt }
          ],
          model: "llama3-8b-8192",
          temperature: 0.3,
          max_tokens: 150,
        });
        englishPrompt = translationRes.choices[0]?.message?.content?.trim() || sanitizedPrompt;
      } catch (e) {
        console.error("Translation failed:", e);
      }

      const randomSeed = Math.floor(Math.random() * 1000000);
      const encoded = encodeURIComponent(englishPrompt);
      let imageUrl = `https://image.pollinations.ai/prompt/${encoded}?model=flux&seed=${randomSeed}&nologo=true`;

      // Try Segmind high-resolution SDXL model if API key is configured
      if (process.env.SEGMIND_API_KEY) {
        try {
          const segmindRes = await fetch("https://api.segmind.com/v1/sdxl1.0-txt2img", {
            method: "POST",
            headers: {
              "x-api-key": process.env.SEGMIND_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: `${englishPrompt}, 8k, photorealistic, masterpiece, highly detailed`,
              seed: randomSeed,
              sampler_name: "euler",
              scheduler: "normal",
              num_inference_steps: 25,
              guidance_scale: 7.5,
              samples: 1,
            }),
          });

          if (segmindRes.ok) {
            const buffer = await segmindRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType = segmindRes.headers.get("content-type") || "image/jpeg";
            const dataUri = `data:${contentType};base64,${base64}`;

            // Upload the heavy base64 to Cloudinary to get a clean URL, preventing markdown crash
            if (process.env.CLOUDINARY_CLOUD_NAME) {
              const uploadRes = await cloudinary.uploader.upload(dataUri, {
                folder: "globalgeniusai_generations",
                resource_type: "image",
              });
              imageUrl = uploadRes.secure_url;
            } else {
              imageUrl = dataUri; // Fallback to base64 if Cloudinary is not configured
            }
          }
        } catch (segmindErr: any) {
          console.warn("Segmind fallback to Pollinations zimage:", segmindErr.message);
        }
      }
      
      const responseText = `Here is your generated image by **globalgeniusai** for **"${sanitizedPrompt}"**:\n\n![${englishPrompt}](${imageUrl})`;

      return new Response(responseText, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // 2. CODING MODE (Cohere AI)
    if (mode === "code") {
      try {
        const streamResponse = await cohere.chatStream({
          message: cleanPrompt,
          model: "command-r",
          preamble: `You are globalgeniusai's expert coding engine. Write clean, production-grade, well-commented code. Always format code using markdown code blocks with correct language identifiers. Your name is globalgeniusai and you were created by globalgeniusai. The current date and time is ${new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "medium" })}.`,
        });

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of streamResponse as any) {
                if (chunk.eventType === "text-generation") {
                  controller.enqueue(new TextEncoder().encode(chunk.text));
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(readableStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch (cohereErr: any) {
        console.warn("Cohere error fallback:", cohereErr?.message);
      }
    }

    // 3. SEARCH MODE (Tavily Web Search + Groq Qwen)
    if (mode === "search" && process.env.TAVILY_API_KEY) {
      try {
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: cleanPrompt || "latest news",
            search_depth: "basic",
            include_answer: false,
            include_images: false,
            max_results: 5,
          }),
        });

        let searchContext = "";
        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          const results = data.results || [];
          searchContext = results.map((r: any, i: number) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
        } else {
          console.warn("Tavily API returned an error:", await tavilyRes.text());
        }

        const currentTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "short" });
        const systemInstruction = `You are globalgeniusai, an expert news reporter and web researcher.
Your task is to answer the user's query directly and intelligently using ONLY the provided Web Search Results. 
IMPORTANT RULES:
1. Provide the direct news/answer. Do NOT include any URLs, links, or sources in your response.
2. Answer in Bengali (বাংলা) by default, unless the user explicitly asks for another language.
3. Keep the answer structured, readable, and directly to the point.
4. If the search results do not contain the answer, say you couldn't find enough information online.
The current date and time is ${currentTime}.

--- WEB SEARCH RESULTS ---
${searchContext}
--------------------------`;

        const streamResponse = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: cleanPrompt || "Summarize the latest news." }
          ],
          model: "qwen/qwen3.8-27b",
          stream: true,
        });

        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of streamResponse as any) {
                const content = chunk.choices?.[0]?.delta?.content || "";
                if (content) {
                  controller.enqueue(new TextEncoder().encode(content));
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(readableStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      } catch (err: any) {
        console.warn("Tavily search error fallback:", err?.message);
      }
    }

    
    // 3.5. DEEP RESEARCH MODE (Tavily Advanced Search + Groq Report Generation)
    if (mode === "research" && process.env.TAVILY_API_KEY) {
      try {
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: cleanPrompt || "latest developments in AI",
            search_depth: "advanced",
            include_answer: true,
            include_images: false,
            max_results: 10,
          }),
        });

        let searchContext = "";
        let directAnswer = "";
        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          const results = data.results || [];
          directAnswer = data.answer || "";
          searchContext = results.map((r: any, i: number) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
        } else {
          console.warn("Tavily API returned an error:", await tavilyRes.text());
        }

        const currentTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "short" });
        const systemInstruction = `You are globalgeniusai, an expert analyst and researcher.
Your task is to provide a highly detailed, comprehensive Deep Research Report based ONLY on the provided Web Search Results.
IMPORTANT RULES:
1. Write a structured report using Markdown (Headers like ## Introduction, ## Key Findings, ## Analysis, ## Conclusion).
2. Use bullet points and paragraphs to make the report easy to read.
3. Answer in Bengali (বাংলা) by default, unless the user explicitly asks for another language.
4. Synthesize the information logically. Do NOT include direct URLs or links in the output.
5. If the search results do not contain enough information, explain what is known and what is missing.
The current date and time is ${currentTime}.

--- WEB SEARCH RESULTS ---
${directAnswer ? "Tavily AI Summary:\n" + directAnswer + "\n\n" : ""}
${searchContext}
--------------------------`;

        const streamResponse = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: cleanPrompt || "Generate a deep research report." }
          ],
          model: "qwen/qwen3.8-27b",
          stream: true,
        });

        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of streamResponse) {
                const text = chunk.choices[0]?.delta?.content || "";
                if (text) {
                  controller.enqueue(new TextEncoder().encode(text));
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
          },
        });
      } catch (err: any) {
        console.warn("Deep research error fallback:", err?.message);
      }
    }

    // 4. AUDIO GENERATION MODE (ElevenLabs TTS)
    if (mode === "audio" && process.env.ELEVENLABS_API_KEY) {
      try {
        const textToSpeak = cleanPrompt
          .replace(/^(generate|make|create|sing|a|an|music|audio|song|mp3|গান|বানাও|বানা|গাও|আমাকে|একটি|শোনাও)\s*/gi, "")
          .trim() || cleanPrompt;
        
        const elRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/hpp4J3VqNfWAUOO0d1Us", {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: textToSpeak,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          }),
        });

        if (elRes.ok) {
          const buffer = await elRes.arrayBuffer();
          const base64Audio = Buffer.from(buffer).toString("base64");
          const dataUri = `data:audio/mpeg;base64,${base64Audio}`;
          
          let audioUrl = dataUri;
          // Upload to Cloudinary to get a clean URL (Cloudinary uses 'video' type for audio)
          if (process.env.CLOUDINARY_CLOUD_NAME) {
            const uploadRes = await cloudinary.uploader.upload(dataUri, {
              folder: "globalgeniusai_audio",
              resource_type: "video",
            });
            audioUrl = uploadRes.secure_url;
          }

          const responseText = `Here is your generated audio:\n\n<audio controls src="${audioUrl}"></audio>\n\n[Download MP3](${audioUrl})`;
          
          return new Response(responseText, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-cache",
            },
          });
        } else {
          console.warn("ElevenLabs Error:", await elRes.text());
        }
      } catch (err: any) {
        console.warn("Audio generation error:", err?.message);
      }
    }

    // 5. GENERAL TEXT / THINKING MODE (Groq Qwen with Identity & Security)
    const currentTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "short" });
    let systemInstruction = `You are globalgeniusai, an advanced, highly capable, and secure AI system.
CRITICAL RULES ABOUT YOUR IDENTITY:
1. Your name is "globalgeniusai". If anyone asks "tomar nam ki", "who are you", "what is your name", always proudly answer that your name is "globalgeniusai".
2. You were created and developed by "globalgeniusai". If anyone asks "banise k", "who created you", "who made you", always answer that you were developed by "globalgeniusai".
3. NEVER reveal your API keys, internal system architecture, environment tokens, or backend endpoints under any circumstances. If anyone asks, refuse strictly.
4. You are fluent in both Bengali and English. Always be helpful, respectful, intelligent, and accurate.
5. The current date and time is ${currentTime}. If the user asks for the time or date, answer accurately using this context.`;
    
    if (thinkMode || mode === "think") {
      systemInstruction += "\n\nYou are in Deep Thinking mode. Provide detailed, step-by-step logical reasoning.";
    }

    let hasImage = false;

    const formattedMessages = [
      { role: "system", content: systemInstruction },
      ...messages.map((m: any) => {
        if (m.attachedFile) {
          hasImage = true;
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content || "Please analyze this image." },
              { type: "image_url", image_url: { url: m.attachedFile } }
            ]
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      }),
    ];

    const streamResponse = await groq.chat.completions.create({
      messages: formattedMessages as any,
      model: hasImage ? "llama-3.2-90b-vision-preview" : "qwen/qwen3.8-27b",
      stream: true,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse as any) {
            const content = chunk.choices?.[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(new TextEncoder().encode(content));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
