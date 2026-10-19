# SVG Path Reverser

A web tool for reversing specific paths in SVG files. Perfect for creating svg animations with the [stroke-dashoffset](https://css-tricks.com/almanac/properties/s/stroke-dashoffset/) technique, where you need control over the drawing direction.

**[Try this tool!](https://svg-reverse.daniel.sticker.name/)**

![SVG Reverse Demo](demo/svg-reverse-short.gif)

### Features
- Paste SVG code and select which paths to reverse
- Preserves all original attributes, classes, and comments
- Set individual easing, duration, and delay for each path.
- View and copy the modified SVG
- No manual coordinate editing required

### Development

Everything runs in the browser; the app is a static [Vite](https://vite.dev) site. With [Bun](https://bun.sh) installed:

```bash
bun install      # install dependencies
bun run dev      # start the dev server
bun test         # run the unit tests
bun run build    # build the static site into dist/
bun run preview  # serve dist/ locally
```

Deployment runs on Cloudflare Pages through its Git integration: every push builds with `bun install --frozen-lockfile && bun run build` and publishes `dist/`. Set `VITE_UMAMI_SRC` and `VITE_UMAMI_WEBSITE_ID` in the Pages build environment to enable analytics (see `.env.example`).
