// Définit toutes les clés de statistiques possibles, extraites de l'analyse exhaustive
// des 179 talents (Section 1 : 47 stats numériques réelles)

import { analyserDescriptionTalent } from './statsParser';

export type CleStat =
// Attaque
| 'attaque'
| 'attaqueElementaire'
| 'attaqueFeu'
| 'attaqueEau'
| 'attaqueFoudre'
| 'attaqueGlace'
| 'attaqueDragon'
| 'attaqueSupplementaire'
| 'affinite'
| 'degatsCritiques'

// Défense
| 'defense'
| 'resistance'
| 'resistanceFeu'
| 'resistanceEau'
| 'resistanceFoudre'
| 'resistanceGlace'
| 'resistanceDragon'

// Statuts & Affections
| 'poison'
| 'paralysie'
| 'sommeil'
| 'explosion'
| 'affliction'

// Etourdissement / Résistances spéciales
| 'etourdissement'
| 'resistanceEtourdissement'

// Endurance
| 'endurance'
| 'reductionEndurance'
| 'vitesseRechargeEndurance'

// Objets & Collecte
| 'vitesseCollecte'
| 'quantiteCollecte'
| 'chanceCollecteRare'

// Armes à distance
| 'vitesseRechargement'
| 'puissanceMunitions'
| 'puissanceFleches'
| 'porteeTir'

// Armes à jauge/charge
| 'vitesseRemplissageJauge'
| 'vitesseChargement'
| 'tempsCharge'

// Mouvement
| 'vitesseDeplacement'
| 'distanceEsquive'
| 'fenetreInvulnerabilite'
| 'vitesseRengainage'

// Divers combat
| 'degatsParties'
| 'degatsInfliges'
| 'furie'
| 'vitesseRepas'

// Défense passive
| 'reductionImpact'
| 'protectionChutes'
| 'protectionRepoussement';

// Structure d'un bonus de stat (utilisée après parsing d'une description)
export interface BonusStat {
    cle: CleStat;
    valeur: number;
    estPourcentage: boolean;
}

// Un talent peut avoir plusieurs bonus permanents ET plusieurs bonus conditionnels
export interface EffetTalent {
    bonusPermanents: BonusStat[];
    bonusConditionnels: BonusStatConditionnel[];
    effetsTexteLibre: string[];
}

// Bonus qui ne s'applique que sous certaines conditions (ex: "si les conditions sont remplies")
export interface BonusStatConditionnel extends BonusStat {
    condition: string; // Texte brut de la condition, affiché à l'utilisateur
}
