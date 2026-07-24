# PR 25 à 27 — Communication : chaque réalisation est un événement — spécification

Objectif : transformer chaque réalisation du programme (tâche terminée, chantier
livré, réunion tenue, décision actée) en **événement de communication**, et
aider les partenaires à produire le contenu correspondant grâce à la
**génération de contenu par IA**, diffusé sur les **canaux médias paramétrés
par chaque organisation** après validation.

Cas d'usage concret (CEM Liban) : l'experte locale à Azour remet son rapport
d'exécution sur l'aménagement du site du Shir → l'application crée l'événement
« Aménagement du site du Shir terminé » → elle génère en un clic une
proposition de post pour la page Facebook de LEY et un paragraphe pour la
newsletter YCID → LEY valide → le contenu est marqué publié. Ce workflow est
aligné avec l'article 2 du contrat de l'experte locale (communication soumise
à validation de LEY selon une stratégie définie d'un commun accord).

---

## 1. Concepts

| Concept | Description |
|---|---|
| **Événement de communication** (`comm_events`) | Un fait marquant du programme, créé automatiquement (tâche passée à « terminée », réunion COPIL, décision) ou manuellement (visite, inauguration, moment fort). Porte titre, résumé, date, photos. |
| **Canal média** (`org_media_channels`) | Un support de diffusion appartenant à une organisation : page Facebook, Instagram, LinkedIn, site web, newsletter, WhatsApp, presse locale. Chaque organisation paramètre ses canaux disponibles : langue, ton, audience, signature. |
| **Contenu** (`comm_contents`) | Un texte (généré par IA ou rédigé) destiné à un canal précis pour un événement précis. Workflow : brouillon → proposé → validé → publié (ou rejeté). |

## 2. Modèle de données

```sql
create table org_media_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in
    ('facebook','instagram','linkedin','site_web','newsletter','whatsapp','presse')),
  name text not null,            -- ex. « Page Facebook LEY »
  url text,
  language text not null default 'fr',   -- fr, en, ar
  tone text,                     -- ex. « institutionnel », « chaleureux, grand public »
  audience text,                 -- ex. « habitants des Yvelines », « diaspora libanaise »
  signature text,                -- mention à ajouter en fin de contenu
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table comm_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_kind text not null check (source_kind in
    ('tache','reunion','decision','jalon','manuel')),
  source_id uuid,                -- id de la tâche/réunion/décision d'origine
  title text not null,
  summary text default '',
  occurred_at date not null default current_date,
  photos jsonb not null default '[]',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table comm_contents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references comm_events(id) on delete cascade,
  channel_id uuid not null references org_media_channels(id) on delete cascade,
  status text not null default 'brouillon' check (status in
    ('brouillon','propose','valide','publie','rejete')),
  body text not null,
  hashtags jsonb not null default '[]',
  media_urls jsonb not null default '[]',
  generated_by_ai boolean not null default false,
  model text,                    -- id du modèle si généré par IA
  author_id uuid references profiles(id),
  validated_by uuid references profiles(id),
  validated_at timestamptz,
  published_at timestamptz,
  published_url text,
  comment text default '',       -- motif de rejet / remarques du validateur
  created_at timestamptz not null default now()
);
```

**Trigger « réalisation = événement »** : quand une tâche passe au statut
`terminee`, insérer automatiquement un `comm_event`
(`source_kind = 'tache'`, titre = titre de la tâche, projet = projet de la
tâche). Idem à la création d'une réunion (`kind = 'copil'`) et d'une décision
passée à `fait`. L'événement auto-créé reste supprimable par un chef de projet
si le fait ne mérite pas de communication.

**RLS** : lecture pour les membres du projet (mêmes règles que `tasks`) ;
`org_media_channels` gérés par les admins de l'organisation ; création de
contenus pour les contributeurs et plus ; validation/publication réservées à
`chef_projet` / `validateur` / admin (aligné sur le registre de permissions
de la PR 7 : `comm.channels.manage`, `comm.generate`, `comm.validate`,
`comm.publish`).

## 3. Génération de contenu par IA

Server action Next.js (`app/(app)/projets/[id]/comm-actions.ts`) appelant
l'API Claude via le SDK officiel `@anthropic-ai/sdk`. La clé `ANTHROPIC_API_KEY`
reste côté serveur (variable d'environnement, jamais exposée au client).

Entrée : l'événement (titre, résumé, photos), le contexte projet (nom,
description, zone, partenaires, financeurs) et le canal cible (kind, langue,
ton, audience, signature). Sortie structurée pour éviter tout parsing fragile :

```ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY côté serveur

const response = await anthropic.messages.create({
  model: "claude-opus-5",
  max_tokens: 2048,
  system: SYSTEM_COMM, // charte éditoriale du programme + règles (pas d'invention de faits/chiffres)
  messages: [{ role: "user", content: buildPrompt(event, project, channel) }],
  output_config: {
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          title:    { type: "string" },
          body:     { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          alt_text: { type: "string" }, // description des photos pour l'accessibilité
        },
        required: ["title", "body", "hashtags", "alt_text"],
        additionalProperties: false,
      },
    },
  },
});
```

- Un appel par canal sélectionné (les contenus par canal diffèrent en ton,
  longueur et langue) ; les résultats sont insérés dans `comm_contents` en
  statut `propose`, avec `generated_by_ai = true` et `model` renseigné.
- Le prompt système impose : ne jamais inventer de faits, chiffres ou
  citations ; rester dans les informations fournies par l'événement et le
  projet ; respecter la langue et le ton du canal ; mentionner les financeurs
  quand le canal l'exige (obligation MEAE de visibilité).
- La génération est une **proposition** : rien n'est diffusé sans passage au
  statut `valide` par un humain habilité.

## 4. Interface

- **Onglet « Communication » du projet** : fil chronologique des événements
  (auto + manuels), bouton « Ajouter un événement », et pour chaque événement
  un bouton **« Générer un contenu »** ouvrant le choix des canaux actifs des
  organisations du projet. Liste des contenus avec pastilles de statut,
  actions Valider / Rejeter (avec motif) / Marquer publié (avec URL).
- **Page Organisations** : bloc « Canaux de communication » (CRUD) réservé à
  l'admin de l'organisation.
- **Notifications** : le validateur est notifié quand un contenu passe à
  `propose` ; l'auteur quand son contenu est validé ou rejeté.
- **Audit** : chaque transition de statut écrit dans `audit_log`
  (qui / quoi / quand / commentaire), comme pour les validations budgétaires.

## 5. Découpage en PR

### PR 25 — Canaux médias par organisation
Schéma `org_media_channels` + RLS, bloc de paramétrage dans la page
Organisations, permissions `comm.channels.manage`.

### PR 26 — Fil d'événements de communication
Schéma `comm_events` + RLS, triggers tâche terminée / réunion / décision,
onglet « Communication » du projet (fil + création manuelle + suppression).

### PR 27 — Génération IA et workflow de validation
Schéma `comm_contents` + RLS, server action Claude API (sortie structurée),
écrans de génération multi-canaux, workflow proposé → validé → publié avec
audit et notifications.

## 6. Arbitrages

- **Pas de publication automatique** vers les réseaux sociaux dans un premier
  temps (pas d'API Facebook/Instagram à maintenir, pas de risque de diffusion
  non validée) : l'utilisateur copie le contenu validé et le poste sur le
  canal, puis renseigne l'URL. Une intégration directe pourra être une PR
  ultérieure.
- **Coût IA maîtrisé** : génération à la demande uniquement (pas de génération
  automatique à chaque événement), un appel par canal, sortie plafonnée à
  2 048 tokens. Ordre de grandeur : quelques centimes par contenu généré.
- **Photos** : les URL de photos proviennent des documents du projet
  (Supabase Storage) ; l'IA rédige le texte et l'alt-text mais ne manipule
  pas les images.
