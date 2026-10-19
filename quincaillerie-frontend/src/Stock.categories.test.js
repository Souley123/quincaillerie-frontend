import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Stock from './modules/Stock';

const mockFunction = () => vi.fn();


/**
 * Régression : dans l'onglet « Catégories », le tableau mélange deux sources —
 * les familles de référence (FAMILLES_PRODUITS, codées en dur) et les
 * catégories ajoutées par l'utilisateur (categoriesAjoutees, supprimables).
 *
 * Le bouton « Supprimer » était rendu pour TOUTES les lignes, y compris les
 * familles de référence : cliquer dessus ne produisait rien de visible, car
 * supprimerCategorie() ne filtre que categoriesAjoutees. D'où l'impression que
 * « le bouton ne fonctionne pas ».
 *
 * Attendu désormais : les familles de référence n'ont pas de bouton actif
 * (bouton « Référence » désactivé), les catégories personnalisées si.
 */
const FAMILLES_PRODUITS = ['Quincaillerie de fixation', 'Outillage manuel', 'Divers'];

const baseProps = (surcharges = {}) => ({
  t: { stock: 'Stock', valeurStock: 'Valeur', add: 'Ajouter', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier' },
  bgColor: '#f1f5f9',
  products: [],
  FAMILLES_PRODUITS,
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
  categoriesReference: FAMILLES_PRODUITS,
  ajouterCategorie: e => e.preventDefault(),
  supprimerCategorie: () => { },
  ajouterSousCategorie: e => e.preventDefault(),
  supprimerSousCategorie: () => { },
  ...surcharges
});

const ouvrirOngletCategories = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Catégories' }));
};

/** La ligne du tableau correspondant à un libellé de catégorie. */
const ligneDe = libelle =>
  screen.getByText(libelle, { selector: 'td' }).closest('tr');

describe('Stock — onglet Catégories : suppression', () => {
  test('une famille de référence n’a pas de bouton Supprimer actif', async () => {
    render(<Stock {...baseProps()} />);
    await ouvrirOngletCategories();

    const ligne = ligneDe('Outillage manuel');
    expect(within(ligne).getByText('Famille de référence')).toBeInTheDocument();

    const bouton = within(ligne).getByRole('button');
    expect(bouton).toBeDisabled();
    expect(bouton).toHaveTextContent('Référence');
  });

  test('une catégorie personnalisée est supprimable et le clic la retire', async () => {
    const supprimerCategorie = mockFunction();
    render(
      <Stock
        {...baseProps({
          categoriesReference: [...FAMILLES_PRODUITS, 'Ma catégorie perso'],
          supprimerCategorie
        })}
      />
    );
    await ouvrirOngletCategories();

    const ligne = ligneDe('Ma catégorie perso');
    expect(within(ligne).getByText('Catégorie personnalisée')).toBeInTheDocument();

    const bouton = within(ligne).getByRole('button', { name: 'Supprimer' });
    expect(bouton).toBeEnabled();

    await userEvent.click(bouton);
    expect(supprimerCategorie).toHaveBeenCalledTimes(1);
    expect(supprimerCategorie).toHaveBeenCalledWith('Ma catégorie perso');
  });

  test('cliquer sur « Référence » ne déclenche aucune suppression', async () => {
    const supprimerCategorie = mockFunction();
    render(<Stock {...baseProps({ supprimerCategorie })} />);
    await ouvrirOngletCategories();

    const bouton = within(ligneDe('Divers')).getByRole('button');
    await userEvent.click(bouton);

    expect(supprimerCategorie).not.toHaveBeenCalled();
  });
});
/**
 * Régression — onglet « Catégories » : nombre d'articles par catégorie.
 *
 * Le tableau de bord affiche « Outillage manuel — 2 article(s) » dans son
 * sélecteur, mais l'onglet Catégories ne montrait aucun compteur : les deux
 * écrans ne concordaient pas, et on ne pouvait pas savoir combien d'articles
 * une catégorie contenait sans ouvrir le tableau de bord.
 *
 * Attendu désormais : chaque ligne de catégorie affiche son nombre d'articles,
 * calculé EXACTEMENT comme le tableau de bord (même filtre sur `famille`).
 */
const ARTICLES = [
  { id: '1', nom: 'Marteau', famille: 'Outillage manuel' },
  { id: '2', nom: 'Tournevis', famille: 'Outillage manuel' },
  { id: '3', nom: 'Vis 4x40', famille: 'Quincaillerie de fixation' }
];

describe('Stock — onglet Catégories : nombre d’articles', () => {
  test('chaque catégorie affiche son nombre d’articles', async () => {
    render(<Stock {...baseProps({ products: ARTICLES })} />);
    await ouvrirOngletCategories();

    // « Outillage manuel » contient 2 articles.
    expect(within(ligneDe('Outillage manuel')).getByText(/2 article/)).toBeInTheDocument();
    // « Quincaillerie de fixation » en contient 1.
    expect(within(ligneDe('Quincaillerie de fixation')).getByText(/1 article/)).toBeInTheDocument();
    // « Divers » n'en contient aucun : la ligne doit l'indiquer aussi.
    expect(within(ligneDe('Divers')).getByText(/0 article/)).toBeInTheDocument();
  });

  test('une catégorie sans article affiche bien 0', async () => {
    render(<Stock {...baseProps({ products: [] })} />);
    await ouvrirOngletCategories();

    expect(within(ligneDe('Divers')).getByText(/0 article/)).toBeInTheDocument();
  });

  test('le compteur suit la catégorie, pas le nom de l’article', async () => {
    render(
      <Stock
        {...baseProps({
          products: [
            { id: '1', nom: 'Divers', famille: 'Outillage manuel' },
            { id: '2', nom: 'Autre', famille: 'Outillage manuel' }
          ]
        })}
      />
    );
    await ouvrirOngletCategories();

    // Un article NOMMÉ « Divers » ne doit pas être compté dans la catégorie
    // « Divers » : seul le champ `famille` fait foi.
    expect(within(ligneDe('Outillage manuel')).getByText(/2 article/)).toBeInTheDocument();
    expect(within(ligneDe('Divers')).getByText(/0 article/)).toBeInTheDocument();
  });
});/**
 * Vérifie la STRUCTURE du tableau : les colonnes affichées et leur espacement.
 *
 * Pourquoi ce test existe : le nombre d'articles était calculé et affiché dans
 * le tableau de bord, mais le tableau des catégories ne comportait AUCUNE
 * colonne pour l'accueillir. Vérifier seulement le contenu des lignes ne
 * suffisait donc pas — il faut contrôler l'en-tête lui-même.
 */
describe('Stock — clés stables pour les listes', () => {
  test('évite les avertissements React de clés manquantes ou dupliquées', async () => {
    const avertissements = vi.spyOn(console, 'error').mockImplementation(() => {});
    const produits = [
      { id: 'article-1', ref: 'REF-1', nom: 'Marteau', famille: 'Outillage manuel', fournisseur: 'Fournisseur A', codeBarre: '123', prix: 500, quantiteStock: 2, minStock: 1 },
      { id: 'article-2', ref: 'REF-2', nom: 'Tournevis', famille: 'Outillage manuel', fournisseur: 'Fournisseur A', codeBarre: '456', prix: 300, quantiteStock: 4, minStock: 1 }
    ];
    const props = {
      products: produits,
      selectedFamille: 'Outillage manuel',
      categoriesReference: [...FAMILLES_PRODUITS, 'Catégorie perso'],
      sousCategories: [
        { id: 'sous-1', nom: 'À main', categorie: 'Outillage manuel' },
        { id: 'sous-2', nom: 'Électrique', categorie: 'Outillage manuel' }
      ],
      fournisseursServeur: [{ nom: 'Fournisseur A' }, { nom: 'Fournisseur B' }]
    };
    try {
      const { rerender } = render(<Stock {...baseProps(props)} />);

      await userEvent.click(screen.getByRole('button', { name: 'Sous-catégories' }));
      rerender(<Stock {...baseProps(props)} />);
      await userEvent.click(screen.getByRole('button', { name: 'Articles' }));
      rerender(<Stock {...baseProps(props)} />);
      await userEvent.click(screen.getByRole('button', { name: 'Catégories' }));
      rerender(<Stock {...baseProps(props)} />);

      expect(avertissements.mock.calls.flat().join(' ')).not.toMatch(/unique \"key\" prop|Encountered two children with the same key/);
    } finally {
      avertissements.mockRestore();
    }
  });
});

describe('Stock — onglet Catégories : structure du tableau', () => {
  /** L'en-tête du tableau des catégories, tel qu'affiché. */
  const entetes = () =>
    [...document.querySelectorAll('table thead th')].map(th => th.textContent.trim());

  test('l’en-tête comporte bien une colonne « Articles »', async () => {
    render(<Stock {...baseProps({ products: ARTICLES })} />);
    await ouvrirOngletCategories();

    expect(entetes()).toContain('Articles');
    // Les autres colonnes restent présentes et dans l'ordre attendu.
    expect(entetes()).toEqual([
      'Catégorie', 'Description', 'Articles', 'Sous-catégories', 'Actions'
    ]);
  });

  test('l’espacement des cellules est compact', async () => {
    render(<Stock {...baseProps({ products: ARTICLES })} />);
    await ouvrirOngletCategories();

    const cellule = document.querySelector('table tbody td');
    // 8px : valeur voulue pour un tableau dense mais lisible.
    expect(cellule.style.padding).toBe('8px');
  });

  test('la taille du texte du tableau reste lisible', async () => {
    render(<Stock {...baseProps({ products: ARTICLES })} />);
    await ouvrirOngletCategories();

    const table = document.querySelector('table');
    expect(table.style.fontSize).toBe('12px');
  });
});