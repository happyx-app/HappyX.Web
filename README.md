<div align="center">

<a href="https://github.com/happyx-app/HappyX"><img src="https://raw.githubusercontent.com/happyx-app/HappyX/main/docs/images/logo.svg" alt="HappyX logo" width="72" height="72"></a>

# HappyX.Web

The web dashboard of **[HappyX](https://github.com/happyx-app/HappyX)**, the Discord bot that asks your team how they
feel every working day and turns the answers into reports.

[![CI](https://github.com/happyx-app/HappyX.Web/actions/workflows/ci.yml/badge.svg)](https://github.com/happyx-app/HappyX.Web/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-Vite-3178C6?style=flat-square&logo=typescript&logoColor=white)](package.json)
[![Self-hosted](https://img.shields.io/badge/self--hosted-nginx-8b5cf6?style=flat-square)](https://github.com/happyx-app/HappyX#self-host-with-portainer)
[![Image](https://img.shields.io/badge/ghcr.io-happyx--web-fbbf24?style=flat-square&logo=docker&logoColor=white)](https://github.com/orgs/happyx-app/packages)

[HappyX](https://github.com/happyx-app/HappyX) ·
[Api](https://github.com/happyx-app/HappyX.Api) ·
[Bot](https://github.com/happyx-app/HappyX.Bot) ·
**Web** ·
[Bruno](https://github.com/happyx-app/HappyX.Bruno)

</div>

> [!TIP]
> New here? Start with the [main HappyX README](https://github.com/happyx-app/HappyX): what HappyX
> does, screenshots, the architecture and how to self-host the whole stack.

Dashboard for HappyX. Visitors who aren't logged in see the landing page (also at `#/about`): what
HappyX is, an **Add to Discord** button (`/api/web/auth/invite`, which needs HappyX.Api with the
invite route) and the login. Anyone logs in with Discord and sees **My evolution**: their own answers,
one line per server, by week, month or year, with each server's average, streak and latest
comments. Server admins also see how their servers feel: the daily average mood, answers by mood
and the (anonymous by default) messages for any period.

TypeScript without a framework, built with Vite. Charts are plain SVG, no chart library.
Served by nginx, which also forwards `/api/web/*` to [HappyX.Api](https://github.com/happyx-app/HappyX.Api),
so the browser only talks to one origin and the API doesn't need to be public.

## Layout

```
src/main.ts      routes (#/ servers or the landing page when logged out, #/about, #/g/<id>?p=<period>, #/me?p=<week|month|year>&g=<id>) and screens
src/settings.ts  server settings form (#/g/<id>/settings): same options as /happyx config, plus the
                 danger zone to delete the server from HappyX (type its name to confirm)
src/access.ts    «Admins and permissions»: main admin and view/manage grants to members or roles,
                 picked from search lists (combobox) of the server's members and roles
src/surveyRoles.ts role filters: «Who gets the survey» card and «Who plays» under the game switch;
                 everyone, everyone except some roles, or only some roles,
                 picked with the same combobox
src/evolution.ts My evolution: periods, per-server points (by day, or by week for a year), colours
src/api.ts       client for the API's /web routes
src/charts.ts    mood line chart, one or more series (hover tooltip + table view), answers-by-mood bars
src/periods.ts   period presets, computed in the server's timezone
src/i18n.ts      UI strings (en default, es), chosen with the language picker and kept in localStorage
src/theme.ts     light/dark toggle; follows the system until chosen, kept in localStorage
nginx.conf.template  production server: static files, /api/web proxy, CSP
```

## Who sees what

Everyone sees their own answers in every server. In a server, a user is an **owner** if they are
the admin who gets the reports, or the owner or an Administrator of the server on Discord: they
see and change everything, choose the main admin and who else has access, and can delete the
server from HappyX. Owners can give members or Discord roles **view** (charts and reports) or
**manage** (also the survey settings) access.
Servers the bot was removed from don't show up. The API enforces this; the web only shows what it
gets back.

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

`ghcr.io/happyx-app/happyx-web` (published by CI from main and `v*` tags), listening on port 8080.
`API_URL` (default `http://api:8080`) is the API's internal URL.
