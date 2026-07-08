# Solid'Pilot — YCID

Application de pilotage de projets de solidarité internationale multi-partenaires, développée pour YCID (Yvelines Coopération Internationale et Développement) et le programme CEM Liban-Yvelines.

## Contenu

### `/prototypes`
Prototypes React single-file (fonctionnels, données de démonstration incluses) :

| Fichier | Contenu |
|---|---|
| `prototype-phase2.jsx` | Phase 2 — Budget et finances (lignes budgétaires, catégories, financeurs, justificatifs, KPI, import CSV) |
| `prototype-phase3.jsx` | Phase 3 — Workflows de validation, vue financeur, rapports exportables, journal d'audit |
| `prototype-phase4.jsx` | Phase 4 — Indicateurs d'impact, réunions COPIL, décisions, page Pilotage |
| `prototype-cem-liban.jsx` | **Version courante** — données réelles du programme CEM Liban-Yvelines (3 projets, budget 106 200 €), carte des projets, page Aide |

Chaque fichier est un composant React autonome (Tailwind + lucide-react + papaparse), utilisable tel quel dans un environnement de prévisualisation React (ex. Claude, CodeSandbox, StackBlitz) ou comme point de départ pour l'intégration Next.js.

### `/docs`
- `spec-phase1-mvp.md` — Spécification fonctionnelle cumulative (sections 1 à 12) : modèle de données, permissions, arbitrages produit, formats d'import.

## État du projet

Les 4 phases fonctionnelles sont spécifiées et prototypées :
1. Organisations, projets, phases, tâches, documents, import CSV
2. Budget multi-financeurs, justificatifs, circuit de validation des devis
3. Workflow de revue unifié, vue financeur, rapports, audit trail
4. Indicateurs d'impact, comité de pilotage, décisions, portefeuille multi-projets

**Prochaine étape** : conversion en application Next.js + Supabase déployable (schéma SQL, authentification réelle, RLS pour les permissions).

## Stack cible pour la production

- **Frontend** : Next.js (PWA), Capacitor pour la distribution mobile
- **Backend** : Supabase (Postgres + Auth + RLS + Storage)
- **Déploiement prévu** : `ycid.joefr.cloud`
