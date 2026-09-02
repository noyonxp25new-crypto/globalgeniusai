import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { CohereClient } from "cohere-ai";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI } from "@google/genai";

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

function detectMode(message: string): { mode: "image" | "code" | "think" | "search" | "research" | "audio" | "study" | "canvas" | "video" | "text"; cleanPrompt: string } {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Explicit slash commands — also handle no-space like /imageবাঘ
  if (/^\/image(\s|$)/i.test(lower) || /^\/image[^a-z]/i.test(lower) || lower === "/image") {
    // Strip /image with or without space, including cases like /imageবাঘ
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

  if (lower.startsWith("/study ") || lower === "/study") {
    const cleanPrompt = trimmed.replace(/^\/study\s*/i, "").trim();
    return { mode: "study", cleanPrompt };
  }

  if (lower.startsWith("/canvas ") || lower === "/canvas") {
    const cleanPrompt = trimmed.replace(/^\/canvas\s*/i, "").trim();
    return { mode: "canvas", cleanPrompt };
  }

  if (lower.startsWith("/video ") || lower === "/video") {
    const cleanPrompt = trimmed.replace(/^\/video\s*/i, "").trim();
    return { mode: "video", cleanPrompt };
  }

  // Automatic detection
  // We avoid \b for Bengali words because JavaScript \b only works with ASCII.
  if (
    /\b(image|picture|pic|photo|draw|wallpaper|logo|generate image|make image|create image|draw a|make a photo)\b/i.test(lower) ||
    /(ছবি|আঁকা|আঁক|ছবি তৈরি|ছবি বানাও|chobi|choby|aka|akbo)/i.test(lower)
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
    /(খুঁজুন|সার্চ|ওয়েব|ইন্টারনেট|খুঁজে বের কর)/.test(lower) ||
    // Live data queries — currency, rates, prices, weather, scores, stocks
    /\b(usd|dollar|euro|gbp|bdt|taka|eur|jpy|exchange rate|currency rate|forex)\b/i.test(lower) ||
    /\b(rate|price|koto|কত|আজকে|ajke|today|current|live|latest|now|এখন)\b.*\b(taka|dollar|usd|bdt|gold|silver|oil|bitcoin|crypto)\b/i.test(lower) ||
    /\b(dollar|gold|silver|bitcoin|crypto|stock|share|petrol|fuel)\b.*\b(rate|price|koto|কত|today|ajke)\b/i.test(lower) ||
    /(ডলার|টাকা|রেট|মূল্য|আজকের|বিনিময়).*?(কত|রেট|দাম)/.test(lower) ||
    /(কত|রেট|দাম).*(ডলার|টাকা|সোনা|বিটকয়েন)/.test(lower) ||
    /\b(weather|আবহাওয়া|বৃষ্টি)\b/i.test(lower) ||
    /\b(score|result|খেলার|match|cricket|football)\b.*\b(today|ajke|এখন|live)\b/i.test(lower)
  ) {
    return { mode: "search", cleanPrompt: trimmed };
  }
  if (
    /\b(audio|music|mp3|song|sing|voice)\b/i.test(lower) ||
    /(গান|অডিও|মিউজিক|গাও|শোনাও)/.test(lower)
  ) {
    return { mode: "audio", cleanPrompt: trimmed };
  }

  if (
    /\b(video|animation|mp4|generate video|make video)\b/i.test(lower) ||
    /(ভিডিও|অ্যানিমেশন|ভিডিও বানাও)/.test(lower)
  ) {
    return { mode: "video", cleanPrompt: trimmed };
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


      // 1. IMAGE GENERATION MODE — fast Pollinations URL
    if (mode === "image") {
      // Strip /image prefix and other filler words
      let sanitizedPrompt = cleanPrompt
        .replace(/^\/image\s*/i, "")
        .replace(/^(generate|make|create|draw|paint|show|give me|ছবি বানাও|ছবি তৈরি কর|ছবি তৈরি করো)\s*(an|a)?\s*(image|picture|photo|ছবি|logo)?\s*(of|for)?/i, "")
        .replace(/(ছবি|আঁকো|আঁক|বানাও|তৈরি করো|তৈরি কর|দেখাও)\s*$/i, "") // strip trailing Bengali filler
        .trim() || cleanPrompt.replace(/^\/image\s*/i, "").trim() || "masterpiece digital art";

      // ── Bengali/Banglish → English keyword dictionary (animals, nature, objects) ──
      const bnDict: [RegExp, string][] = [
        // Animals
        [/বাঘ/g, "tiger"], [/সিংহ/g, "lion"], [/হাতি/g, "elephant"],
        [/ঘোড়া/g, "horse"], [/কুকুর/g, "dog"], [/বিড়াল/g, "cat"],
        [/পাখি/g, "bird"], [/মাছ/g, "fish"], [/সাপ/g, "snake"],
        [/বানর/g, "monkey"], [/ভালুক/g, "bear"], [/নেকড়ে/g, "wolf"],
        [/হরিণ/g, "deer"], [/খরগোশ/g, "rabbit"], [/ময়ূর/g, "peacock"],
        [/কাক/g, "crow"], [/ঈগল/g, "eagle"], [/হাঙর/g, "shark"],
        [/ডলফিন/g, "dolphin"], [/কুমির/g, "crocodile"], [/গরু/g, "cow"],
        [/ছাগল/g, "goat"], [/ভেড়া/g, "sheep"], [/শেয়াল/g, "fox"],
        // Nature
        [/ফুল/g, "flower"], [/গাছ/g, "tree"], [/নদী/g, "river"],
        [/সমুদ্র/g, "ocean"], [/পাহাড়/g, "mountain"], [/বন/g, "forest"],
        [/আকাশ/g, "sky"], [/চাঁদ/g, "moon"], [/সূর্য/g, "sun"],
        [/তারা/g, "stars"], [/মেঘ/g, "clouds"], [/বৃষ্টি/g, "rain"],
        [/ঝরনা/g, "waterfall"], [/হ্রদ/g, "lake"], [/মরুভূমি/g, "desert"],
        // Objects / Places
        [/শহর/g, "city"], [/গ্রাম/g, "village"], [/রাস্তা/g, "street"],
        [/ব্রিজ/g, "bridge"], [/মসজিদ/g, "mosque"], [/মন্দির/g, "temple"],
        [/প্রাসাদ/g, "palace"], [/জাহাজ/g, "ship"], [/বিমান/g, "airplane"],
        [/রকেট/g, "rocket"], [/রোবট/g, "robot"], [/দুর্গ/g, "castle"],
        // Banglish common
        [/\bbagh\b/gi, "tiger"], [/\bsher\b/gi, "lion"],
        [/\bpakhi\b/gi, "bird"], [/\bmach\b/gi, "fish"],
        [/\bnodi\b/gi, "river"], [/\bful\b/gi, "flower"],
        [/\bsomudro\b/gi, "ocean"], [/\bpahad\b/gi, "mountain"],
      ];

      // Apply dictionary substitutions
      let dictTranslated = sanitizedPrompt;
      for (const [pattern, replacement] of bnDict) {
        dictTranslated = dictTranslated.replace(pattern, replacement);
      }

      // Translate using Groq with few-shot examples for accuracy
      let englishPrompt = dictTranslated;
      try {
        const translationRes = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `You are an expert AI image prompt translator. Convert Bengali or Banglish text into a short, vivid English image generation prompt.

Examples:
- "বাঘের ছবি" → "a majestic tiger in the jungle"
- "সূর্যাস্তের সমুদ্র" → "beautiful ocean sunset with golden reflections"
- "মহাকাশ রকেট" → "rocket launching into outer space with stars"
- "লাল গোলাপ ফুল" → "beautiful red rose flower with dewdrops"
- "tiger in forest" → "a fierce tiger prowling through a dense green forest"

Output ONLY the English prompt, nothing else. Keep it under 20 words.`
            },
            { role: "user", content: dictTranslated }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.2,
          max_tokens: 60,
        });
        const translated = translationRes.choices[0]?.message?.content?.trim();
        if (translated && translated.length > 3 && /[a-zA-Z]/.test(translated)) {
          englishPrompt = translated;
        }
      } catch (e) {
        console.warn("Translation skipped:", e);
      }

      // Build Pollinations URL — fast and reliable
      const randomSeed = Math.floor(Math.random() * 9999999);
      const encoded = encodeURIComponent(
        `${englishPrompt}, ultra realistic, 4k, highly detailed, professional photography`
      );
      const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?model=flux&seed=${randomSeed}&width=1024&height=1024&nologo=true&enhance=true`;

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
            include_answer: true,
            include_images: false,
            max_results: 8,
          }),
        });

        let searchContext = "";
        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          const results = data.results || [];
          const directAnswer = data.answer ? `Direct Answer: ${data.answer}\n\n` : "";
          searchContext = directAnswer + results.map((r: any, i: number) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
        } else {
          console.warn("Tavily API returned an error:", await tavilyRes.text());
        }

        const currentTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "short" });
        const systemInstruction = `You are globalgeniusai, an expert researcher with access to real-time web data.
Your task is to answer the user's query using the provided Live Web Search Results.
IMPORTANT RULES:
1. If the query is about exchange rates, currency, prices, or any live data — extract the EXACT numbers from the search results and present them clearly.
2. Answer in Bengali (বাংলা) by default unless the user asks in English.
3. Be direct and concise. Present numbers prominently (e.g., "আজকের USD/BDT রেট: ১১০ টাকা").
4. Do NOT include any URLs or links in your response.
5. If you find conflicting rates, mention the range (e.g., buy rate vs sell rate).
6. The current date and time is ${currentTime}.

--- LIVE WEB SEARCH RESULTS ---
${searchContext}
--------------------------------`;

        // Groq-first for search (fast & reliable)
        let searchResponse: ReadableStream;
        try {
          const groqStream = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemInstruction }, { role: "user", content: cleanPrompt || "Search the web." }],
            model: "qwen/qwen3.8-27b",
            stream: true,
          });
          searchResponse = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of groqStream) {
                  const text = chunk.choices[0]?.delta?.content || "";
                  if (text) controller.enqueue(new TextEncoder().encode(text));
                }
                controller.close();
              } catch (err) { controller.error(err); }
            },
          });
        } catch (groqErr) {
          console.warn("Groq unavailable for search, falling back to Gemini");
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const geminiStream = await ai.models.generateContentStream({
              model: "gemini-flash-latest",
              contents: cleanPrompt || "Summarize the latest news.",
              config: { systemInstruction: systemInstruction }
            });
            searchResponse = new ReadableStream({
              async start(controller) {
                try {
                  for await (const chunk of geminiStream) {
                    if (chunk.text) controller.enqueue(new TextEncoder().encode(chunk.text));
                  }
                  controller.close();
                } catch (err) { controller.error(err); }
              },
            });
          } catch {
            searchResponse = new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("দুঃখিত, এই মুহূর্তে সার্চ সার্ভিস পাওয়া যাচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন।"));
                controller.close();
              }
            });
          }
        }

        return new Response(searchResponse, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache", "Connection": "keep-alive" },
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

        let deepResearchResponse: ReadableStream;
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const geminiStream = await ai.models.generateContentStream({
            model: "gemini-pro-latest",
            contents: cleanPrompt || "Generate a deep research report.",
            config: { systemInstruction: systemInstruction }
          });
          deepResearchResponse = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of geminiStream) {
                  if (chunk.text) controller.enqueue(new TextEncoder().encode(chunk.text));
                }
                controller.close();
              } catch (err) { controller.error(err); }
            },
          });
        } catch (geminiErr) {
          console.warn("Gemini unavailable for deep research, falling back to Groq");
          const groqStream = await groq.chat.completions.create({
            messages: [{ role: "system", content: systemInstruction }, { role: "user", content: cleanPrompt || "Generate a deep research report." }],
            model: "qwen/qwen3.8-27b",
            stream: true,
          });
          deepResearchResponse = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of groqStream) {
                  const text = chunk.choices[0]?.delta?.content || "";
                  if (text) controller.enqueue(new TextEncoder().encode(text));
                }
                controller.close();
              } catch (err) { controller.error(err); }
            },
          });
        }

        return new Response(deepResearchResponse, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
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

    // 4.5. VIDEO GENERATION MODE (Lightricks/LTX-Video)
    if (mode === "video") {
      try {
        const sanitizedPrompt = cleanPrompt.replace(/^(generate|make|create|video)\s*(a)?\s*(video|animation)?\s*(of|for)?/i, "").trim() || "A beautiful landscape";
        const hfToken = process.env.HUGGINGFACE_API_KEY;
        if (!hfToken) throw new Error("Hugging Face API key is missing");

        const videoRes = await fetch("https://api-inference.huggingface.co/models/Lightricks/LTX-Video", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: sanitizedPrompt }),
        });

        if (videoRes.ok) {
          const buffer = await videoRes.arrayBuffer();
          const base64Video = Buffer.from(buffer).toString("base64");
          const dataUri = `data:video/mp4;base64,${base64Video}`;
          let videoUrl = dataUri;
          if (process.env.CLOUDINARY_CLOUD_NAME) {
            const uploadRes = await cloudinary.uploader.upload(dataUri, {
              folder: "globalgeniusai_video",
              resource_type: "video",
            });
            videoUrl = uploadRes.secure_url;
          }
          const responseText = `Here is your generated video:\n\n<video controls loop autoplay src="${videoUrl}" className="w-full rounded-xl mt-4 shadow-lg"></video>\n\n[Download Video](${videoUrl})`;
          return new Response(responseText, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
          });
        } else {
          console.warn("LTX-Video Error:", await videoRes.text());
        }
      } catch (err: any) {
        console.warn("Video generation error:", err?.message);
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
5. The current date and time is ${currentTime}. If the user asks for the time or date, answer accurately using this context.
6. YOUR ADVANCED CAPABILITIES: You are a deeply integrated multimodal system. You can perfectly read files, analyze photos and pictures, generate high-quality images and video, browse the live internet, conduct deep academic-level research, generate lifelike audio/speech, write complex code and documents in a dedicated 'Canvas' editor, and tutor students in 'Study' mode. If a user asks what you can do, proudly list all of these advanced features!`;
    
    if (thinkMode || mode === "think") {
      systemInstruction += "\n\nYou are in Deep Thinking mode. Provide detailed, step-by-step logical reasoning.";
    }
    
    if (mode === "study") {
      systemInstruction += "\n\nYou are in Guided Learning (Study) mode. You are an expert tutor and guide. When the user asks a question, do NOT just give the direct answer. Break the concept down, explain it clearly step-by-step, use helpful analogies, and ask guiding questions to help the student figure it out themselves. Encourage critical thinking.";
    }

    if (mode === "canvas") {
      systemInstruction += "\n\nYou are in Canvas mode. The user wants you to write a comprehensive document, code, or article. You MUST output the ENTIRE main content wrapped perfectly inside <canvas_content> and </canvas_content> tags. Ensure the content inside the tags is comprehensive, complete, and formatted in Markdown. Outside the tags, you can provide a brief, friendly one-sentence intro or outro.";
    }

    const useHfCanvas = mode === "canvas" && process.env.HUGGINGFACE_API_KEY;
    const hfToken = process.env.HUGGINGFACE_API_KEY;

    if (useHfCanvas && hfToken) {
      const formattedMessages = [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content || "",
        })),
      ];

      const hfRes = await fetch("https://api-inference.huggingface.co/models/Qwen/Qwen2.5-Coder-32B-Instruct/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-Coder-32B-Instruct",
          messages: formattedMessages,
          stream: true,
          max_tokens: 4000,
        })
      });

      if (hfRes.ok && hfRes.body) {
        const reader = hfRes.body.getReader();
        const decoder = new TextDecoder();
        const readableStream = new ReadableStream({
          async start(controller) {
            try {
              let buffer = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                  if (line.startsWith("data: ") && line !== "data: [DONE]") {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      const content = parsed.choices?.[0]?.delta?.content || "";
                      if (content) {
                        controller.enqueue(new TextEncoder().encode(content));
                      }
                    } catch(e) {}
                  }
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          }
        });

        return new Response(readableStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    // Fetch image utility for Gemini
    async function fetchImageAsBase64(url: string) {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = res.headers.get("content-type") || "image/jpeg";
        return { data: buffer.toString("base64"), mimeType };
      } catch(e) {
        console.error("Failed to fetch image for Gemini:", e);
        return null;
      }
    }

    let hasImage = false;
    const geminiMessages = [];
    
    for (const m of messages) {
      const parts: any[] = [{ text: m.content || "" }];
      if (m.attachedFile) {
        hasImage = true;
        const inlineData = await fetchImageAsBase64(m.attachedFile);
        if (inlineData) {
          parts.push({ inlineData });
        }
      }
      geminiMessages.push({
        role: m.role === "assistant" ? "model" : "user",
        parts
      });
    }

    // STEP 1: Try Groq first (confirmed working, fast & reliable)
    try {
      const groqFormattedMessages = [
        { role: "system", content: systemInstruction },
        ...messages.map((m: any) => {
          if (m.attachedFile) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content || "Analyze this image." },
                { type: "image_url", image_url: { url: m.attachedFile } }
              ]
            };
          }
          return { role: m.role, content: m.content || "" };
        })
      ];

      const groqStream = await groq.chat.completions.create({
        messages: groqFormattedMessages as any,
        model: hasImage ? "llama-3.2-90b-vision-preview" : "qwen/qwen3.8-27b",
        stream: true,
      });

      const groqReadableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of groqStream) {
              const text = chunk.choices[0]?.delta?.content || "";
              if (text) controller.enqueue(new TextEncoder().encode(text));
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(groqReadableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (groqError: any) {
      console.warn("Groq failed, trying Gemini:", groqError?.message?.slice?.(0, 100));
    }

    // STEP 2: Fallback to Gemini if Groq fails
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const streamResponse = await ai.models.generateContentStream({
        model: hasImage ? "gemini-pro-latest" : "gemini-flash-latest",
        contents: geminiMessages,
        config: { systemInstruction: systemInstruction }
      });

      const geminiReadableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResponse) {
              if (chunk.text) controller.enqueue(new TextEncoder().encode(chunk.text));
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(geminiReadableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (geminiError: any) {
      console.warn("Both Groq and Gemini failed:", geminiError?.message?.slice?.(0, 100));
      throw new Error("All AI services are currently unavailable. Please try again in a moment.");
    }
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
