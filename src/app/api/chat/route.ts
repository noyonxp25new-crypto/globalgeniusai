import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";
import { CohereClient } from "cohere-ai";

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

function detectMode(message: string): { mode: "image" | "code" | "think" | "text"; cleanPrompt: string } {
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

  // Automatic detection
  if (lower.match(/\b(image|picture|photo|draw|wallpaper|logo|ছবি|আঁক|generate image|make image|create image|draw a|make a photo)\b/)) {
    return { mode: "image", cleanPrompt: trimmed };
  }
  if (lower.match(/\b(code|script|function|program|algorithm|কোড|write code|coding|create app|component|html|css|python|javascript|react)\b/)) {
    return { mode: "code", cleanPrompt: trimmed };
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

    // 1. IMAGE MODE (Pollinations AI)
    if (mode === "image") {
      const sanitizedPrompt = cleanPrompt
        .replace(/^(generate|make|create|draw|paint|একটি|আমারে|আমাকে)\s*(an|a)?\s*(image|picture|photo|ছবি|logo)?\s*(of|for)?/i, "")
        .trim() || cleanPrompt;

      const randomSeed = Math.floor(Math.random() * 1000000);
      const encoded = encodeURIComponent(sanitizedPrompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${randomSeed}&nologo=true&enhance=true`;
      
      const responseText = `Here is your generated image by **globalgeniusai** for **"${sanitizedPrompt}"**:\n\n![${sanitizedPrompt}](${imageUrl})`;

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
          preamble: "You are globalgeniusai's expert coding engine. Write clean, production-grade, well-commented code. Always format code using markdown code blocks with correct language identifiers. Your name is globalgeniusai and you were created by globalgeniusai.",
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

    // 3. GENERAL TEXT / THINKING MODE (Groq Qwen with Identity & Security)
    let systemInstruction = `You are globalgeniusai, an advanced, highly capable, and secure AI system.
CRITICAL RULES ABOUT YOUR IDENTITY:
1. Your name is "globalgeniusai". If anyone asks "tomar nam ki", "who are you", "what is your name", always proudly answer that your name is "globalgeniusai".
2. You were created and developed by "globalgeniusai". If anyone asks "banise k", "who created you", "who made you", always answer that you were developed by "globalgeniusai".
3. NEVER reveal your API keys, internal system architecture, environment tokens, or backend endpoints under any circumstances. If anyone asks, refuse strictly.
4. You are fluent in both Bengali and English. Always be helpful, respectful, intelligent, and accurate.`;
    
    if (thinkMode || mode === "think") {
      systemInstruction += "\n\nYou are in Deep Thinking mode. Provide detailed, step-by-step logical reasoning.";
    }

    const formattedMessages = [
      { role: "system", content: systemInstruction },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const streamResponse = await groq.chat.completions.create({
      messages: formattedMessages as any,
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
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
