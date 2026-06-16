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

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as dotenv from "dotenv";

import { normalizeText } from "./normalizer";
import { INJECTION_PATTERNS, ARCHETYPES, OUTPUT_SECRET_PATTERNS, INPUT_CREDENTIAL_PATTERNS } from "./patterns";

// Load dotenv from sandbox root and current dir
dotenv.config({ path: path.join(process.cwd(), "..", ".env.local") });
dotenv.config({ path: path.join(process.cwd(), "..", ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const AI_FIREWALL_ADDR = process.env.AI_FIREWALL_ADDR || "127.0.0.1:11435";
const OLLAMA_REAL_URL = process.env.OLLAMA_REAL_URL || "http://127.0.0.1:11434";
const AI_FIREWALL_LOG_URL = process.env.AI_FIREWALL_LOG_URL || "http://127.0.0.1:3001/api/events";
const AI_FIREWALL_SEMANTIC_THRESHOLD = parseFloat(process.env.AI_FIREWALL_SEMANTIC_THRESHOLD || "0.70");
const AI_FIREWALL_INSPECT_OUTPUT = (process.env.AI_FIREWALL_INSPECT_OUTPUT || "true").toLowerCase() === "true";
const AI_FIREWALL_BYPASS_SECRET = process.env.AI_FIREWALL_BYPASS_SECRET || "sentinel-internal-bypass-2024";

let ARCHETYPE_EMBEDDINGS: number[][] = [];

function httpPost(urlStr: string, jsonBody: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(jsonBody);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 60000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Status code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(postData);
    req.end();
  });
}

async function getEmbedding(text: string): Promise<number[]> {
  const data = await httpPost(`${OLLAMA_REAL_URL}/api/embed`, {
    model: "nomic-embed-text",
    input: text
  });
  if (data && data.embeddings && data.embeddings[0]) {
    return data.embeddings[0];
  }
  throw new Error("No embeddings in response");
}

async function cacheArchetypeEmbeddings() {
  console.log("[AI-FIREWALL] Initialising archetype embeddings via nomic-embed-text...");
  for (const arch of ARCHETYPES) {
    try {
      const emb = await getEmbedding(arch);
      ARCHETYPE_EMBEDDINGS.push(emb);
    } catch (e: any) {
      console.error(`[AI-FIREWALL] Failed to embed archetype '${arch}': ${e.message}`);
    }
  }
  console.log(`[AI-FIREWALL] ✅ ${ARCHETYPE_EMBEDDINGS.length} archetype embeddings cached.`);
}

async function logEvent(event: any) {
  let loggedLocally = false;
  if (AI_FIREWALL_LOG_URL) {
    try {
      await httpPost(AI_FIREWALL_LOG_URL, event);
    } catch (e: any) {
      console.error(`[AI-FIREWALL] Telemetry POST failed: ${e.message}. Spooling locally...`);
      loggedLocally = true;
    }
  } else {
    loggedLocally = true;
  }

  if (loggedLocally) {
    console.log("[AI-FIREWALL] Logging event locally to ai_firewall_events.jsonl...");
    try {
      const logFilePath = path.join(process.cwd(), "..", "ai_firewall_events.jsonl");
      fs.appendFileSync(logFilePath, JSON.stringify(event) + "\n", "utf-8");
    } catch (err: any) {
      console.error(`[AI-FIREWALL] Local logging failed: ${err.message}`);
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0.0;
  let dot = 0.0;
  let na = 0.0;
  let nb = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0.0 || nb === 0.0) return 0.0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function handleBlock(res: http.ServerResponse, reason: any, prompt: string, model: string) {
  const event = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    attack_type: reason.attack_type,
    layer_caught: reason.layer,
    similarity_score: reason.score || null,
    payload_excerpt: prompt.substring(0, 240),
    model_target: model,
    blocked: true
  };

  logEvent(event);

  let guardrailMsg = "";
  if (reason.layer === "semantic") {
    guardrailMsg = `Request blocked by AI Firewall (Semantic Guardrail: similarity ${reason.score.toFixed(3)})`;
  } else {
    guardrailMsg = `Request blocked by AI Firewall (Regex Guardrail: ${reason.attack_type})`;
  }

  const responseBody = JSON.stringify({
    error: guardrailMsg,
    layer_caught: reason.layer,
    attack_type: reason.attack_type
  });

  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(responseBody);
}

function handleBlockOutput(res: http.ServerResponse, reason: any, model: string) {
  const event = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    attack_type: reason.attack_type,
    layer_caught: reason.layer,
    similarity_score: null,
    payload_excerpt: "[OUTPUT SUPPRESSED — SECRET DETECTED]",
    model_target: model,
    blocked: true
  };

  logEvent(event);

  const responseBody = JSON.stringify({
    error: "AI Firewall — Output Secret Detected",
    layer_caught: "output_secret",
    attack_type: reason.attack_type,
    message: "Model output suppressed due to potential credential leakage."
  });

  res.writeHead(403, { "Content-Type": "application/json" });
  res.end(responseBody);
}

function extractPrompt(body: any, pathStr: string): string | null {
  if (pathStr.includes("/embed")) return null;
  if (body.prompt && typeof body.prompt === "string") {
    return body.prompt;
  }
  if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
    const last = body.messages[body.messages.length - 1];
    if (last && typeof last.content === "string") {
      return last.content;
    }
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = url.search;

  const bodyChunks: Buffer[] = [];
  req.on("data", (chunk) => { bodyChunks.push(chunk); });
  req.on("end", async () => {
    const bodyBytes = Buffer.concat(bodyChunks);
    let bodyJson: any = {};
    if (bodyBytes.length > 0) {
      try {
        bodyJson = JSON.parse(bodyBytes.toString("utf-8"));
      } catch (e) {}
    }

    const model = bodyJson.model || "unknown";

    // Bypass check
    let hasBypass = false;
    const bypassHeader = req.headers["x-sentinel-bypass"];
    if (AI_FIREWALL_BYPASS_SECRET && bypassHeader === AI_FIREWALL_BYPASS_SECRET) {
      hasBypass = true;
    }

    // Input Inspection
    if (!hasBypass) {
      const prompt = extractPrompt(bodyJson, pathname);
      if (prompt) {
        if (prompt.length > 8192) {
          return handleBlock(res, { attack_type: "CONTEXT_SIZE_OVERFLOW", layer: "boundary" }, prompt, model);
        }
        if (prompt.includes("</user_payload>") || prompt.includes("</instruction>")) {
          return handleBlock(res, { attack_type: "BOUNDARY_ESCAPE", layer: "boundary" }, prompt, model);
        }

        // L0 Normalizer
        const normalized = normalizeText(prompt);
        console.log(`[AI-FIREWALL-L0] Normalized: ${normalized.substring(0, 60)}...`);

        // L1 Regex patterns check
        for (const pattern of INJECTION_PATTERNS) {
          if (pattern.regex.test(normalized)) {
            console.log(`🚨 [AI-FIREWALL-L1] Injection blocked — pattern: ${pattern.name}`);
            return handleBlock(res, { attack_type: pattern.name, layer: "regex" }, prompt, model);
          }
        }

        // L1.5 Input Credential Exfiltration Check
        // Catches echo-back attacks: attacker embeds a real credential in the
        // prompt hoping the model will repeat it back verbatim.
        for (const pattern of INPUT_CREDENTIAL_PATTERNS) {
          if (pattern.regex.test(prompt)) {
            console.log(`🚨 [AI-FIREWALL-L1.5] Input credential detected — pattern: ${pattern.name}`);
            return handleBlock(res, { attack_type: pattern.name, layer: "output_secret" }, prompt, model);
          }
        }

        // L2 Semantic Check
        try {
          const embedding = await getEmbedding(prompt);
          let maxScore = 0.0;
          for (const archEmb of ARCHETYPE_EMBEDDINGS) {
            const score = cosineSimilarity(embedding, archEmb);
            if (score > maxScore) {
              maxScore = score;
            }
          }

          if (maxScore > AI_FIREWALL_SEMANTIC_THRESHOLD) {
            console.log(`🚨 [AI-FIREWALL-L2] Semantic injection blocked — similarity: ${maxScore.toFixed(3)}`);
            return handleBlock(res, { attack_type: "SEMANTIC_INJECTION", layer: "semantic", score: maxScore }, prompt, model);
          } else {
            console.log(`[AI-FIREWALL-L2] Clean — max similarity: ${maxScore.toFixed(3)}`);
          }
        } catch (e: any) {
          console.error(`[AI-FIREWALL] Semantic check skipped (Ollama embed unavailable): ${e.message}`);
        }
      }
    } else {
      console.log(`[AI-FIREWALL] 🔓 Internal Security Bypass active for request to ${pathname}`);
    }

    // Forward to Real Ollama
    const targetUrl = new URL(OLLAMA_REAL_URL + pathname + query);
    const forwardHeaders: Record<string, string> = {};
    for (const key of Object.keys(req.headers)) {
      if (
        key.toLowerCase() !== "host" &&
        key.toLowerCase() !== "content-length" &&
        key.toLowerCase() !== "accept-encoding" &&
        req.headers[key]
      ) {
        forwardHeaders[key] = req.headers[key] as string;
      }
    }

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...forwardHeaders,
        "content-length": bodyBytes.length
      },
      timeout: 120000
    };

    const forwardReq = http.request(options, (ollamaRes) => {
      const respChunks: Buffer[] = [];
      ollamaRes.on("data", (chunk) => { respChunks.push(chunk); });
      ollamaRes.on("end", () => {
        const respBytes = Buffer.concat(respChunks);
        const respText = respBytes.toString("utf-8");

        // L3 Output Check
        if (AI_FIREWALL_INSPECT_OUTPUT) {
          for (const pattern of OUTPUT_SECRET_PATTERNS) {
            if (pattern.regex.test(respText)) {
              console.log(`🚨 [AI-FIREWALL-L3] Output secret blocked — pattern: ${pattern.name}`);
              return handleBlockOutput(res, { attack_type: pattern.name, layer: "output_secret" }, model);
            }
          }
        }

        // Return clean response
        const headersToReturn: Record<string, string> = {};
        for (const key of Object.keys(ollamaRes.headers)) {
          if (
            key.toLowerCase() !== "content-length" &&
            key.toLowerCase() !== "content-encoding" &&
            key.toLowerCase() !== "transfer-encoding" &&
            ollamaRes.headers[key]
          ) {
            headersToReturn[key] = ollamaRes.headers[key] as string;
          }
        }
        res.writeHead(ollamaRes.statusCode || 200, headersToReturn);
        res.end(respBytes);
      });
    });

    forwardReq.on("error", (e) => {
      console.error(`[AI-FIREWALL] Forward failed: ${e.message}`);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Ollama unreachable" }));
    });

    forwardReq.write(bodyBytes);
    forwardReq.end();
  });
});

async function main() {
  let host = "127.0.0.1";
  let port = 11435;
  try {
    const parts = AI_FIREWALL_ADDR.split(":");
    host = parts[0];
    port = parseInt(parts[1], 10);
  } catch (e) {}

  // Warm archetype embeddings cache before accepting connections
  try {
    await cacheArchetypeEmbeddings();
  } catch (err: any) {
    console.error(`[AI-FIREWALL] Failed to cache archetype embeddings: ${err.message}`);
  }

  server.listen(port, host, () => {
    console.log(`[AI-FIREWALL] Node.js Gateway listening on http://${host}:${port}`);
  });
}

main().catch(err => {
  console.error("Failed to start Node.js proxy:", err);
  process.exit(1);
});
