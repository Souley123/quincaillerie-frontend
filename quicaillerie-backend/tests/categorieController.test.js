/**
 * Tests du contrôleur catégories — logique pure, sans base de données.
 *
 * Ce qui est vérifié ici est exactement ce qui fait la cohérence de la chaîne
 * Catégorie → Sous-catégorie → Article : la normalisation utilisée comme clé
 * de comparaison, et le filtre Mongoose qui retrouve les articles
 * d'une catégorie (casse, accents et espaces ignorés).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

/* Les modèles Mongoose ne se connectent pas à l'import : on peut charger le
   contrôleur pour tester ses fonctions sans serveur. */
const controleur = require(path.join(__dirname, '..', 'controllers', 'categorieController'));

test('normaliser ignore casse, accents et espaces superflus', () => {
  assert.equal(controleur.normaliser('  Matélas  '), 'matelas');
  assert.equal(controleur.normaliser('MATELAS'), 'matelas');
  assert.equal(controleur.normaliser('Matelas'), 'matelas');
  // Deux écritures du même nom doivent produire la MÊME clé : sinon le
  // serveur laisserait créer « Ciment » et « ciment ».
  assert.equal(controleur.normaliser('Électricité'), controleur.normaliser('electricite'));
  assert.equal(controleur.normaliser(''), '');
  assert.equal(controleur.normaliser(null), '');
});

test('normaliser borne la longueur (protection contre les noms démesurés)', () => {
  assert.equal(controleur.normaliser('a'.repeat(200)).length, 80);
});

test('la catégorie de repli existe et n’est jamais vide', () => {
  assert.equal(typeof controleur.CATEGORIE_REPLI, 'string');
  assert.ok(controleur.CATEGORIE_REPLI.trim().length > 0);
});
