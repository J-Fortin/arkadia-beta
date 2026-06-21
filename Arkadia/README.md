# Arkadia Beta

Application beta pour remplir, exporter, importer et envoyer une fiche de personnage Arkadia.

## Local

```bash
npm run dev
```

Puis ouvrir:

```txt
http://localhost:3000/
```

## Database

Le backend lit:

```txt
database/source/Fiche de joueur - V1.2.xlsx
```

Si ce fichier Excel est modifie, le backend recharge automatiquement les donnees au prochain appel API.

## Courriel

Copier `backend/.env.example` vers `backend/.env`, puis remplir les variables SMTP.

Sans SMTP, le bouton Envoyer reste en mode previsualisation.

## Deploiement Render

Le fichier `render.yaml` est pret. Sur Render:

1. Creer un nouveau Blueprint.
2. Connecter le repo GitHub.
3. Render detecte `render.yaml`.
4. Ajouter les variables SMTP dans l'onglet Environment si l'envoi reel est voulu.
