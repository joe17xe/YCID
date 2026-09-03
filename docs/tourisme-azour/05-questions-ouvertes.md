# Plateforme touristique d'Azour — cadrage : réponses et questions restantes

## Tranché — 29/08 puis 03/09/2026

1. **« L'offre S Chehab » = « scalable »** (dictée vocale). Aucun lieu ni
   partenaire mystère : l'exigence est que l'offre soit **scalable** —
   duplicable et élargissable. Conséquence produit : la plateforme est un
   **gabarit paramétrable** (« 1 modèle de village × N villages ») — nom,
   logo, couleurs, contacts, langues et contenus se configurent par
   territoire, rien n'est codé en dur pour Azour.
2. **Hébergements : associés, mais indirectement.** Blue Jay Valley,
   Pineview et les maisons d'hôtes ne sont pas des partenaires du projet,
   mais la rubrique « Dormir » les référence pour qui veut rester
   plusieurs jours — un annuaire de contacts, pas un engagement.
3. **Le kiosque : place du village d'Azour, animé par des jeunes et des
   guides.** Vocation d'information d'abord. Un **numéro de téléphone
   d'information** sera communiqué plus tard → le numéro, comme le reste,
   doit être **paramétrable** dans le back-office (affiché au kiosque,
   dans l'app, sur les panneaux).
4. **Les contenus existent : l'étude des sentiers** (voir
   `06-etude-des-sentiers.md`). Trois parcours définis et chiffrés
   (boucle 3,1 km facile ; Azour–Joubeh–Bisri 5 km modéré ; Hyrax Rock
   400 m technique guidé), cartes Google Earth avec tracés (KML à
   récupérer), photos dont drone, matière naturaliste (géologie,
   orchidées, cigognes).
5. **Portage budgétaire — proposition** (voir la section « Le portage
   budgétaire » de `03-methode.md`) : la plateforme sur la ligne
   **« Structuration d'une offre de randonnée cohérente avec mapping,
   topographie, renforcement des offices touristiques locaux »**
   (1 450 € en 2026 + 1 450 € en 2027, MEAE, décaissement LEY puis
   Azour) ; le matériel du kiosque et les QR des panneaux sur
   **« Dotation d'équipement pour la réalisation des sensibilisations
   (panneaux explicatifs, tablettes, etc.) »** (3 200 €, YCID, 2026) ;
   en complément possible, la campagne photo/vidéo via la ligne
   « Communication » du volet commun (3 000 €, YCID/MEAE) si le COPIL
   l'accepte.
6. **Le nom : « Visit Azour » en nom de travail** — à confirmer après
   consultation, et de toute façon **paramétrable** (cohérent avec le
   point 1 : le nom appartient à la configuration du territoire, pas au
   code).
7. **Les coordonnées GPS sont des données, jamais du code** (demande du
   29/08 au soir) : chaque point et chaque trace se saisit au
   back-office avec ses informations en paramètres — la carte et les
   parcours évoluent sans redéploiement. Modèle de données, modes de
   saisie et impacts techniques : `07-modele-de-donnees.md`.

8. **Le numéro d'information du kiosque : +961 7 700 825** (donné le
   29/08 « pour le moment ») — paramétré dans le seed, affiché en
   Pratique et au kiosque, modifiable à tout instant dans `/admin`.
9. **Le camping El Abo est retiré du circuit** (29/08) : son POI passe
   en statut « brouillon » — invisible partout (Explorer, Pratique,
   cartes), **réversible en un clic** dans `/admin` ou en une ligne de
   contenu. C'est exactement le paramètre demandé.
10. **L'arabe est validé** (29/08).
11. **Beit Mrad entre à l'annuaire, et « Se restaurer » naît** (03/09) :
    maison de village restaurée (murs de 1750), chambres, petit-déjeuner
    libanais au saj servi dans la cour — établissement indépendant du
    projet, comme Blue Jay Valley et Pineview. La page Pratique gagne
    une rubrique **« Se restaurer »** en trois temps : le
    petit-déjeuner, les tables d'Azour, puis « un peu plus loin » —
    volontairement en retrait, sans vignette ni contact, parce qu'on ne
    met pas en avant ce qu'on ne peut pas garantir ouvert. Elle se
    nourrit du champ **services** (voir dossier 07), pas d'une liste
    codée en dur.
12. **Plus de lien avec le Lebanon Mountain Trail** (03/09) : ni side
    trail, ni appui au trail 2027, ni annuaire. **Tout est géré
    localement** — parcours, guides, kiosque, réservation. Le LMT reste
    dans le benchmark comme référence de marché, jamais comme partenaire.
13. **Le kiosque prend les réservations** (03/09) : au-delà du numéro de
    téléphone, le kiosque devient le guichet des sorties accompagnées.
    Six **formules paramétrables** sont proposées au catalogue (visite du
    village, boucle du Shir accompagnée, grande randonnée du Bisri,
    Hyrax Rock, journée complète, groupes et scolaires) ; la demande se
    dépose depuis l'app et se confirme au village. **L'entrée est sur la
    page d'accueil**, à côté du numéro.
14. **La table d'Azour, c'est le restaurant de l'hôtel** (03/09).
    Aucun établissement nommé « Lion » n'existe — la mention entendue au
    cadrage était un artefact de dictée, rien n'a été créé sous ce nom.
    La rubrique « Se restaurer » retient donc **Pineview Hotel** pour le
    déjeuner et le dîner, et **Beit Mrad** pour le petit-déjeuner.
    Blue Jay Valley redevient un **hébergement seul** : son service de
    table est retiré, et la phrase qui l'annonçait aussi — une
    description qui promet une table vaut une table promise.

## Encore ouvert

- La **confirmation du nom** après consultation (« Visit Azour »
  pressenti).
- L'**ordre des publics prioritaires** (diaspora estivale, clubs de
  randonnée libanais, visiteurs internationaux) — oriente le ton et le
  plan de lancement.
- La **récupération du KML** des tracés auprès de l'auteur de l'étude
  (raccourci n°1 de la phase 1).
- Les **points d'eau** sur les parcours : l'étude n'en mentionne pas —
  à confirmer sur le terrain (information de sécurité à afficher).
- Les **photos des établissements** (Beit Mrad, Blue Jay Valley,
  Pineview) et de plusieurs lieux du village : la place, le kiosque,
  l'église Saint-Joseph, le Chir el-Joube, le village de Bisri. Le
  champ `photo` les attend, POI par POI ; tant qu'il est vide la fiche
  affiche une icône. **Rien ne sera illustré par une image de synthèse
  ou empruntée** : il faut des clichés réels, avec leur crédit.
- Les **tables de Jezzine** à nommer, si l'on veut remplacer la mention
  générique « un peu plus loin » par de vraies adresses (le code les
  affiche dès qu'elles existent — il suffit de les créer avec le
  service « restaurant » ; leur distance au village fait le reste).
- Les **durées, capacités et tarifs des six formules** : ce sont des
  propositions, à valider par la municipalité avant la prochaine mise en
  ligne. Les tarifs sont volontairement vides — l'app affiche alors
  « communiqué au kiosque », et rien n'est promis à la place des guides.
- Le **canal de réception des demandes** : sans base, l'app pousse la
  demande vers WhatsApp, l'e-mail ou le téléphone du kiosque. Aucun des
  trois n'est renseigné aujourd'hui à part le fixe — un **numéro
  WhatsApp** rendrait le circuit immédiat.
- Les **coordonnées exactes** de Beit Mrad, Blue Jay Valley et
  Pineview : les points actuels sont approchés (± quelques centaines de
  mètres) et se corrigent dans `/admin` en collant les coordonnées
  Google Maps.
