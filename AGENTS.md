<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:uiux-anti-slop-rules -->
# Mandatory UI/UX & Anti-AI-Slop Rules (`c:\projects\pos\.agent\skill\uiuxskills.md`)

Before creating or modifying any frontend component or page, you MUST follow `c:\projects\pos\.agent\skill\uiuxskills.md`:
- **Never use**: harsh gradients, rainbow/pastel multi-coloring, purple/black themes, neon colors, pure white (`#FFFFFF`) page backgrounds (use Warm Ivory `#F7F3EC` and Porcelain `#FFFCF7`), heavy drop shadows (`shadow-lg`/`xl`/`2xl`), liquid glass/frosted blobs, radial orbs, dot grids, colored left card stripes (`border-l-4`), pillowy corners (`rounded-3xl`), bento grids, generic 3-feature-card rows, fake terminal windows, emojis in UI, `<Sparkles />` icons, Lucide icon soup, animated arrows/bouncy hover effects (`hover:scale-*`, `hover:-translate-*`), em-dash copywriting clichés, or `"It's not X, it's Y"` slogans.
- **Always use**: flat semantic tokens (`#6B2837`, `#F7F3EC`, `#FFFCF7`, `#EEE7DD`, `#292320`, `#71675E`, `#D8CEC1`), crisp `1px` borders, `rounded-md` / `rounded-lg` geometry, `tabular-nums` for numbers/money, structural skeleton loaders (`animate-pulse bg-[#EEE7DD]`) instead of plain `"Loading..."` text, and ToS/Privacy links on public/auth/guest surfaces.
<!-- END:uiux-anti-slop-rules -->
