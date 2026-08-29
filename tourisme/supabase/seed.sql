-- Seed « Azour » — GÉNÉRÉ par scripts/gen-seed.mjs depuis content/*.json.
-- Ne pas éditer à la main : modifier content/ puis relancer `node scripts/gen-seed.mjs`.
-- Idempotent : rejouable (upsert par slug).

insert into territoires (slug, nom, marque, slogan, actif, langues, langue_defaut, photo_accueil,
  contact_tel, contact_whatsapp, contact_email, urgences, etat_acces, centre, zoom_defaut)
values ('azour', '{"fr":"Azour","ar":"عازور","en":"Azour"}'::jsonb, 'Visit Azour', '{"fr":"Le village du Shir, entre falaises et vallée du Bisri","ar":"قرية الشير، بين الجروف ووادي بسري","en":"The village of the Shir, between cliffs and the Bisri valley"}'::jsonb, true,
  '{ar,fr,en}', 'fr', '/photos/panorama-crete.jpg',
  null, null, null,
  '[{"nom":{"fr":"Défense civile (secours)","ar":"الدفاع المدني","en":"Civil Defence (rescue)"},"tel":"125"},{"nom":{"fr":"Croix-Rouge libanaise","ar":"الصليب الأحمر اللبناني","en":"Lebanese Red Cross"},"tel":"140"},{"nom":{"fr":"Forces de sécurité intérieure","ar":"قوى الأمن الداخلي","en":"Internal Security Forces"},"tel":"112"}]'::jsonb, '{"niveau":"ouvert","message":{"fr":"Sentiers en cours d''aménagement (programme 2026-2027) : certains tronçons sont encore en chantier. Renseignez-vous au kiosque avant de partir.","ar":"الدروب قيد التأهيل (برنامج ٢٠٢٦–٢٠٢٧): بعض المقاطع لا تزال قيد الأشغال. استعلموا عند الكشك قبل الانطلاق.","en":"Trails under development (2026-2027 programme): some sections are still being worked on. Check at the kiosk before setting out."},"date":"2026-08-29"}'::jsonb, st_setsrid(st_makepoint(35.57, 33.53), 4326), 13.5)
on conflict (slug) do update set nom = excluded.nom, marque = excluded.marque, slogan = excluded.slogan,
  actif = excluded.actif, langues = excluded.langues, langue_defaut = excluded.langue_defaut,
  photo_accueil = excluded.photo_accueil, urgences = excluded.urgences,
  etat_acces = excluded.etat_acces, centre = excluded.centre, zoom_defaut = excluded.zoom_defaut;

insert into parcours (territoire_id, slug, nom, accroche, description, type, difficulte,
  acces_guide, trace, trace_statut, distance_m, denivele_pos_m, denivele_neg_m,
  duree_min_minutes, duree_max_minutes, saison, dangers, acces, depart, photo, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'boucle-foret-falaise', '{"fr":"Boucle de la forêt d''Azour et de la falaise panoramique","ar":"جولة غابة عازور والجرف البانورامي","en":"Azour forest and panoramic cliff loop"}'::jsonb, '{"fr":"La boucle familiale : pins, chênes et le grand balcon du Shir sur la vallée du Bisri.","ar":"الجولة العائلية: صنوبر وسنديان وشرفة الشير الكبيرة على وادي بسري.","en":"The family loop: pines, oaks and the great Shir balcony over the Bisri valley."}'::jsonb, '{"fr":"Itinéraire circulaire au départ du village d''Azour. Le sentier traverse la forêt méditerranéenne (pins, chênes, pistachier de Palestine), longe des chemins agricoles puis atteint les points de vue des falaises calcaires qui dominent la vallée du Bisri. Au printemps, ouvrez l''œil : trois orchidées remarquables vivent ici, et les cigognes passent au-dessus de la vallée en saison de migration.","ar":"مسار دائري ينطلق من ساحة قرية عازور. يمرّ الدرب في الغابة المتوسطية (صنوبر وسنديان وبطم فلسطيني)، ويمتد على طرق زراعية قبل الوصول إلى مطلات الجروف الكلسية المشرفة على وادي بسري. في الربيع تتفتح هنا سحلبيات نادرة، وتعبر طيور اللقلق فوق الوادي في موسم الهجرة.","en":"A circular route starting from Azour''s village square. The trail crosses Mediterranean forest (pines, oaks, Palestine pistachio), follows farm tracks, then reaches the limestone cliff viewpoints overlooking the Bisri valley. In spring, keep your eyes open: three remarkable orchids live here, and storks cross the valley in migration season."}'::jsonb, 'boucle',
  'facile', false, st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[35.5715,33.5295],[35.5704,33.5301],[35.5695,33.531],[35.5687,33.5316],[35.5678,33.5322],[35.5669,33.5329],[35.5662,33.5335],[35.5655,33.5339],[35.5648,33.5342],[35.5643,33.5347],[35.564,33.5352],[35.5632,33.535],[35.5628,33.5344],[35.5633,33.5337],[35.5638,33.533],[35.5648,33.5323],[35.5658,33.5318],[35.5668,33.5311],[35.568,33.5305],[35.5691,33.5297],[35.5698,33.5292],[35.5708,33.529],[35.5715,33.5295]]}'), 4326), 'provisoire',
  3100, 215, 215,
  90, 120, '{"fr":"Toute l''année ; éviter les heures chaudes en été. Orchidées en avril-mai.","ar":"على مدار السنة؛ تجنّبوا ساعات الحر صيفًا. السحلبيات في نيسان وأيار.","en":"Year-round; avoid the hottest hours in summer. Orchids in April-May."}'::jsonb, '{"fr":"Bords de falaise non protégés aux points de vue : restez sur le sentier balisé, surveillez les enfants.","ar":"حواف الجرف غير محمية عند المطلات: التزموا بالدرب المعلَّم وانتبهوا إلى الأطفال.","en":"Unprotected cliff edges at the viewpoints: stay on the waymarked trail and keep children close."}'::jsonb,
  '{"fr":"Départ de la place du village d''Azour (stationnement sur la place). Azour est à ~20 min de Jezzine par la route.","ar":"الانطلاق من ساحة قرية عازور (موقف سيارات في الساحة). تبعد عازور نحو ٢٠ دقيقة عن جزين بالسيارة.","en":"Start from Azour''s village square (parking on the square). Azour is ~20 min from Jezzine by road."}'::jsonb, st_setsrid(st_makepoint(35.5715, 33.5295), 4326), '/photos/shir-falaise.jpg', 'publie', 1)
on conflict (territoire_id, slug) do update set nom = excluded.nom, accroche = excluded.accroche,
  description = excluded.description, type = excluded.type, difficulte = excluded.difficulte,
  acces_guide = excluded.acces_guide, trace = excluded.trace, trace_statut = excluded.trace_statut,
  distance_m = excluded.distance_m, denivele_pos_m = excluded.denivele_pos_m,
  denivele_neg_m = excluded.denivele_neg_m, duree_min_minutes = excluded.duree_min_minutes,
  duree_max_minutes = excluded.duree_max_minutes, saison = excluded.saison,
  dangers = excluded.dangers, acces = excluded.acces, depart = excluded.depart,
  photo = excluded.photo, statut = excluded.statut, ordre = excluded.ordre;

insert into parcours (territoire_id, slug, nom, accroche, description, type, difficulte,
  acces_guide, trace, trace_statut, distance_m, denivele_pos_m, denivele_neg_m,
  duree_min_minutes, duree_max_minutes, saison, dangers, acces, depart, photo, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'azour-joubeh-bisri', '{"fr":"Falaise d''Azour – Joubeh – vallée du Bisri","ar":"جرف عازور – الجوبة – وادي بسري","en":"Azour cliff – Joubeh – Bisri valley"}'::jsonb, '{"fr":"La grande descente : des falaises d''Azour au fond de la vallée du Bisri, par le Chir el Joube.","ar":"النزول الكبير: من جروف عازور إلى قاع وادي بسري مرورًا بشير الجوبة.","en":"The great descent: from the Azour cliffs down to the Bisri valley floor, past Chir el Joube."}'::jsonb, '{"fr":"Itinéraire linéaire reliant le village d''Azour à la vallée et au village du Bisri. Le sentier suit d''abord les falaises panoramiques au-dessus du corridor de la rivière Awali, passe le Chir el Joube, puis descend par les sentiers forestiers et les chemins agricoles jusqu''au fond de la vallée. Prévoyez un véhicule à l''arrivée ou un retour accompagné — la remontée ajoute presque 600 m de dénivelé.","ar":"مسار خطي يربط قرية عازور بوادي بسري وقريته. يتبع الدرب أولًا الجروف البانورامية فوق مجرى نهر الأولي، ويمرّ بشير الجوبة، ثم ينحدر عبر دروب الغابة والطرق الزراعية حتى قاع الوادي. دبّروا سيارة عند الوصول أو عودة برفقة أحد — فالصعود يضيف نحو ٦٠٠ متر من الارتفاع.","en":"A linear route linking Azour village to the Bisri valley and its village. The trail first follows the panoramic cliffs above the Awali river corridor, passes Chir el Joube, then descends through forest paths and farm tracks to the valley floor. Arrange a vehicle at the far end or a guided return — climbing back adds almost 600 m of ascent."}'::jsonb, 'lineaire',
  'modere', false, st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[35.5715,33.5295],[35.5703,33.5302],[35.5693,33.531],[35.5681,33.5319],[35.5668,33.5328],[35.5656,33.5336],[35.5648,33.5342],[35.5641,33.535],[35.5636,33.5358],[35.5629,33.5366],[35.5624,33.5374],[35.562,33.5382],[35.5615,33.539],[35.5618,33.5397],[35.5625,33.5403],[35.5618,33.541],[35.5608,33.5416],[35.5597,33.5425],[35.5588,33.5436],[35.558,33.545],[35.5572,33.5464],[35.5565,33.548],[35.5558,33.5496],[35.5552,33.5512],[35.5546,33.5527],[35.554,33.5541],[35.5535,33.5552],[35.553,33.556]]}'), 4326), 'provisoire',
  5000, 185, 594,
  150, 180, '{"fr":"Octobre à juin de préférence ; très exposé au soleil en plein été.","ar":"يفضَّل من تشرين الأول إلى حزيران؛ معرّض جدًا للشمس في عز الصيف.","en":"Best from October to June; very exposed to the sun at the height of summer."}'::jsonb, '{"fr":"Passages en bord de falaise exposés ; forte descente (−594 m) éprouvante pour les genoux ; pas de point d''eau confirmé sur le parcours — emportez au moins 2 L par personne.","ar":"مقاطع مكشوفة على حافة الجرف؛ نزول قوي (−٥٩٤ م) مُتعِب للركبتين؛ لا نقطة ماء مؤكدة على المسار — احملوا لترين على الأقل للشخص.","en":"Exposed cliff-edge sections; a strong descent (−594 m) that is hard on the knees; no confirmed water point on the route — carry at least 2 L per person."}'::jsonb,
  '{"fr":"Départ de la place du village d''Azour. Arrivée au village du Bisri : prévoyez une voiture déposée à l''avance ou contactez un guide pour la navette.","ar":"الانطلاق من ساحة قرية عازور. الوصول إلى قرية بسري: اتركوا سيارة مسبقًا أو تواصلوا مع دليل لتأمين النقل.","en":"Start from Azour''s village square. Finish at Bisri village: leave a car in advance or contact a guide for a shuttle."}'::jsonb, st_setsrid(st_makepoint(35.5715, 33.5295), 4326), '/photos/vallee-bisri.jpg', 'publie', 2)
on conflict (territoire_id, slug) do update set nom = excluded.nom, accroche = excluded.accroche,
  description = excluded.description, type = excluded.type, difficulte = excluded.difficulte,
  acces_guide = excluded.acces_guide, trace = excluded.trace, trace_statut = excluded.trace_statut,
  distance_m = excluded.distance_m, denivele_pos_m = excluded.denivele_pos_m,
  denivele_neg_m = excluded.denivele_neg_m, duree_min_minutes = excluded.duree_min_minutes,
  duree_max_minutes = excluded.duree_max_minutes, saison = excluded.saison,
  dangers = excluded.dangers, acces = excluded.acces, depart = excluded.depart,
  photo = excluded.photo, statut = excluded.statut, ordre = excluded.ordre;

insert into parcours (territoire_id, slug, nom, accroche, description, type, difficulte,
  acces_guide, trace, trace_statut, distance_m, denivele_pos_m, denivele_neg_m,
  duree_min_minutes, duree_max_minutes, saison, dangers, acces, depart, photo, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'hyrax-rock', '{"fr":"Éco-aventure verticale « Hyrax Rock »","ar":"مغامرة الحبال «صخرة الوبر»","en":"\"Hyrax Rock\" vertical eco-adventure"}'::jsonb, '{"fr":"400 mètres d''aventure encadrée, cordes fixes et falaise, jusqu''au rocher du daman.","ar":"٤٠٠ متر من المغامرة المؤطَّرة بحبال مثبتة على الجرف حتى صخرة الوبر.","en":"400 metres of supervised adventure, fixed ropes and cliff, up to the hyrax''s rock."}'::jsonb, '{"fr":"Un itinéraire court et technique reliant la zone des falaises panoramiques au rocher de Hyrax Rock — le rocher du daman, ce petit animal des falaises qui a donné son nom au site. Progression assistée par cordes fixes (50 m), sur un relief calcaire exposé, encadrée obligatoirement par un guide formé. La récompense : un belvédère naturel unique au-dessus de la vallée, au coucher du soleil si vous réservez en fin de journée.","ar":"مسار قصير وتقني يربط منطقة الجروف البانورامية بصخرة الوبر — ذلك الحيوان الصغير ساكن الجروف الذي أعطى الموقع اسمه. تقدّم بمساعدة حبال مثبتة (٥٠ م) على صخر كلسي مكشوف، برفقة دليل مدرّب إلزاميًا. المكافأة: مطلّ طبيعي فريد فوق الوادي، وعند الغروب إن حجزتم في آخر النهار.","en":"A short, technical route linking the panoramic cliff area to Hyrax Rock — named after the rock hyrax, the small cliff-dwelling animal that lives here. Progression on fixed ropes (50 m) over exposed limestone, always supervised by a trained guide. The reward: a unique natural viewpoint above the valley — at sunset if you book late in the day."}'::jsonb, 'guide',
  'difficile', true, st_setsrid(st_geomfromgeojson('{"type":"LineString","coordinates":[[35.5648,33.5342],[35.5644,33.5344],[35.5641,33.5346],[35.5637,33.5348],[35.5633,33.5349],[35.563,33.535]]}'), 4326), 'provisoire',
  400, null, null,
  30, 45, '{"fr":"Mars à novembre, par temps sec uniquement.","ar":"من آذار إلى تشرين الثاني، وفي الطقس الجاف فقط.","en":"March to November, in dry weather only."}'::jsonb, '{"fr":"Falaise calcaire exposée : accès UNIQUEMENT avec un guide formé et le matériel fourni (casque, baudrier). Interdit par temps humide ou venteux. Âge minimum et condition physique : voir avec le guide.","ar":"جرف كلسي مكشوف: الدخول فقط برفقة دليل مدرّب وبالمعدات المؤمَّنة (خوذة وحزام). ممنوع في الطقس الرطب أو العاصف. الحد الأدنى للعمر واللياقة: يُنسَّق مع الدليل.","en":"Exposed limestone cliff: access ONLY with a trained guide and the provided gear (helmet, harness). Forbidden in wet or windy weather. Minimum age and fitness: check with the guide."}'::jsonb,
  '{"fr":"Rendez-vous fixé avec le guide au kiosque de la place du village, puis approche commune par le sentier de la falaise.","ar":"الموعد مع الدليل عند كشك ساحة القرية، ثم مقاربة مشتركة عبر درب الجرف.","en":"Meet the guide at the village-square kiosk, then walk in together via the cliff trail."}'::jsonb, st_setsrid(st_makepoint(35.5648, 33.5342), 4326), '/photos/hyrax-rock.jpg', 'publie', 3)
on conflict (territoire_id, slug) do update set nom = excluded.nom, accroche = excluded.accroche,
  description = excluded.description, type = excluded.type, difficulte = excluded.difficulte,
  acces_guide = excluded.acces_guide, trace = excluded.trace, trace_statut = excluded.trace_statut,
  distance_m = excluded.distance_m, denivele_pos_m = excluded.denivele_pos_m,
  denivele_neg_m = excluded.denivele_neg_m, duree_min_minutes = excluded.duree_min_minutes,
  duree_max_minutes = excluded.duree_max_minutes, saison = excluded.saison,
  dangers = excluded.dangers, acces = excluded.acces, depart = excluded.depart,
  photo = excluded.photo, statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'place-du-village', '{"fr":"Place du village — départ des sentiers","ar":"ساحة القرية — نقطة انطلاق الدروب","en":"Village square — trailhead"}'::jsonb, 'depart', st_setsrid(st_makepoint(35.5715, 33.5295), 4326), 1,
  '{"fr":"Le point de départ de tous les parcours. Le kiosque touristique, animé par les jeunes et les guides d''Azour, vous renseigne, vous équipe et vous met en route. Stationnement sur la place.","ar":"نقطة انطلاق جميع المسارات. الكشك السياحي، بإشراف شباب وأدلّاء عازور، يرشدكم ويجهّزكم ويضعكم على الدرب. موقف سيارات في الساحة.","en":"The starting point of every route. The tourist kiosk, run by Azour''s young people and guides, informs you, equips you and sets you on your way. Parking on the square."}'::jsonb, null, null, null, 'publie', 1)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'kiosque', '{"fr":"Kiosque touristique d''Azour","ar":"كشك عازور السياحي","en":"Azour tourist kiosk"}'::jsonb, 'patrimoine', st_setsrid(st_makepoint(35.5716, 33.5296), 4326), null,
  '{"fr":"Informations, conseils, réservation des guides et des sorties encadrées. Animé par les jeunes du village.","ar":"معلومات ونصائح وحجز الأدلّاء والنشاطات المؤطَّرة. بإشراف شباب القرية.","en":"Information, advice, booking of guides and supervised outings. Run by the village youth."}'::jsonb, null, null, null, 'publie', 2)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'eglise-saint-joseph', '{"fr":"Église Saint-Joseph","ar":"كنيسة مار يوسف","en":"Saint Joseph church"}'::jsonb, 'patrimoine', st_setsrid(st_makepoint(35.572, 33.53), 4326), null,
  '{"fr":"L''église du village, repère du départ des sentiers.","ar":"كنيسة القرية، معلم قرب نقطة انطلاق الدروب.","en":"The village church, a landmark by the trailhead."}'::jsonb, null, null, null, 'publie', 3)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'foret-des-pins', '{"fr":"Forêt de pins et d''orchidées","ar":"غابة الصنوبر والسحلبيات","en":"Pine and orchid forest"}'::jsonb, 'nature', st_setsrid(st_makepoint(35.5678, 33.5322), 4326), 2,
  '{"fr":"Pins, chênes et pistachier de Palestine. Au printemps, trois orchidées remarquables fleurissent ici : Limodorum abortivum, Ophrys fuciflora et Anacamptis sancta. En sous-bois, les champignons Mycena travaillent à l''équilibre de la forêt.","ar":"صنوبر وسنديان وبطم فلسطيني. في الربيع تُزهر هنا ثلاث سحلبيات نادرة: Limodorum abortivum وOphrys fuciflora وAnacamptis sancta. وفي ظل الأشجار تعمل فطور Mycena على توازن الغابة.","en":"Pines, oaks and Palestine pistachio. In spring three remarkable orchids bloom here: Limodorum abortivum, Ophrys fuciflora and Anacamptis sancta. On the forest floor, Mycena fungi keep the ecosystem in balance."}'::jsonb, '/photos/mycena.jpg', null, null, 'publie', 4)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'falaise-panoramique', '{"fr":"Falaise panoramique du Shir","ar":"جرف الشير البانورامي","en":"Shir panoramic cliff"}'::jsonb, 'belvedere', st_setsrid(st_makepoint(35.5648, 33.5342), 4326), 3,
  '{"fr":"Le grand balcon d''Azour : des falaises calcaires du Cénomanien, épaisses de 500 à 600 mètres, sculptées par le karst et piquetées de silex. En contrebas, la vallée du Bisri et le corridor de la rivière Awali. Levez les yeux en saison : les cigognes migrent au-dessus de la vallée.","ar":"شرفة عازور الكبرى: جروف كلسية من العصر السينوماني، بسماكة ٥٠٠ إلى ٦٠٠ متر، نحتها الكارست وتخللها الصوان. في الأسفل وادي بسري ومجرى نهر الأولي. ارفعوا أنظاركم في الموسم: طيور اللقلق تهاجر فوق الوادي.","en":"Azour''s great balcony: Cenomanian limestone cliffs 500-600 m thick, carved by karst and studded with chert. Below, the Bisri valley and the Awali river corridor. Look up in season: storks migrate over the valley."}'::jsonb, '/photos/shir-falaise.jpg', null, null, 'publie', 5)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'rocher-hyrax', '{"fr":"Hyrax Rock — le rocher du daman","ar":"صخرة الوبر","en":"Hyrax Rock"}'::jsonb, 'belvedere', st_setsrid(st_makepoint(35.563, 33.535), 4326), 4,
  '{"fr":"Un bloc calcaire suspendu au-dessus de la vallée, accessible uniquement en sortie encadrée (cordes fixes). Le daman des rochers — petit cousin lointain de l''éléphant — vit dans ces falaises et a donné son nom au site.","ar":"كتلة كلسية معلّقة فوق الوادي، لا يمكن الوصول إليها إلا في نشاط مؤطَّر (حبال مثبتة). الوبر الصخري — قريب بعيد صغير للفيل — يسكن هذه الجروف وأعطى الموقع اسمه.","en":"A limestone block suspended above the valley, reachable only on supervised outings (fixed ropes). The rock hyrax — a small, distant cousin of the elephant — lives in these cliffs and gave the site its name."}'::jsonb, '/photos/hyrax-rock.jpg', null, null, 'publie', 6)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'chir-el-joube', '{"fr":"Chir el Joube","ar":"شير الجوبة","en":"Chir el Joube"}'::jsonb, 'belvedere', st_setsrid(st_makepoint(35.5615, 33.539), 4326), 5,
  '{"fr":"Second système de falaises sur l''itinéraire vers le Bisri, au-dessus des terrasses de Joubeh.","ar":"نظام الجروف الثاني على الطريق إلى بسري، فوق جلول الجوبة.","en":"The second cliff system on the way to the Bisri, above the Joubeh terraces."}'::jsonb, null, null, null, 'publie', 7)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'belvedere-bisri', '{"fr":"Belvédère de la vallée du Bisri","ar":"مطل وادي بسري","en":"Bisri valley viewpoint"}'::jsonb, 'belvedere', st_setsrid(st_makepoint(35.5625, 33.5403), 4326), 6,
  '{"fr":"Vue ouverte sur la vallée préservée du Bisri et la rivière Awali, avant la grande descente.","ar":"إطلالة مفتوحة على وادي بسري المصان ونهر الأولي، قبل النزول الكبير.","en":"An open view over the preserved Bisri valley and the Awali river, before the big descent."}'::jsonb, '/photos/vallee-bisri.jpg', null, null, 'publie', 8)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'chemin-agricole', '{"fr":"Chemins agricoles du retour","ar":"الطرق الزراعية في طريق العودة","en":"Farm tracks on the way back"}'::jsonb, 'nature', st_setsrid(st_makepoint(35.5691, 33.5297), 4326), 7,
  '{"fr":"Le retour de la boucle emprunte les chemins agricoles du village — oliviers, terrasses et murets de pierre sèche.","ar":"تعود الجولة عبر طرق القرية الزراعية — زيتون وجلول وجدران حجرية جافة.","en":"The loop returns along the village farm tracks — olive trees, terraces and dry-stone walls."}'::jsonb, '/photos/chemin-agricole.jpg', null, null, 'publie', 9)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'village-bisri', '{"fr":"Village du Bisri (arrivée)","ar":"قرية بسري (الوصول)","en":"Bisri village (finish)"}'::jsonb, 'depart', st_setsrid(st_makepoint(35.553, 33.556), 4326), 8,
  '{"fr":"Point d''arrivée de l''itinéraire linéaire, au fond de la vallée. Prévoyez votre retour (voiture déposée ou navette avec un guide).","ar":"نقطة وصول المسار الخطي في قاع الوادي. دبّروا عودتكم (سيارة متروكة مسبقًا أو نقل مع دليل).","en":"The finish of the linear route, on the valley floor. Plan your return (a car left in advance, or a shuttle with a guide)."}'::jsonb, null, null, null, 'publie', 10)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'camping-el-abo', '{"fr":"Camping El Abo - Le Cave","ar":"مخيم العبو - المغارة","en":"El Abo - Le Cave campsite"}'::jsonb, 'camping', st_setsrid(st_makepoint(35.582, 33.5215), 4326), null,
  '{"fr":"Le site de camping aménagé par le programme à Bteddine El Lockh : sentiers, toilettes, point d''eau. Ouverture progressive en 2026-2027 — renseignez-vous au kiosque.","ar":"موقع التخييم الذي يجهّزه البرنامج في بتدين اللقش: دروب ومرافق صحية ونقطة ماء. افتتاح تدريجي في ٢٠٢٦–٢٠٢٧ — استعلموا عند الكشك.","en":"The campsite being developed by the programme at Bteddine El Lockh: trails, toilets, water point. Opening progressively in 2026-2027 — ask at the kiosk."}'::jsonb, null, null, null, 'publie', 11)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'blue-jay-valley', '{"fr":"Blue Jay Valley (hébergement)","ar":"بلو جاي فالي (إقامة)","en":"Blue Jay Valley (stay)"}'::jsonb, 'hebergement', st_setsrid(st_makepoint(35.576, 33.532), 4326), null,
  '{"fr":"Bungalows et tentes aménagées à Azour. Établissement indépendant du projet — contact direct.","ar":"أكواخ وخيام مجهزة في عازور. منشأة مستقلة عن المشروع — تواصل مباشر.","en":"Bungalows and furnished tents in Azour. Independent from the project — contact directly."}'::jsonb, null, null, '{"site":"https://bluejayvalley.com"}'::jsonb, 'publie', 12)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'pineview-hotel', '{"fr":"Pineview Hotel (hébergement)","ar":"فندق باين فيو (إقامة)","en":"Pineview Hotel (stay)"}'::jsonb, 'hebergement', st_setsrid(st_makepoint(35.57, 33.528), 4326), null,
  '{"fr":"Hôtel du village, sous les pins. Établissement indépendant du projet — contact direct.","ar":"فندق القرية تحت الصنوبر. منشأة مستقلة عن المشروع — تواصل مباشر.","en":"The village hotel, under the pines. Independent from the project — contact directly."}'::jsonb, null, null, null, 'publie', 13)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre)
values ((select id from territoires where slug = 'azour'), 'guides-azour', '{"fr":"Les jeunes guides d''Azour","ar":"أدلّاء عازور الشباب","en":"Azour''s young guides"}'::jsonb, 'guide', st_setsrid(st_makepoint(35.5716, 33.5296), 4326), null,
  '{"fr":"Formés en 2026-2027 dans le cadre du programme, les jeunes guides accompagnent les randonnées, encadrent Hyrax Rock et animent le kiosque. Réservation au kiosque ou par téléphone/WhatsApp.","ar":"تدرّبوا في ٢٠٢٦–٢٠٢٧ ضمن البرنامج، يرافقون المشيات ويؤطّرون صخرة الوبر ويديرون الكشك. الحجز عند الكشك أو عبر الهاتف/واتساب.","en":"Trained in 2026-2027 through the programme, the young guides lead hikes, supervise Hyrax Rock and run the kiosk. Book at the kiosk or by phone/WhatsApp."}'::jsonb, null, null, null, 'publie', 14)
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre;

delete from parcours_pois where parcours_id = (select id from parcours where slug = 'boucle-foret-falaise' and territoire_id = (select id from territoires where slug = 'azour'));
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'boucle-foret-falaise' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'place-du-village' and territoire_id = (select id from territoires where slug = 'azour')), 1
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'boucle-foret-falaise' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'foret-des-pins' and territoire_id = (select id from territoires where slug = 'azour')), 2
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'boucle-foret-falaise' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'falaise-panoramique' and territoire_id = (select id from territoires where slug = 'azour')), 3
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'boucle-foret-falaise' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'chemin-agricole' and territoire_id = (select id from territoires where slug = 'azour')), 4
on conflict do nothing;

delete from parcours_pois where parcours_id = (select id from parcours where slug = 'azour-joubeh-bisri' and territoire_id = (select id from territoires where slug = 'azour'));
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'azour-joubeh-bisri' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'place-du-village' and territoire_id = (select id from territoires where slug = 'azour')), 1
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'azour-joubeh-bisri' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'falaise-panoramique' and territoire_id = (select id from territoires where slug = 'azour')), 2
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'azour-joubeh-bisri' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'chir-el-joube' and territoire_id = (select id from territoires where slug = 'azour')), 3
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'azour-joubeh-bisri' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'belvedere-bisri' and territoire_id = (select id from territoires where slug = 'azour')), 4
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'azour-joubeh-bisri' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'village-bisri' and territoire_id = (select id from territoires where slug = 'azour')), 5
on conflict do nothing;

delete from parcours_pois where parcours_id = (select id from parcours where slug = 'hyrax-rock' and territoire_id = (select id from territoires where slug = 'azour'));
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'hyrax-rock' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'falaise-panoramique' and territoire_id = (select id from territoires where slug = 'azour')), 1
on conflict do nothing;
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = 'hyrax-rock' and territoire_id = (select id from territoires where slug = 'azour')),
       (select id from pois where slug = 'rocher-hyrax' and territoire_id = (select id from territoires where slug = 'azour')), 2
on conflict do nothing;

insert into evenements (territoire_id, slug, nom, description, date_debut, date_fin, recurrent, lien, photo, statut)
values ((select id from territoires where slug = 'azour'), 'trail-azour-2027', '{"fr":"Trail d''Azour 2027","ar":"سباق عازور الجبلي ٢٠٢٧","en":"Azour Trail 2027"}'::jsonb, '{"fr":"Le premier trail annuel d''Azour, préparé avec l''appui du Lebanon Mountain Trail : parcours sur les sentiers du Shir, ravitaillements au village, 250 coureurs attendus. Date et inscriptions annoncées ici et au kiosque.","ar":"أول سباق جبلي سنوي في عازور، بدعم من درب الجبل اللبناني: مسارات على دروب الشير وتموين في القرية و٢٥٠ عدّاءً متوقعًا. الموعد والتسجيل يُعلنان هنا وعند الكشك.","en":"Azour''s first annual trail race, prepared with the support of the Lebanon Mountain Trail: routes on the Shir trails, refreshments in the village, 250 runners expected. Date and registration announced here and at the kiosk."}'::jsonb, '2027-05-01', null,
  true, null, '/photos/panorama-crete.jpg', 'publie')
on conflict (territoire_id, slug) do update set nom = excluded.nom, description = excluded.description,
  date_debut = excluded.date_debut, date_fin = excluded.date_fin, recurrent = excluded.recurrent,
  lien = excluded.lien, photo = excluded.photo, statut = excluded.statut;

insert into evenements (territoire_id, slug, nom, description, date_debut, date_fin, recurrent, lien, photo, statut)
values ((select id from territoires where slug = 'azour'), 'randonnee-inauguration', '{"fr":"Randonnée d''inauguration des sentiers","ar":"مسيرة افتتاح الدروب","en":"Trail inauguration hike"}'::jsonb, '{"fr":"La grande randonnée d''ouverture officielle des sentiers d''Azour, avec les partenaires du programme, les jeunes du village et la diaspora. Date annoncée à l''achèvement des aménagements.","ar":"المسيرة الكبرى للافتتاح الرسمي لدروب عازور، مع شركاء البرنامج وشباب القرية والمغتربين. يُعلن الموعد عند اكتمال الأشغال.","en":"The official opening hike of the Azour trails, with the programme partners, the village youth and the diaspora. Date announced once the works are complete."}'::jsonb, '2027-06-01', null,
  false, null, '/photos/chemin-agricole.jpg', 'publie')
on conflict (territoire_id, slug) do update set nom = excluded.nom, description = excluded.description,
  date_debut = excluded.date_debut, date_fin = excluded.date_fin, recurrent = excluded.recurrent,
  lien = excluded.lien, photo = excluded.photo, statut = excluded.statut;

insert into evenements (territoire_id, slug, nom, description, date_debut, date_fin, recurrent, lien, photo, statut)
values ((select id from territoires where slug = 'azour'), 'migration-cigognes', '{"fr":"La migration des cigognes","ar":"هجرة اللقلق","en":"The stork migration"}'::jsonb, '{"fr":"Deux fois par an, les cigognes traversent le ciel de la vallée du Bisri — un spectacle à observer depuis la falaise panoramique, jumelles en main. Passages principaux : mars-avril vers le nord, septembre-octobre vers le sud.","ar":"مرتين في السنة تعبر طيور اللقلق سماء وادي بسري — مشهد يُراقب من الجرف البانورامي بالمناظير. العبور الرئيسي: آذار-نيسان شمالًا، وأيلول-تشرين الأول جنوبًا.","en":"Twice a year, storks cross the sky of the Bisri valley — a spectacle to watch from the panoramic cliff, binoculars in hand. Main passages: March-April northbound, September-October southbound."}'::jsonb, null, null,
  true, null, '/photos/cigognes.jpg', 'publie')
on conflict (territoire_id, slug) do update set nom = excluded.nom, description = excluded.description,
  date_debut = excluded.date_debut, date_fin = excluded.date_fin, recurrent = excluded.recurrent,
  lien = excluded.lien, photo = excluded.photo, statut = excluded.statut;
