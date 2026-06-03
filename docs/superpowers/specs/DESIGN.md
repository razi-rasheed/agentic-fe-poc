# DESIGN.md — Triathlon OS UI Design System

## 1. Overview

The Triathlon OS web UI (SP2 — the Review app) is a **hand/AI-coded Next.js app** styled with **shadcn/ui** (CLI v4). The entire design system — color palette, light/dark themes, fonts, border-radius, and icon library — is packed into a single shadcn **preset**:

> **Preset code: `b5pZXjoX4i`** — this is the source of truth for the visual design. Don't hand-pick colors/radii; consume the preset's tokens.

### Scaffold the app with the preset
```bash
npx shadcn@latest init --preset b5pZXjoX4i --base base --template next
```

### Inspect / manage the preset
```bash
npx shadcn@latest preset decode b5pZXjoX4i   # see the exact colors/theme/fonts/radius/icons it packs
npx shadcn@latest preset resolve             # resolve the preset from the current project
```

### Add components as needed
```bash
npx shadcn@latest add button card dialog select switch input form table tabs badge sonner skeleton tooltip
```

## 2. Principles

- **shadcn/ui = Radix primitives (accessible behavior) + Tailwind CSS**, copied into the repo under `components/ui/*` — owned and editable, not a black-box dependency.
- The **preset `b5pZXjoX4i` is the single source of truth** for tokens. Style with semantic theme tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`, …) — **never** hardcode hex/Tailwind color literals (`bg-blue-500`).
- **Layout** via Tailwind utilities (`flex`, `grid`, `gap-*`, `p-*`); **components** via shadcn; **behavior/a11y** via the underlying Radix primitives (focus, ARIA, keyboard).
- Composition stays **calm and uncluttered** (generous spacing, clear hierarchy, numbers-first, gentle data viz) — the preset supplies the palette; restraint is in the layout.

## 3. Theming (light / dark)

- shadcn themes are CSS variables on `:root` and `.dark`; Tailwind runs in **`darkMode: 'class'`**. The preset defines both schemes.
- Use **`next-themes`** for persistence + system preference + **FOUC prevention**:
  ```tsx
  // app/layout.tsx
  <html lang="en" suppressHydrationWarning>
    <body>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </body>
  </html>
  ```
  `next-themes` injects the pre-paint blocking script that sets the theme class before first render — no flash.
- A theme toggle uses a shadcn `Switch` or `DropdownMenu` + `useTheme()`.

## 4. Component guidelines

- Prefer shadcn components for all primitives: `Button`, `Card`, `Dialog`/`Sheet`, `Select`, `Switch`, `Input`/`Textarea`, `Form`, `Table`, `Tabs`, `Badge`, `Sonner` (toasts), `Skeleton` (loading), `Tooltip`, `Calendar`/`DatePicker`.
- **Compose, don't rebuild.** Customize via the copied component source + theme tokens, not ad-hoc color utilities.
- **Forms:** shadcn `Form` (react-hook-form + zod) for onboarding, Profile/Goal, race-result, and admin-race forms — gives consistent validation + error states (matches the SP2 spec's validation requirements).
- **Data viz:** shadcn `Chart` (Recharts) for the fitness/fatigue/form (CTL/ATL/TSB) trend + per-pillar sparklines, themed to the preset.
- **Data layer:** `supabase-js` against the existing Supabase project (publishable key; RLS handles tenant isolation) — per the SP2 spec's data contract.

> This document defines *how the UI looks and is built*. **What** to build (screens, flows, data contract, acceptance) lives in `2026-06-03-triathlon-os-sp2-review-ui-design.md`.
