/* Vérification syntaxique d'un fichier JSX avec Babel (déjà installé par Vite).
   Usage : node tests/qa-mobile/_lint-app.mjs [chemin]   (défaut : src/App.js)
   N'échoue que sur une erreur de syntaxe — pas de règle de style. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const importBabel = mod => import(pathToFileURL(require.resolve(mod)).href);
const { parseSync } = await importBabel("@babel/core");
const jsx = await importBabel("@babel/parser");

const chemin = process.argv[2]
  || new URL("../../src/App.js", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const code = readFileSync(chemin, "utf8");

try {
  parseSync(code, {
    sourceType: "module",
    babelrc: false,
    configFile: false,
    filename: chemin,
    parserOpts: { plugins: ["jsx"] },
  });
  console.log(`syntaxe OK — ${chemin.split(/[\\/]/).pop()} (${code.split("\n").length} lignes)`);
} catch (erreur) {
  console.log(erreur.message);
  process.exitCode = 1;
}
