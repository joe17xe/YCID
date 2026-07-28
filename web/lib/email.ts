// ============================================================
// LA règle du format d'une adresse email — source unique
// ============================================================
// L'import de comptes a laissé passer deux adresses malformées (un
// point en tête), dont celle d'un référent mairie — injoignable par
// notification sans que rien ne le signale. Cause racine : HUIT
// copies de la règle, sept laxistes (elles acceptaient « .nom@… »)
// et une stricte (l'envoi d'emails, notify-circuit) — l'adresse
// passait la porte puis échouait au guichet.
//
// La règle vit désormais ici, celle de l'envoi : premier caractère ni
// espace, ni @, ni point — car c'est l'envoi qui décide, en dernier
// ressort, de ce qui est exploitable. Création de comptes, import en
// masse, invitations, contacts d'organisations, expéditeur SMTP et
// envoi partagent la même.

export const EMAIL_RE = /^[^\s@.][^\s@]*@[^\s@]+\.[^\s@]+$/

export function isUsableEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email)
}
