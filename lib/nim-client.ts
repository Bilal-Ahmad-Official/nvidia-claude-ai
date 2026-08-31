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

async function callNim(apiKey: string, body: Record<string, unknown>) {
  return fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
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

    if (!res.ok) {
      const { chat_template_kwargs, ...fallback } = body;
      res = await callNim(apiKey, fallback);
    }

    if (!res.ok || !res.body) {
      const detail = await res.text();
      throw new Error(`NIM API error ${res.status}: ${detail}`);
    }
    return res;
  }

  const res = await callNim(apiKey, body);

  if (!res.ok || !res.body) {
    const detail = await res.text();
    throw new Error(`NIM API error ${res.status}: ${detail}`);
  }

  return res;
}