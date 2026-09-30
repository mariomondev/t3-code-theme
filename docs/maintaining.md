# Maintaining the theme

The whole plugin is `desktop/plugin.js`, loaded by Hermes as is. It targets Hermes Desktop's markup: data slots, Tailwind classes and row structure. Hermes changes them without notice, so most maintenance is catching up after a Hermes update.

## Test

```sh
pnpm install
pnpm exec playwright install chromium
pnpm test
```

To try a change in the live app, install the plugin once with `hermes plugins install mariomondev/t3-code-theme`, then copy your working file over it. Hermes reloads it on the spot:

```sh
cp desktop/plugin.js ~/.hermes/desktop-plugins/t3-code-theme/plugin.js
```

`hermes plugins update t3-code-theme` puts the released version back.

## After a Hermes update

1. Open a chat and the model picker once, then look for missing hooks:

   ```sh
   grep "t3-code-theme" ~/.hermes/logs/desktop.log | tail
   ```

   `DOM_HOOKS` in `desktop/plugin.js` lists every selector the theme relies on, by group. Each group is checked the first time it is on screen, and misses are logged and shown once as a warning toast.

2. See what changed in Hermes since the last verified commit (in the README):

   ```sh
   git -C ~/.hermes/hermes-agent diff <verified-commit> HEAD --stat -- apps/desktop/src/app apps/desktop/src/components/ui
   ```

3. Fix the selectors, add or update a fixture test in `tests/`, run `pnpm test`, and check the live app with the copy above.
4. Update the verified version in the README.

## Rules the plugin keeps

- Everything is scoped to `:root[data-hermes-theme="t3-code-theme"]`, and disabling the plugin removes every stylesheet, listener, observer and element it added.
- The model picker only restyles and extends Hermes' own menu. Selecting a model always goes through Hermes' handlers, so confirmations, presets and the owning session stay correct. When the picker cannot tell which session it belongs to, it stays native.
- The plugin reads data Hermes already loaded (the model catalog cache and persisted sessions). It makes no model switches, auth calls or polling of its own.
