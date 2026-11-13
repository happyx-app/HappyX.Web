// The light/dark choice («dark-mode-toggle»: follow the system, or pin light or dark), applied to
// the page before its first paint. This is the one place that writes the choice into the page:
// src/theme.ts calls the same function, window.happyxTheme, when the choice changes later.
//
// «system» leaves <meta name="color-scheme" content="light dark"> and each theme-color meta on its
// own media query. A pinned choice sets the color-scheme meta to it and switches the theme-color
// metas so only the pinned one applies (theme-color takes a media query, not a scheme).
;(function () {
  function apply(choice) {
    var pinned = choice === 'light' || choice === 'dark'
    document.querySelector('meta[name="color-scheme"]').content = pinned ? choice : 'light dark'
    document.querySelectorAll('meta[name="theme-color"][data-scheme]').forEach(function (m) {
      var own = m.getAttribute('data-scheme')
      m.media = pinned ? (choice === own ? 'all' : 'not all') : '(prefers-color-scheme: ' + own + ')'
    })
  }
  var saved = null
  try {
    saved = localStorage.getItem('happyx.theme')
  } catch (e) {
    // Site data blocked: follow the system.
  }
  apply(saved)
  window.happyxTheme = apply
})()
