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

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ShieldAlert, 
  ArrowLeft, 
  MessageSquare, 
  Clock, 
  RefreshCw, 
  Activity, 
  Server, 
  Database,
  Search,
  Eye,
  AlertTriangle
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface FirewallEvent {
  id: string;
  timestamp: string;
  attack_type: string;
  layer_caught: string;
  similarity_score: number | null;
  payload_excerpt: string;
  model_target: string;
  blocked: boolean;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<FirewallEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<FirewallEvent | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    if (!autoRefresh) return;
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Derived Metrics
  const totalBlocks = events.length;
  const regexBlocks = events.filter(e => e.layer_caught === "regex").length;
  const semanticBlocks = events.filter(e => e.layer_caught === "semantic").length;
  const outputBlocks = events.filter(e => e.layer_caught === "output_secret" || e.layer_caught === "output").length;

  // Search filter
  const filteredEvents = events.filter(e => 
    e.attack_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.layer_caught.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.payload_excerpt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Recharts: Timeline Calculations (Last 7 days or hour-by-hour depending on data)
  const getTimelineData = () => {
    if (events.length === 0) {
      return Array.from({ length: 7 }, (_, i) => ({
        time: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        blocks: 0
      }));
    }

    const counts: Record<string, number> = {};
    events.forEach(e => {
      const dateStr = new Date(e.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    // Sort chronologically and take last 7 days
    const dates = Object.keys(counts).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return dates.map(d => ({
      time: d,
      blocks: counts[d]
    }));
  };

  // Recharts: Distribution Calculations
  const getDistributionData = () => {
    const counts: Record<string, number> = {};
    events.forEach(e => {
      counts[e.attack_type] = (counts[e.attack_type] || 0) + 1;
    });

    const COLORS = ["#ff3366", "#00f0ff", "#ffbb28", "#8884d8", "#00C49F", "#FF8042"];
    return Object.keys(counts).map((key, idx) => ({
      name: key,
      value: counts[key],
      color: COLORS[idx % COLORS.length]
    }));
  };

  const timelineData = getTimelineData();
  const distributionData = getDistributionData();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background">
      {/* Header */}
      <header className="glass-card border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-accent animate-pulse" />
            </div>
            <div>
              <h1 className="font-headline font-bold text-sm tracking-tight text-white leading-none">Threat Analytics</h1>
              <p className="text-[9px] text-primary font-bold uppercase tracking-wider mt-1">Live Firewall Diagnostics</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${autoRefresh ? 'bg-green-400' : 'bg-slate-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${autoRefresh ? 'bg-green-500' : 'bg-slate-500'}`}></span>
            </span>
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-[10px] font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
            >
              {autoRefresh ? "Auto-Refresh: Active" : "Auto-Refresh: Paused"}
            </button>
          </div>

          <button 
            onClick={fetchEvents}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Link href="/chat" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-mono text-[10px] uppercase tracking-wider transition-all">
            <MessageSquare className="w-3.5 h-3.5" />
            Chat Playground
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Intercepts", val: totalBlocks, desc: "Total blocked payloads", color: "text-primary border-primary/15", icon: ShieldAlert },
            { label: "L1 Pattern Matches", val: regexBlocks, desc: "Fast-path regular expression catches", color: "text-accent border-accent/15", icon: Activity },
            { label: "L2 Semantic Catches", val: semanticBlocks, desc: "Cosine similarity vector blocks", color: "text-amber-400 border-amber-400/15", icon: Server },
            { label: "L3 Leakage Blocks", val: outputBlocks, desc: "Prevented credential & token leaks", color: "text-blue-400 border-blue-400/15", icon: Database }
          ].map((card, idx) => (
            <div key={idx} className={`glass-card rounded-2xl p-6 border-l-4 ${card.color} flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-[10px] font-headline font-bold text-slate-500 uppercase tracking-widest">{card.label}</span>
                <p className="text-3xl font-headline font-black text-white">{card.val}</p>
                <p className="text-[10px] text-slate-400 leading-normal max-w-[180px]">{card.desc}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl text-slate-400">
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Timeline Chart */}
          <div className="lg:col-span-8 glass-card rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="font-headline font-bold text-xs uppercase tracking-widest text-slate-300">Threat Timeline</h3>
                <p className="text-[10px] text-slate-500 mt-1">Timeline analysis of security events</p>
              </div>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>

            <div className="h-64 w-full">
              {totalBlocks === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                  No telemetry events collected yet. Run tests in the playground.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="colorBlocks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff3366" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ff3366" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={9} tickLine={false} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "rgba(7, 10, 19, 0.9)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: "8px", fontSize: "10px" }}
                      labelClassName="text-slate-500"
                    />
                    <Area type="monotone" dataKey="blocks" stroke="#ff3366" strokeWidth={2} fillOpacity={1} fill="url(#colorBlocks)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Classification Breakdown Chart */}
          <div className="lg:col-span-4 glass-card rounded-2xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="font-headline font-bold text-xs uppercase tracking-widest text-slate-300">Attack Classification</h3>
                <p className="text-[10px] text-slate-500 mt-1">Breakdown by threat categories</p>
              </div>
              <Activity className="w-4 h-4 text-slate-500" />
            </div>

            <div className="h-48 flex items-center justify-center relative">
              {totalBlocks === 0 ? (
                <div className="text-xs text-slate-500 font-mono">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "rgba(7, 10, 19, 0.9)", borderColor: "rgba(255, 255, 255, 0.08)", borderRadius: "8px", fontSize: "10px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend */}
            <div className="space-y-2 mt-4 max-h-24 overflow-y-auto pr-1">
              {distributionData.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-300 truncate max-w-[150px]">{entry.name}</span>
                  </div>
                  <span className="text-slate-500 font-bold">{entry.value} ({Math.round(entry.value / totalBlocks * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Threat Log */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
            <div>
              <h3 className="font-headline font-bold text-xs uppercase tracking-widest text-slate-300">Live Intercept Feed</h3>
              <p className="text-[10px] text-slate-500 mt-1">Real-time listing of blocked payloads</p>
            </div>

            <div className="relative w-full sm:w-64">
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search threat events..."
                className="w-full bg-black/40 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary/50"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                {searchTerm ? "No results match your search query." : "Zero threat vectors intercepted yet."}
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[10px] font-mono">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold">Attack Family</th>
                    <th className="pb-3 font-semibold">Detection Layer</th>
                    <th className="pb-3 font-semibold">Similarity</th>
                    <th className="pb-3 font-semibold">Payload Snippet</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredEvents.slice(0, 100).map((event) => (
                    <tr key={event.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3.5 text-slate-400">{new Date(event.timestamp).toLocaleString()}</td>
                      <td className="py-3.5">
                        <span className="text-primary font-bold">{event.attack_type}</span>
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full border uppercase text-[8px] ${
                          event.layer_caught === 'regex' ? 'border-accent/20 bg-accent/5 text-accent' :
                          event.layer_caught === 'semantic' ? 'border-amber-500/20 bg-amber-500/5 text-amber-400' :
                          'border-blue-500/20 bg-blue-500/5 text-blue-400'
                        }`}>
                          {event.layer_caught}
                        </span>
                      </td>
                      <td className="py-3.5 text-slate-300">
                        {event.similarity_score !== null ? event.similarity_score.toFixed(3) : "—"}
                      </td>
                      <td className="py-3.5 text-slate-500 max-w-xs truncate">{event.payload_excerpt}</td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white transition-all inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3 h-3" /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Modal for detailed inspection */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card max-w-2xl w-full rounded-2xl overflow-hidden border border-white/10"
            >
              <div className="p-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  <span className="font-headline font-bold text-xs uppercase tracking-widest text-white">Threat Investigation Logs</span>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="text-slate-500 hover:text-slate-300 transition-colors text-xs font-mono"
                >
                  [Close]
                </button>
              </div>

              <div className="p-6 space-y-6 text-xs font-mono">
                <div className="grid grid-cols-2 gap-4 bg-black/40 border border-white/5 rounded-xl p-4">
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block mb-1">Event UUID</span>
                    <span className="text-slate-300 font-bold select-all">{selectedEvent.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block mb-1">Timestamp</span>
                    <span className="text-slate-300">{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block mb-1">Interception Layer</span>
                    <span className="text-slate-300 font-bold uppercase">{selectedEvent.layer_caught}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider block mb-1">Pattern/Signature ID</span>
                    <span className="text-primary font-bold uppercase">{selectedEvent.attack_type}</span>
                  </div>
                  {selectedEvent.similarity_score !== null && (
                    <div className="col-span-2 border-t border-white/5 pt-3">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider block mb-1">Cosine Distance Score</span>
                      <span className="text-amber-400 font-bold">{selectedEvent.similarity_score.toFixed(4)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider block">Blocked Prompt Payload</span>
                  <div className="p-4 bg-black/40 border border-white/5 rounded-xl text-slate-300 break-words max-h-48 overflow-y-auto select-all leading-relaxed whitespace-pre-wrap">
                    {selectedEvent.payload_excerpt}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between border-t border-white/5 py-6 px-6 text-[10px] font-mono text-slate-600 gap-4">
        <div>
          Copyright &copy; 2026 Erwin R. Pasia | SU.OSM AI. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <span>Ollama Target: localhost:11434</span>
        </div>
      </footer>
    </div>
  );
}
