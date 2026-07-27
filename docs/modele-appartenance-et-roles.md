# Appartenance, périmètre, capacité — et où placent les communes libanaises

Arbitrage du 27/07/2026, à la question « les communes libanaises doivent
avoir des comptes, dans quel cas sommes-nous ? ».

## Les deux couches

Le modèle ne repose pas sur une échelle de droits allant du moins au
plus. Il repose sur **deux questions indépendantes**, et c'est leur
croisement qui décide de ce qu'une personne voit et peut faire.

| Couche | Portée | Ce qu'elle décide |
|---|---|---|
| **Appartenance à une organisation** (`memberships` + `project_organizations`) | Ce qu'on **voit** | Être membre d'une organisation rattachée à un projet donne accès au projet : phases, tâches, budget, pièces, journal |
| **Rôle sur le projet** (`project_members`) | Ce qu'on **peut faire** | Chef de projet, référent mairie, responsable financier, contributeur, auditeur |

Une personne peut avoir l'une sans l'autre :

- **Appartenance seule** — un agent de la Commune de Villepreux voit les
  projets de sa commune, sans pouvoir rien y modifier. C'est le *droit
  de regard*.
- **Rôle projet seul** — un chef de projet extérieur, qui n'appartient à
  aucune des organisations du projet, y accède quand même :
  `is_project_member()` répond vrai dès qu'on figure dans
  `project_members`. C'est exactement le cas du **coordinateur extérieur
  qui anime les activités et les rencontres** sans être salarié d'aucune
  des parties.

## Le cas des communes libanaises

> « Souvent, les communes libanaises doivent nommer un chef de projet et
> exécuter : renseigner un devis, suivre les travaux. Parfois on nomme
> aussi un chef de projet extérieur qui coordonne des activités et des
> rencontres. Ce rôle peut aussi être tenu au sein de la commune
> libanaise. »

Elles **agissent**. Elles ne regardent pas.

Or `project_organizations.role` les classait `observateur`. Le libellé
était faux, et le rendre vrai supposerait de leur retirer ce dont elles
ont besoin pour travailler. Elles passent donc **partenaire**, comme les
communes françaises, avec lesquelles elles sont exactement à parité :
chacune exécute sa part sur son territoire.

Le chef de projet, lui, se nomme dans `project_members` — qu'il soit
agent de la commune ou coordinateur extérieur. **Les deux cas décrits
sont le même geste**, sur la couche capacité, et le modèle n'a pas à les
distinguer : ce qui compte est la personne nommée, pas d'où elle vient.

## Ce qui n'est donc PAS à construire

Une **visibilité graduée par rôle d'organisation** — un observateur qui
verrait l'avancement sans le budget — avait été envisagée avant cet
arbitrage. Elle n'a plus d'objet : après reclassement, **aucune
organisation n'est réellement observatrice**.

La règle reste écrite ici pour le jour où le cas se présentera —
un financeur institutionnel invité à suivre sans voir le détail des
pièces, un bénéficiaire final :

> `is_project_member()` ne regarde pas le rôle de l'organisation
> rattachée. Un membre d'une organisation `observateur` ou
> `beneficiaire` voit donc **tout** le projet : montants, devis,
> factures, décisions de validation, journal d'audit.

Construire cette gradation avant d'en avoir l'usage ajouterait des
policies à maintenir pour zéro utilisateur. Le jour où une organisation
doit vraiment être tenue à distance du budget, c'est une migration et
une seule.

## Vérifier, puis corriger

Recensement — quelles organisations sont rattachées à quoi, et comment :

```sql
select p.name as projet, o.name as organisation, po.role
  from project_organizations po
  join projects p on p.id = po.project_id
  join organizations o on o.id = po.org_id
 order by p.name, po.role, o.name;
```

Reclassement des deux municipalités :

```sql
update project_organizations po
   set role = 'partenaire'
  from organizations o
 where o.id = po.org_id
   and po.role = 'observateur'
   and o.name in ('Municipalité d''Azour', 'Municipalité de Jeïta');
```

Le changement est **sans effet sur ce qu'elles voient** — l'accès venait
déjà de l'appartenance, quel que soit le rôle. Il rend le libellé
conforme à la réalité, ce qui compte le jour où quelqu'un lit la fiche
projet pour comprendre qui fait quoi. Et il évite qu'une future règle
visant les vrais observateurs ne les atteigne par erreur.

## Nommer les personnes

Une fois les comptes créés et rattachés à leur organisation :

| Personne | Organisation | Rôle projet |
|---|---|---|
| L'agent qui pilote côté commune | Municipalité concernée | `chef_projet` |
| Celui qui dépose devis et justificatifs | Municipalité concernée | `contributeur` ou `resp_financier` |
| Le coordinateur extérieur | la sienne, ou aucune | `chef_projet` |
| Un contrôle YCID | YCID | `auditeur` — **nommé par un administrateur seulement** (0047) |

Rappel de la 0047 : le siège d'auditeur n'est pas à la main du chef de
projet. Le contrôlé ne choisit pas son contrôleur.
