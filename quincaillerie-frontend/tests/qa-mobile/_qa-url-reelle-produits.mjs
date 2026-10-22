/* Relève l'URL EXACTE de la requête catalogue réellement émise par le frontend
   (diagnostic en lecture seule, ne modifie ni l'application ni la base).

   Pourquoi ce script existe
   -------------------------
   `_qa-camembert-avec-donnees.mjs` simule `GET /api/products` avec le motif
   /\/api\/products(\?|$)/. Si le frontend n'appelle pas exactement cette URL,
   l'interception ne s'applique jamais, la requête part vers le vrai serveur et
   le camembert s'affiche vide. On mesure donc ici ce que le navigateur émet
   vraiment : URL, méthode, type de ressource, statut.

   Aucune interception de /api/products : les appels restent réels. Seule la
   vérification de session (`GET /api/auth/moi`) est contournée, sinon l'ERP
   affiche l'écran de connexion et ne charge aucun module.

   Structure
   ---------
   1. `CONFIGURATION` / `SESSION` : réglages nommés (plus aucun « nombre
                       magique » perdu dans le déroulé du scénario).
   2. `Session`     : responsable d'ouvrir l'ERP avec une session simulée
                      (SRP — seule la mise en place de la session est ici).
   3. `ObservateurCatalogue` : collecte les échanges catalogue et sait vider
                      sa fenêtre d'observation (SRP + encapsulation : plus de
                      tableaux partagés que l'on tronque à distance).
   4. `Menu`        : ouverture d'un module par son libellé (détail d'UI isolé,
                      réutilisable par les autres scripts QA).
   5. `run`         : orchestration du scénario et construction du rapport.

   Politique d'interception de `/api/products`
   -------------------------------------------
   Le motif de `_qa-camembert-avec-donnees.mjs` ne couvre que le chemin EXACT
   `/api/products`. Or le frontend appelle le catalogue AVEC paramètre
   (`listerProduits({ limite: 2000 })` → `/api/products?limite=2000`) et
   utilise aussi des sous-chemins (`/api/products/code/:code`). Le rapport
   indique donc, pour chaque requête observée, si ce motif l'intercepterait
   (`intercepteParMotifActuel`), au lieu de le laisser deviner. */

/* ----------------------------------------------------------------------------
   1. Configuration et session de démonstration
   -------------------------------------------------------------------------- */
const CONFIGURATION = Object.freeze({
  viewport: Object.freeze({ width: 1366, height: 900 }),
  delais: Object.freeze({
    menuMobile: 500,
    ouvertureModule: 2500,
    stabilisationDonnees: 1500,
    premierChargement: 5000,
    clicMenu: 5000
  }),
  modules: Object.freeze(['Stock', 'Caisse']),
  /* Motifs partiels : on veut voir AUSSI les sous-chemins (`/code/:code`). */
  segmentsCatalogue: Object.freeze(['/api/products', '/products']),
  maxUrls: 6
});

/* Mêmes valeurs que les autres scripts QA. `companyId` est requis par
   useDonneesServeur pour déclencher le chargement. */
const SESSION = Object.freeze({
  jeton: 'jeton-qa-mobile',
  utilisateur: Object.freeze({
    nom: 'QA',
    email: 'demo@skys-erp.com',
    role: 'Administrateur'
  }),
  entreprise: Object.freeze({
    nom: 'Quincaillerie QA',
    slug: 'demo',
    abonnementActif: true,
    companyId: 'qa0000000000000000000001'
  })
});

/* Motif utilisé par `_qa-camembert-avec-donnees.mjs` : on ÉVALUE sa fidélité au
   lieu de la supposer. */
const MOTIF_ACTUEL_CAMEMBERT = /\/api\/products(\?|$)/;

const SELECTEURS = Object.freeze({
  boutonMenu: '.app-menu-toggle',
  liensMenu: '.sidebar a, .app-sidebar a, .sidebar button, .app-sidebar button'
});

/* ----------------------------------------------------------------------------
   2. Session — ouverture de l'ERP sans passer par l'écran de connexion
   -------------------------------------------------------------------------- */
const Session = {
  /** Injecte le jeton puis suspend la vérification de session avant tout script. */
  async preparer(page, session = SESSION) {
    await page.setViewportSize(CONFIGURATION.viewport);

    await page.addInitScript(([jeton, utilisateur, entreprise]) => {
      localStorage.setItem('skys_erp_jeton', jeton);
      localStorage.setItem(
        'skys_erp_entreprise',
        JSON.stringify({ utilisateur, entreprise })
      );
    }, [session.jeton, session.utilisateur, session.entreprise]);

    await page.route('**/api/auth/moi', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        utilisateur: session.utilisateur,
        entreprise: session.entreprise
      })
    }));
  },

  /** Recharge la page avec la session en place et attend le chargement initial. */
  async ouvrirErp(page) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(CONFIGURATION.delais.premierChargement);
  }
};

/* ----------------------------------------------------------------------------
   3. ObservateurCatalogue — collecte des échanges réseau du catalogue
   -------------------------------------------------------------------------- */
class ObservateurCatalogue {
  #requetes = [];
  #reponses = [];

  constructor(page, segments = CONFIGURATION.segmentsCatalogue) {
    this.concerneCatalogue = url => segments.some(segment => url.includes(segment));

    page.on('request', this.#enregistrerRequete);
    page.on('response', this.#enregistrerReponse);
  }

  #enregistrerRequete = requete => {
    if (!this.concerneCatalogue(requete.url())) return;
    this.#requetes.push({
      methode: requete.method(),
      type: requete.resourceType(),
      url: requete.url(),
      typeContenu: requete.headers()['content-type'] || ''
    });
  };

  #enregistrerReponse = reponse => {
    if (!this.concerneCatalogue(reponse.url())) return;
    this.#reponses.push({ statut: reponse.status(), url: reponse.url() });
  };

  /** Repart de zéro pour le module suivant (au lieu de tronquer de l'extérieur). */
  reinitialiser() {
    this.#requetes.length = 0;
    this.#reponses.length = 0;
  }

  /** Instantané immuable de la fenêtre d'observation courante. */
  instantane() {
    return { requetes: [...this.#requetes], reponses: [...this.#reponses] };
  }
}

/* ----------------------------------------------------------------------------
   4. Menu — navigation par libellé dans la barre latérale
   -------------------------------------------------------------------------- */
const Menu = {
  /** Sur téléphone, la barre latérale est un tiroir qu'il faut déplier. */
  async ouvrirTiroirSiBesoin(page) {
    const bouton = page.locator(SELECTEURS.boutonMenu);
    if (!(await bouton.isVisible().catch(() => false))) return;

    await bouton.click().catch(() => { });
    await page.waitForTimeout(CONFIGURATION.delais.menuMobile);
  },

  /**
   * Ouvre un module par son libellé.
   * @returns {Promise<boolean>} `false` si le module est absent du menu.
   */
  async ouvrirModule(page, nom) {
    await this.ouvrirTiroirSiBesoin(page);

    const lien = page.locator(SELECTEURS.liensMenu)
      .filter({ hasText: new RegExp(nom, 'i') })
      .first();

    if (await lien.count() === 0) return false;

    await lien.click({ timeout: CONFIGURATION.delais.clicMenu }).catch(() => { });
    await page.waitForTimeout(CONFIGURATION.delais.ouvertureModule);
    return true;
  }
};

/* ----------------------------------------------------------------------------
   5. Synthèse du rapport
   -------------------------------------------------------------------------- */
const uniques = valeurs => [...new Set(valeurs)];

const cheminDe = url => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const resumerRequete = requete => ({
  methode: requete.methode,
  url: requete.url,
  chemin: cheminDe(requete.url),
  intercepteParMotifActuel: MOTIF_ACTUEL_CAMEMBERT.test(requete.url)
});

/** Construit la synthèse globale à partir des fenêtres observées par module. */
function construireRapport(modules) {
  const requetes = Object.values(modules).flatMap(module => module.requetes);
  const resumees = requetes.map(resumerRequete);

  return {
    modules,
    /* `urls` : ce qu'il faut mettre dans le motif d'interception.
       `chemins` (ex. « /api/products » ou « /products ») est la seule
       information indispensable pour savoir si le motif actuel est correct. */
    urlsDistinctes: uniques(resumees.map(requete => requete.url))
      .slice(0, CONFIGURATION.maxUrls),
    cheminsDistincts: uniques(resumees.map(requete => requete.chemin))
      .slice(0, CONFIGURATION.maxUrls),
    totalRequetes: requetes.length,
    aucunAppelCatalogue: requetes.length === 0,
    /* Verdict direct sur la fidélité du motif utilisé par le script camembert. */
    motifActuel: {
      source: String(MOTIF_ACTUEL_CAMEMBERT),
      requetesCouvertes: resumees.filter(requete => requete.intercepteParMotifActuel).length,
      requetesNonCouvertes: resumees
        .filter(requete => !requete.intercepteParMotifActuel)
        .map(requete => requete.url)
    }
  };
}

/* ----------------------------------------------------------------------------
   Scénario
   -------------------------------------------------------------------------- */
export default async function run(page) {
  await Session.preparer(page);
  const observateur = new ObservateurCatalogue(page);

  await Session.ouvrirErp(page);

  const modules = {};
  for (const nom of CONFIGURATION.modules) {
    observateur.reinitialiser();

    const ouvert = await Menu.ouvrirModule(page, nom);
    /* On attend la stabilisation AVANT l'instantané : c'est cette fenêtre de
       temps que l'on mesure, et plus une copie prise juste après le clic. */
    await page.waitForTimeout(CONFIGURATION.delais.stabilisationDonnees);

    modules[nom] = { ouvert, ...observateur.instantane() };
  }

  return construireRapport(modules);
}
