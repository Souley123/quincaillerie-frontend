/**
 * Réapplique les classes de mise en page mobile au module Caisse.
 *
 * POURQUOI UN SCRIPT ? Les modifications faites par l'outil d'édition sur ce
 * fichier ont été perdues deux fois (fichier rétabli à 232 lignes, daté
 * d'origine). Ce script est IDEMPOTENT : il vérifie l'état avant d'agir et
 * refuse de doubler une modification déjà présente.
 *
 * Usage : node scripts/appliquer-caisse-mobile.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const chemin = path.resolve(__dirname, '../src/modules/Caisse.js');
let source = fs.readFileSync(chemin, 'utf8');

if (source.includes('caisse-module')) {
  console.log('Déjà appliqué — aucune modification nécessaire.');
  process.exit(0);
}

const remplacements = [
  // 1. Conteneur racine + classe du titre.
  [
    `  return (\n    <div>\n      <h2 className="no-print" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.transaction}</h2>`,
    `  return (\n    <div className="caisse-module">\n      <h2 className="no-print caisse-titre" style={{ fontSize: headerConfig.tailleTitre, color: '#0f172a' }}>{t.transaction}</h2>`
  ],
  // 2. Grille extérieure (ordinateur : deux colonnes ; mobile : une seule via CSS).
  [
    `      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>`,
    `      <div className="caisse-grille" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>`
  ],
  // 3. Colonne de gauche : minWidth 0, sinon une grille refuse de rétrécir.
  [
    `        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>\n          <h3>Articles du catalogue</h3>`,
    `        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minWidth: 0 }}>\n          <h3>Articles du catalogue</h3>`
  ],
  // 4. Colonne du panier + cadre défilant du tableau.
  [
    `        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>\n          <h3>Panier Actuel</h3>`,
    `        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', minWidth: 0 }}>\n          <h3>Panier Actuel</h3>`
  ],
  [
    `          {panier.length === 0 ? <p style={{ color: '#64748b' }}>Panier vide.</p> : (\n            <div>\n              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>`,
    `          {panier.length === 0 ? <p style={{ color: '#64748b' }}>Panier vide.</p> : (\n            <div style={{ minWidth: 0 }}>\n              {/* Défilement DANS le tableau : sur 320 px, quatre colonnes ne\n                  tiennent pas. Le cadre ne dépasse jamais la carte. */}\n              <div className="caisse-table-defile">\n                <table className="caisse-table-panier" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>`
  ],
  // 5. Fermeture du cadre défilant + classe du total.
  [
    `              </table>\n              <h3 style={{ marginTop: '15px', textAlign: 'right', color: '#0f172a' }}>Total :`,
    `              </table>\n              </div>\n              <h3 className="caisse-total" style={{ marginTop: '15px', textAlign: 'right', color: '#0f172a' }}>Total :`
  ],
  // 6. Boutons d'action : flex-wrap + classe dédiée.
  [
    `              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>\n                <button onClick={validerTransaction} style={{ flex: 1,`,
    `              <div className="caisse-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>\n                <button onClick={validerTransaction} style={{ flex: '1 1 160px',`
  ],
  [
    `                <button type="button" onClick={lancerPaiementKkiapay} style={{ flex: 1,`,
    `                <button type="button" onClick={lancerPaiementKkiapay} style={{ flex: '1 1 160px',`
  ],
  [
    `                <button onClick={imprimerRecuFacture} title={estApplicationNative() ? 'Impression disponible sur ordinateur' : 'Imprimer le reçu'} style={{ backgroundColor:`,
    `                <button onClick={imprimerRecuFacture} title={estApplicationNative() ? 'Impression disponible sur ordinateur' : 'Imprimer le reçu'} style={{ flex: '1 1 140px', backgroundColor:`
  ],
  // 7. Barre de scan : l'input passe à la ligne sur mobile.
  [
    `boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', gap: '10px', alignItems: 'center' }}>`,
    `boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>`
  ],
  [
    `onKeyDown={traiterEntreeDouchette} style={{ flex: 1, padding: '10px',`,
    `onKeyDown={traiterEntreeDouchette} style={{ flex: '1 1 200px', minWidth: 0, padding: '10px',`
  ]
];

let appliques = 0;
for (const [avant, apres] of remplacements) {
  if (source.includes(avant)) {
    source = source.replace(avant, apres);
    appliques += 1;
  } else {
    console.warn(`⚠ motif non trouvé : ${avant.slice(0, 60).replace(/\n/g, ' ⏎ ')}…`);
  }
}

fs.writeFileSync(chemin, source, 'utf8');
console.log(`${appliques}/${remplacements.length} modifications appliquées.`);
console.log('Classes présentes :', ['caisse-module', 'caisse-grille', 'caisse-table-defile', 'caisse-table-panier', 'caisse-total', 'caisse-actions'].filter(c => source.includes(c)).join(', '));
