# Project [ConquestAce](http://www.conquestace.com/)
conquestace.com is a glitch-aesthetic playground for AI-assisted creativity. This repo houses the prompt-builder and terminal UI that power the site.
## Features
1. [Index](#index)
2. [newtab](#newtab)
3. [TerminalOverlay](#terminaloverlay)
4. [Wildcarder](#wildcarder)

## Index
The landing page of Project ConquestAce. It immediately sets the glitch‑aesthetic tone for the entire site and funnels visitors to each major tool.

- Animated headline built with a staggered text‑scramble effect.

- Quick‑link grid to newtab, TerminalOverlay, Wildcarder, and the blog.

-  Source ➜ [`src/pages/index.astro`](./src/pages/index.astro)
## newtab

A self‑contained **custom start page** inspired by minimal command launchers (Surfraw, DuckDuckGo bangs):

| Capability                | Notes                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| **Glitch Tiger backdrop** | SVG/PNG asset positioned as a floating element with subtle parallax.                 |
| **Command parsing**       | `g query` → Google, `ddg query` → DuckDuckGo, aliases in `tablogic.js`.              |
| **Keyboard‑first UX**     | Page autofocuses the input; *⌘/Ctrl+L* cycles history, *Esc* clears.                 |
| **Live clock**            | Optional; update interval 1 s.                                                       |
| **Config object**         | Users can adjust defaults (engine, colors, showClock) via `CONFIG` in `tablogic.js`. |

Source ➜ [`src/pages/newtab.astro`](./src/pages/newtab.astro) + [`src/scripts/tablogic.js`](./src/scripts/tablogic.js)

---

## TerminalOverlay

A full‑screen **AI terminal interface** that responds in cryptic, hacker‑style prose.

- **OpenAI ChatGPT** primary LLM.
- **Gemini 2 Flash** fallback after 5 s timeout.
- **Streaming output** rendered with a faux CRT scan‑line effect, cursor blink, and occasional *ASCII corruption*.
- Accepts site navigation commands (`help`, `goto /wildcarder`, etc.) and forwards unknown input to the LLM.
- Source ➜ [`src/components/TerminalOverlay.astro`](./src/components/TerminalOverlay.astro)


## Wildcarder 🃏 — Prompt-Builder UI

A lightweight Astro-powered tool for turning **wildcard `.txt` files** into **refined, LLM-ready prompts** — built with modular UI islands, prompt saving, content moderation, and dynamic Hugging Face wildcard ingestion. It now requires you to provide your own **Gemini API key** for LLM access.

---

## ✨ Key Features

| Module                                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WildcardLoader.astro`                | *Client-only island* for loading `.txt` wildcard files:<br>• **Drag & drop** or **browse** files manually.<br>• **Load defaults** from Hugging Face (`danbooru`, `natural-language`).<br>• **Multi-level cherry-picking**:<br>  1️⃣ **Collection selector** (top-level)<br>  2️⃣ **Category pills** (e.g., `clothing`, `styles`)<br>  3️⃣ **File pills** (wrap + multi-select)<br>• Can load **entire categories** *or* only selected files.<br>• Auto-wraps file pills to new lines.<br>• Remove files individually 🗑️ or **clear all** 🧹.<br>• Emits `wildcards-loaded` with full `{ [filename]: lines[] }` structure. |
| `PromptBuilder.astro`                 | Builds the **initial prompt** by randomly sampling lines from selected wildcards.<br>• User controls sample count per file.<br>• Supports **🔄 Re-roll**, manual editing, and live broadcasting via `initial-prompt`.                                                                                                                                                                                                                                                                                                                     |
| `LLMControls.astro`                   | Sends prompt + instructions to the backend:<br>• Optional **extra instructions** textarea.<br>• Choose from **system prompt presets** (`danbooru`, `natural-language`, future).<br>• POSTs everything to `/.netlify/functions/generatePrompt`.                                                                                                                                                                                                                                                                                             |
| `PromptSaver.astro`                  | Local prompt memory:<br>• Save most recent LLM output 📌<br>• View full list 📜<br>• Download all as `prompts.txt` ⬇️<br>• Clear saved prompts 🗑️<br>• Button state updates automatically based on interaction.<br>• No backend; all browser-local.                                                                                                                                                                                                                                                   |
| `netlify/functions/generatePrompt.js` | • Configurable `SYSTEM_PRESETS` (e.g., Danbooru / NL)<br>• **OpenAI Moderation API** with per-category probability thresholds (`BLOCK_THRESHOLDS`)<br>• Blocks only flagged categories exceeding your explicitness thresholds (e.g., allow sensitive/questionable, block explicit/minors).<br>• Sends clean prompts to **OpenAI ChatGPT (or your `LOCAL_LLM_URL`)**<br>• Auto-fallback to **Gemini 2 Flash**.                                                                                                                                                       |

---

## 🏗️ How It Works

```mermaid
graph TD
  A[WildcardLoader] -- fires --> B((wildcards-loaded))
  B --> C[PromptBuilder]
  C -- initial-prompt --> D[LLMControls]
  D -- preset/instr + prompt --> F(generatePrompt.js)
  F -- refined prompt --> G[TerminalOutput]
  G --> H[PromptSaver]
````

---

### 📦 Wildcard Ingestion

Loader pulls manifests from:
`https://huggingface.co/datasets/ConquestAce/wildcards/...`

Supports:

* ✅ **Collection selection** (danbooru / natural-language)
* ✅ **Category pills** (e.g., `clothing`, `styles`, etc.)
* ✅ **File pills** (multi-selectable, wrapped to fit screen)
* ✅ Loading **entire categories** or just selected files

---

### 🛠 Prompt Generation

* Built dynamically by sampling `N` lines from each wildcard file
* Shown in a textarea for editing
* Can be re-rolled or edited manually
* Dispatched downstream via `initial-prompt`

---

### 🧠 LLM Prompting

* Collects:

  * `initialPrompt`
  * `preset` (controls system prompt)
  * `instructions` (user-typed refinements)
* POSTs to `/.netlify/functions/generatePrompt`
* Serverless function:

  * Runs **OpenAI Moderation API**
  * Checks per-category **probability scores** via `BLOCK_THRESHOLDS`
  * Sends safe prompt to **OpenAI ChatGPT** (or your `LOCAL_LLM_URL`) with **Gemini 2 Flash** fallback

---

### 💾 Saving Prompts

* All LLM outputs appear in `TerminalOutput`
* Click 📌 to save the prompt
* Toggle 📜 to view saved prompts inline
* Download all with ⬇️
* Clear all with 🗑️

---

## 🔧 Configuration Pointers

| What to change                         | Where                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Add a new wildcard collection**      | Upload `.txt` files + manifest to Hugging Face. Then extend `collectionSelector` in `WildcardLoader`. |
| **Add a new system-prompt preset**     | Add key in `SYSTEM_PRESETS` (Netlify function) and `<option>` in `LLMControls.astro`.                 |
| **Adjust moderation strictness**       | Edit per-category `BLOCK_THRESHOLDS` in `generatePrompt.js`.                                          |
| **Change sample count per file**       | Modify PromptBuilder’s sampling logic.                                                                |
| **Tweak file/category UI styling**     | Edit Tailwind class names in `WildcardLoader.astro`.                                                  |
| **Change file pill wrapping behavior** | Adjust CSS: use `flex-wrap` and `max-h` in `.file-wrap`.                                              |

---

## 🚀 Quick Start

```bash
# Install deps
npm i

# Run Astro dev server
npm run dev

# Run Netlify Functions locally
netlify dev
```

Set the following environment variables in `.env` or Netlify:

* `OPENAI_API_KEY` — for OpenAI requests and moderation
* `LOCAL_LLM_URL`  — optional custom chat completion endpoint
* `LOCAL_LLM_AUTH` — optional auth header for the local LLM
* `GEMINI_API_KEY` — (TerminalOverlay only) fallback Gemini key

---

## 🤝 Credits

* Wildcard dataset: [ConquestAce/wildcards](https://huggingface.co/datasets/ConquestAce/wildcards)
* OpenAI ChatGPT (`gpt-3.5-turbo`)
* Google Gemini 2 Flash fallback
* Moderation via OpenAI `/moderations` endpoint

---

## 💬 Contributing

Pull requests welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## ⚖️ License

Credit me if you want, or don’t. I vibe-coded all of this over \~100 hours.
© 2025 Ashiful Bhuiyan
