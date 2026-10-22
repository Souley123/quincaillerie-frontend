/* Fichier de vérification TEMPORAIRE (supprimé après exécution) : contrôle
   que le module Stock ne réaffiche plus d'erreur de chargement globale. */
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import Stock from './modules/Stock';

const props = surcharges => ({
  t: { stock: 'Stock', valeurStock: 'Valeur', add: 'Ajouter', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier' },
  bgColor: '#f1f5f9',
  products: [],
  FAMILLES_PRODUITS: ['Divers'],
  fournisseursServeur: [],
  selectedFamille: 'Divers',
  setSelectedFamille: () => { },
  totalValeurStock: 0,
  prodForm: { ref: '', nom: '', codeBarre: '', famille: 'Divers', fournisseur: '', prixAchat: '', prix: '', quantiteStock: '', minStock: '', maxStock: '' },
  setProdForm: () => { },
  editingProdId: null,
  handleProductSubmit: e => e.preventDefault(),
  resetProdForm: () => { },
  handleEditProd: () => { },
  handleDeleteProduct: () => { },
  sousCategories: [],
  categorieForm: { nom: '', description: '' },
  setCategorieForm: () => { },
  sousCategorieForm: { nom: '', categorie: '', description: '' },
  setSousCategorieForm: () => { },
  categoriesReference: ['Divers'],
  ajouterCategorie: e => e.preventDefault(),
  supprimerCategorie: () => { },
  ajouterSousCategorie: e => e.preventDefault(),
  supprimerSousCategorie: () => { },
  ...surcharges
});

describe('Stock — bandeau d’erreur', () => {
  test('aucune erreur de chargement globale affichée au-dessus du formulaire', () => {
    render(<Stock {...props()} />);
    expect(screen.queryByText(/Trop de requêtes/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Créer une fiche article')).toBeInTheDocument();
  });

  test('un échec de la soumission reste affiché', async () => {
    const handleProductSubmit = vi.fn().mockRejectedValue(new Error('Article refusé.'));
    const { getByRole } = render(<Stock {...props({ handleProductSubmit })} />);
    /* Le formulaire exige des champs valides (required) : on soumet
       directement pour déclencher l'enveloppe de soumission. */
    getByRole('button', { name: 'Ajouter' }).closest('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toContain('Article refusé.');
  });
});
