-- Copyright 2026 Erwin R. Pasia | SU.OSM AI (erwinpasia@gmail.com)
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

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

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON ai_firewall_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_attack_type ON ai_firewall_events (attack_type);
