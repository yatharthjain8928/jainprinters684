import type { Config, Context } from "@netlify/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
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

type ChatMessage = { role: "user" | "assistant"; content: string };

function sanitize(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null;
  const msgs = input
    .filter(
      (m): m is ChatMessage =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== ""
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  if (url.pathname !== "/api/chat") return new Response("Not found", { status: 404 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messages = sanitize((body as { messages?: unknown })?.messages);
  if (!messages) return Response.json({ error: "Please send a message." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 700,
          system: SYSTEM_PROMPT,
          messages,
          stream: true,
        });
        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error("Chat error", err);
        controller.enqueue(
          encoder.encode(
            "\n\nSorry, I'm having trouble right now. Please reach Jain Printers on WhatsApp at +91 92144 95684."
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
};

export const config: Config = { path: "/api/chat" };
