# HappyX.Web

Dashboard for HappyX: admins log in with Discord and see how their servers feel, with the daily
average mood, answers by mood and the (anonymous by default) messages for any period.

TypeScript without a framework, built with Vite. Charts are plain SVG, no chart library.
Served by nginx, which also forwards `/api/web/*` to [HappyX.Api](https://github.com/moixblau/HappyX.Api),
so the browser only talks to one origin and the API doesn't need to be public.

## Layout

```
src/main.ts      routes (#/ servers, #/g/<id>?p=<period>) and screens
src/api.ts       client for the API's /web routes
src/charts.ts    daily mood line chart (hover tooltip + table view) and answers-by-mood bars
src/periods.ts   period presets, computed in the server's timezone
src/i18n.ts      UI strings (en default, es, ca), picked from the browser's language
nginx.conf.template  production server: static files, /api/web proxy, CSP
```

## Who sees what

A user sees a server if they are the admin who gets the reports, or the owner or an Administrator
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
