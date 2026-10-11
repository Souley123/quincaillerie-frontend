/**
 * Documentation OpenAPI / Swagger — API SKYS ERP Solution
 * ========================================================
 * Génère la spécification OpenAPI 3.0 servie ensuite par swagger-ui-express
 * (voir server.js, route « /api-docs »).
 *
 * Les descriptions d'endpoints sont regroupées ici (et non annotées dans
 * server.js) pour garder le point d'entrée serveur lisible et concentrer
 * toute la documentation dans un seul fichier.
 */

const swaggerJsdoc = require('swagger-jsdoc');

const port = process.env.PORT || 5001;
const serveurDeveloppement = `http://localhost:${port}`;
// En production, renseigner SERVER_URL (ex. https://api.exemple.com).
const serveurProduction = process.env.SERVER_URL;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API SKYS ERP Solution',
      version: process.env.APP_VERSION || '1.0.0',
      description:
        'API de gestion de quincaillerie multi-entreprises (produits, ventes, ' +
        'clients, fournisseurs, transports, dépenses, abonnements et paiements). ' +
        'Authentification par jeton Bearer (JWT). Chaque requête authentifiée est ' +
        'isolée par entreprise (multi-tenant).',
      license: { name: 'Propriétaire — SKYS ERP Solution' }
    },
    servers: [
      { url: serveurDeveloppement, description: 'Serveur local' },
      ...(serveurProduction
        ? [{ url: serveurProduction, description: 'Serveur de production' }]
        : [])
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Jeton JWT renvoyé par /api/auth/login, au format « Bearer <jeton> ».'
        }
      },
      schemas: {
        Utilisateur: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '652a1f...' },
            nom: { type: 'string', example: 'Fohoua Katiene' },
            email: { type: 'string', format: 'email', example: 'admin@exemple.com' },
            role: { type: 'string', enum: ['Administrateur', 'Gestionnaire', 'Caissier', 'Magasinier'] }
          }
        },
        Produit: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            code: { type: 'string', example: 'PROD-001' },
            nom: { type: 'string', example: 'Ciment 50kg' },
            categorie: { type: 'string', example: 'Matériaux' },
            prix: { type: 'number', example: 4500 },
            quantite: { type: 'integer', example: 120 },
            seuilAlerte: { type: 'integer', example: 10 }
          }
        },
        Client: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            nom: { type: 'string', example: 'Boutique Centrale' },
            telephone: { type: 'string', example: '+2250700000000' },
            email: { type: 'string', format: 'email' },
            adresse: { type: 'string' }
          }
        },
        Vente: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            client: { type: 'string', description: 'Identifiant du client' },
            lignes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  produit: { type: 'string' },
                  quantite: { type: 'integer', example: 2 },
                  prixUnitaire: { type: 'number', example: 4500 }
                }
              }
            },
            total: { type: 'number', example: 9000 },
            statut: { type: 'string', enum: ['payee', 'impayee', 'annulee'] }
          }
        },
        Erreur: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Ressource introuvable.' }
          }
        }
      },
      responses: {
        NonAutorise: {
          description: 'Jeton absent, invalide ou expiré.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erreur' } } }
        },
        AccesRefuse: {
          description: "Rôle insuffisant pour cette ressource.",
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erreur' } } }
        },
        NonTrouve: {
          description: 'Ressource introuvable.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erreur' } } }
        },
        TropDeRequetes: {
          description: 'Limite de débit atteinte.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erreur' } } }
        }
      }
    },
    tags: [
      { name: 'Système', description: 'État du service et diagnostics.' },
      { name: 'Authentification', description: 'Connexion, inscription et comptes.' },
      { name: 'Produits', description: 'Catalogue et stock.' },
      { name: 'Clients', description: 'Répertoire clients.' },
      { name: 'Ventes', description: 'Enregistrement et suivi des ventes.' },
      { name: 'Mouvements', description: 'Entrées/sorties de stock.' },
      { name: 'Fournisseurs', description: 'Fournisseurs et réapprovisionnement.' },
      { name: 'Transports', description: 'Livraisons et transports.' },
      { name: 'Dépenses', description: 'Dépenses (Administrateur uniquement).' },
      { name: 'Abonnements', description: 'Abonnements de l’entreprise.' },
      { name: 'Paiements', description: 'Paiements et configuration Kkiapay.' }
    ],
    security: [{ bearerAuth: [] }],
    paths: {
      '/': {
        get: {
          tags: ['Système'],
          summary: "État de la plateforme",
          security: [],
          responses: {
            200: { description: 'Informations générales et état de sécurité.' }
          }
        }
      },
      '/health': {
        get: {
          tags: ['Système'],
          summary: 'Sonde de santé (health check)',
          security: [],
          responses: {
            200: { description: 'Service prêt.' },
            503: { description: 'Base de données déconnectée.' }
          }
        }
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentification'],
          summary: 'Connexion et obtention du jeton JWT',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'motDePasse'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    motDePasse: { type: 'string', format: 'password' }
                  }
                }
              }
            }
          },
          responses: {
            200: { description: 'Connexion réussie, renvoie le jeton et l’utilisateur.' },
            401: { description: 'Identifiants invalides.' },
            429: { $ref: '#/components/responses/TropDeRequetes' }
          }
        }
      },
      '/api/auth/inscription': {
        post: {
          tags: ['Authentification'],
          summary: 'Créer un compte (avec son entreprise)',
          security: [],
          responses: {
            201: { description: 'Compte créé.' },
            400: { $ref: '#/components/responses/NonTrouve' }
          }
        }
      },
      '/api/auth/moi': {
        get: {
          tags: ['Authentification'],
          summary: 'Identité et entreprise courantes',
          responses: {
            200: { description: 'Utilisateur courant.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Utilisateur' } } } },
            401: { $ref: '#/components/responses/NonAutorise' }
          }
        }
      },
      '/api/auth/utilisateurs': {
        get: {
          tags: ['Authentification'],
          summary: 'Lister les comptes de mon entreprise',
          responses: {
            200: { description: 'Liste des utilisateurs.' },
            401: { $ref: '#/components/responses/NonAutorise' }
          }
        }
      },
      '/api/products': {
        get: {
          tags: ['Produits'],
          summary: 'Lister les produits',
          responses: {
            200: {
              description: 'Liste des produits.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Produit' } } } }
            },
            401: { $ref: '#/components/responses/NonAutorise' }
          }
        },
        post: {
          tags: ['Produits'],
          summary: 'Créer un produit',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Produit' } } }
          },
          responses: {
            201: { description: 'Produit créé.' },
            400: { description: 'Données invalides.' },
            401: { $ref: '#/components/responses/NonAutorise' }
          }
        }
      },
      '/api/products/code/{code}': {
        get: {
          tags: ['Produits'],
          summary: 'Rechercher un produit par son code (scan)',
          parameters: [
            { name: 'code', in: 'path', required: true, schema: { type: 'string' }, example: 'PROD-001' }
          ],
          responses: {
            200: { description: 'Produit trouvé.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Produit' } } } },
            404: { $ref: '#/components/responses/NonTrouve' }
          }
        }
      },
      '/api/products/{id}': {
        get: {
          tags: ['Produits'],
          summary: 'Afficher un produit',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Produit.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Produit' } } } },
            404: { $ref: '#/components/responses/NonTrouve' }
          }
        }
      },
      '/api/clients': {
        get: {
          tags: ['Clients'],
          summary: 'Lister les clients',
          responses: {
            200: { description: 'Liste des clients.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Client' } } } } },
            401: { $ref: '#/components/responses/NonAutorise' }
          }
        },
        post: {
          tags: ['Clients'],
          summary: 'Créer un client',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          responses: { 201: { description: 'Client créé.' }, 400: { description: 'Données invalides.' } }
        }
      },
      '/api/clients/{id}': {
        get: {
          tags: ['Clients'],
          summary: 'Afficher un client',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Client.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } }, 404: { $ref: '#/components/responses/NonTrouve' } }
        }
      },
      '/api/ventes': {
        get: {
          tags: ['Ventes'],
          summary: 'Lister les ventes',
          responses: {
            200: { description: 'Liste des ventes.', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Vente' } } } } },
            401: { $ref: '#/components/responses/NonAutorise' }
          }
        },
        post: {
          tags: ['Ventes'],
          summary: 'Enregistrer une vente',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Vente' } } } },
          responses: { 201: { description: 'Vente enregistrée.' }, 400: { description: 'Données invalides ou stock insuffisant.' } }
        }
      },
      '/api/ventes/stats/{periode}': {
        get: {
          tags: ['Ventes'],
          summary: 'Statistiques de ventes',
          parameters: [
            { name: 'periode', in: 'path', required: true, schema: { type: 'string' }, example: 'jour' }
          ],
          responses: { 200: { description: 'Statistiques calculées.' } }
        }
      },
      '/api/ventes/{id}': {
        get: {
          tags: ['Ventes'],
          summary: 'Afficher une vente',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Vente.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vente' } } } }, 404: { $ref: '#/components/responses/NonTrouve' } }
        }
      },
      '/api/mouvements': {
        get: {
          tags: ['Mouvements'],
          summary: 'Lister les mouvements de stock',
          responses: { 200: { description: 'Liste des mouvements.' }, 401: { $ref: '#/components/responses/NonAutorise' } }
        }
      },
      '/api/mouvements/{id}': {
        get: {
          tags: ['Mouvements'],
          summary: 'Afficher un mouvement',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Mouvement.' }, 404: { $ref: '#/components/responses/NonTrouve' } }
        }
      },
      '/api/fournisseurs': {
        get: {
          tags: ['Fournisseurs'],
          summary: 'Lister les fournisseurs',
          responses: { 200: { description: 'Liste des fournisseurs.' }, 401: { $ref: '#/components/responses/NonAutorise' } }
        },
        post: {
          tags: ['Fournisseurs'],
          summary: 'Créer un fournisseur',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 201: { description: 'Fournisseur créé.' } }
        }
      },
      '/api/fournisseurs/alertes/reappro': {
        get: {
          tags: ['Fournisseurs'],
          summary: 'Alertes de réapprovisionnement',
          responses: { 200: { description: 'Liste des alertes.' } }
        }
      },
      '/api/fournisseurs/{id}': {
        get: {
          tags: ['Fournisseurs'],
          summary: 'Afficher un fournisseur',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Fournisseur.' }, 404: { $ref: '#/components/responses/NonTrouve' } }
        }
      },
      '/api/transports': {
        get: {
          tags: ['Transports'],
          summary: 'Lister les transports',
          responses: { 200: { description: 'Liste des transports.' }, 401: { $ref: '#/components/responses/NonAutorise' } }
        },
        post: {
          tags: ['Transports'],
          summary: 'Créer un transport',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 201: { description: 'Transport créé.' } }
        }
      },
      '/api/transports/{id}': {
        get: {
          tags: ['Transports'],
          summary: 'Afficher un transport',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Transport.' }, 404: { $ref: '#/components/responses/NonTrouve' } }
        }
      },
      '/api/depenses': {
        get: {
          tags: ['Dépenses'],
          summary: 'Lister les dépenses (Administrateur)',
          responses: { 200: { description: 'Liste des dépenses.' }, 403: { $ref: '#/components/responses/AccesRefuse' } }
        },
        post: {
          tags: ['Dépenses'],
          summary: 'Créer une dépense (Administrateur)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 201: { description: 'Dépense créée.' }, 403: { $ref: '#/components/responses/AccesRefuse' } }
        }
      },
      '/api/depenses/{id}': {
        get: {
          tags: ['Dépenses'],
          summary: 'Afficher une dépense (Administrateur)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Dépense.' }, 403: { $ref: '#/components/responses/AccesRefuse' } }
        }
      },
      '/api/abonnements': {
        get: {
          tags: ['Abonnements'],
          summary: 'Lister les abonnements',
          responses: { 200: { description: 'Liste des abonnements.' } }
        },
        post: {
          tags: ['Abonnements'],
          summary: 'Souscrire à un abonnement',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 201: { description: 'Abonnement souscrit.' } }
        }
      },
      '/api/abonnements/actif': {
        get: {
          tags: ['Abonnements'],
          summary: 'Abonnement actif de l’entreprise',
          responses: { 200: { description: 'Abonnement actif.' } }
        }
      },
      '/api/paiements/config': {
        get: {
          tags: ['Paiements'],
          summary: 'Clés publiques de paiement (Kkiapay)',
          responses: { 200: { description: 'Configuration publique de paiement.' } }
        }
      },
      '/api/paiements': {
        get: {
          tags: ['Paiements'],
          summary: 'Historique des paiements de l’entreprise',
          responses: { 200: { description: 'Liste des paiements.' } }
        }
      }
    }
  },
  // Aucun fichier scanné : la spécification est décrite ci-dessus.
  apis: []
};

const specificationSwagger = swaggerJsdoc(options);
const optionsUi = {
  customSiteTitle: 'API SKYS ERP Solution — Documentation',
  swaggerOptions: { persistAuthorization: true }
};

module.exports = { specificationSwagger, optionsUi };
