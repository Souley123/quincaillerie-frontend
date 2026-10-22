import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as attendre } from 'node:timers/promises';

const windows = process.platform === 'win32';
const portBackend = Number(process.env.PORT_BACKEND || 5001);
const portFrontend = Number(process.env.PORT_FRONTEND || process.env.PORT || 3000);
const hoteLocal = process.env.HOST || 'localhost';
const urlFrontend = `http://${hoteLocal}:${portFrontend}/`;
/* Le réveil de l'API Render publique est DÉSACTIVÉ par défaut : elle n'est
   contactée que si le backend local n'a pas démarré ET que l'appel est
   explicitement demandé (REVEIL_API_PUBLIQUE=true). Sans cela, chaque
   `npm start` réveillait inutilement le service hébergé (cold start ~33 s). */
const reveilApiPublique = process.env.REVEIL_API_PUBLIQUE === 'true';
const urlApiPublique = 'https://gestion-de-stocks-5lv3.onrender.com';
const urlSante = `http://localhost:${portBackend}/health`;
const racineBackend = new URL('../../quicaillerie-backend/', import.meta.url);

const portEcoute = port => new Promise(resolve => {
  const serveur = createServer();
  serveur.once('error', () => resolve(false));
  serveur.listen(port, '0.0.0.0', () => serveur.close(() => resolve(true)));
});

const environnementEnfant = extra => ({
  ...process.env,
  ...extra,
  PATH: process.env.PATH || process.env.Path || process.env.path
});

const verifierBackend = async () => {
  try {
    const reponse = await fetch(urlSante, { signal: AbortSignal.timeout(2500) });
    return reponse.ok;
  } catch {
    return false;
  }
};

const attendreApiPublique = async () => {
  if (!reveilApiPublique) return false;
  for (let tentative = 0; tentative < 4; tentative += 1) {
    try {
      const reponse = await fetch(`${urlApiPublique}/health`, {
        signal: AbortSignal.timeout(15000)
      });
      if (reponse.ok) return true;
    } catch {
      // Le service hébergé peut être en cours de réveil.
    }
    if (tentative < 3) await attendre(1500);
  }
  return false;
};

const lancer = (commande, args, options = {}) => spawn(commande, args, {
  stdio: 'inherit',
  windowsHide: true,
  ...options
});

let backend;
let frontend;
let arretDemande = false;
let backendErreur;

const arreter = code => {
  if (arretDemande) return;
  arretDemande = true;
  backend?.kill();
  frontend?.kill();
  process.exitCode = code;
};

const attendreFinEnfants = async () => {
  const sorties = [];
  if (frontend && frontend.exitCode === null) {
    sorties.push(new Promise(resolve => frontend.once('exit', resolve)));
  }
  if (backend && backend.exitCode === null) {
    sorties.push(new Promise(resolve => backend.once('exit', resolve)));
  }
  if (sorties.length) await Promise.all(sorties);
};

process.on('SIGINT', () => arreter(0));
process.on('SIGTERM', () => arreter(0));

try {
  if (!(await verifierBackend())) {
    if (!(await portEcoute(portBackend))) {
      throw new Error(`Le port ${portBackend} est déjà utilisé par un service qui ne répond pas sur ${urlSante}.`);
    }

    console.log('\n[SKYS] Démarrage du backend local sur http://localhost:5001…');
    console.log('[SKYS] Ce backend local doit avoir sa configuration et sa base de données propres.');
    backend = lancer(windows ? 'node.exe' : 'node', ['server.js'], {
      cwd: new URL('.', racineBackend),
      env: environnementEnfant({ PORT: String(portBackend) })
    });

    backend.once('error', erreur => {
      backendErreur = erreur;
      console.error(`[SKYS] Impossible de démarrer le backend : ${erreur.message}`);
      arreter(1);
    });
    backend.once('exit', (code, signal) => {
      if (!arretDemande) {
        if (backendErreur) return;
        console.error(`[SKYS] Le backend s’est arrêté (${signal || `code ${code}`}).`);
        arreter(code || 1);
      }
    });

    let backendPret = false;
    for (let tentative = 0; tentative < 60 && !arretDemande; tentative += 1) {
      if (await verifierBackend()) {
        backendPret = true;
        break;
      }
      await attendre(1000);
    }

    if (backendErreur) throw backendErreur;
    if (!backendPret) {
      backend?.kill();
      if (!reveilApiPublique) {
        throw new Error(`Le backend local n’a pas démarré sur http://localhost:${portBackend}. Vérifiez le fichier .env du backend et MongoDB (réveil de l’API publique volontairement désactivé : REVEIL_API_PUBLIQUE=true pour l’autoriser).`);
      }
      console.warn('[SKYS] Le backend local n’a pas démarré. Vérification du backend public…');
      if (!(await attendreApiPublique())) {
        throw new Error('Ni le backend local ni le backend public ne répondent. Vérifiez le fichier .env, MongoDB et votre connexion Internet.');
      }
      console.log('[SKYS] Backend public opérationnel : https://gestion-de-stocks-5lv3.onrender.com');
    } else {
      console.log('[SKYS] Backend local prêt et connecté à sa base.');
    }
  } else {
    console.log('[SKYS] Backend local déjà opérationnel sur http://localhost:5001.');
  }

  if (arretDemande) process.exit(0);
  if (!(await portEcoute(portFrontend))) {
    throw new Error(`Le port ${portFrontend} est déjà utilisé. Arrêtez l’autre application ou libérez ce port.`);
  }

  console.log(`[SKYS] Backend prêt. Démarrage du frontend et ouverture de ${urlFrontend}…\n`);
  const viteCommande = windows ? 'node.exe' : 'node';
  const viteCli = decodeURIComponent(new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname);
  const argumentsVite = windows ? viteCli.replace(/^\/(\w:)/, '$1') : viteCli;
  /* NODE_ENV=development EXPLICITE : lancé hors de `npm run`, NODE_ENV était
     vide, Vite prenait le mode « production » et n'activait plus le plugin
     transform-jsx-in-js (vite.config.js filtre sur NODE_ENV === 'production'
     pour le base path). Les fichiers .js contenant du JSX échouaient alors
     avec « The JSX syntax extension is not currently enabled ». */
  frontend = lancer(viteCommande, [argumentsVite, '--host', '0.0.0.0', '--port', String(portFrontend), '--strictPort', '--mode', 'development'], {
    cwd: new URL('../', import.meta.url),
    env: environnementEnfant({ PORT: String(portFrontend), NODE_ENV: 'development' })
  });

  frontend.once('error', erreur => {
    console.error(`[SKYS] Impossible de démarrer le frontend : ${erreur.message}`);
    arreter(1);
  });
  frontend.once('exit', (code, signal) => {
    if (!arretDemande) arreter(code || (signal ? 1 : 0));
  });

  let frontendPret = false;
  for (let tentative = 0; tentative < 30 && !arretDemande; tentative += 1) {
    try {
      const reponse = await fetch(urlFrontend, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
      if (reponse.status < 500) {
        frontendPret = true;
        break;
      }
    } catch {
      // Vite n'a pas encore fini son démarrage.
    }
    await attendre(500);
  }

  if (!frontendPret) throw new Error('Le frontend ne répond pas sur le port 3000.');

  const ouvrir = windows ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const argumentsOuvrir = windows ? ['/c', 'start', '', urlFrontend] : [urlFrontend];
  const navigateur = spawn(ouvrir, argumentsOuvrir, {
    detached: true,
    stdio: 'ignore',
    env: environnementEnfant({})
  });
  navigateur.on('error', erreur => {
    console.warn(`[SKYS] La page est prête, mais le navigateur n’a pas pu s’ouvrir automatiquement : ${erreur.message}`);
    console.log(`[SKYS] Ouvrez manuellement ${urlFrontend}`);
  });
  navigateur.unref();

  if (arretDemande) await attendreFinEnfants();
  else await new Promise(resolve => {
    frontend.once('exit', resolve);
    backend?.once('exit', resolve);
  });
} catch (erreur) {
  console.error(`\n[SKYS] ${erreur.message}`);
  console.error('[SKYS] Pour démarrer, installez au besoin les dépendances dans les dossiers frontend et backend, puis vérifiez le fichier .env du backend.');
  arreter(1);
  await attendreFinEnfants();
}
