-- ============================================================
-- PR 38c — Photos avant / pendant / après par phase
-- ============================================================
-- Matière première des rapports terrain et des supports de
-- communication : une photo de chantier ne vaut que rapprochée de son
-- état initial. Sans qualification du moment, une galerie de vingt
-- photos ne raconte rien.

create type doc_moment as enum ('avant', 'pendant', 'apres');

-- Nullable : seules les photos portent un moment. Un devis n'a pas
-- d'« avant ».
alter table documents
  add column if not exists moment doc_moment;

-- La galerie interroge les photos d'une phase non rattachées à une
-- tâche : c'est l'accès le plus fréquent de l'onglet Tâches.
create index if not exists documents_phase_photo_idx
  on documents(phase_id, type) where task_id is null;

-- ------------------------------------------------------------
-- Durcissement du bucket (dette signalée en 38a)
-- ------------------------------------------------------------
-- La limite de 10 Mo n'était vérifiée QUE dans le navigateur
-- (MAX_DOC_SIZE). Un appel direct à l'API Storage passait outre : pas
-- exploitable par un inconnu — les policies exigent d'être membre du
-- projet avec un rôle de dépôt — mais un membre légitime pouvait
-- saturer le stockage par accident. La limite est désormais appliquée
-- par le serveur, seul endroit où elle vaut quelque chose.
--
-- Les types autorisés couvrent large à dessein : bloquer un format
-- légitime en terrain associatif coûte plus cher que le risque écarté.
-- HEIC / HEIF sont indispensables — c'est le format par défaut des
-- iPhone, donc de la majorité des photos de chantier.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'application/pdf',
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'image/heic', 'image/heif',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'text/plain', 'text/csv'
       ]
 where id = 'documents';
