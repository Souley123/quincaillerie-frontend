import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import Caisse from './Caisse';

vi.mock('../components/ScannerHtml5', () => ({ default: () => <div data-testid="fake-scanner" /> }));
vi.mock('../components/Icones', () => ({ Icone: () => <span aria-hidden="true" /> }));
vi.mock('../services/dialogues', () => ({ estApplicationNative: () => false }));
vi.mock('../services/mentionsLegales', () => ({ construireMentionsLegales: () => [] }));

const construireProps = surcharger => ({
  t: { transaction: 'Caisse & Transactions', printReceipt: 'Imprimer' },
  headerConfig: {},
  recuConfig: { couleur: '#000' },
  storeInfo: { nomMagasin: 'Test' },
  selectedClientTx: '',
  selectedPaymentMethod: 'Espèces',
  setSelectedPaymentMethod: vi.fn(),
  MOYENS_PAIEMENT: ['Espèces'],
  panier: [],
  totalPanier: 0,
  handleBarcodeScan: vi.fn(),
  scannerInputRef: { current: null },
  barcodeInput: '',
  barcodeInputRef: { current: '' },
  setBarcodeInput: vi.fn(),
  traiterEntreeDouchette: vi.fn(),
  setCameraOpen: vi.fn(),
  cameraOpen: false,
  cameraError: '',
  setCameraError: vi.fn(),
  traiterCodeScanne: vi.fn(),
  scanResult: null,
  preparerArticleDepuisCode: vi.fn(),
 products: [{ _id: 'p1', nom: 'Marteau', ref: 'OUT-1', prix: 2500, quantiteStock: 4 }],
  selectedPosCatalogItem: 'p1',
  setSelectedPosCatalogItem: vi.fn(),
  ajouterAuPanier: vi.fn(),
  ajouterArticleCatalogueSelectionne: vi.fn(() => true),
  reduireQuantitePanier: vi.fn(),
  retirerDuPanier: vi.fn(),
  validerTransaction: vi.fn(),
  lancerPaiementKkiapay: vi.fn(),
  imprimerRecuFacture: vi.fn(),
  ...surcharger
});

describe('Caisse — actions du catalogue et du panier', () => {
  test('Ajouter au panier transmet l’action de l’article sélectionné, sans soumettre de formulaire', () => {
    const ajouterArticleCatalogueSelectionne = vi.fn(() => true);
    render(<Caisse {...construireProps({ ajouterArticleCatalogueSelectionne })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ajouter au panier' })[1]);
    expect(ajouterArticleCatalogueSelectionne).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Votre panier est vide.')).toBeInTheDocument();
  });

  test('Réduire transmet l’article choisi et est désactivé quand le panier est vide', () => {
    const props = construireProps({
      panier: [{ _id: 'p1', nom: 'Marteau', prix: 2500, qteVente: 1 }]
    });
    const { unmount } = render(<Caisse {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Réduire/i }));
    expect(props.reduireQuantitePanier).toHaveBeenCalledWith('p1');
    unmount();

    const propsPanierVide = construireProps();
    render(<Caisse {...propsPanierVide} />);
    expect(screen.getByRole('button', { name: /Réduire/i })).toBeDisabled();
  });

  test('les boutons paiement, paiement en ligne et impression sont des boutons explicites', () => {
    const props = construireProps({
      panier: [{ _id: 'p1', nom: 'Marteau', prix: 2500, qteVente: 1 }],
      totalPanier: 2500
    });
    render(<Caisse {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Valider le paiement' }));
    fireEvent.click(screen.getByRole('button', { name: /Payer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Imprimer' }));
    expect(props.validerTransaction).toHaveBeenCalledTimes(1);
    expect(props.lancerPaiementKkiapay).toHaveBeenCalledTimes(1);
    expect(props.imprimerRecuFacture).toHaveBeenCalledTimes(1);
  });
});
