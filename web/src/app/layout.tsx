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

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NZ AI Firewall OSS Sandbox",
  description: "Prompt injection detection, visual sanitization and safety containment proxy sandbox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Grotesk:wght@400;600;700&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-slate-100 min-h-screen antialiased select-none">
        {children}
      </body>
    </html>
  );
}
