import { streamNimChat, type NimMessage, type ContentPart } from "@/lib/nim-client";
import { SYSTEM_PROMPT, DEEP_THINK_INSTRUCTION, VISION_MODEL } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const MAX_CONTINUATIONS = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

function friendlyError(status: number): string {
  switch (status) {
    case 400: return "Bad request — the model rejected the input.";
    case 401:
    case 403: return "API key invalid or unauthorized. Check your NVIDIA_API_KEY.";
    case 402: return "NVIDIA trial credits exhausted. Check build.nvidia.com.";
    case 404: return "Model not found — the model name may be wrong or deprecated.";
    case 408: return "Request timed out. Please try again.";
    case 429: return "Rate limit reached — wait a few seconds and try again.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "NVIDIA servers are busy or warming up. Tried multiple times — please try again in a moment.";
    case 599: return "Connection to NVIDIA failed. Retried multiple times — please try again.";
    default: return `Upstream error (HTTP ${status}).`;
  }
}

/**
 * ✅ FIXED: now catches THROWN errors (network failures, timeouts) too —
 * previously only HTTP statuses were retried, so a network hiccup
 * crashed straight through to "[stream interrupted]".
 */
async function streamNimChatWithRetry(
  messages: NimMessage[],
  model: string | undefined,
  opts: { deepThink: boolean }
): Promise<{ res: Response | null; status: number; errText: string }> {
  let lastStatus = 500;
  let lastErrText = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;

    // ✅ FIX: thrown errors (network, abort, DNS) are now caught + retried
    try {
      res = await streamNimChat(messages, model, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastStatus = 599; // internal code for "connection failed"
      lastErrText = msg;
      console.error(`[NIM] attempt ${attempt}/${MAX_ATTEMPTS} threw:`, msg);

      if (attempt === MAX_ATTEMPTS) {
        return { res: null, status: lastStatus, errText: msg };
      }
      await sleep(attempt * 1000);
      continue;
    }

    if (res.ok) {
      return { res, status: res.status, errText: "" };
    }

    const errText = await res.text().catch(() => "");
    lastStatus = res.status;
    lastErrText = errText;

    if (!RETRYABLE_STATUS.has(res.status)) {
      console.error(`[NIM] non-retryable error ${res.status}:`, errText);
      return { res: null, status: res.status, errText };
    }

    if (attempt === MAX_ATTEMPTS) {
      console.error(`[NIM] all ${MAX_ATTEMPTS} attempts failed (${res.status})`);
      return { res: null, status: res.status, errText };
    }

    console.warn(`[NIM] attempt ${attempt}/${MAX_ATTEMPTS} failed (${res.status}). Retrying…`);
    await sleep(attempt * 1000);
  }

  return { res: null, status: lastStatus, errText: lastErrText };
}

/**
 * Reads one upstream SSE stream. write() returns false when the client
 * has disconnected → we stop reading instead of crashing.
 */
async function pumpStream(
  upstream: Response,
  write: (text: string) => boolean,
  decoder: TextDecoder,
  stripper: ThinkStripper | null
): Promise<{ finishReason: string | null; rawText: string }> {
  const reader = upstream.body!.getReader();
  let sseBuffer = "";
  let finishReason: string | null = null;
  let rawText = "";

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
            choice?.delta?.content ?? choice?.delta?.reasoning_content ?? "";

          if (raw) rawText += raw;
          if (choice?.finish_reason) finishReason = choice.finish_reason;

          const clean = stripper ? stripper.push(raw) : raw;
          if (clean && !write(clean)) {
            // client gone — stop reading
            return { finishReason, rawText };
          }
        } catch {
          // skip malformed/partial lines
        }
      }
    }

    const rest = stripper ? stripper.flush() : "";
    if (rest) write(rest);
  } finally {
    reader.releaseLock();
  }

  return { finishReason, rawText };
}

export async function POST(req: Request) {
  try {
    const { messages, model, deepThink } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages array is required" }, { status: 400 });
    }

    const trimmedMessages = messages.slice(-12);

    const safeModel =
      typeof model === "string" && /^[\w./-]+$/.test(model) ? model : undefined;

    const wantsThink = deepThink === true;

    const baseMessages: NimMessage[] = [
      {
        role: "system",
        content: wantsThink
          ? `${SYSTEM_PROMPT}\n\n${DEEP_THINK_INSTRUCTION}`
          : SYSTEM_PROMPT,
      },
      ...trimmedMessages.map((m: { role: string; content: unknown }) => ({
        role: m.role,
        content: sanitizeContent(m.content),
      })),
    ];

    const hasImage = baseMessages.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((p: ContentPart) => p.type === "image_url")
    );
    const chosenModel = hasImage ? VISION_MODEL : safeModel;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stripper = wantsThink ? null : new ThinkStripper();

    const stream = new ReadableStream({
      async start(controller) {
        // ✅ FIX: track client disconnect so enqueue never throws
        let closed = false;
        const write = (text: string): boolean => {
          if (closed) return false;
          try {
            controller.enqueue(encoder.encode(text));
            return true;
          } catch {
            closed = true;
            return false;
          }
        };
        // If the user navigates away / presses stop, mark closed
        req.signal?.addEventListener("abort", () => { closed = true; });

        let currentMessages = baseMessages;
        let fullAnswer = "";

        try {
          for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
            let upstream: Response | null = null;
            let status = 0;
            let errText = "";

            if (round === 0) {
              ({ res: upstream, status, errText } =
                await streamNimChatWithRetry(currentMessages, chosenModel, {
                  deepThink: wantsThink,
                }));
            } else {
              // ✅ FIX: continuation errors no longer crash the stream —
              // the user just keeps the partial answer they already have
              try {
                upstream = await streamNimChat(
                  currentMessages,
                  chosenModel,
                  { deepThink: wantsThink }
                );
              } catch (contErr) {
                console.error("[NIM] continuation request failed:", contErr);
                break;
              }
            }

            if (!upstream || !upstream.ok || !upstream.body) {
              if (round === 0) {
                let detail = errText;
                try {
                  detail = JSON.parse(errText)?.detail ?? errText;
                } catch {}
                write(`⚠️ ${friendlyError(status)}${detail ? `\n\n${detail}` : ""}`);
              }
              break;
            }

            const { finishReason, rawText } = await pumpStream(
              upstream,
              write,
              decoder,
              stripper
            );

            fullAnswer += rawText;

            if (closed) break; // client disconnected — stop everything
            if (finishReason !== "length") break; // complete answer

            console.log(
              `[NIM] answer truncated (length). Auto-continuing (${round + 1}/${MAX_CONTINUATIONS})…`
            );

            currentMessages = [
              ...baseMessages,
              { role: "assistant", content: fullAnswer },
              {
                role: "user",
                content:
                  "Your previous answer was cut off. Continue EXACTLY where you left off — mid-sentence if needed. Do NOT repeat any part of your previous answer, do NOT add an introduction.",
              },
            ];
          }
        } catch (streamErr) {
          // Last-resort catch — now only for truly unexpected bugs
          console.error("[NIM] stream error:", streamErr);
          write("\n\n⚠️ Something went wrong while generating. Please try again.");
        } finally {
          try {
            if (!closed) controller.close();
          } catch {}
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
    console.error("[NIM] route error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}