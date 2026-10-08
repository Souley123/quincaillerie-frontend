const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Blocage automatique à l'échéance : vérifie la règle de décision appliquée
 * par le middleware multi-tenant et le contrôleur de connexion.
 *
 * La règle : l'accès est coupé si l'abonnement est inactif OU si son échéance
 * est dépassée, même quand le booléen abonnementActif est resté à true.
 */
const accesRefuse = entreprise => {
  const echeanceDepassee = entreprise.abonnementEcheance
    && new Date(entreprise.abonnementEcheance).getTime() < Date.now();
  return !entreprise.abonnementActif || Boolean(echeanceDepassee);
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

test('essai de 3 jours : accès autorisé au jour 2, refusé au jour 4', () => {
  const debut = Date.now();
  const echeance = new Date(debut + 3 * 24 * 60 * 60 * 1000);

  const jour2 = debut + 2 * 24 * 60 * 60 * 1000;
  assert.equal(new Date(echeance).getTime() < jour2, false, 'encore dans la fenêtre');

  const jour4 = debut + 4 * 24 * 60 * 60 * 1000;
  assert.equal(new Date(echeance).getTime() < jour4, true, 'fenêtre dépassée');
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
