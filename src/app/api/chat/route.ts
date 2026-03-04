// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { FUZE_KNOWLEDGE } from "@/lib/fuze-knowledge";

// ─── OpenAI Chat Completion ─────────────────────────
async function callOpenAI(messages: any[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.4,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
}

// ─── Anthropic Chat Completion (fallback) ─────────────────────────
async function callAnthropic(messages: any[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  // Convert OpenAI message format to Anthropic format
  const systemMsg = messages.find((m: any) => m.role === "system")?.content || "";
  const userMessages = messages.filter((m: any) => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      system: systemMsg,
      messages: userMessages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.content[0]?.text || "I'm sorry, I couldn't generate a response.";
}

// ─── System Prompt ─────────────────────────
const SYSTEM_PROMPT = `You are FUZE AI, the official product assistant for FUZE Biotech's antimicrobial textile technology. You help brands, factories, and partners understand FUZE products, testing, pricing, safety, and application processes.

RULES:
- Answer ONLY based on the knowledge base provided below. Do not make up information.
- If you don't know the answer, say "I don't have that specific information, but I'd recommend contacting your FUZE sales representative for details."
- Be professional, friendly, and concise. Keep answers focused and under 200 words unless a detailed explanation is needed.
- When discussing pricing, always mention that exact quotes depend on fabric specifications and volume.
- When discussing safety, reference specific certifications (OEKO-TEX, bluesign, EPA).
- You may suggest relevant pages in the FUZE Atlas platform when appropriate (e.g., "You can check your test results in the Test Results section of your brand portal").
- Format responses with markdown when helpful (bold for emphasis, bullet points for lists).
- Never discuss competitors negatively. If asked to compare, focus on FUZE's strengths.
- If asked about something outside of FUZE products/textiles, politely redirect: "I'm specialized in FUZE antimicrobial technology. For other topics, I'd suggest reaching out to the appropriate team."

KNOWLEDGE BASE:
${FUZE_KNOWLEDGE}`;

// ─── POST /api/chat ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, history = [] } = await req.json();

    if (!messages || typeof messages !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Build conversation history (last 10 messages for context)
    const conversationHistory = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-10).map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: messages },
    ];

    let reply: string;

    // Try OpenAI first, fall back to Anthropic
    try {
      reply = await callOpenAI(conversationHistory);
    } catch (openaiErr) {
      console.warn("OpenAI failed, trying Anthropic:", openaiErr);
      try {
        reply = await callAnthropic(conversationHistory);
      } catch (anthropicErr) {
        console.error("Both AI providers failed:", anthropicErr);
        // Final fallback: pattern matching
        reply = getFallbackResponse(messages);
      }
    }

    return NextResponse.json({ reply, provider: "ai" });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

// ─── Fallback Pattern Matching (if both APIs fail) ─────────────────────────
function getFallbackResponse(message: string): string {
  const q = message.toLowerCase();

  if (q.includes("safe") || q.includes("toxic") || q.includes("oeko") || q.includes("bluesign")) {
    return "FUZE is certified safe through multiple standards: **OEKO-TEX Standard 100 Class I** (safe for baby products), **bluesign® approved**, and **EPA registered**. It's non-toxic, non-irritating, and contains no formaldehyde or harmful heavy metals. It's safe for direct skin contact, including sensitive skin and infant applications.";
  }
  if (q.includes("tier") || q.includes("f1") || q.includes("f2") || q.includes("f3") || q.includes("f4") || q.includes("level")) {
    return "FUZE offers four tiers:\n- **F1 — Full Spectrum**: 1.0 mg/kg, 100 washes\n- **F2 — Advanced**: 0.75 mg/kg, 75 washes\n- **F3 — Core**: 0.5 mg/kg, 50 washes\n- **F4 — Foundation**: 0.25 mg/kg, 25 washes\n\nThe right tier depends on your product's durability requirements and wash expectations.";
  }
  if (q.includes("price") || q.includes("cost") || q.includes("how much")) {
    return "FUZE pricing depends on your fabric specifications (GSM, width) and the tier selected. Typical treatment costs range from **$0.02–$0.15 per linear meter**. The base stock solution is $36/liter, with volume discounts available. For an accurate quote, I recommend using the Cost Calculator in your brand portal or contacting your FUZE sales representative.";
  }
  if (q.includes("wash") || q.includes("durability") || q.includes("last")) {
    return "FUZE treatment durability depends on the tier: F1 lasts 100 washes, F2 lasts 75, F3 lasts 50, and F4 lasts 25 — all tested at 60°C standard laundering. The treatment bonds to the fiber structure and does not wash out under normal conditions.";
  }
  if (q.includes("test") || q.includes("aatcc") || q.includes("iso")) {
    return "FUZE undergoes rigorous testing including **AATCC 100** (antibacterial), **AATCC 30** (antifungal), **ISO 20743** (antibacterial activity), and **ISO 18184** (antiviral, select tiers). All test reports are available in your brand portal under Test Results.";
  }
  if (q.includes("apply") || q.includes("factory") || q.includes("process") || q.includes("how")) {
    return "FUZE can be applied through three methods: **exhaust method** (in dye bath), **pad-dry-cure** (padder application), or **spray** (for specialized substrates). Standard textile finishing equipment works — no special machinery needed. The treatment requires curing at 150–170°C for 2–3 minutes.";
  }
  if (q.includes("pfas") || q.includes("environment") || q.includes("sustain") || q.includes("green")) {
    return "FUZE is completely **PFAS-free** and has a low environmental impact. Silver concentrations in wastewater are well below regulatory limits. The treatment extends garment life (reducing textile waste), doesn't affect recyclability, and supports ESG goals aligned with SDG 3 and SDG 12.";
  }
  if (q.includes("start") || q.includes("begin") || q.includes("onboard") || q.includes("get going")) {
    return "Getting started with FUZE is straightforward:\n1. **Consultation** — We discuss your fabric types and requirements\n2. **Sampling** — Treatment at a partner factory (2-4 weeks)\n3. **Testing** — Lab validation of treated samples (1-2 weeks)\n4. **Approval** — Review results and confirm production specs\n5. **Production** — Full-scale treatment begins\n\nYour FUZE sales representative can kick this off, or you can submit fabric specs through the brand portal.";
  }
  if (q.includes("nano") || q.includes("silver")) {
    return "FUZE uses **conventional silver-based technology**, not nanosilver. The active ingredient is a silver salt compound that is EPA registered and classified as a conventional antimicrobial. It's safe, proven, and well-characterized.";
  }
  if (q.includes("virus") || q.includes("antiviral") || q.includes("covid")) {
    return "FUZE has demonstrated antiviral efficacy per **ISO 18184** testing on select tiers (F1 and F2). For specific pathogen test data, please contact your FUZE sales representative.";
  }
  if (q.includes("hello") || q.includes("hi") || q.includes("hey")) {
    return "Hello! I'm FUZE AI, your antimicrobial product assistant. I can help with questions about FUZE tiers, pricing, testing, safety certifications, application processes, and more. What would you like to know?";
  }

  return "That's a great question! I'd recommend reaching out to your FUZE sales representative for the most detailed answer. In the meantime, I can help with questions about FUZE tiers, pricing, testing standards, safety certifications, application processes, and sustainability. What would you like to know more about?";
}
