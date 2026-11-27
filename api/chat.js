import Anthropic from "@anthropic-ai/sdk";

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
    .filter((message) =>
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).send("The AI assistant is not configured yet. Please contact Jain Printers on WhatsApp at +91 92144 95684.");
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }

  const messages = sanitize(body?.messages);
  if (!messages) return res.status(400).json({ error: "Please send a message." });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("Jain Printers AI is missing ANTHROPIC_API_KEY in Vercel environment variables.");
    return res.status(503).send(
      "The Jain Printers AI Assistant is not connected to its AI service yet. The website administrator needs to add ANTHROPIC_API_KEY in Vercel Environment Variables and redeploy."
    );
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const stream = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        res.write(event.delta.text);
      }
    }
    return res.end();
  } catch (error) {
    console.error("Jain Printers chat error:", {
      status: error?.status ?? null,
      message: error?.message ?? String(error),
    });
    if (!res.headersSent) {
      res.status(502);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
    }
    return res.end("\n\nSorry, the AI assistant is temporarily unavailable. Please reach Jain Printers on WhatsApp at +91 92144 95684.");
  }
}
