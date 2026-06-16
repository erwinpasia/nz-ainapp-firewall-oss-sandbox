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

import Link from "next/link";
import { ShieldAlert, ShieldCheck, MessageSquare, LayoutDashboard, Terminal, Zap, Cpu } from "lucide-react";
import { motion } from "framer-motion";

export default function LaunchpadPage() {
  return (
    <main className="min-h-screen flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background design elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 blur-3xl rounded-full -ml-20 -mb-20 pointer-events-none" />

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-headline font-bold text-sm tracking-widest uppercase text-white leading-none">SU.OSM AI</h1>
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          v0.1.0-OSS
        </div>
      </header>

      {/* Hero Content */}
      <section className="max-w-4xl w-full mx-auto my-auto py-12 text-center z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase text-primary tracking-widest mb-4">
            <Zap className="w-3.5 h-3.5" />
            Production-First AI Security (OSS Version)
          </div>
          <h2 className="text-4xl sm:text-6xl font-headline font-black text-white tracking-tight uppercase leading-none">
            NZ AINAPP Firewall <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">OSS Sandbox</span>
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
            An open-source, high-durability transparent proxy designed to intercept, analyze, and block prompt injections, jailbreaks, and sensitive data leakage.
          </p>
        </motion.div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mt-12">
          {/* Card 1: Chat Playground */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <Link
              href="/chat"
              className="group flex flex-col justify-between p-8 text-left rounded-3xl glass-card glass-card-hover min-h-[200px]"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-300">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-headline font-bold text-lg text-white group-hover:text-primary transition-colors">Chat Playground</h3>
                  <p className="text-slate-400 text-xs leading-normal">
                    Interact directly with local models and test evasion vectors, prompt injections, and safety boundary delimiters.
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-6 group-hover:text-primary transition-colors flex items-center gap-1">
                Enter Chat Playground <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          </motion.div>

          {/* Card 2: Security Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <Link
              href="/dashboard"
              className="group flex flex-col justify-between p-8 text-left rounded-3xl glass-card glass-card-hover min-h-[200px]"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center group-hover:bg-accent/20 group-hover:scale-105 transition-all duration-300">
                  <LayoutDashboard className="w-6 h-6 text-accent" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-headline font-bold text-lg text-white group-hover:text-accent transition-colors">Security Dashboard</h3>
                  <p className="text-slate-400 text-xs leading-normal">
                    Audit firewall event records, analyze cosine similarity statistics, and trace active system rules.
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-6 group-hover:text-accent transition-colors flex items-center gap-1">
                Launch Dashboard <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between border-t border-white/5 pt-6 text-[10px] font-mono text-slate-600 gap-4 z-10">
        <div>
          Copyright &copy; 2026 Erwin R. Pasia | SU.OSM AI. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5" /> Python / TypeScript</span>
          <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> Next.js App Router</span>
        </div>
      </footer>
    </main>
  );
}
