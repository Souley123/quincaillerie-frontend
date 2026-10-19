import { createRequire } from 'node:module';
import { beforeEach, describe, it } from 'vitest';

const require = createRequire(import.meta.url);
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const CONSTANTES_TEST = Object.freeze({
  slugEntreprise: 'atelier',
  companyId: 'ATELIER',
  emailCommun: 'commun@example.test',
  secret: 'test-secret-for-password-reset-tests-32-chars',
  appUrl: 'https://app.example.test',
  smtpUser: 'support@example.test',
  smtpHost: 'smtp.example.test',
  smtpPassword: 'test-password'
});

const ENVIRONNEMENT_TEST = {
  JWT_SECRET: CONSTANTES_TEST.secret,
  APP_URL: CONSTANTES_TEST.appUrl,
  SMTP_USER: CONSTANTES_TEST.smtpUser,
  SMTP_HOST: CONSTANTES_TEST.smtpHost,
  SMTP_PASSWORD: CONSTANTES_TEST.smtpPassword
};
Object.assign(process.env, ENVIRONNEMENT_TEST);
delete process.env.BREVO_API_KEY;

const utilisateurs = [];
const entreprises = [];
const emails = [];
let resultatEnvoiEmail;

const hash = valeur => crypto.createHash('sha256').update(valeur).digest('hex');
const creerModuleMock = (chemin, exports) => ({
  id: chemin,
  filename: chemin,
  loaded: true,
  exports
});
const creerReponseEnvoiEmail = message => ({
  ...resultatEnvoiEmail,
  accepted: [message.to],
  recipients: [message.to],
  response: '250 2.0.0 accepted'
});

const modeleUtilisateur = {
  find(filtre) {
    const selection = utilisateurs.filter(utilisateur => (
      utilisateur.email === filtre.email
      && (typeof filtre.actif === 'object' && '$ne' in filtre.actif
        ? utilisateur.actif !== filtre.actif.$ne
        : utilisateur.actif === filtre.actif)
      && (!filtre.companyId || utilisateur.companyId === filtre.companyId)
    ));
    return { select: async () => selection };
  },
  findOne(filtre) {
    const selection = utilisateurs.find(utilisateur => (
      Object.entries(filtre).every(([cle, valeur]) => {
        if (valeur && typeof valeur === 'object' && '$gt' in valeur) {
          return utilisateur[cle] > valeur.$gt;
        }
        if (valeur && typeof valeur === 'object' && '$ne' in valeur) {
          return utilisateur[cle] !== valeur.$ne;
        }
        return utilisateur[cle] === valeur;
      })
    ));
    return { select: async () => selection || null };
  }
};

const modeleEntreprise = {
  findOne(filtre) {
    const entreprise = entreprises.find(element => (
      Object.entries(filtre).every(([cle, valeur]) => element[cle] === valeur)
    ));
    return { select: async () => entreprise || null };
  }
};

const creerMockEnvoiEmail = () => ({
  envoyerEmail: async message => {
    emails.push(message);
    return creerReponseEnvoiEmail(message);
  }
});
const mockerDependances = chemins => {
  const dependances = {
    [chemins.utilisateur]: modeleUtilisateur,
    [chemins.entreprise]: modeleEntreprise,
    [chemins.email]: creerMockEnvoiEmail(),
    [chemins.notification]: { notifierAdmin: async () => {} }
  };

  Object.entries(dependances).forEach(([chemin, exports]) => {
    require.cache[chemin] = creerModuleMock(chemin, exports);
  });
};
const creerReponseHttp = () => ({
  statusCode: 200,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
  set(nom, valeur) {
    this.headers[nom] = valeur;
    return this;
  }
});
const creerUtilisateur = (email, companyId) => ({
  email,
  companyId,
  actif: true,
  bloqueReinitialisation: false,
  reinitialisations: 0,
  motDePasseHash: 'old-hash',
  reinitialisationHash: null,
  reinitialisationExpire: null,
  tentativesEchouees: 4,
  bloque: true,
  verrouillageVersion: 0,
  async save() {
    return this;
  }
});
const demanderReinitialisation = (service, body, ip = '127.0.0.1') => {
  const response = creerReponseHttp();
  return service.demander({ body, ip }, response).then(() => response);
};
const confirmerReinitialisation = (service, body) => {
  const response = creerReponseHttp();
  return service.confirmer({ body }, response).then(() => response);
};

const cheminsModules = {
  service: require.resolve('../services/reinitialisationService'),
  utilisateur: require.resolve('../models/Utilisateur'),
  entreprise: require.resolve('../models/Entreprise'),
  email: require.resolve('../services/envoiEmail'),
  notification: require.resolve('../services/notifierAdmin')
};
const reinitialiserEtat = () => {
  utilisateurs.length = 0;
  emails.length = 0;
  resultatEnvoiEmail = { envoye: true, mode: 'smtp', id: 'smtp-test-id' };
  entreprises.splice(0, entreprises.length, {
    slug: CONSTANTES_TEST.slugEntreprise,
    companyId: CONSTANTES_TEST.companyId,
    actif: true
  });
  mockerDependances(cheminsModules);
  delete require.cache[cheminsModules.service];
};
const chargerService = () => require(cheminsModules.service);

describe('service de réinitialisation', () => {
  beforeEach(reinitialiserEtat);

  it('sends a reset link for each tenant without a slug', async () => {
    const premier = creerUtilisateur(CONSTANTES_TEST.emailCommun, CONSTANTES_TEST.companyId);
    const second = creerUtilisateur(CONSTANTES_TEST.emailCommun, 'AUTRE');
    utilisateurs.push(premier, second);
    const service = chargerService();

    const res = await demanderReinitialisation(service, { email: CONSTANTES_TEST.emailCommun });

    assert.equal(res.statusCode, 200);
    assert.equal(emails.length, 2, 'une demande sans slug doit envoyer un lien par tenant');
    const liens = emails.map(email => new URL(email.text.split(' : ').pop()));
    const slugsDesLiens = liens.map(lien => lien.searchParams.get('slug')).filter(Boolean).sort();
    const liensSansSlug = liens.filter(lien => !lien.searchParams.has('slug'));
    assert.deepEqual(slugsDesLiens, [CONSTANTES_TEST.slugEntreprise]);
    assert.equal(liensSansSlug.length, 1, 'le lien du tenant sans slug doit omettre le paramètre');
    assert.ok(emails.every(email => email.to === CONSTANTES_TEST.emailCommun));
    assert.strictEqual(emails[0].to, premier.email);
    assert.strictEqual(emails[1].to, second.email);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
    assert.strictEqual(res.headers['Referrer-Policy'], 'no-referrer');
    assert.ok(premier.reinitialisationHash);
    assert.ok(second.reinitialisationHash);
    assert.notStrictEqual(premier.reinitialisationHash, second.reinitialisationHash, 'chaque tenant doit avoir un jeton distinct');
  });

  it('selects the correct account when email casing and surrounding spaces differ', async () => {
    const cible = creerUtilisateur(CONSTANTES_TEST.emailCommun, CONSTANTES_TEST.companyId);
    utilisateurs.push(cible);
    const service = chargerService();

    const res = await demanderReinitialisation(service, {
      email: `  ${CONSTANTES_TEST.emailCommun.toUpperCase()}  `,
      slug: CONSTANTES_TEST.slugEntreprise
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(emails.length, 1);
    assert.strictEqual(emails[0].to, CONSTANTES_TEST.emailCommun);
    assert.ok(cible.reinitialisationHash);
  });

  it('restores the previous token when email delivery fails', async () => {
    const echecEmail = creerUtilisateur('echec@example.test', CONSTANTES_TEST.companyId);
    utilisateurs.push(echecEmail);
    const hashPrecedent = hash('ancien-jeton');
    const expirationPrecedente = new Date(Date.now() + 120_000);
    echecEmail.reinitialisationHash = hashPrecedent;
    echecEmail.reinitialisationExpire = expirationPrecedente;
    resultatEnvoiEmail = { envoye: false, mode: 'smtp', erreur: '550 sender rejected' };
    const service = chargerService();
    const res = await demanderReinitialisation(
      service,
      { email: echecEmail.email, slug: CONSTANTES_TEST.slugEntreprise },
      '127.0.0.2'
    );

    assert.strictEqual(res.statusCode, 503, 'un fournisseur qui refuse le message doit remonter une erreur de service');
    assert.strictEqual(emails.length, 1);
    assert.strictEqual(echecEmail.reinitialisationHash, hashPrecedent, 'un échec d’envoi doit restaurer le jeton précédent');
    assert.strictEqual(echecEmail.reinitialisationExpire, expirationPrecedente, 'un échec d’envoi doit restaurer l’expiration précédente');
  });

  it('confirms a reset only for the targeted tenant', async () => {
    const cible = creerUtilisateur(CONSTANTES_TEST.emailCommun, CONSTANTES_TEST.companyId);
    const second = creerUtilisateur(CONSTANTES_TEST.emailCommun, 'AUTRE');
    utilisateurs.push(cible, second);
    const jeton = 'a'.repeat(64);
    cible.reinitialisationHash = hash(jeton);
    cible.reinitialisationExpire = new Date(Date.now() + 60_000);
    const service = chargerService();
    const res = await confirmerReinitialisation(service, {
      email: cible.email,
      jeton,
      motDePasse: 'nouveau-mot-de-passe-123',
      slug: CONSTANTES_TEST.slugEntreprise
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(cible.forcePasswordChange, false);
    assert.strictEqual(cible.bloque, false);
    assert.strictEqual(cible.bloqueJusqua, null);
    assert.strictEqual(cible.tentativesEchouees, 0);
    assert.strictEqual(cible.reinitialisationHash, null);
    assert.strictEqual(cible.reinitialisationExpire, null);
    assert.strictEqual(cible.reinitialisations, 1);
    assert.strictEqual(cible.verrouillageVersion, 1);
    assert.notStrictEqual(cible.motDePasseHash, 'old-hash');
    assert.strictEqual(second.reinitialisations, 0, 'la confirmation doit rester isolée au tenant ciblé');
  });

  it('rejects passwords longer than 256 characters without changing the account', async () => {
    const cible = creerUtilisateur(CONSTANTES_TEST.emailCommun, CONSTANTES_TEST.companyId);
    utilisateurs.push(cible);
    const hashAvant = cible.motDePasseHash;
    const service = chargerService();
    const res = await confirmerReinitialisation(service, {
      email: cible.email,
      jeton: 'b'.repeat(64),
      motDePasse: 'x'.repeat(257),
      slug: CONSTANTES_TEST.slugEntreprise
    });

    assert.strictEqual(res.statusCode, 400, 'les mots de passe de plus de 256 caractères doivent être refusés');
    assert.strictEqual(cible.motDePasseHash, hashAvant, 'un mot de passe invalide ne doit pas modifier le compte');
  });

  it('rejects a reset token used with another tenant account', async () => {
    const second = creerUtilisateur(CONSTANTES_TEST.emailCommun, 'AUTRE');
    utilisateurs.push(second);
    const jeton = 'a'.repeat(64);
    const hashAutreTenant = second.reinitialisationHash;
    const service = chargerService();
    const res = await confirmerReinitialisation(service, {
      email: second.email,
      jeton,
      motDePasse: 'mot-de-passe-valide-123',
      slug: CONSTANTES_TEST.slugEntreprise
    });

    assert.strictEqual(res.statusCode, 400, 'un lien ne doit pas pouvoir réinitialiser le compte d’un autre tenant');
    assert.strictEqual(second.reinitialisationHash, hashAutreTenant);
  });

  it('rejects a reset link for an unknown tenant', async () => {
    const dernierCompte = creerUtilisateur('dernier@example.test', 'INCONNU');
    utilisateurs.push(dernierCompte);
    const hashJetonInconnuEntreprise = hash('c'.repeat(64));
    dernierCompte.reinitialisationHash = hashJetonInconnuEntreprise;
    dernierCompte.reinitialisationExpire = new Date(Date.now() + 60_000);
    const service = chargerService();
    const res = await confirmerReinitialisation(service, {
      email: dernierCompte.email,
      jeton: 'c'.repeat(64),
      motDePasse: 'mot-de-passe-valide-123',
      slug: 'inconnu'
    });

    assert.strictEqual(res.statusCode, 400, 'un tenant inconnu doit être refusé');
    assert.strictEqual(dernierCompte.reinitialisationHash, hashJetonInconnuEntreprise, 'un slug inconnu ne doit pas confirmer le jeton');
  });

  it('does not send email for an account outside the requested tenant', async () => {
    const compteLimite = creerUtilisateur('limite@example.test', 'INCONNU');
    utilisateurs.push(compteLimite);
    const service = chargerService();

    for (let i = 0; i < 3; i += 1) {
      const res = await demanderReinitialisation(
        service,
        { email: compteLimite.email, slug: CONSTANTES_TEST.slugEntreprise },
        `192.0.2.${10 + i}`
      );
      assert.strictEqual(res.statusCode, 200);
    }

    assert.strictEqual(emails.length, 0, 'aucun email ne doit être envoyé à une adresse hors du tenant demandé');
  });
});
