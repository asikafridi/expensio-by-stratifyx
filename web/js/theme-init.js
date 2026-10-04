// Runs before first paint (CSP-safe external script) to avoid a theme flash.
try { const t = localStorage.getItem('ex_theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); document.documentElement.dataset.theme = t; } catch (e) { /* default dark */ }
