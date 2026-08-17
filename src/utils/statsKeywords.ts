// Dictionnaire des mots-clés associés à chaque stat, ORDONNÉ du plus spécifique
// au plus générique (crucial pour le parsing par regex : on doit tester
// "Résistance Dragon" avant "Résistance" seul, sinon on matchera le mauvais pattern)

import type { CleStat } from '../types/stats';

export interface MotCleStat {
    cle: CleStat;
    motsCles: RegExp;
    estPourcentage: boolean;
}

// Patterns à EXCLURE explicitement du matching automatique car trop ambigus/contextuels
// (dépendent du monstre affronté, non calculables dans un build statique)
export const PATTERNS_EXCLUS: RegExp[] = [
    /r[ée]sistance\s+à\s+l['’]élément/i,
/r[ée]sistance\s+subi/i,
];

export const MOTS_CLES_STATS: MotCleStat[] = [
    // === ATTAQUE ÉLÉMENTAIRE (spécifique avant générique) ===
    { cle: 'attaqueFeu', motsCles: /attaque\s+feu/i, estPourcentage: false },
{ cle: 'attaqueEau', motsCles: /attaque\s+eau/i, estPourcentage: false },
{ cle: 'attaqueFoudre', motsCles: /attaque\s+foudre/i, estPourcentage: false },
{ cle: 'attaqueGlace', motsCles: /attaque\s+glace/i, estPourcentage: false },
{ cle: 'attaqueDragon', motsCles: /attaque\s+dragon/i, estPourcentage: false },
{ cle: 'attaqueElementaire', motsCles: /attaque\s+élémentaire/i, estPourcentage: false },
{ cle: 'attaqueSupplementaire', motsCles: /dégâts?\s+(suppl[ée]mentaires?|additionnels?)/i, estPourcentage: false },

// === RÉSISTANCES ÉLÉMENTAIRES (spécifique avant générique) ===
{ cle: 'resistanceFeu', motsCles: /r[ée]sistance\s+feu/i, estPourcentage: false },
{ cle: 'resistanceEau', motsCles: /r[ée]sistance\s+eau/i, estPourcentage: false },
{ cle: 'resistanceFoudre', motsCles: /r[ée]sistance\s+foudre/i, estPourcentage: false },
{ cle: 'resistanceGlace', motsCles: /r[ée]sistance\s+glace/i, estPourcentage: false },
{ cle: 'resistanceDragon', motsCles: /r[ée]sistance\s+dragon/i, estPourcentage: false },
{ cle: 'resistanceEtourdissement', motsCles: /r[ée]sistance.*[ée]tourdissement/i, estPourcentage: false },
{ cle: 'resistance', motsCles: /r[ée]sistances?\s+[ée]l[ée]mentaires?/i, estPourcentage: false },

// === DÉFENSE / ATTAQUE GÉNÉRIQUES ===
{ cle: 'defense', motsCles: /d[ée]fense/i, estPourcentage: false },
{ cle: 'affinite', motsCles: /affinit[ée]/i, estPourcentage: true },
{ cle: 'degatsCritiques', motsCles: /d[ée]g[ââ]ts?\s+critiques?/i, estPourcentage: false },
{ cle: 'attaque', motsCles: /attaque(?!\s+(feu|eau|foudre|glace|dragon|[ée]l[ée]mentaire))/i, estPourcentage: false },

// === STATUTS ===
{ cle: 'poison', motsCles: /poison/i, estPourcentage: false },
{ cle: 'paralysie', motsCles: /paralysie/i, estPourcentage: false },
{ cle: 'sommeil', motsCles: /sommeil/i, estPourcentage: false },
{ cle: 'explosion', motsCles: /explosion/i, estPourcentage: false },
{ cle: 'affliction', motsCles: /affliction/i, estPourcentage: false },
{ cle: 'etourdissement', motsCles: /[ée]tourdissement/i, estPourcentage: true },

// === ENDURANCE ===
{ cle: 'reductionEndurance', motsCles: /r[ée]duit.*endurance/i, estPourcentage: true },
{ cle: 'vitesseRechargeEndurance', motsCles: /vitesse.*(recharge|remplissage).*endurance/i, estPourcentage: false },
{ cle: 'endurance', motsCles: /endurance/i, estPourcentage: false },

// === COLLECTE ===
{ cle: 'chanceCollecteRare', motsCles: /points?\s+de\s+collecte\s+rare/i, estPourcentage: false },
{ cle: 'vitesseCollecte', motsCles: /vitesse\s+de\s+collecte/i, estPourcentage: false },
{ cle: 'quantiteCollecte', motsCles: /quantit[ée].*collecte/i, estPourcentage: false },

// === ARMES À DISTANCE ===
{ cle: 'puissanceMunitions', motsCles: /puissance.*munitions/i, estPourcentage: false },
{ cle: 'puissanceFleches', motsCles: /puissance.*fl[èe]ches/i, estPourcentage: false },
{ cle: 'vitesseRechargement', motsCles: /vitesse\s+de\s+rechargement/i, estPourcentage: false },
{ cle: 'porteeTir', motsCles: /port[ée]e/i, estPourcentage: false },

// === ARMES JAUGE/CHARGE ===
{ cle: 'vitesseRemplissageJauge', motsCles: /remplissage.*jauge/i, estPourcentage: false },
{ cle: 'tempsCharge', motsCles: /temps\s+de\s+charge/i, estPourcentage: true },
{ cle: 'vitesseChargement', motsCles: /vitesse.*chargement/i, estPourcentage: false },

// === MOUVEMENT ===
{ cle: 'vitesseDeplacement', motsCles: /vitesse\s+de\s+d[ée]placement/i, estPourcentage: false },
{ cle: 'distanceEsquive', motsCles: /distance\s+d.?esquive/i, estPourcentage: false },
{ cle: 'fenetreInvulnerabilite', motsCles: /fen[êe]tre\s+d.?invulnérabilit[ée]/i, estPourcentage: false },
{ cle: 'vitesseRengainage', motsCles: /vitesse\s+de\s+rengainage/i, estPourcentage: false },

// === DIVERS COMBAT ===
{ cle: 'degatsParties', motsCles: /d[ée]g[âa]ts?\s+contre\s+les\s+parties/i, estPourcentage: true },
{ cle: 'degatsInfliges', motsCles: /d[ée]g[âa]ts?\s+inflig[ée]s/i, estPourcentage: true },
{ cle: 'furie', motsCles: /furie/i, estPourcentage: false },
{ cle: 'vitesseRepas', motsCles: /vitesse\s+des\s+repas/i, estPourcentage: false },

// === DÉFENSE PASSIVE ===
{ cle: 'reductionImpact', motsCles: /r[ée]duit.*impact/i, estPourcentage: false },
{ cle: 'protectionChutes', motsCles: /[ée]vite\s+les\s+chutes/i, estPourcentage: false },
{ cle: 'protectionRepoussement', motsCles: /[ée]vite.*repoussements?/i, estPourcentage: false },
];

// Mots-clés indiquant qu'un effet est CONDITIONNEL (à traiter à part dans l'UI)
export const MOTS_CLES_CONDITIONNELS: RegExp[] = [
    /\blorsque\b/i,
/\bsi\s+les?\s+conditions?\b/i,
/\bpendant\b/i,
/\baprès\b/i,
/\bactif\b/i,
/\btant\s+que\b/i,
/\bquand\b/i,
];
