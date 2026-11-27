const MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
const SYSTEM_PROMPT = "You are \"Jain Printers Assistant\", the friendly AI helper on the website of Jain Printers, a family printing business in Sangaria, Rajasthan, India, serving customers since 1969.\n\nABOUT THE BUSINESS\n- Founded in 1969 by Late Shri Kalwant Rai Jain with traditional letterpress printing. Over the years the business added offset printing, screen printing and flex printing.\n- 57+ years of experience. Serves clients from Sangaria, Hanumangarh and nearby areas.\n- Tagline: \"Print · Create · Inspire\". Promise: quality, reliability, personal service.\n\nSERVICES\n1. Wedding invitations (page: wedding-invitations.html): wedding invitation cards, Lagan Patrika, Shahi Chithi, royal/musical invitation boxes, custom inserts & cards, coordinated wedding packaging and gift presentation.\n2. Packaging & gift boxes (page: packaging.html): sweet boxes, dry fruit boxes, wedding gift boxes, corporate gifting, custom printed boxes, product packaging, stickers & labels.\n3. Commercial printing (page: commercial-printing.html): business stationery (visiting cards, letterheads, bill books, envelopes), flex, banners & hoardings, pamphlets & brochures, folders & company profiles, catalogues & magazines, labels & stickers.\n- Gallery of work: gallery.html. Story & founder: about.html.\n\nCONTACT\n- Phone / WhatsApp: +91 92144 95684 (WhatsApp link: https://wa.me/919214495684)\n- Address: Railway Station Road, opposite Nagar Palika Bhawan, Sangaria, Rajasthan 335063, India\n- Hours: Mon–Sat 9:00 AM–8:00 PM, Sunday 11:00 AM–5:00 PM (call to confirm on public holidays)\n- Instagram: @jainprinters_official\n- Quote form: contact.html#quote (opens a ready-to-send WhatsApp message)\n\nHOW TO BEHAVE\n- Be warm, concise and helpful (usually 2–5 short sentences or a short list). Use simple language.\n- Reply in the same language the customer uses (English, Hindi or Hinglish).\n- Help customers choose the right product and gather details for a quote: product type, quantity, size, paper/material, finish, design ideas, and the date they need it by.\n- You do NOT know prices, stock or delivery times. Never invent prices, discounts, timelines or services not listed above. Say the team will share an exact quote and suggest WhatsApp, a call, or the quote form.\n- When the customer is ready, offer to summarise their requirement so they can paste it into WhatsApp.\n- You may link to site pages using their file names, e.g. [Wedding Invitations](wedding-invitations.html).\n- Politely decline topics unrelated to Jain Printers or printing, and steer back to how you can help.\n- Use plain text with light markdown only (bold, bullet lists, links). No headings or tables.";

function sanitize(input) {
  if (!Array.isArray(input)) return null;
  const messages = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" && m.content.trim() !== "")
    .slice(-20)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 2000) }] }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) return null;
  }
  return messages;
}

function sendError(res, status, message) {
  res.status(status);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(message);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in Vercel environment variables.");
    return sendError(res, 503,
      "The Jain Printers AI Assistant is not configured yet. Please add GEMINI_API_KEY in Vercel Environment Variables and redeploy.");
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return sendError(res, 400, "Invalid JSON."); }
  }
  const contents = sanitize(body?.messages);
  if (!contents) return sendError(res, 400, "Please send a valid message.");

  let upstream = null;
  let lastStatus = 502;
  let lastDetail = "";
  let connected = false;

  // Use a lightweight free-tier model first; fall back to Gemini Flash
  // when Google reports temporary overload or the first model is unavailable.
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents,
              generationConfig: { maxOutputTokens: 700 }
            })
          }
        );

        if (response.ok && response.body) {
          upstream = response;
          connected = true;
          console.info("Jain Printers AI connected using model:", model);
          break;
        }

        lastStatus = response.status;
        lastDetail = await response.text().catch(() => "");
        console.warn("Gemini model attempt failed:", {
          model,
          status: lastStatus,
          detail: lastDetail.slice(0, 800)
        });

        // Invalid credentials affect every model; don't waste further requests.
        if (lastStatus === 401 || lastStatus === 403) {
          return sendError(res, 502,
            "The Gemini API key was not accepted. Please check GEMINI_API_KEY in Vercel and redeploy.");
        }

        // Quota may differ by model; try the fallback, but don't repeatedly hit the same quota.
        if (lastStatus === 429 || lastStatus === 404 || lastStatus < 500) break;

        // 5xx errors can be transient. Retry once, then move to the fallback model.
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        } else {
          break;
        }
      } catch (error) {
        lastStatus = 502;
        lastDetail = error?.message ?? String(error);
        console.warn("Gemini connection attempt failed:", { model, detail: lastDetail });
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
    }

    if (connected) break;
  }

  if (!connected || !upstream?.body) {
    console.error("All configured Gemini models failed:", {
      status: lastStatus,
      detail: lastDetail.slice(0, 1200)
    });

    if (lastStatus === 429) {
      return sendError(res, 429,
        "The Jain Printers AI Assistant has reached the current Gemini free-tier usage limit. Please try again later or contact us on WhatsApp at +91 92144 95684.");
    }
    if (lastStatus === 503 || lastStatus >= 500) {
      return sendError(res, 503,
        "Google Gemini is temporarily busy across the available free models. Please wait a little and try again, or contact Jain Printers on WhatsApp at +91 92144 95684.");
    }
    return sendError(res, 502,
      "The AI assistant is temporarily unavailable. Please try again or contact Jain Printers on WhatsApp at +91 92144 95684.");
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function processSseLine(line) {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const event = JSON.parse(data);
      const parts = event?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.text) res.write(part.text);
      }
    } catch (error) {
      console.error("Could not parse Gemini stream event:", error?.message ?? String(error));
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) processSseLine(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) processSseLine(buffer.trim());
    return res.end();
  } catch (error) {
    console.error("Gemini response stream error:", error?.message ?? String(error));
    if (!res.headersSent) return sendError(res, 502, "The AI response was interrupted. Please try again.");
    return res.end();
  } finally {
    reader.releaseLock();
  }
}
