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

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-pt-sans)", "system-ui", "sans-serif"],
        headline: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-source-code-pro)", "monospace"],
      },
      colors: {
        background: "#070a13",
        card: "rgba(13, 18, 33, 0.7)",
        primary: {
          DEFAULT: "#ff3366",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#00f0ff",
          foreground: "#070a13",
        },
        border: "rgba(255, 255, 255, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
