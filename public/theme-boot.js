// Before the first paint: a pinned light/dark choice (modern-web-guidance «dark-mode-toggle»).
// A classic, blocking script on purpose; the CSP forbids inline ones. theme-color only takes
// media queries, so a pinned choice also switches which of the two applies.
try {
  var t = localStorage.getItem('happyx.theme')
  if (t === 'light' || t === 'dark') {
    document.querySelector('meta[name="color-scheme"]').content = t
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.media = m.media.indexOf(t) >= 0 ? 'all' : 'not all'
    })
  }
} catch (e) {}
