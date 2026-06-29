// Regles manuelles du Codex qui corrigent ou completent les donnees Excel.
// Source principale: database/source/Fiche-de-joueur-V1.3.xlsx
// A modifier ici quand une regle du livre ne peut pas etre representee simplement
// dans le fichier Excel.

export const valueAliases = {
  combatant: "combattant",
  ilithyd: "illithyd",
  "etre-sylvestre-terre": "etre-sylvestre",
  "etre-sylvestre-eau": "etre-sylvestre",
  "etre-sylvestre-feu": "etre-sylvestre",
  "etre-sylvestre-air": "etre-sylvestre",
  "presqu-humain": "presque-humain",
  "saurien-phrynos": "saurien",
  "saurien-slann": "saurien",
  "saurien-coatl": "saurien",
  "saurien-troglodon": "saurien",
  "maitre-des-runes": "maitre-runes",
  "seigneur-de-guerre": "seigneur-guerre"
};

export const defaultRaceChances = 3;

export const raceChanceOverrides = {
  morgull: 4
};

export const raceStatOverrides = {
  orque: {
    pvJour: 4,
    pvNuit: 4
  }
};

export const raceVariantDefinitions = {
  "etre-sylvestre": [
    {
      value: "feu",
      label: "Feu",
      immunites: ["Feu"],
      faiblesses: ["Eau"],
      description: "Immunite au feu; faiblesse eau/glace."
    },
    {
      value: "eau",
      label: "Eau",
      immunites: ["Eau"],
      faiblesses: ["Feu"],
      description: "Immunite a l'eau/glace; faiblesse feu."
    },
    {
      value: "terre",
      label: "Terre / acide",
      immunites: ["Acide"],
      faiblesses: ["Electricite"],
      description: "Immunite terre/acide; faiblesse air/electricite."
    },
    {
      value: "air",
      label: "Air / electricite",
      immunites: ["Electricite"],
      faiblesses: ["Acide"],
      description: "Immunite air/electricite; faiblesse terre/acide."
    }
  ],
  saurien: [
    {
      value: "phrynos",
      label: "Phrynos",
      immunites: [],
      faiblesses: ["Eau"],
      description: "Faiblesse eau/glace."
    },
    {
      value: "slann",
      label: "Slann / Kambara",
      immunites: [],
      faiblesses: ["Acide"],
      description: "Faiblesse terre/acide."
    },
    {
      value: "coatl",
      label: "Coatl",
      immunites: [],
      faiblesses: ["Feu"],
      description: "Faiblesse feu."
    },
    {
      value: "troglodon",
      label: "Troglodon",
      immunites: [],
      faiblesses: ["Electricite"],
      description: "Faiblesse air/electricite."
    }
  ]
};

export const mixedCareerSources = {
  animiste: ["pretre", "druide"],
  archer: ["roublard", "combattant"],
  barde: ["mage", "roublard"],
  berserker: ["pretre", "barbare"],
  chaman: ["druide", "mage"],
  charlatan: ["marchand", "roublard"],
  ermite: ["druide", "marchand"],
  garde: ["marchand", "combattant"],
  "gardien-mystique": ["druide", "barbare"],
  guerisseur: ["marchand", "pretre"],
  inquisiteur: ["pretre", "roublard"],
  magelame: ["combattant", "mage"],
  "maitre-runes": ["mage", "barbare"],
  maraudeur: ["barbare", "marchand"],
  paladin: ["combattant", "pretre"],
  rodeur: ["combattant", "druide"],
  sage: ["pretre", "mage"],
  scribe: ["mage", "marchand"],
  "seigneur-guerre": ["barbare", "combattant"],
  totem: ["roublard", "druide"],
  traqueur: ["barbare", "roublard"]
};

export const cumulableCompetenceNames = [
  "archerie arcane",
  "art mystique",
  "charognard",
  "lecture et ecriture",
  "resistance a l alcool",
  "resistance aux maladies",
  "energie vegetale",
  "elementaliste",
  "morsure elementaire",
  "attaque brutale",
  "bravoure accrue",
  "bris d arme",
  "brise bouclier",
  "coup meurtrier",
  "onde de choc",
  "resistance a la torture",
  "resistance aux poisons",
  "resistance physique",
  "tir precis",
  "haute magie",
  "magie brutale",
  "peinture de protection",
  "peinture des morts",
  "poudre de morphee",
  "resistance elementaire",
  "resistance contre un element",
  "resistance contre un element acide",
  "resistance contre un element feu",
  "resistance contre un element glace",
  "resistance contre un element electricite",
  "resistance magique",
  "resistance mentale",
  "transfert de vitalite en mana",
  "talisman",
  "creation d anima",
  "egorgement",
  "archerie mystique",
  "performance bardique",
  "langue fourchue",
  "peinture de guerre",
  "lame enchantee",
  "rune de protection",
  "runes de protection",
  "ennemi jure",
  "magie puissante",
  "spiritualite animale",
  "expert en concoction",
  "expert en concoctions",
  "forge avancee",
  "maitrise des poisons",
  "maitre des poisons",
  "armure de la foi",
  "attaque divine",
  "don miraculeux",
  "equilibre",
  "esquive",
  "maitre de l evasion",
  "lancer meurtrier"
];

export const codexCumulableCompetences = new Set(cumulableCompetenceNames);

export const firstFreeCompetenceRules = {
  barbare: [
    { names: ["bravoure"] }
  ],
  combattant: [
    { names: ["resistance physique"] }
  ],
  mage: [
    { startsWith: "lecture et ecriture" }
  ],
  marchand: [
    {
      names: [
        "contact marchand mineur",
        "contact marchand druide",
        "contact marchand brasseur",
        "contact marchand forgeron"
      ]
    }
  ],
  roublard: [
    { names: ["attaque sournoise"] }
  ],
  barde: [
    { startsWith: "lecture et ecriture" }
  ],
  charlatan: [
    { startsWith: "lecture et ecriture" }
  ],
  sage: [
    { startsWith: "lecture et ecriture" }
  ],
  scribe: [
    { startsWith: "lecture et ecriture" }
  ],
  traqueur: [
    { names: ["lancer meurtrier"] }
  ]
};

export const religionAliases = {
  "essence-infernale": "Essence infernale",
  "esprits-de-la-nature": "Esprits de la Nature",
  "esprits-des-morts": "Esprits des Morts"
};

export const canonicalTextAliases = {
  "voix-sacree": "Voie sacrée",
  "voix-maudite": "Voie maudite",
  "deliverance-des-maledictions": "Délivrance des malédictions",
  "lumier-solaire": "Lumière solaire",
  "faiblaisse-elementaire": "Faiblesse élémentaire",
  "faiblaisse-magique": "Faiblesse magique",
  "passage-des-braisiers": "Passage des brasiers",
  "bouclier-du-vent": "Bouclier de vent majeur",
  "asect-elementaire": "Aspect élémentaire",
  "colone-elementaire": "Colonne élémentaire",
  "reincarnation-du-phoenix": "Réincarnation du Phoenix",
  "cage-de-verre": "Cage de verre enchantée",
  "toucher-de-dissipation": "Toucher de dissipation de la magie",
  "embleme-sacree": "Emblème sacré",
  "avatar-sacree": "Avatar sacré",
  "symbole-de-jugement": "Symbole du jugement",
  "talisman-avancee": "Talisman avancé",
  "bouclier-avace": "Bouclier avancé",
  "cration-d-anima": "Création d'anima",
  "creation-d-anima": "Création d'anima"
};

export const magicRules = {
  raceForbiddenSchools: {
    "elfe-lunaire": ["Sortilèges", "Magie élémentaire", "Nécromancie", "Magie noire", "Voie maudite"]
  },
  careerSchoolOverrides: {
    ermite: ["Druidisme"],
    "gardien-mystique": ["Druidisme"],
    guerisseur: ["Dons", "Magie noire", "Voie maudite", "Voie sacrée"],
    inquisiteur: ["Dons", "Magie noire", "Voie maudite", "Voie sacrée"]
  },
  schoolTypes: {
    arcane: ["Magie élémentaire", "Nécromancie", "Sortilèges"],
    divine: ["Dons", "Druidisme", "Magie noire", "Voie maudite", "Voie sacrée"]
  },
  dualSchoolCareers: {
    animiste: { secondReligion: false, primaryType: "any", secondaryType: "any" },
    chaman: { secondReligion: false, primaryType: "divine", secondaryType: "arcane" },
    sage: { secondReligion: true, primaryType: "divine", secondaryType: "arcane" }
  }
};

export const competenceRules = {
  concoctionRules: {
    "concoction alchimie": {
      races: ["gobelin", "satyre", "humain"],
      carrieres: ["mage", "marchand", "magelame", "maitre-runes", "sage", "scribe"]
    },
    "concoction herboristerie": {
      races: ["elfe-sauvage", "etre-sylvestre", "satyre", "humain"],
      carrieres: [
        "druide",
        "marchand",
        "pretre",
        "animiste",
        "chaman",
        "ermite",
        "gardien-mystique",
        "guerisseur",
        "inquisiteur",
        "totem",
        "rodeur",
        "sage"
      ]
    },
    "concoction toxicologie": {
      races: ["etre-sylvestre", "humain"],
      carrieres: ["druide", "marchand", "roublard", "barde", "chaman", "charlatan", "ermite", "inquisiteur", "totem", "rodeur", "traqueur"]
    }
  },
  exclusiveConcoctionsByCareer: {
    sage: ["concoction alchimie", "concoction herboristerie"]
  },
  firstFreeByCareer: firstFreeCompetenceRules,
  scenarioResourceRules: {
    concoctionPlantGift: {
      keys: ["concoction alchimie", "concoction herboristerie", "concoction toxicologie"],
      label: "Concoction",
      detail: "5 plantes au hasard en début de scénario si le personnage possède au moins une catégorie de Concoction."
    },
    byCompetence: {
      "concoction alchimie": {
        label: "Concoction : Alchimie",
        detail: "5 bases d'alchimie en début de scénario."
      },
      "concoction herboristerie": {
        label: "Concoction : Herboristerie",
        detail: "5 bases d'herboristerie en début de scénario."
      },
      "concoction toxicologie": {
        label: "Concoction : Toxicologie",
        detail: "5 bases de toxicologie en début de scénario."
      },
      forge: {
        label: "Forge",
        detail: "10 cartes de forge et 5 minerais au hasard en début de scénario."
      },
      "contact marchand mineur": {
        label: "Contact Marchand - Mineur",
        detail: "5 minerais au hasard en début de scénario."
      },
      "contact marchand druide": {
        label: "Contact Marchand - Druide",
        detail: "5 plantes au hasard en début de scénario."
      },
      "contact marchand brasseur": {
        label: "Contact Marchand - Brasseur",
        detail: "10 lots d'alcool en début de scénario."
      },
      "contact marchand forgeron": {
        label: "Contact Marchand - Forgeron",
        detail: "10 cartes de forge supplémentaires en début de scénario."
      },
      "contact marchand scribe": {
        label: "Contact Marchand - Scribe",
        detail: "1 parchemin de sort de niveau aléatoire 1 à 5 en début de scénario."
      },
      "contact marchand sorcier": {
        label: "Contact Marchand - Sorcier",
        detail: "1 talisman au hasard avec un seul pouvoir en début de scénario."
      },
      "contact marchand commanditaire": {
        label: "Contact Marchand - Commanditaire",
        detail: "5 couronnes en début de scénario."
      }
    },
    creationAccrue: {
      key: "creation accrue",
      label: "Création accrue",
      amountPerConcoction: 3,
      detailWithConcoctions: "3 plantes au hasard supplémentaires par type de Concoction possédé ({types}: {total} plantes).",
      detailWithoutConcoction: "3 plantes au hasard supplémentaires par type de Concoction possédé; aucune Concoction sélectionnée pour calculer le total."
    }
  },
  access: {
    charognardRaces: ["corvus", "orque", "norde", "demi-demon", "rasgadan", "gobelin", "morgull", "saurien", "ratfolk"],
    rageAnimaleRaces: ["arboreen", "corvus", "merflok", "rasgadan", "ratfolk", "saurien"],
    sangImpurDirectRaces: ["demi-demon", "elfe-sanguinaire", "morgull", "illithyd"],
    sangInterditRaces: ["norde"],
    sangPurInterditRaces: ["demi-demon", "elfe-sanguinaire", "morgull", "illithyd", "norde"]
  }
};

export function getClientCodexRules() {
  return {
    magic: magicRules,
    competences: competenceRules
  };
}
