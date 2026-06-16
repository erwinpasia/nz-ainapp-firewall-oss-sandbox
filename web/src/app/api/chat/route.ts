// Copyright 2026 Erwin R. Pasia | SU.OSM AI (erwinpasia@gmail.com)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { NextResponse } from "next/server";

// Production-First Rigor: raise Next.js route function timeout to 120s so that
// Ollama model cold-starts (which can take 10-30s) don't get killed by the
// default 30s serverless function deadline.
export const maxDuration = 120;

// Inference timeout budget: 120 seconds aligns with the Rust/Python/JS/C/C++
// gateway timeout budget standardised during the timeout hardening sprint.
const INFERENCE_TIMEOUT_MS = 120_000;

export async function POST(request: Request) {
  // Create a per-request AbortController so we can enforce an explicit
  // INFERENCE_TIMEOUT_MS deadline. Without this, Node.js undici uses an
  // internal socket idle-timeout (~30s) that fires before Ollama finishes
  // loading the model, producing UND_ERR_SOCKET / 503 errors.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

  try {
    const { messages, model = process.env.NEXT_PUBLIC_DEFAULT_CHAT_MODEL || "nemotron-3-nano:4b" } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: "Invalid or missing messages array." }, { status: 400 });
    }

    const firewallAddr = process.env.AI_FIREWALL_ADDR || "127.0.0.1:11435";
    const targetUrl = `http://${firewallAddr}/api/chat`;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Production-First Rigor: force a fresh TCP connection for each inference
        // request. Undici's connection pool reuses idle sockets; on loopback LLM
        // proxying, these idle sockets are silently closed by the OS before
        // inference completes, producing UND_ERR_SOCKET. "Connection: close"
        // eliminates this race condition at the cost of one TCP handshake per
        // request — acceptable given inference latency is 5-120s.
        "Connection": "close",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      // Attach the abort signal — this is the critical fix for UND_ERR_SOCKET.
      // Node.js undici will now wait up to INFERENCE_TIMEOUT_MS before giving up.
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (response.status === 403) {
      // Structure the firewall blocking payload
      return NextResponse.json({
        blocked: true,
        status: data.status || "INJECTION",
        layer: data.layer || "L1 Regex",
        attack_type: data.attack_type || "PROMPT_INJECTION",
        score: data.score || null,
        message: data.message || "This request was identified as malicious and blocked by the AI Firewall.",
      }, { status: 403 });
    }

    if (!response.ok) {
      return NextResponse.json({
        error: data.error || `Proxy error: Received HTTP status ${response.status}`,
      }, { status: response.status });
    }

    return NextResponse.json({
      content: data.message?.content || "",
      raw: data,
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isTimeout = error?.name === "AbortError";
    console.error(`API Chat route error [${isTimeout ? "TIMEOUT" : "NETWORK"}]:`, error?.message ?? error);
    return NextResponse.json({
      error: isTimeout
        ? `Inference timed out after ${INFERENCE_TIMEOUT_MS / 1000}s. The model may still be loading — please retry.`
        : "Ollama proxy connection error. Ensure the AI Firewall and Ollama are active.",
    }, { status: 503 });
  }
}
