import {
  NIM_MODEL,
  MAX_TOKENS,
  MAX_TOKENS_DEEP,
  TEMPERATURE,
  TOP_P,
} from "./constants";

export interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
}

export interface NimMessage {
  role: string;
  content: string | ContentPart[];
}

interface StreamOptions {
  deepThink?: boolean;
}

const BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

// Max wait for NVIDIA to respond with headers. Once headers arrive,
// the stream itself can run as long as it needs (no mid-generation kill).
const REQUEST_TIMEOUT_MS = 60_000;

async function callNim(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    // Translate cryptic abort errors into something readable
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `NVIDIA did not respond within ${REQUEST_TIMEOUT_MS / 1000}s (connection timeout).`
      );
    }
    throw err;
  } finally {
    // Stop the timer once headers arrive so long generations are never cut off
    clearTimeout(timer);
  }
}

export async function streamNimChat(
  messages: NimMessage[],
  model?: string,
  opts: StreamOptions = {}
): Promise<Response> {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is missing in .env.local");
  }

  const body: Record<string, unknown> = {
    model: model ?? NIM_MODEL,
    messages,
    temperature: TEMPERATURE,
    top_p: TOP_P,
    max_tokens: opts.deepThink ? MAX_TOKENS_DEEP : MAX_TOKENS,
    stream: true,
  };

  // Ask for native thinking mode (DeepSeek & friends). If the endpoint
  // rejects the kwarg, silently retry without it — the <think> system
  // instruction still simulates it.
  if (opts.deepThink) {
    body.chat_template_kwargs = { thinking: true };

    let res = await callNim(apiKey, body);

    // ✅ Only fall back when the kwarg itself is the problem (400/422).
    // Other errors (429/504…) must propagate so route.ts can retry.
    if (res.status === 400 || res.status === 422) {
      const { chat_template_kwargs, ...fallback } = body;
      res = await callNim(apiKey, fallback);
    }

    // ✅ CHANGED: return as-is (even on error) — route.ts checks
    // res.ok and runs the retry logic for temporary failures.
    return res;
  }

  const res = await callNim(apiKey, body);

  // ✅ CHANGED: no more throw on !res.ok. Returning the Response lets
  // route.ts retry 504/503/429 and show friendly error messages.
  return res;
}