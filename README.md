# Arkadia Beta

Application web pour remplir, vérifier, exporter, importer et envoyer une fiche de personnage Arkadia.

## Démarrage local

```bash
npm run dev
```

Puis ouvrir:

```txt
http://localhost:3000/
```

## Vérification rapide

```bash
npm run verify
```

Ce script vérifie notamment:

- la présence du fichier Excel source;
- l'absence de l'ancienne base statique `ui/js/data.js`;
- les règles Sage, Animiste et Concoctions exposées au frontend;
- que `Falsification` reste non cumulable;
- que l'export/import Excel restaure les contacts d'urgence.

## Où modifier les données

La source principale est:

```txt
database/source/Fiche-de-joueur-V1.3.xlsx
```

À modifier dans l'Excel:

- races, carrières, divinités, moralités;
- écoles et sorts;
- restrictions de race, carrière, moralité, divinité;
- compétences, coûts, gratuités et restrictions simples.

Les corrections qui ne se placent pas bien dans l'Excel sont centralisées ici:

```txt
backend/services/codex-rules.js
```

À modifier dans ce fichier:

- alias et corrections de noms;
- carrières mixtes et leurs sources;
- compétences cumulables;
- règles de concoction;
- accès spéciaux de compétences;
- règles Sage/Animiste et types d'écoles arcane/divine.

## Import et export

Formats supportés par le bouton `Charger une fiche`:

- `.json`: import local de l'ancien format sauvegardé;
- `.xlsx`: import fiable, incluant les anciennes fiches Excel Arkadia connues;
- `.pdf`: import possible si le PDF contient du texte lisible ou si `pdftotext` est installé;
- `.jpg`, `.jpeg`, `.png`: import possible seulement si Tesseract OCR est installé et que l'image est assez lisible.

Pour les modifications futures, l'Excel reste le format recommandé. PDF/JPG dépendent de la qualité du fichier et peuvent demander un exemple réel pour améliorer le parseur.

## Structure utile

```txt
backend/server.js                         API locale et routes import/export
backend/services/database.service.js       Lecture du fichier Excel source
backend/services/codex-rules.js            Règles Codex manuelles centralisées
backend/services/excel.service.js          Export/import XLSX des fiches
backend/services/document-import.service.js Import PDF/JPG/JSON/XLSX
ui/arkadia_beta_1.2.html                   Page principale
ui/js/api.js                               Appels API et règles reçues du backend
ui/js/sauvegarde.js                        Sauvegarde, chargement et export
ui/competences/competences.js              Affichage et coût des compétences
ui/competences/sorts.js                    Affichage et coût des sorts
scripts/verify-rules.mjs                   Vérifications simples du projet
```

## Courriel

Copier `backend/.env.example` vers `backend/.env`, puis remplir les variables SMTP.

Sans SMTP, le bouton Envoyer reste en mode prévisualisation.

## Déploiement Render

Le fichier `render.yaml` est prêt. Sur Render:

1. Créer un nouveau Blueprint.
2. Connecter le repo GitHub.
3. Render détecte `render.yaml`.
4. Ajouter les variables SMTP dans l'onglet Environment si l'envoi réel est voulu.
