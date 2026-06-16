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
import fs from "fs";
import path from "path";
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool | null {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
  }
  return pool;
}

let tableEnsured = false;
async function ensureTableExists(dbPool: Pool) {
  if (tableEnsured) return;
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS ai_firewall_events (
        id UUID PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        attack_type VARCHAR(100) NOT NULL,
        layer_caught VARCHAR(50) NOT NULL,
        similarity_score DOUBLE PRECISION,
        payload_excerpt TEXT NOT NULL,
        model_target VARCHAR(100) NOT NULL,
        blocked BOOLEAN NOT NULL
    );
  `);
  await dbPool.query(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON ai_firewall_events (timestamp DESC);`);
  await dbPool.query(`CREATE INDEX IF NOT EXISTS idx_events_attack_type ON ai_firewall_events (attack_type);`);
  tableEnsured = true;
}

export async function POST(req: Request) {
  try {
    const event = await req.json();
    const dbPool = getPool();
    
    if (dbPool) {
      await ensureTableExists(dbPool);
      await dbPool.query(
        `INSERT INTO ai_firewall_events (id, timestamp, attack_type, layer_caught, similarity_score, payload_excerpt, model_target, blocked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          event.id,
          event.timestamp,
          event.attack_type,
          event.layer_caught,
          event.similarity_score,
          event.payload_excerpt,
          event.model_target,
          event.blocked,
        ]
      );
      return NextResponse.json({ status: "success" });
    }
    
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (error: any) {
    console.error("API Events POST error:", error);
    return NextResponse.json({ error: error.message || "Failed to log event." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const dbPool = getPool();
    if (dbPool) {
      await ensureTableExists(dbPool);
      const res = await dbPool.query(
        `SELECT * FROM ai_firewall_events ORDER BY timestamp DESC`
      );
      return NextResponse.json(res.rows);
    }
  } catch (error) {
    console.warn("PostgreSQL fetch failed, falling back to local file:", error);
  }

  // Fallback: Read local jsonl file in the sandbox root directory
  try {
    const filePath = path.join(process.cwd(), "..", "ai_firewall_events.jsonl");

    if (!fs.existsSync(filePath)) {
      return NextResponse.json([]);
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n");
    const events = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          events.push(JSON.parse(line));
        } catch (e) {
          console.error("Failed to parse event line:", e);
        }
      }
    }

    // Sort events by timestamp desc
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(events);
  } catch (err: any) {
    console.error("API Events GET fallback error:", err);
    return NextResponse.json({ error: "Failed to read firewall events." }, { status: 500 });
  }
}
