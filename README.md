# Flowa — Site vitrine

Landing page premium pour **Flowa Studio** (Bruxelles).  
iOS 17+ aesthetic · Bilingue FR/EN · Responsive · Animé · Supabase + EmailJS

---

## Stack

| Couche | Technologie |
|---|---|
| Frontend | HTML / CSS / JS vanilla — aucun build requis |
| Base de données | Supabase (PostgreSQL + RLS + Realtime) |
| Emails | EmailJS |
| Analytics | Google Analytics 4 |
| Hébergement | GitHub Pages |

---

## Fichiers

```
flowa/
├── index.html          — Site principal (iOS aesthetic, bilingue, funnel)
├── admin.html          — Dashboard admin (Supabase Auth, leads temps réel)
├── mentions-legales.html
├── confidentialite.html
├── supabase-setup.sql  — Migrations SQL (table leads, RLS, Realtime)
├── audit.py            — Script Playwright pour auditer le site (9 catégories)
└── animation/
    └── animations.jsx  — Moteur d'animation React (Stage, Sprite, Easing)
```

---

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

---

## Lancer l'audit Playwright

```bash
pip install playwright --break-system-packages
playwright install chromium
python audit.py
# Résultats dans audit_results/ (screenshots + rapport JSON)
```

---

## Déploiement

Le site est automatiquement déployé via **GitHub Pages** à chaque push sur `main`.

URL live : **https://moodsss92.github.io/flowa/**

---

## Configuration requise

### Supabase
1. Copier `supabase-setup.sql` dans **SQL Editor → New query → Run**
2. Récupérer `Project URL` et `anon public key` dans **Settings → API**
3. Les mettre à jour dans `index.html` et `admin.html` (variables `SUPABASE_URL` / `SUPABASE_ANON_KEY`)

### Admin dashboard
Créer un compte dans **Supabase → Authentication → Users → Add user**  
Accès via `admin.html`

### EmailJS
- Service ID : `service_0itl689`
- Template ID : `template_8da5ipm`
- Public key : dans `emailjs.init()`

---

## Design system

```css
--violet: #7B2FBE
--coral:  #FF6B6B
--accent-grad: linear-gradient(135deg, #7B2FBE 0%, #FF6B6B 100%)
--bg: #f5f5f7        /* iOS gray background */
--spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## Fonctionnalités

- **Glass morphism nav** — pilule fixe avec blur, scroll-aware
- **Hero iPhone mockup** — mockup 3D avec cartes flottantes animées
- **Typewriter hero** — 4 phrases en boucle (FR + EN)
- **Bento grid** — 6 tuiles solutions avec effets hover
- **Method timeline** — 4 étapes avec ligne dégradé animée
- **Glow cards** — halo réactif au curseur sur toutes les cartes (`.glow-card`)
- **Funnel 3 étapes** — service → budget → contact, envoi Supabase + EmailJS
- **i18n FR/EN** — toggle dans la nav, persistance localStorage
- **Reveal on scroll** — IntersectionObserver sur toutes les sections
- **Honeypot anti-spam** — champ caché pour filtrer les bots
