# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static web app that reverses SVG path directions for stroke-dashoffset animations. It parses SVG content, lets users select specific paths to reverse, and generates downloadable animation packages. All processing runs in the browser; there is no server.

## Core Architecture

- **Build**: Vite with `index.html` at the root; files in `public/` are served and copied verbatim (asset URLs stay `/static/...`)
- **Frontend**: `src/main.js` imports jQuery, Ace, SweetAlert2 and GSAP from npm; `src/styles.css` bundles Tailwind CSS and daisyUI with compatibility styles for the original layout. Downloaded animations still load GSAP from cdnjs.
- **SVG Processing** (`src/svg.js`):
  - `extractPaths`: parses SVG with `DOMParser` and lists path information
  - `reversePaths`: reverses selected paths and applies animation classes
  - `buildZip`: builds the downloadable animation zip with `fflate`
  - `reverseD`: path reversal on top of `svg-path-commander`, matching the traversal order of Python's `svgpathtools`

## Key Components

- **Path Extraction**: Handles both namespaced and non-namespaced SVG paths, preserves all attributes
- **Animation Classes**: Supports `duration-*`, `delay-*`, and `ease-*` classes with dot-to-underscore conversion
- **Zip Generation**: Packages `public/static/js/anim.mjs` with `public/static/zip_files/index.html`, into which the SVG and speed scale are substituted

## Development Commands

```bash
bun install      # install dependencies
bun run dev      # start the dev server
bun test         # unit tests for the DOM-free helpers in src/svg.js
bun run build    # build the static site into dist/
```

## File Structure

- `index.html`: Main UI
- `src/main.js`: Frontend logic
- `src/svg.js`: SVG parsing, path reversal, and zip generation
- `src/svg.test.js`: Unit tests (`bun test`)
- `public/static/js/anim.mjs`: Animation script, used by the app and copied into downloads
- `public/static/svg/`: Sample SVG files (`hello.svg` is the default)
- `public/static/zip_files/index.html`: Template for downloadable animations

## Analytics Integration

The application includes Umami analytics for privacy-focused tracking:

- **Client-side tracking**: Events tracked include SVG parsing, path toggling, animation previews, downloads, and configuration changes
- **Configuration**: The Umami script tag is added only when `VITE_UMAMI_SRC` and `VITE_UMAMI_WEBSITE_ID` are both set at build time (see `.env.example`)
- **Privacy**: Cookieless tracking, GDPR compliant, no personal data collection

### Key Analytics Events

- `svg_parsed` - SVG processing with complexity metrics
- `path_toggled` - Path reversal state changes with context
- `animation_previewed` - Animation tests with settings
- `svg_copied` - Export usage with metadata
- `animation_downloaded` - Package generation with full context
- `animation_configured` - Parameter changes (duration, delay, easing)
- `processing_error` - Parse, reverse, copy, upload, and download errors with context

## Important Notes

- SVG content is wrapped in an `<svg>` element if its root element is not `<svg>`; malformed XML is rejected with the parser's message
- Closed subpaths keep their `Z` after reversal
- Animation classes use underscore format (`duration-1_5` for 1.5s duration)
- Deployment is Cloudflare Pages via Git integration (build `bun install --frozen-lockfile && bun run build`, output `dist`)
- Analytics tracking gracefully degrades if Umami is unavailable
