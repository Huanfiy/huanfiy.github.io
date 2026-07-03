# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pure static personal website (huanfly.com) — no frameworks, no build step, no package manager. Vanilla HTML5 + CSS3 + JavaScript. All external libraries loaded via CDN.

## Commands

```bash
./run.sh test          # Start local Python HTTP server on port 8080
./run.sh test 3000     # Start on custom port
./run.sh deploy        # rsync to remote server (user@example.com)
```

No build, lint, or test commands exist — the site is served as-is.

## Architecture

**Multi-page static site** with client-side rendering:

- `index.html` — Homepage with hero and entry cards
- `blog.html` — Blog system: article grid + Markdown detail view (toggles visibility)
- `tool.html` — Tools hub with inline ICO converter + links to standalone tools
- `about.html` — Profile with timeline and interest cards
- `tools/` — Standalone tool pages (keyboard practice, ESP32 pin mapper, link converter)
- `posts/*.md` — Blog articles fetched and parsed client-side with Marked.js
- `css/style.css` — Single unified stylesheet with CSS custom properties for theming
- `js/script.js` — Shared functionality (mobile nav toggle, smooth scroll)

**Key pattern:** Pages use view switching — JavaScript toggles between list view and detail view within the same page (blog article list ↔ article content, tool grid ↔ tool interface).

**Design theme:** Hand-drawn storybook style inspired by "Luo Xiaohei" (罗小黑). Warm paper background with grain overlay; dark mode = "night forest". Primary: forest green `#5da844`, accent: spirit teal `#4fc4cf`. Signature elements: wobble border-radius (`--wobble-*` vars), ink outlines with offset shadows, squiggle SVG underlines, hero hills + animated black cat SVG (index.html), ambient firefly canvas + click spirit-burst (js/script.js). Standalone pages in `tools/` still consume legacy aliases from style.css (`--border-color`, `--radius-lg/md`, `.tool-icon`) — keep them.

**CDN dependencies:** Marked.js 4.0.12, AOS 2.3.1, Font Awesome 6.4.0, LXGW WenKai Screen webfont (jsDelivr).

## Git Commit Convention

Format: `<type>(<scope>): <subject>` — English, single line, scope optional.

Types: `feat`, `fix`, `perf`, `refactor`, `chore`, `docs`

Breaking changes: `feat!: ...` with `BREAKING CHANGE:` in body.

Principles: single responsibility per commit, each commit must be independently deployable.
