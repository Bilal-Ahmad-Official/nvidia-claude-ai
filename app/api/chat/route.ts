import { streamNimChat, type NimMessage, type ContentPart } from "@/lib/nim-client";
import { SYSTEM_PROMPT, DEEP_THINK_INSTRUCTION } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

// Add your vision model string here (or import VISION_MODEL from "@/lib/constants")
const VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";

/** Removes <think>…</think> blocks from a token stream (handles chunk splits) */
class ThinkStripper {
  private buffer = "";
  private insideThink = false;

  push(chunk: string): string {
    this.buffer += chunk;
    let out = "";

    while (this.buffer.length > 0) {
      if (!this.insideThink) {
        const i = this.buffer.indexOf(OPEN_TAG);
        if (i !== -1) {
          out += this.buffer.slice(0, i);
          this.buffer = this.buffer.slice(i + OPEN_TAG.length);
          this.insideThink = true;
        } else {
          const hold = Math.min(OPEN_TAG.length - 1, this.buffer.length);
          out += this.buffer.slice(0, this.buffer.length - hold);
          this.buffer = this.buffer.slice(this.buffer.length - hold);
          break;
        }
      } else {
        const j = this.buffer.indexOf(CLOSE_TAG);
        if (j !== -1) {
          this.buffer = this.buffer.slice(j + CLOSE_TAG.length);
          this.insideThink = false;
        } else {
          const hold = Math.min(CLOSE_TAG.length - 1, this.buffer.length);
          out += this.buffer.slice(0, this.buffer.length - hold);
          this.buffer = this.buffer.slice(this.buffer.length - hold);
          break;
        }
      }
    }
    return out;
  }

  flush(): string {
    return this.insideThink ? "" : this.buffer;
  }
}

function sanitizeContent(c: unknown): string | ContentPart[] {
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c
    .filter(
      (p) =>
        p &&
        typeof p === "object" &&
        (p.type === "text" || p.type === "image_url")
    )
    .map((p) =>
      p.type === "text"
        ? { type: "text", text: String(p.text ?? "") }
        : { type: "image_url", image_url: { url: String(p.image_url?.url ?? "") } }
    );
}

/** ✅ NEW: Map upstream HTTP status codes to friendly, human-readable messages */
function friendlyError(status: number): string {
  switch (status) {
    case 400:
      return "Bad request — the model rejected the input.";
    case 401:
    case 403:
      return "API key invalid or unauthorized. Check your NVIDIA_API_KEY.";
    case 402:
      return "NVIDIA trial credits exhausted. Check your balance at build.nvidia.com.";
    case 404:
      return "Model not found — the model name may be wrong or deprecated.";
    case 429:
      return "Rate limit reached — wait a few seconds and try again.";
    case 500:
    case 502:
    case 503:
      return "NVIDIA service is temporarily unavailable. Please try again shortly.";
    default:
      return `Upstream error (HTTP ${status}).`;
  }
}

export async function POST(req: Request) {
  try {
    const { messages, model, deepThink } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const safeModel =
      typeof model === "string" && /^[\w./-]+$/.test(model) ? model : undefined;

    const wantsThink = deepThink === true;

    const nimMessages: NimMessage[] = [
      {
        role: "system",
        content: wantsThink
          ? `${SYSTEM_PROMPT}\n\n${DEEP_THINK_INSTRUCTION}`
          : SYSTEM_PROMPT,
      },
      ...messages.map((m: { role: string; content: unknown }) => ({
        role: m.role,
        content: sanitizeContent(m.content),
      })),
    ];

    // Auto-route to the vision model when any image is present
    const hasImage = nimMessages.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((p: ContentPart) => p.type === "image_url")
    );
    const chosenModel = hasImage ? VISION_MODEL : safeModel;

    const upstream = await streamNimChat(nimMessages, chosenModel, {
      deepThink: wantsThink,
    });

    // ✅ FIX 1: Surface upstream HTTP errors instead of silently streaming nothing
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error(
        `[NIM] upstream error ${upstream.status}:`,
        errText || "(no body)"
      );

      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed?.detail ?? parsed?.message ?? errText;
      } catch {
        // body wasn't JSON — keep raw text
      }

      return Response.json(
        { error: friendlyError(upstream.status), detail },
        { status: upstream.status }
      );
    }

    // ✅ FIX 2: Guard against a missing response body
    if (!upstream.body) {
      return Response.json(
        { error: "Upstream returned an empty response body." },
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    // In DeepThink mode we PASS <think> blocks through so the client can
    // render the collapsible panel. Otherwise we strip them.
    const stripper = wantsThink ? null : new ThinkStripper();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        let sseBuffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;

              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;

              try {
                const json = JSON.parse(data);
                const choice = json.choices?.[0];
                const raw: string =
                  choice?.delta?.content ??
                  choice?.delta?.reasoning_content ??
                  "";
                const clean = stripper ? stripper.push(raw) : raw;
                if (clean) controller.enqueue(encoder.encode(clean));
              } catch {
                // skip malformed/partial lines
              }
            }
          }

          const rest = stripper ? stripper.flush() : "";
          if (rest) controller.enqueue(encoder.encode(rest));
        } catch (streamErr) {
          // ✅ FIX 3: Log stream errors so failures are visible in your terminal
          console.error("[NIM] stream read error:", streamErr);
          controller.enqueue(encoder.encode("\n\n⚠️ [stream interrupted]"));
        } finally {
          controller.close();
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    // ✅ FIX 4: Log route-level errors too
    console.error("[NIM] route error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}