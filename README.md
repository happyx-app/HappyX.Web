# HappyX.Web

Dashboard for HappyX. Anyone logs in with Discord and sees **My evolution**: their own answers,
one line per server, by week, month or year, with each server's average, streak and latest
comments. Server admins also see how their servers feel: the daily average mood, answers by mood
and the (anonymous by default) messages for any period.

TypeScript without a framework, built with Vite. Charts are plain SVG, no chart library.
Served by nginx, which also forwards `/api/web/*` to [HappyX.Api](https://github.com/moixblau/HappyX.Api),
so the browser only talks to one origin and the API doesn't need to be public.

## Layout

```
src/main.ts      routes (#/ servers, #/g/<id>?p=<period>, #/me?p=<week|month|year>&g=<id>) and screens
src/settings.ts  server settings form (#/g/<id>/settings): same options as /happyx config
src/evolution.ts My evolution: periods, per-server points (by day, or by week for a year), colours
src/api.ts       client for the API's /web routes
src/charts.ts    mood line chart, one or more series (hover tooltip + table view), answers-by-mood bars
src/periods.ts   period presets, computed in the server's timezone
src/i18n.ts      UI strings (en default, es, ca), picked from the browser's language
nginx.conf.template  production server: static files, /api/web proxy, CSP
```

## Who sees what

Everyone sees their own answers in every server. A user sees a server's charts, and can change its
settings, if they are the admin who gets the reports, or the owner or an Administrator
of the server on Discord. The API enforces this; the web only shows what it gets back.

## Development

```sh
npm ci
npm test
API_URL=http://localhost:8083 npm run dev   # http://localhost:8084, proxies /api/web to the API
```

For the login to work locally, run the API with `WEB_URL=http://localhost:8084` and the Discord
variables (see the API README), and add `http://localhost:8084/api/web/auth/callback` to the
Discord application's OAuth2 redirects.

## Image

`ghcr.io/moixblau/happyx-web` (published by CI from main and `v*` tags), listening on port 8080.
`API_URL` (default `http://api:8080`) is the API's internal URL.
