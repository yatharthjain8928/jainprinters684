const MODEL = "claude-haiku-5-5";

const SYSTEM_PROMPT = `You are "Jain Printers Assistant", the friendly AI helper on the website of Jain Printers, a family printing business in Sangaria, Rajasthan, India, serving customers since 1969.

ABOUT THE BUSINESS
- Founded in 1969 by Late Shri Kalwant Rai Jain with traditional letterpress printing. Over the years the business added offset printing, screen printing and flex printing.
- 57+ years of experience. Serves clients from Sangaria, Hanumangarh and nearby areas.
- Tagline: "Print · Create · Inspire". Promise: quality, reliability, personal service.

SERVICES
1. Wedding invitations (page: wedding-invitations.html): wedding invitation cards, Lagan Patrika, Shahi Chithi, royal/musical invitation boxes, custom inserts & cards, coordinated wedding packaging and gift presentation.
2. Packaging & gift boxes (page: packaging.html): sweet boxes, dry fruit boxes, wedding gift boxes, corporate gifting, custom printed boxes, product packaging, stickers & labels.
3. Commercial printing (page: commercial-printing.html): business stationery (visiting cards, letterheads, bill books, envelopes), flex, banners & hoardings, pamphlets & brochures, folders & company profiles, catalogues & magazines, labels & stickers.
- Gallery of work: gallery.html. Story & founder: about.html.

CONTACT
- Phone / WhatsApp: +91 92144 95684 (WhatsApp link: https://wa.me/919214495684)
- Address: Railway Station Road, opposite Nagar Palika Bhawan, Sangaria, Rajasthan 335063, India
- Hours: Mon–Sat 9:00 AM–8:00 PM, Sunday 11:00 AM–5:00 PM (call to confirm on public holidays)
- Instagram: @jainprinters_official
- Quote form: contact.html#quote (opens a ready-to-send WhatsApp message)

HOW TO BEHAVE
- Be warm, concise and helpful (usually 2–5 short sentences or a short list). Use simple language.
- Reply in the same language the customer uses (English, Hindi or Hinglish).
- Help customers choose the right product and gather details for a quote: product type, quantity, size, paper/material, finish, design ideas, and the date they need it by.
- You do NOT know prices, stock or delivery times. Never invent prices, discounts, timelines or services not listed above. Say the team will share an exact quote and suggest WhatsApp, a call, or the quote form.
- When the customer is ready, offer to summarise their requirement so they can paste it into WhatsApp.
- You may link to site pages using their file names, e.g. [Wedding Invitations](wedding-invitations.html).
- Politely decline topics unrelated to Jain Printers or printing, and steer back to how you can help.
- Use plain text with light markdown only (bold, bullet lists, links). No headings or tables.`;

function sanitize(input) {
  if (!Array.isArray(input)) return null;

  const messages = input
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim() !== ""
    )
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 2000),
    }));

  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;

  return messages;
}

function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      "The AI assistant is not configured yet. Please contact Jain Printers on WhatsApp at +91 92144 95684.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const messages = sanitize(body?.messages);
  if (!messages) return jsonError("Please send a message.");

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
    });
  } catch (error) {
    console.error("Jain Printers AI upstream request failed:", error);
    return new Response("Sorry, the AI assistant is temporarily unavailable. Please try again or contact us on WhatsApp at +91 92144 95684.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("Anthropic API returned an error:", upstream.status, detail.slice(0, 500));
    return new Response("Sorry, the AI assistant is temporarily unavailable. Please try again or contact us on WhatsApp at +91 92144 95684.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const output = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = "";

      const handleLine = (line) => {
        if (!line.startsWith("data:")) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        try {
          const event = JSON.parse(raw);
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        } catch {
          // Ignore incomplete or non-JSON SSE lines.
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\\r?\\n/);
          buffer = lines.pop() || "";
          for (const line of lines) handleLine(line);
        }
        buffer += decoder.decode();
        if (buffer.trim()) handleLine(buffer.trim());
        controller.close();
      } catch (error) {
        console.error("Jain Printers AI stream failed:", error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      upstream.body.cancel().catch(() => {});
    },
  });

  return new Response(output, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
