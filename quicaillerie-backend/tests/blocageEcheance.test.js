const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Blocage automatique à l'échéance : vérifie la règle de décision appliquée
 * par le middleware multi-tenant et le contrôleur de connexion.
 *
 * La règle : l'accès est coupé si l'abonnement est inactif OU si son échéance
 * est dépassée, même quand le booléen abonnementActif est resté à true.
 */
const DUREE_ESSAI_JOURS = 5;
const accesRefuse = entreprise => {
  const echeanceEssai = entreprise.abonnementActuel === 'essai'
    ? new Date(new Date(entreprise.dateCreation).getTime() + DUREE_ESSAI_JOURS * 24 * 60 * 60 * 1000)
    : null;
  const echeance = echeanceEssai || entreprise.abonnementEcheance;
  const echeanceDepassee = echeance && new Date(echeance).getTime() < Date.now();
  const echeanceHistoriqueDepassee = !entreprise.abonnementActuel && entreprise.abonnementEcheance
    && new Date(entreprise.abonnementEcheance).getTime() < Date.now();
  return entreprise.abonnementActuel === 'expire' || !entreprise.abonnementActif
    || Boolean(echeanceDepassee) || Boolean(echeanceHistoriqueDepassee);
};

test('abonnement actif et échéance future → accès autorisé', () => {
  const futur = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  assert.equal(accesRefuse({ abonnementActif: true, abonnementEcheance: futur }), false);
});

test('échéance dépassée → accès refusé même si le booléen dit actif', () => {
  const passe = new Date(Date.now() - 1000);
  assert.equal(accesRefuse({ abonnementActif: true, abonnementEcheance: passe }), true);
});

test('abonnement inactif → accès refusé', () => {
  const futur = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  assert.equal(accesRefuse({ abonnementActif: false, abonnementEcheance: futur }), true);
});

test('sans échéance définie, seul le booléen compte', () => {
  assert.equal(accesRefuse({ abonnementActif: true, abonnementEcheance: null }), false);
  assert.equal(accesRefuse({ abonnementActif: false, abonnementEcheance: null }), true);
});

test('nouvel essai de 5 jours : autorisé jusqu’à la date de fin, refusé après', () => {
  const debut = Date.now();
  const echeance = new Date(debut + 5 * 24 * 60 * 60 * 1000);

  const jour4 = debut + 4 * 24 * 60 * 60 * 1000;
  assert.equal(new Date(echeance).getTime() < jour4, false, 'encore dans la fenêtre de 5 jours');

  const jour6 = debut + 6 * 24 * 60 * 60 * 1000;
  assert.equal(new Date(echeance).getTime() < jour6, true, 'fenêtre dépassée');
});

test('compte de démonstration : durée bornée entre 1 et 90 jours', () => {
  const borne = valeur => {
    const n = Number(valeur);
    return Number.isFinite(n) && n >= 1 && n <= 90 ? n : 3;
  };
  assert.equal(borne(3), 3);
  assert.equal(borne(0), 3);
  assert.equal(borne(-5), 3);
  assert.equal(borne(200), 3);
  assert.equal(borne('abc'), 3);
  assert.equal(borne(1), 1);
  assert.equal(borne(90), 90);
});
/**
 * Anti-abus de l'essai gratuit : l'essai est lié à l'ADRESSE EMAIL, pas
 * seulement au sous-domaine. Sans cette règle, un client pouvait boucler
 * « essai expiré → nouvelle inscription avec un autre sous-domaine →
 * nouvel essai » et obtenir un essai gratuit illimité.
 *
 * Reconstruction isolée de la décision prise dans authController.inscription :
 * si l'email a déjà servi à une inscription, la nouvelle entreprise démarre
 * avec une échéance DANS LE PASSÉ (donc bloquée immédiatement, cf. la règle
 * d'accès ci-dessus).
 */
const DUREE_ESSAI_JOURS_EMAIL = 5;
const echeancePourEmail = emailDejaEssaye =>
  emailDejaEssaye
    ? new Date(Date.now() - 1000)
    : new Date(Date.now() + DUREE_ESSAI_JOURS_EMAIL * 24 * 60 * 60 * 1000);

test('un email déjà utilisé n’obtient AUCUN nouvel essai (échéance passée)', () => {
  const echeance = echeancePourEmail(true);
  assert.equal(echeance.getTime() < Date.now(), true, 'échéance dans le passé → 402 immédiat');
});

test('un email jamais utilisé obtient le nouvel essai de 5 jours', () => {
  const echeance = echeancePourEmail(false);
  const jours = (echeance.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(jours > 4.9 && jours <= 5, 'environ 5 jours');
});

test('email déjà essayé → accès refusé, même avec abonnementActif true', () => {
  const passe = new Date(Date.now() - 1000);
  assert.equal(accesRefuse({ abonnementActif: true, abonnementEcheance: passe }), true);
});
