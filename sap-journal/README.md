# Journal de configuration SAP · Philo Televisions

Web app partagée par l'équipe (Moad, Armel, Mazen, Thomas) pour documenter chaque étape de la configuration S/4HANA MM/SD du business case **Philo Televisions** : company codes C2NL / C2BE (copiées de 1010), plants Breda, Delft, Brussels, Antwerp, purchasing orgs P2HQ / P2BR / P2BX / P2AN, sales orgs S2NL / S2BE.

Pour chaque étape : transaction, chemin SPRO, ce qu'on a fait, valeurs saisies, contrôle, problème / solution et captures d'écran. Claude lit les captures et pré-remplit la fiche.

## Fonctionnalités

- Connexion par **magic link** (Supabase Auth), choix « Qui es-tu ? » dans une bottom sheet.
- **Un espace par personne** + « Tout le journal », dans un segmented control collé en haut.
- Liste groupée par bloc, avec la progression « x/y faites », la recherche plein texte et des filtres par bloc et par statut.
- **+ Nouvelle étape depuis une capture** : glisser-déposer de plusieurs images, sélection de fichiers ou Ctrl/⌘ + V. Claude remplit ensuite les champs vides.
- Auto-complétion du chemin et du titre à partir du T-code (`lib/tcodes.ts`), numérotation automatique dans le bloc.
- Fiche détaillée façon Réglages iOS : statut en un clic, lightbox, ajout de captures sans passer par « Modifier », Dupliquer, Copier, Supprimer.
- Export **Word (.docx)** avec les captures intégrées, et copie du journal en texte.
- Synchronisation **temps réel** (Supabase Realtime) et mode sombre automatique.

## Structure

```
sap-journal/
├── app/
│   ├── layout.tsx, globals.css      Thème iOS (variables clair / sombre)
│   ├── page.tsx                     Application (client)
│   ├── login/page.tsx               Connexion par magic link
│   ├── auth/callback/route.ts       Échange du code Supabase → session
│   └── api/analyze/route.ts         Lecture des captures par Claude (serveur uniquement)
├── components/
│   ├── JournalApp.tsx               Orchestration : onglets, split view, collage, exports
│   ├── StepList.tsx, StepDetail.tsx, StepForm.tsx
│   ├── NewFromCaptureButton.tsx, AddCapturesZone.tsx, Lightbox.tsx, CaptureImage.tsx
│   ├── PersonTabs.tsx, WhoAreYouSheet.tsx, HelpBanner.tsx
│   └── ui/                          SegmentedControl, BottomSheet, Alert, Toast, Badges/Icônes
├── hooks/                           useSession, useMembers, useJournal (Realtime), useSignedUrl, useImageDrop
├── lib/
│   ├── types.ts                     Types partagés
│   ├── tcodes.ts                    Dictionnaire T-code → [chemin, titre]
│   ├── blocs.ts, numbering.ts       Blocs proposés, numérotation automatique
│   ├── storage.ts, images.ts        Upload, URLs signées, compression des captures
│   ├── exportDocx.ts, exportText.ts
│   └── supabase/                    Clients navigateur et serveur
├── middleware.ts                    Rafraîchit la session et protège les pages
└── supabase/
    ├── migrations/0001_init.sql     Tables, RLS, bucket « captures », Realtime
    └── seed.sql                     Étapes 1.1 à 1.7 (facultatif)
```

## Installation

### 1. Dépendances

```bash
cd sap-journal
npm i
```

### 2. Projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute `supabase/migrations/0001_init.sql`. Ce script crée :
   - les tables `members`, `steps` et `captures` ;
   - les policies RLS : tout membre connecté peut tout lire et tout modifier ;
   - le bucket **privé** `captures` et ses policies ;
   - la publication Realtime sur `steps`, `captures` et `members`.

   Avec la CLI Supabase, tu peux aussi lancer `supabase db push`.
3. Facultatif : exécute `supabase/seed.sql` pour créer les étapes 1.1 à 1.7 (responsable : Moad).
4. Vérifie que le bucket `captures` existe et qu'il est **privé** (Storage › Buckets). Le script le crée ; sinon, crée-le à la main avec le nom `captures`, sans cocher « Public ».
5. Dans **Authentication › URL Configuration** :
   - **Site URL** : `http://localhost:3000` en local, puis l'URL Vercel ;
   - **Redirect URLs** : ajoute `http://localhost:3000/auth/callback` et `https://<ton-app>.vercel.app/auth/callback`.
6. Recommandé : une fois les 4 comptes créés, désactive les nouvelles inscriptions (**Authentication › Sign In / Providers › Allow new users to sign up**). Sinon, toute personne qui connaît l'URL peut se connecter et rejoindre le journal.

### 3. Variables d'environnement

```bash
cp .env.example .env.local
```

| Variable | Où la trouver | Exposée au navigateur ? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase › Project Settings › API | oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (clé `anon` / publishable) | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (clé `service_role`) | **non**, serveur uniquement |
| `ANTHROPIC_API_KEY` | console.anthropic.com › API Keys | **non**, serveur uniquement |
| `ANTHROPIC_MODEL` (facultatif) | par défaut `claude-sonnet-5-5` | non |

Les clés Anthropic et `service_role` ne servent que dans `app/api/analyze/route.ts`. Cette route vérifie d'abord que l'appelant est connecté et membre de l'équipe.

## Lancer en local

```bash
npm run dev
```

Ouvre http://localhost:3000, saisis ton e-mail, puis clique sur le lien reçu et choisis ton nom.

Autres commandes : `npm run build` (build de production), `npm run lint`, `npm run typecheck`.

## Déploiement sur Vercel

1. Pousse le dépôt sur GitHub, puis importe-le dans Vercel (**Add New › Project**).
2. **Root Directory** : `sap-journal`. Le reste du dépôt est le site vitrine statique. Vercel détecte Next.js.
3. Ajoute les variables d'environnement ci-dessus dans **Settings › Environment Variables**.
4. Déploie, puis ajoute l'URL obtenue dans Supabase : Site URL et Redirect URL `…/auth/callback`.

`/api/analyze` déclare `maxDuration = 60` s. La lecture de 5 captures prend en général 10 à 30 s.

## Lecture des captures par Claude

- Au maximum **5 images** sont envoyées par analyse. Le serveur les télécharge depuis le Storage privé, puis appelle l'API Anthropic avec le prompt du business case et le dictionnaire `lib/tcodes.ts`.
- La réponse JSON est validée avec **zod**. Si le JSON est invalide, le client reçoit une erreur claire.
- Seuls les **champs vides** sont remplis. Ils portent le hint « proposé, à vérifier ».
- Le bouton **Arrêter** annule la requête. **Remplir depuis les captures** relance l'analyse sur une fiche existante.
- Les captures de plus de 3,5 Mo sont réduites dans le navigateur avant l'envoi, à cause de la limite de 5 Mo par image de l'API.
- En cas de refus du modèle principal, la requête active le repli serveur (`fallbacks: "default"`) vers un autre modèle.

## Raccourcis clavier

| Raccourci | Action |
|---|---|
| Ctrl/⌘ + V | Colle une capture : nouvelle étape ; ajout au formulaire s'il est ouvert ; ajout à la fiche si la zone « Ajouter d'autres captures » est survolée ou sélectionnée |
| ↑ / ↓ | Étape précédente / suivante |
| ← / → | Capture précédente / suivante dans la lightbox |
| Ctrl/⌘ + S | Enregistrer le formulaire |
| Échap | Annuler, ou fermer la lightbox ou l'alerte |
