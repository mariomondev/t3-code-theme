# T3 Code theme for Hermes Desktop

Unofficial [Hermes Desktop](https://github.com/NousResearch/hermes-agent) plugin that ports the **standard T3 Code dark theme** (not T3 Code's optional purple "T3 Chat" theme) and adds a T3-style model picker. Hermes lists it as "T3 Code" in the theme picker.

Not affiliated with T3 Tools or Nous Research.

Everything is scoped to `:root[data-hermes-theme="t3-code-theme"]`. Selecting another theme restores Hermes' native look, and disabling the plugin removes every stylesheet, listener, observer and injected element.

## Install

```sh
hermes plugins install mariomondev/t3-code-theme
```

Then open Hermes Desktop, go to **Capabilities > Plugins** and turn on **T3 Code dark theme** (the desktop half of a plugin package installs off). The theme is selected once on first load; after that, switch themes as usual.

Update with `hermes plugins update t3-code-theme`, remove with `hermes plugins remove t3-code-theme`.

## Compatibility

This plugin hooks into Hermes Desktop's markup (data slots, Tailwind classes, row structure), not only the stable plugin API. **A Hermes update can break parts of it.** When a hook is missing the affected piece falls back to Hermes' native look, a warning toast names the missing hooks once, and the rest keeps working (see [DOM hook self-check](#dom-hook-self-check)). Please open an issue with the toast text and your `hermes --version`.

| | Version | Verified |
|---|---|---|
| Hermes | v0.21.5+3666.gfb7eda7, commit `fb7eda7416ed2004f906a57bb3e3ad2e92cb8e93` (built 2026-09-27) | 2026-09-27 |
| T3 Code | `pingdotgg/t3code` commit `de251fc2971a884cb5b1305ba4daf309dc8cccb0` | 2026-09-27 |

## Develop

The plugin is one file, `desktop/plugin.js`, loaded uncompiled by Hermes. `plugin.yaml` is the package manifest.

```sh
pnpm install              # Playwright, for the fixture tests
pnpm exec playwright install chromium
pnpm test                 # syntax check + every fixture test
./scripts/install.sh      # copies the desktop half into ~/.hermes/desktop-plugins/t3-code-theme/ (hot reload)
```

Use either `scripts/install.sh` or `hermes plugins install`, not both: two folders would claim the same plugin id. Tests resolve Playwright from `PLAYWRIGHT_PATH` when set, otherwise from `node_modules`.

When a Hermes update breaks something:

1. Compare the installed Hermes with the table above: `hermes --version`, or `commit` in `~/.hermes/hermes-agent/install-stamp.json`.
2. Look for hook misses: `grep "t3-code-theme" ~/.hermes/logs/desktop.log | tail`.
3. Diff the Hermes files the theme depends on between the verified commit and the installed one, e.g. `git -C ~/.hermes/hermes-agent diff fb7eda7416e HEAD --stat -- apps/desktop/src/app/shell apps/desktop/src/components/ui apps/desktop/src/app/chat`.
4. After fixing and checking the live app, update the table.

## What it does

### Theme and layout

- T3 Code dark palette from source: canvas `#0a0a0a`, sidebar `#000000`, surfaces `#111111`, primary `#346bf1`, system font stacks.
- One 48rem (768px) reading column shared by the thread, the user bubble and the composer. Assistant text is inset 20px.
- User bubble: max 80% wide, 18px radius, 12px padding. Hermes' restore/stop button moves out of the bubble to a T3-style hover row under it (4px gap, 24px tall, right-aligned); the row always keeps its space, so hovering never shifts the thread. Attachments sit right-aligned under the bubble as fixed 300x192 tiles with a 12px radius, so a loading image never resizes the row.
- Chat titlebar uses the canvas color instead of the sidebar black.
- Portaled menus use T3's glass surface (blur 16px, saturate 1.08, 10px radius, dark shadow).
- Confirm dialogs (a Hermes dialog whose body holds a header and a footer) follow T3's AlertDialog: dialog-glass popup with an 18px radius and an 8% white border, a 4px-blur backdrop, 24px header, 20px semibold title, 14px muted description, and the footer as a muted bar with a top border. Cancel is T3's outline button and Confirm the primary blue (red when destructive), 32px tall with an 8px radius. The close X is hidden, as in T3; Escape and Cancel still dismiss. Other dialogs keep Hermes' layout.

### Composer

- Two-row layout: 70px editor (T3's `min-h-17.5`), controls below, 22px radius. Placeholder reads "Ask anything, @tag files/folders, or / for commands": T3's resting text without "$use skills", which Hermes has no trigger for. It replaces every random starter and follow-up line; "Starting Hermes..." and "Reconnecting to Hermes..." stay. The message-edit composer keeps its own placeholder.
- One 16px left edge for text, attachment chips and the model icon, including Hermes' multiline "stacked" layout (which otherwise adds `pl-3`).
- While the model or effort is still loading, the pills show a quiet skeleton bar instead of Hermes' braille spinner. The provider icon is cached so it does not blink while a chat opens.
- Model control: 16px provider icon and T3 display name ("Claude Opus 5.5", "GPT-6-Astra") through the `composer.modelPill` label provider; 14px, font-medium, #767676, 28px tall like the installed T3 build's "sm" `ComposerControl` (measured in the app).
- Reasoning control reads "Medium · 1M": T3 effort names plus the model's context tag, after a 1x16px separator.
- Picking a model in a live chat updates the pill at once. Hermes repaints only its draft model, and the pill of a live chat waits for the gateway's session.info (~0.9s). The primary pill shows the pick and its provider icon until Hermes' own label changes, a confirm dialog opens, or 4s pass, so a failed switch falls back to the real model. Tiles already repaint natively.
- The native "+" context menu is drawn as T3's paperclip on the right. The round primary action (voice start or send) uses T3's blue, and send dims to 30% when disabled.

### Chat chrome

- Chat header shows T3's crumb: a two-letter project badge, the project name and "New thread" (or the selected session's title).
- With tabs open the header is the tab strip, so each chat pane gets its project crumb (badge + project, no title: the tab shows it) as a 40px bar at its top and the transcript starts below it. A pane is paired with its tab through `data-session-anchor` = `data-tree-tab`. The primary chat's project comes from `host.state.cwd`. A tile's comes from its persisted session row (`host.listPersistedSessions`, read-only, keyed by the tile's stored id, using `git_repo_root` like the sidebar). A draft tile is not persisted until its first message, so it has no bar until then.
- Chat tab strips look like Codex tabs: 26px rounded tabs (8px radius) with 4px gaps, inactive `#111111`, hover `#171717`, active `#1c1c1c` with an 8% white hairline. Titles are 13px sentence case (500 on the active tab), led by the pane's provider icon (read from its model pill, or from the session row for a tab whose pane is not mounted yet). The 14px icon slot is always reserved: a skeleton square pulses until the provider is known, then the icon fades in, so a new tab never shifts. Hermes mounts the primary "workspace" pane only while its tab is active and that tab id is no session id, so the last provider seen per tab id is kept in plugin storage (`tabProviders.v1`, pruned to open tabs). A draft tab never opened has neither a session row nor a stored provider; it shows the provider of the default model for new chats (the cached global `model-options` entry), a guess that is never stored. Hermes' status dot shows only while it means something (working, stalled, needs input, unread, background); idle and draft dots are hidden. The close slot is reserved so titles never run under it, and the active tab always shows its close button. Tabs are matched by the plugin's `data-t3-chat-tab` mark because a session tab's context-menu wrapper replaces `data-slot="pane-tab"`. Strips without a chat (the sidebar's Sessions/Bots/Terminal) keep Hermes' tabs.
- Every composer tray shows where its chat runs (Local or the server label). The SDK reports only the focused session's owner, so each pane remembers the connection seen while it held focus; the primary chat falls back to the active connection.
- Hermes' bottom status bar is hidden.
- Opening a chat from the sidebar: Hermes paints it scrolled to the top for a few frames, then jumps to the bottom. The primary transcript stays hidden from the route change until the new rows are pinned to the bottom, then fades in over 120ms. It is capped at 300ms, and focusing a tile never triggers it.
- In that same gap Hermes mounts the "chat.empty" slot for a frame or two. While the switch runs, the primary pane counts as hydrating, not empty: the "What should we build?" headline stays hidden and the composer is not centered, so it no longer flashes in the middle of the pane. Tiles keep their empty-state headline.
- The branch/status drawer sits below the composer as T3's inset tray (grip hidden). It starts with where the chat runs (laptop icon + "Local", or a blue server icon + the connection label), then the branch. Its fill is #151515 with a #252525 border and #767676 text, measured against T3.
- The model pill's "pinned" dot is hidden (the pill tooltip still says it is pinned).
- The voice fan's read-aloud and wake-word discs are hidden while off.

### Sidebar rows

- One-line rows: medium title, dim until hover or selection, 11px metadata, 8px radius.
- Hermes' card style (Filter menu) becomes T3's thread card: a 16px project badge (repo root initials, or a home glyph outside any repo) and the project at 12px, the 14px title at 90% foreground, then a footer with the branch, the machine glyph and the provider icon at 60%. Hermes' model/size line and the running arc are hidden, and the idle dot gives way to the badge. Working, unread and needs-input dots stay.
- Badge and footer data come from one read of `host.listPersistedSessions` (all profiles, read-only), refreshed on connection or focus changes, at most every 30s, or after 5s when a row is not in the last read.
- The machine glyph follows T3: local chats carry none, chats on another gateway show a server glyph titled "Running on <label>".

### Draft hero

- On a fresh draft the composer moves to the middle of the pane and the "HERMES AGENT" wordmark is replaced by T3's headline: "What should we build in <project>?", with the project (basename of `host.state.cwd`) underlined with dots. Without a workspace it reads "What should we build?".

### Model picker

- T3 layout: 360px wide, a 44px rail (Favorites, separator, one logo per provider) with a blue selected indicator, and a search field with icon and underline that turns blue on focus.
- Two-line rows: T3 display name, then provider icon + short provider name + context tag ("Claude · 1M"). The first nine visible rows show `⌘1`...`⌘9`, and those shortcuts pick the row.
- Hermes' per-row chips (variant/context tag, Fast, effort) and the submenu caret are hidden; effort stays on the composer control. Rows are identified from Hermes' name span plus its first chip (the tag), matched against `modelDisplayParts` ported to `nativeModelParts`.
- Outline star inside each row, yellow when favorited. Favorites persist via `ctx.storage` under `modelFavorites.v1`, each key `JSON.stringify([provider, model])` with exact identifiers.
- Provider group labels are hidden (the rail replaces them); a collapsed group keeps its label so it can be expanded. Search shows the native highlighted names.
- Refresh, Add custom model and Edit models stay as one quiet footer line.
- Keyboard: arrows, Home/End, Enter and ⌘1-9 on models; ArrowRight from the rail jumps to search; Tab/Shift+Tab between controls; native Escape. `aria-pressed`, `aria-current` and `aria-activedescendant` reflect state. IME composition never selects a model.

## DOM hook self-check

The theme depends on Hermes markup (data slots, Tailwind grid areas, icon classes, the native picker rows). Hermes can change any of it in an update, and the theme then falls back to native without an error. `DOM_HOOKS` in `desktop/plugin.js` lists every hook by group.

- Each group is checked once, the first time its anchor is on screen with this theme active (composer, reasoning pill, status tray, thread, draft hero, chat header, sidebar, model picker). A closed picker is not a miss.
- Misses are logged as `[t3-code-theme] Hermes DOM hooks missing` at error level, because packaged Hermes copies only renderer errors to `~/.hermes/logs/desktop.log`, and shown once as a warning toast per new set of misses.
- The last result is kept in plugin storage under `domCheck.v1`.
- "identified model rows" failing means `nativeModelParts` no longer matches Hermes' model labels.

After a Hermes update, open a chat and the model picker once, then check:

```sh
grep "t3-code-theme" ~/.hermes/logs/desktop.log | tail
```

## Streaming cost

`pnpm bench` streams 1500 simulated tokens into a fixture thread and compares Chromium's script, layout and style-recalc work with and without the plugin (median of 3 runs). Last result: no extra layouts or style recalcs, and script time within run-to-run noise. The observers drop streaming mutations before doing any work: text changes have no element target, and new nodes inside a message match none of the watched selectors.

## Safe model-selection architecture

The SDK exports `ModelCatalogMenu`, but not the composer's session-bound controller. So the plugin **extends the native open menu** instead of calling `model.switch` itself.

1. It reads the already-loaded catalog from the shared React Query cache, with no RPC or polling. The key must match `['model-options', profile, sessionId || 'global', 'owner', connectionId]` exactly and have active observers.
2. The open pill and focus must belong to the same session, with `focusedSessionOwner` resolved: the primary pill needs `activeSessionId === focusedSessionId`, a tile pill needs its surface to be the focused tile. The menu is bound through the trigger's `aria-controls`, never by picking the first global portal.
3. React nodes for search, groups and options are preserved. The plugin only adds its own elements, reversible attributes and visual filters. It uses no private React properties, credentials, auth endpoints or invented catalog.
4. Mouse clicks go to the original handlers. Enter from search activates the **visible, connected native element that belongs to that menu**, so Hermes keeps the owning session, cost/policy confirmations, presets, rollback, close and cache invalidation.
5. Name matching requires one unique match within the real provider. If several IDs produce the same label, the row stays native and no favorite key is invented. `-fast` variants follow the native family and its presets.

### Deliberate limits

- Tiles (a chat opened in another tab, e.g. from a project) get the layout, the provider icon, an empty-session headline and the T3 picker. Hermes gives `data-tour` only to the primary pill, so the tile pill is found as the first control in the wrapper it shares with the reasoning pill.
- A tile's picker is enhanced only while that tile holds focus: its surface's `data-composer-target` must be `tile:<focusedStoredSessionId>`, and the catalog is read with the focused session and owner (`['model-options', profile, focusedSessionId, 'owner', connectionId]`). Any mismatch, or a focus change while it is open, falls back to the native picker. Row clicks still go to the native handlers, so Hermes switches the tile's own session.
- The empty tile headline reads "What should we build?" without a project: a draft tile has no persisted row yet. It uses Hermes' `chat.empty` slot and stands down when another plugin, such as a bot, owns that empty state.
- Favorites and provider filters respect the visible list, collapsed groups and Hermes search. They do not change `Edit Models` or enable providers.
- There is no "All" category. Row hover does not open reasoning; that stays on the separate composer control.
- OpenAI, Claude, Gemini, OpenCode, xAI (Grok) and GitHub Copilot use T3 Code's SVGs; OpenRouter uses its Simple Icons mark (CC0). Groq, Nous and the other providers in Hermes' registry that T3 lacks use LobeHub marks. Providers without a mark get neutral monograms.
- The popup is 360px wide with a 260px list, close to T3's 360x346px. There is no "NEW" badge or "Legacy models" group: the Hermes catalog carries neither.
- T3's "Full access" control is not ported. Hermes' equivalent (per-session YOLO) has no plugin API, and driving it from a plugin would desync the app's own state.
- No pixel-perfect claim: verification is computed DOM and behavior.

## Measuring the live app

Packaged Hermes has no CDP port. `tools/dom-probe/` holds a throwaway pattern: a temporary plugin reads geometry and computed styles (never transcript text) and POSTs them to a loopback-only receiver.

```sh
python3 tools/dom-probe/receiver.py &                         # listens on 127.0.0.1:18794, writes out.jsonl
mkdir -p ~/.hermes/desktop-plugins/t3-dom-probe
cp tools/dom-probe/probe.js ~/.hermes/desktop-plugins/t3-dom-probe/plugin.js
# wait for out.jsonl, then remove the probe and stop the receiver
rm -rf ~/.hermes/desktop-plugins/t3-dom-probe
```

Always remove the probe directory and stop the receiver afterwards.

## Sources and licenses

Reference: [pingdotgg/t3code](https://github.com/pingdotgg/t3code), commit `da6a85b1365993d0ff2a79698cd82498de247d8a`; confirm dialogs and the Grok/Copilot marks from commit `de251fc2971a884cb5b1305ba4daf309dc8cccb0`. Source audit: [`docs/t3-code-theme-audit.md`](docs/t3-code-theme-audit.md).

- Palette: `packages/shared/src/themePalettes.ts` (`T3_CODE_DARK_THEME_COLORS`).
- Typography, glass and radii: `apps/web/src/index.css`.
- Picker and controls: `apps/web/src/components/chat/{ProviderModelPicker,ModelPickerContent,ModelPickerSidebar,ModelListRow,ComposerControl}.tsx`.
- Confirm dialogs: `apps/web/src/components/{ConfirmDialogHost,ui/alert-dialog,ui/dialog-styles,ui/button}.tsx` and the `dialog-glass`/`dialog-backdrop` utilities in `index.css`.
- **OpenAI, Claude, Gemini, OpenCode, Grok and GitHub Copilot SVGs:** paths from `apps/web/src/components/Icons.tsx` at the commits above, copied under the repository's **MIT license, Copyright (c) 2026 T3 Tools Inc.** (full text in `LICENSE-T3-Code`). Used for identification only; trademarks belong to their owners and MIT grants no trademark rights.
- **Groq, Nous, DeepSeek, Qwen, Kimi, MiniMax, Z.ai, Hugging Face, Ollama, Nvidia, Meta, Bedrock, Vertex, Fireworks, DeepInfra, Novita, Azure, Nebius, Upstage, StepFun, Xiaomi, LM Studio, Kilo Code, Vercel and Arcee SVGs:** from `@lobehub/icons-static-svg` 1.95.1 ([lobehub/lobe-icons](https://github.com/lobehub/lobe-icons)), **MIT, Copyright (c) 2023 LobeHub** (full text in `LICENSE-LobeHub`). Same trademark note as above.
- Label adaptation from Hermes `lib/model-status-label.ts`, **MIT, Copyright (c) 2025 Nous Research** (full text in `LICENSE-Hermes`).
- Paperclip, search and star icons: [Lucide](https://lucide.dev) (ISC).
- The monograms and the extension code are original. No proprietary font files or T3 logo are distributed.

- Everything else in this repository: MIT, Copyright (c) 2026 Mario Montano (`LICENSE`).
