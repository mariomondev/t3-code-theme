// Temporary read-only probe: composer left edges only, no text content.
export default { id: 't3-dom-probe', name: 'Temporary DOM probe', register(ctx) {
  const post = d => fetch('http://127.0.0.1:18794/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).catch(() => {})
  const t = setTimeout(() => {
    const q = s => document.querySelector(s)
    const r = e => e && Math.round(e.getBoundingClientRect().x * 10) / 10
    const input = q('[data-slot="composer-rich-input"]'), pill = q('[data-slot="composer-fade"] [data-tour="model-pill"]')
    post({ at: new Date().toISOString(), theme: document.documentElement.dataset.hermesTheme,
      surfaceX: r(q('[data-slot="composer-surface"]')), fadeX: r(q('[data-slot="composer-fade"]')),
      inputX: r(input), inputPadL: input && getComputedStyle(input).paddingLeft, stacked: !!input?.className.includes('pl-3'),
      attachX: r(q('[data-slot="composer-attachments"]')), attachFirstX: r(q('[data-slot="composer-attachments"] > *')),
      pillX: r(pill), pillPadL: pill && getComputedStyle(pill).paddingLeft, sendRight: (() => { const b = q('[data-slot="composer-fade"] button[type="submit"]') || Array.from(document.querySelectorAll('[data-slot="composer-fade"] button')).pop(); return b && Math.round(b.getBoundingClientRect().right) })(),
      surfaceRight: (() => { const e = q('[data-slot="composer-surface"]'); return e && Math.round(e.getBoundingClientRect().right) })() })
  }, 1200)
  ctx.onDispose(() => clearTimeout(t))
} }
