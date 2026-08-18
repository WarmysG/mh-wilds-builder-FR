# Demande d’audit — MH Wilds Builder FR

> **Dépôt source :** `WarmysG/mh-wilds-builder-FR`  
> **Branche auditée :** `main`  
> **Objectif principal :** diagnostiquer de la base du code, de sa fiabilité et de son optimisation avant poursuite du projet. Des milliers de lignes supplémentaires sont prévues .

## 1. Contexte et symptôme

Cette application React + TypeScript + Vite permet de composer un build Monster Hunter Wilds à partir d’une arme, de pièces d’armure et d’un talisman, puis d’afficher les statistiques résultantes.

Le problème à investiguer est le suivant : **les talents présents sur l’équipement ou sélectionnés dans l’interface semblent ne pas modifier les statistiques affichées**.

L’audit doit suivre le flux complet :

```text
API / données locales
  → types TypeScript
  → état du build
  → sélection d’équipement et de talents
  → calcul des statistiques
  → affichage dans StatsPanel
```

Merci d’identifier précisément :

- où les talents sont chargés, transformés, stockés et transmis ;
- si les noms, identifiants et niveaux de talents restent cohérents entre l’API et l’interface ;
- si les talents sont réellement inclus dans `calculateBuildStats` ;
- si les bonus sont appliqués au bon niveau et au bon moment ;
- si l’interface affiche un état différent de celui utilisé pour le calcul ;
- si un typage trop permissif, une valeur `undefined`, une mauvaise clé ou une conversion de type neutralise les bonus.

---

## 2. Fichiers à auditer — code TypeScript / React

### 2.1 Types et contrats de données

Ces fichiers définissent les formes attendues pour les équipements, les talents et les statistiques. Vérifier leur compatibilité avec les réponses réelles de l’API et avec les objets effectivement manipulés par les composants.

 FILE: main/src/types/wilds.ts

 
/** Types bruts de l'API Wilds MHDB (https://wilds.mhdb.io/fr/).
 * Les noms et la forme sont volontairement ceux de l'API ; ne pas les traduire ici.
 * Validé le 16/08/2026 contre un échantillon réel de 1188 armes, 714 armures,
 * 64 talismans, 179 talents et les décorations (joyaux).
 */

import type { EffetTalent } from './stats';

// ============================================================
// TYPES COMMUNS / PARTAGÉS
// ============================================================


export interface IconAPI {
    id?: number;
    kind?: string;
    color?: string;
    colorId?: number;
}

// ============================================================
// ARMES (/fr/weapons)
// ============================================================

export interface WeaponDamageAPI {
    raw: number;
    display: number;
}

export interface WeaponSkillAPI {
    skill: { id: number };
    level: number;
}

export interface WeaponAPI {
    id: number;
    name: string;
    kind: string;
    rarity: number;
    damage: WeaponDamageAPI;
    slots: number[];
    skills: WeaponSkillAPI[];
}

// ============================================================
// ARMURES (/fr/armor)
// ============================================================

export interface ResistancesAPI {
    fire: number;
    water: number;
    ice: number;
    thunder: number;
    dragon: number;
}

export interface DefenseAPI {
    base: number;
    max: number;
}

export interface ArmorSkillAPI {
    skill: {
        id: number;
        gameId?: number;
        name: string;
        kind: string; // "armor" | "group" | "set" ...
    };
    level: number;
    name: string | null;          // nom du bonus si différent (ex: "Maître dépeceur")
    description: string;
    setPiecesRequired: number | null; // nombre de pièces requises si bonus de set
    id: number;
}

export interface ArmorSetAPI {
    id: number;
    name: string;
}

export interface ArmorAPI {
    kind: string;
    name: string;
    description: string;
    rank: string;
    rarity: number;
    resistances: ResistancesAPI;
    defense: DefenseAPI;
    slots: number[];
    skills: ArmorSkillAPI[];
    armorSet?: ArmorSetAPI; // absent si l'armure n'appartient à aucun set
    id: number;
}

// ============================================================
// TALISMANS (/fr/charms)
// ============================================================

export interface CharmRankSkillAPI {
    skill: { id: number };
    level: number;
}

export interface CharmRankAPI {
    id: number;
    level: number;
    name: string;
    description?: string;
    rarity?: number;
    skills: CharmRankSkillAPI[];
}

export interface CharmAPI {
    id: number;
    gameId?: number;
    ranks: CharmRankAPI[];
}

// ============================================================
// TALENTS (/fr/skills)
// ============================================================

export interface SkillRankAPI {
    skill: { id: number };
    level: number;
    name: string | null;
    description: string;
    setPiecesRequired: number | null;
    id: number;
}

export interface SkillAPI {
    name: string;
    kind: string;
    description: string | null;
    ranks: SkillRankAPI[];
    icon: IconAPI;
    id: number;
    gameId: number;
}

// ============================================================
// DÉCORATIONS / JOYAUX (/fr/decorations)
// ============================================================

/** kind détermine si le joyau se place dans un emplacement d'arme ou d'armure. */
export interface DecorationSkillAPI {
    skill: { id: number; name: string };
    level: number;
    description: string;
    setPiecesRequired: number | null;
    id: number;
}

export interface DecorationAPI {
    id: number;
    gameId: number;
    name: string;
    description: string;
    value: number;
    slot: number;
    rarity: number;
    kind: 'weapon' | 'armor';
    skills: DecorationSkillAPI[];
    icon: IconAPI;
}

// ============================================================
// ============================================================
// DOMAINE FRANÇAIS (types mappés, utilisés dans toute l'app)
// ============================================================
// ============================================================

export type TypeArme =
| 'great-sword'
| 'long-sword'
| 'sword-and-shield'
| 'dual-blades'
| 'hammer'
| 'hunting-horn'
| 'lance'
| 'gunlance'
| 'switch-axe'
| 'charge-blade'
| 'insect-glaive'
| 'bow'
| 'heavy-bowgun'
| 'light-bowgun';

/** Instance d'un talent appliqué à une pièce d'équipement précise
 * (un seul niveau, celui de cette pièce). À ne pas confondre avec Skill,
 * qui est la fiche complète du talent avec tous ses rangs possibles.
 */
export interface Talent {
    id: number;
    nom: string;
    niveau: number;
}

export interface Arme {
    id: number;
    nom: string;
    type: TypeArme;
    rarete: number;
    degatsAffiches: number;
    affinite: number;
    defenseBonus: number;
    emplacements: number[];
    talents: Talent[];
}

export interface EnsembleArmure {
    id: number;
    nom: string;
}

export interface Armure {
    id: number;
    nom: string;
    description: string;
    emplacement: string;
    rarete: number;
    defenseBase: number;
    defenseMax: number;
    resistances: {
        feu: number;
        eau: number;
        glace: number;
        tonnerre: number;
        dragon: number;
    };
    emplacements: number[];
    talents: Talent[];
    bonusEnsemble: Talent[];
    ensemble?: EnsembleArmure;
}

/** Un talisman mappé pour le domaine français.
 * Ne conserve que le premier rang (niveau de base) de l'API.
 */
export interface Talisman {
    id: number;
    nom: string;
    niveau: number;
    talents: Talent[];
}

/** Un joyau (décoration) mappé pour le domaine français.
 * kind indique s'il se place dans un emplacement d'arme ou d'armure.
 */
export interface Joyau {
    id: number;
    nom: string;
    taille: number;
    kind: 'weapon' | 'armor';
    talents: Talent[];
}

/** Un rang possible d'un talent, indépendant de toute pièce d'équipement. */
export interface RangTalent {
    niveau: number;
    description: string;
    effets: EffetTalent;
}

/** Définition complète d'un talent (fiche générale), provenant de /fr/skills.
 * Le niveau max du talent = ranks.length (variable selon le talent, 1 à 7+).
 */
export interface Skill {
    id: number;
    nom: string;
    description: string;
    ranks: RangTalent[];
}

// ============================================================
// ÉTAT DU BUILD
// ============================================================

export type SlotEquipement =
| 'arme'
| 'casque'
| 'torse'
| 'bras'
| 'taille'
| 'jambes'
| 'talisman';

/** Tableau des joyaux insérés dans une pièce, un élément par emplacement.
 * L'index correspond à l'emplacement (0 = premier slot, etc.).
 * null = emplacement vide.
 */
export type JoyauxInseres = (Joyau | null)[];

export interface EmplacementBuild<T> {
    equipement: T | null;
    joyaux: JoyauxInseres;
}

export interface EtatBuild {
    arme: EmplacementBuild<Arme>;
    casque: EmplacementBuild<Armure>;
    torse: EmplacementBuild<Armure>;
    bras: EmplacementBuild<Armure>;
    taille: EmplacementBuild<Armure>;
    jambes: EmplacementBuild<Armure>;
    talisman: EmplacementBuild<Talisman>;
}

/** Crée un état de build vierge, avec tous les slots vides. */
export function creerBuildVide(): EtatBuild {
    const vide = <T,>(): EmplacementBuild<T> => ({ equipement: null, joyaux: [] });
    return {
        arme: vide<Arme>(),
        casque: vide<Armure>(),
        torse: vide<Armure>(),
        bras: vide<Armure>(),
        taille: vide<Armure>(),
        jambes: vide<Armure>(),
        talisman: vide<Talisman>(),
    };
}

// ============================================================
// STATISTIQUES CALCULÉES
// ============================================================

export interface TalentActif {
    nom: string;
    niveau: number;
    niveauMax: number;
}

export interface StatsCalculees {
    attaque: number;
    affinite: number;
    defense: number;
    resistances: {
        feu: number;
        eau: number;
        glace: number;
        tonnerre: number;
        dragon: number;
    };
    talentsActifs: TalentActif[];
}

---

FILE : main/src/types/stats.ts

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

**Points de contrôle :**

- représentation d’un talent : `id`, nom, niveau, rangs et bonus ;
- distinction entre talent d’équipement, talent actif et bonus agrégé ;
- types numériques réellement numériques (`number`) et non chaînes (`string`) ;
- propriétés optionnelles, valeurs nulles et valeurs par défaut ;
- correspondance entre les clés de résistances/statistiques et celles attendues par les calculs ;
- perte éventuelle d’informations lors du mapping d’une réponse API.

### 2.2 Logique de calcul et parsing

C’est la zone prioritaire de l’audit : elle doit démontrer, étape par étape, comment les talents deviennent des bonus de statistiques.


FILE : src/utils/calculations.ts

import type { EtatBuild, StatsCalculees, Talent, SlotEquipement, Skill, Armure, EmplacementBuild } from '../types/wilds';

const RESISTANCES_VIDES = {
    feu: 0,
    eau: 0,
    glace: 0,
    tonnerre: 0,
    dragon: 0,
} as const;

const EMPLACEMENTS_ARMURE: ('casque' | 'torse' | 'bras' | 'taille' | 'jambes')[] = [
    'casque',
'torse',
'bras',
'taille',
'jambes',
];

/** Construit une table de correspondance nom du talent → niveau maximum possible,
 * à partir de la liste des talents renvoyée par l'API (/fr/skills).
 */
export function construireNiveauxMax(talents: Skill[]): Map<string, number> {
    const table = new Map<string, number>();
    talents.forEach((talent) => {
        table.set(talent.nom, talent.ranks.length);
    });
    return table;
}

function ajouterTalent(accumulateur: Map<string, number>, talent: Talent): void {
    const niveauActuel = accumulateur.get(talent.nom) ?? 0;
    accumulateur.set(talent.nom, niveauActuel + talent.niveau);
}

/** Calcule les statistiques totales d'un build : attaque, affinité, défense,
 * résistances et talents actifs (cumulés et plafonnés selon leur niveau max).
 * Prend en compte les talents des pièces ET des joyaux insérés dans chaque emplacement.
 *
 * @param niveauxMax table nom du talent → niveau max, construite via construireNiveauxMax()
 */
export function calculerStats(
    build: EtatBuild,
    niveauxMax: Map<string, number>
): StatsCalculees {
    let attaque = 0;
    let affinite = 0;
    let defense = 0;
    const resistances = { ...RESISTANCES_VIDES };
    const talentsAccumules = new Map<string, number>();

    // --- ARME ---
    const arme = build.arme.equipement;
    if (arme) {
        attaque += arme.degatsAffiches;
        affinite += arme.affinite;
        defense += arme.defenseBonus;
        arme.talents.forEach((talent) => ajouterTalent(talentsAccumules, talent));
    }
    build.arme.joyaux.forEach((joyau) => {
        joyau?.talents.forEach((talent) => ajouterTalent(talentsAccumules, talent));
    });

    // --- ARMURES ---
    for (const emplacement of EMPLACEMENTS_ARMURE) {
        const piece: EmplacementBuild<Armure> = build[emplacement];
        const armure = piece.equipement;

        if (armure) {
            defense += armure.defenseBase;
            resistances.feu += armure.resistances.feu;
            resistances.eau += armure.resistances.eau;
            resistances.glace += armure.resistances.glace;
            resistances.tonnerre += armure.resistances.tonnerre;
            resistances.dragon += armure.resistances.dragon;

            armure.talents.forEach((talent: Talent) => ajouterTalent(talentsAccumules, talent));
        }

        piece.joyaux.forEach((joyau) => {
            joyau?.talents.forEach((talent) => ajouterTalent(talentsAccumules, talent));
        });
    }

    // --- TALISMAN ---
    const talisman = build.talisman.equipement;
    if (talisman) {
        talisman.talents.forEach((talent) => ajouterTalent(talentsAccumules, talent));
    }
    build.talisman.joyaux.forEach((joyau) => {
        joyau?.talents.forEach((talent) => ajouterTalent(talentsAccumules, talent));
    });

    // Plafonnement selon le niveau max de chaque talent, puis conversion en tableau trié
    const talentsActifs = Array.from(talentsAccumules.entries())
    .map(([nom, niveau]) => {
        const niveauMax = niveauxMax.get(nom) ?? niveau; // si inconnu, pas de plafond
        return {
            nom,
            niveau: Math.min(niveau, niveauMax),
         niveauMax,
        };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    return {
        attaque,
        affinite,
        defense,
        resistances,
        talentsActifs,
    };
}

/** Détermine si un joyau peut être inséré dans un emplacement donné,
 * selon sa taille et le type de pièce (arme ou armure).
 */
export function joyauCompatible(
    tailleJoyau: number,
    tailleEmplacement: number,
    kindJoyau: 'weapon' | 'armor',
    slot: SlotEquipement
): boolean {
    const kindAttendu = slot === 'arme' ? 'weapon' : 'armor';
    return kindJoyau === kindAttendu && tailleJoyau <= tailleEmplacement;
}

---

FILE : main/src/utils/statsParser.ts


// Parseur qui analyse une description brute de talent et en extrait
// les bonus permanents, conditionnels, et les effets texte libre non quantifiables

import type { BonusStat, BonusStatConditionnel, EffetTalent } from '../types/stats';
import { MOTS_CLES_STATS, MOTS_CLES_CONDITIONNELS, PATTERNS_EXCLUS } from './statsKeywords';

// Regex pour capturer une valeur numérique avec signe, suivie ou précédée d'un mot-clé
// Ex: "Attaque +8", "Défense +10 %", "-30 % d'endurance"
const REGEX_VALEUR_NUMERIQUE = /([+-]\s?\d+(?:[.,]\d+)?)\s*(%)?/g;

/**
 * Découpe une description en segments (une description peut contenir plusieurs
 * bonus, ex: "Défense +5 % Défense +10 Résistances élémentaires +3")
 *
 * On découpe sur DEUX types de frontières :
 * 1. Nombre/% suivi d'une majuscule (nouvelle stat sans ponctuation)
 * 2. Point final suivi d'une majuscule (nouvelle phrase/nouveau concept)
 */
function decouperEnSegments(description: string): string[] {
    const segments = description.split(
        /(?:(?<=[%\d])\s+(?=[A-ZÀ-Ý])|(?<=\.)\s+(?=[A-ZÀ-Ý]))/
    );
    return segments.length > 0 ? segments : [description];
}

/**
 * Détermine si une description contient une condition
 */
function estConditionnel(description: string): boolean {
    return MOTS_CLES_CONDITIONNELS.some((regex) => regex.test(description));
}

/**
 * Détermine si un segment correspond à un pattern explicitement exclu
 * (ex: "résistance à l'élément subi" — trop contextuel, non calculable)
 */
function estExclu(segment: string): boolean {
    return PATTERNS_EXCLUS.some((regex) => regex.test(segment));
}

/**
 * Cherche le premier mot-clé de stat qui correspond dans un segment de texte,
 * en testant dans l'ordre du dictionnaire (spécifique → générique)
 */
function trouverCleStat(segment: string) {
    for (const motCle of MOTS_CLES_STATS) {
        if (motCle.motsCles.test(segment)) {
            return motCle;
        }
    }
    return null;
}

/**
 * Extrait la valeur numérique et le signe % d'un segment
 */
function extraireValeur(segment: string): { valeur: number; estPourcentage: boolean } | null {
    const matches = [...segment.matchAll(REGEX_VALEUR_NUMERIQUE)];
    if (matches.length === 0) return null;

    // On prend la première valeur numérique trouvée dans le segment
    const premiereMatch = matches[0];
    const valeurBrute = premiereMatch[1].replace(/\s/g, '').replace(',', '.');
    const valeur = parseFloat(valeurBrute);
    const estPourcentage = premiereMatch[2] === '%';

    if (isNaN(valeur)) return null;

    return { valeur, estPourcentage };
}

/**
 * Fonction principale : parse une description brute de rang de talent
 * et retourne les bonus permanents, conditionnels et effets texte libre détectés
 */
export function analyserDescriptionTalent(description: string | null): EffetTalent {
    const resultat: EffetTalent = {
        bonusPermanents: [],
        bonusConditionnels: [],
        effetsTexteLibre: [],
    };

    if (!description || description.trim() === '') {
        return resultat;
    }

    const estConditionnelGlobal = estConditionnel(description);
    const segments = decouperEnSegments(description);

    let auMoinsUneStatTrouvee = false;

    for (const segment of segments) {
        // On ignore les segments explicitement exclus (ex: résistance contextuelle au monstre)
        if (estExclu(segment)) {
            continue;
        }

        const motCle = trouverCleStat(segment);
        const valeurExtraite = extraireValeur(segment);

        if (motCle && valeurExtraite) {
            auMoinsUneStatTrouvee = true;

            const bonus: BonusStat = {
                cle: motCle.cle,
                valeur: valeurExtraite.valeur,
                estPourcentage: valeurExtraite.estPourcentage || motCle.estPourcentage,
            };

            if (estConditionnelGlobal) {
                const bonusConditionnel: BonusStatConditionnel = {
                    ...bonus,
                    condition: description, // On garde la description complète comme condition affichable
                };
                resultat.bonusConditionnels.push(bonusConditionnel);
            } else {
                resultat.bonusPermanents.push(bonus);
            }
        }
    }

    // Si aucune stat numérique n'a été détectée, c'est un effet texte libre
    if (!auMoinsUneStatTrouvee) {
        resultat.effetsTexteLibre.push(description);
    }

    return resultat;
}

/**
 * Fonction utilitaire : parse tous les rangs d'un talent d'un coup
 * (à utiliser avec les données brutes de l'API /fr/skills)
 */
export function analyserTousLesRangs(
    ranks: Array<{ description: string | null }>
): EffetTalent[] {
    return ranks.map((rank) => analyserDescriptionTalent(rank.description));
}

---

FILE : main/src/utils/statsKeywords.ts

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

---

FILE : main/src/utils/mappage.ts

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

---

FILE : main/test-parser.ts

import { analyserDescriptionTalent } from './src/utils/statsParser';

const exemples = [
  "Défense +5 % Défense +10",
  "Défense +5 % Défense +20 Résistances élémentaires +3",
  "Augmente légèrement l'attaque élémentaire. Résistance à l'élément subi à l'activation : +4.",
  "Permet d'utiliser des fioles explosives",
  "Réduit la durée de la puanteur de 50 %.",
  "Facilite légèrement la création d'une blessure. Inflige aussi des dégâts non élémentaires.",
  "Lorsqu'il est actif, augmente légèrement l'attaque élémentaire. Résistance à l'élément subi à l'activation : +4.",
  "Réduit légèrement l'impact des attaques et réduit la perte d'endurance de 15 %.",
  "Augmente les dégâts contre les parties et les dégâts infligés de 10 % si les conditions sont remplies.",
  "Étourdissement +20 %",
];

exemples.forEach((desc, index) => {
  console.log(`\n=== Test ${index + 1} ===`);
  console.log('Description:', desc);
  console.log('Résultat:', JSON.stringify(analyserDescriptionTalent(desc), null, 2));
});

**Questions spécifiques sur le calcul :**

1. `calculateBuildStats` reçoit-il bien le build courant et tous ses équipements ?
2. Les talents de chaque slot sont-ils parcourus, ou seuls attaque/défense/résistances sont-ils additionnés ?
3. Les talents sont-ils regroupés par **identifiant stable** ou par nom affiché ?
4. Le regroupement additionne-t-il correctement les niveaux lorsque le même talent provient de plusieurs pièces ?
5. Le niveau total est-il plafonné au maximum prévu, et ce plafonnement est-il appliqué après l’agrégation ?
6. Le code distingue-t-il le niveau d’un talent (`level`, `rank`, `points`, etc.) d’un bonus numérique ?
7. Les descriptions de talents sont-elles parsées de manière robuste pour les bonus tels que pourcentage, valeur fixe, élément, défense ou affinité ?
8. `statsParser.ts` retourne-t-il réellement une structure consommée par `calculations.ts`, ou produit-il un format différent ?
9. `statsKeywords.ts` reconnaît-il les libellés français et les variantes réelles des données API ?
10. `mappage.ts` conserve-t-il les talents lors de la conversion anglais/français ou équipement/API → modèle interne ?
11. Les bonus en pourcentage sont-ils appliqués au bon ordre : base, addition des bonus fixes, puis multiplicateurs, si nécessaire ?
12. Les opérations arithmétiques ont-elles un effet neutralisé par `|| 0`, `Number(...)`, `parseInt`, concaténation de chaînes ou comparaison stricte d’identifiants ?
13. Les talents sans effet direct sur attaque/défense sont-ils tout de même conservés et affichés correctement ?
14. Existe-t-il des erreurs silencieuses, `catch` trop larges ou retours par défaut qui masquent un échec de parsing ?
15. Les règles de jeu codées correspondent-elles aux descriptions réellement reçues, ou le système suppose-t-il un format non garanti ?

**Tests minimaux à exiger de l’audit :**

- build vide : aucune statistique ni talent fantôme ;
- une pièce avec un talent de niveau 1 : le talent apparaît et son bonus change la statistique attendue ;
- deux pièces avec le même talent : les niveaux s’additionnent correctement ;
- talent au niveau maximal : aucun dépassement non prévu ;
- talents multiples sur une même pièce : aucun talent n’est écrasé ;
- talent sans bonus parsable : le talent reste visible et un diagnostic explicite est disponible ;
- changement/suppression d’une pièce : les bonus retirés disparaissent immédiatement ;
- valeurs API représentées sous forme de chaînes et de nombres ;
- descriptions françaises et anglaises, si les deux formats sont supportés.

### 2.3 Hooks et état du build

 Fichier URL raw GitHub 
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/hooks/useBuildState.ts

https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/hooks/useJoyauxAPI.ts

https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/hooks/useWildsAPI.ts

**Questions spécifiques sur l’état :**

- Les mises à jour d’un slot sont-elles immuables et déclenchent-elles bien un nouveau rendu ?
- L’équipement sélectionné contient-il ses talents complets, ou uniquement un `id`/nom qui n’est jamais résolu ensuite ?
- Les joyaux sont-ils ajoutés au même agrégat que les talents d’armure et de talisman ?
- Une sélection de talent ou de joyau est-elle écrasée par une mise à jour ultérieure du slot ?
- Le hook expose-t-il la même structure que celle attendue par les fonctions de calcul ?
- Les dépendances des `useMemo`, `useCallback` et `useEffect` sont-elles complètes ?
- Un tableau est-il muté directement, empêchant React de détecter le changement ?
- Les chargements API, états `loading` et erreurs peuvent-ils laisser des données partielles utilisées par le calcul ?
- Les réponses API sont-elles normalisées une seule fois, de façon cohérente et typée ?

### 2.4 Composants React

FILE : src/components/BuilderLayout.tsx

import { useState, useCallback } from 'react';
import { creerBuildVide } from '../types/wilds';
import type { EtatBuild, SlotEquipement, Arme, Armure, Talisman, JoyauxInseres, Joyau } from '../types/wilds';

type PieceEquipement = Arme | Armure | Talisman | null;

/** Gère l'état complet du build en cours de construction.
 * Fournit des fonctions pour définir ou retirer une pièce par slot,
 * ainsi que pour gérer les joyaux insérés dans chaque pièce.
 */
export function useBuildState() {
    const [build, setBuild] = useState<EtatBuild>(creerBuildVide());

    /** Remplace l'équipement d'un slot. Réinitialise les joyaux du slot
     * (car le nombre d'emplacements peut changer avec un nouvel équipement).
     */
    const definirPiece = useCallback((slot: SlotEquipement, piece: PieceEquipement) => {
        setBuild((precedent) => ({
            ...precedent,
            [slot]: {
                equipement: piece,
                joyaux: [],
            },
        }));
    }, []);

    const retirerPiece = useCallback((slot: SlotEquipement) => {
        setBuild((precedent) => ({
            ...precedent,
            [slot]: {
                equipement: null,
                joyaux: [],
            },
        }));
    }, []);

    /** Définit ou retire un joyau à un index précis dans un slot donné. */
    const definirJoyau = useCallback((slot: SlotEquipement, index: number, joyau: Joyau | null) => {
        setBuild((precedent) => {
            const emplacement = precedent[slot];
            const nouveauxJoyaux: JoyauxInseres = [...emplacement.joyaux];
            nouveauxJoyaux[index] = joyau;

            return {
                ...precedent,
                [slot]: {
                    ...emplacement,
                    joyaux: nouveauxJoyaux,
                },
            };
        });
    }, []);

    const reinitialiserBuild = useCallback(() => {
        setBuild(creerBuildVide());
    }, []);

    const chargerBuild = useCallback((nouveauBuild: EtatBuild) => {
        setBuild(nouveauBuild);
    }, []);

    return {
        build,
        definirPiece,
        retirerPiece,
        definirJoyau,
        reinitialiserBuild,
        chargerBuild,
    };
}

---



FILE : src/components/EquipmentGrid.tsx

import type { EtatBuild, SlotEquipement } from '../types/wilds';
import SelectionJoyauxSlot from './SelectionJoyauxSlot';

interface Props {
    build: EtatBuild;
    onSlotClick: (slot: SlotEquipement) => void;
    onSlotClear: (slot: SlotEquipement) => void;
    onJoyauSlotClick: (slot: SlotEquipement, index: number, tailleMax: number) => void;
    onRetirerJoyau: (slot: SlotEquipement, index: number) => void;
}

const LIBELLES_SLOTS: Record<SlotEquipement, string> = {
    arme: '🗡️ Arme',
    casque: '🪖 Casque',
    torse: '👔 Torse',
    bras: '🤝 Bras',
    taille: '⚙️ Taille',
    jambes: '🦵 Jambes',
    talisman: '✨ Talisman',
};

const ORDRE_SLOTS: SlotEquipement[] = [
    'arme', 'casque', 'torse', 'bras', 'taille', 'jambes', 'talisman',
];

export default function EquipementGrille({
    build,
    onSlotClick,
    onSlotClear,
    onJoyauSlotClick,
    onRetirerJoyau,
}: Props) {
    return (
        <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Équipement</h2>
        <div className="space-y-2">
        {ORDRE_SLOTS.map((slot) => {
            const { equipement, joyaux } = build[slot];
            // 'emplacements' n'existe pas sur Talisman
            const emplacements = equipement && 'emplacements' in equipement
            ? equipement.emplacements
            : [];

            return (
                <div key={slot}>
                <div
                className="flex items-center justify-between bg-gray-700 rounded p-3 hover:bg-gray-600 cursor-pointer transition"
                onClick={() => onSlotClick(slot)}
                >
                <div>
                <span className="font-medium">{LIBELLES_SLOTS[slot]}</span>
                <span className="ml-3 text-gray-300">
                {equipement ? `— ${equipement.nom}` : 'Aucun équipement sélectionné'}
                </span>
                </div>
                {equipement && (
                    <button
                    className="text-red-400 hover:text-red-300 px-2"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSlotClear(slot);
                    }}
                    aria-label={`Retirer ${LIBELLES_SLOTS[slot]}`}
                    >
                    ✕
                    </button>
                )}
                </div>

                {equipement && emplacements.length > 0 && (
                    <SelectionJoyauxSlot
                    emplacements={emplacements}
                    joyauxInseres={joyaux}
                    onSlotClick={(index, tailleMax) =>
                        onJoyauSlotClick(slot, index, tailleMax)
                    }
                    onRetirerJoyau={(index) => onRetirerJoyau(slot, index)}
                    />
                )}
                </div>
            );
        })}
        </div>
        </div>
    );
}

---

FILE : main/src/components/StatsPanel.tsx

import type { StatsCalculees } from '../types/wilds';

interface Props {
    stats: StatsCalculees;
}

const LIBELLES_RESISTANCES: Record<keyof StatsCalculees['resistances'], string> = {
    feu: '🔥 Feu',
    eau: '💧 Eau',
    glace: '❄️ Glace',
    tonnerre: '⚡ Tonnerre',
    dragon: '🐲 Dragon',
};

/** Affiche le panneau de statistiques calculées du build : attaque, défense,
 * résistances élémentaires et talents actifs cumulés.
 */
export default function StatsPanel({ stats }: Props) {
    return (
        <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Statistiques</h2>

        <div className="space-y-2 mb-6">
        <div className="flex justify-between">
        <span>⚔️ Attaque</span>
        <span className="font-bold">{stats.attaque}</span>
        </div>
        <div className="flex justify-between">
        <span>🎯 Affinité</span>
        <span className={`font-bold ${stats.affinite >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {stats.affinite > 0 ? '+' : ''}{stats.affinite}%
        </span>
        </div>
        <div className="flex justify-between">
        <span>🛡️ Défense</span>
        <span className="font-bold">{stats.defense}</span>
        </div>
        {(Object.keys(stats.resistances) as (keyof StatsCalculees['resistances'])[]).map(
            (cle) => (
                <div key={cle} className="flex justify-between">
                <span>{LIBELLES_RESISTANCES[cle]}</span>
                <span className="font-bold">{stats.resistances[cle]}</span>
                </div>
            )
        )}
        </div>

        <h3 className="text-lg font-semibold mb-2">📊 Talents actifs</h3>
        <div className="space-y-1">
        {stats.talentsActifs.length === 0 && (
            <p className="text-gray-400">Aucun talent actif.</p>
        )}
        {stats.talentsActifs.map((talent) => (
            <div key={talent.nom} className="flex justify-between text-sm">
            <span>{talent.nom}</span>
            <span className="text-gray-300">Niveau {talent.niveau}</span>
            </div>
        ))}
        </div>
        </div>
    );
}

---

FILE : main/src/components/SelectionModal.tsx

import { useState } from 'react';
import type { Arme, Armure, Talisman, SlotEquipement } from '../types/wilds';

type PieceSelectionnable = Arme | Armure | Talisman;

interface Props {
    slot: SlotEquipement;
    armes: Arme[];
    armures: Armure[];
    talismans: Talisman[];
    onSelect: (piece: PieceSelectionnable) => void;
    onClose: () => void;
}

const SLOTS_ARMURE: SlotEquipement[] = ['casque', 'torse', 'bras', 'taille', 'jambes'];

/** Correspondance entre nos slots FR et la valeur 'kind' brute renvoyée par l'API
 * (a priori en anglais : "head", "chest", "arms", "waist", "legs").
 */
const KIND_ARMURE_PAR_SLOT: Record<string, string> = {
    casque: 'head',
    torse: 'chest',
    bras: 'arms',
    taille: 'waist',
    jambes: 'legs',
};

/** Modale de sélection d'équipement. Filtre automatiquement la liste selon le slot
 * demandé (arme, une des 5 pièces d'armure, ou talisman) et permet une recherche
 * textuelle simple par nom.
 */
export default function SelectionModal({
    slot,
    armes,
    armures,
    talismans,
    onSelect,
    onClose,
}: Props) {
    const [recherche, setRecherche] = useState('');

    let liste: PieceSelectionnable[] = [];

    if (slot === 'arme') {
        liste = armes;
    } else if (slot === 'talisman') {
        liste = talismans;
    } else if (SLOTS_ARMURE.includes(slot)) {
        const kindAttendu = KIND_ARMURE_PAR_SLOT[slot];
        liste = armures.filter((a) => a.emplacement === kindAttendu);
    }

    const listeFiltree = liste.filter((piece) =>
    piece.nom.toLowerCase().includes(recherche.toLowerCase())
    );

    return (
        <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        >
        <div
        className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choisir un équipement</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
        ✕
        </button>
        </div>

        <div className="p-4 border-b border-gray-700">
        <input
        type="text"
        placeholder="Rechercher par nom..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full bg-gray-700 rounded px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
        />
        </div>

        <div className="overflow-y-auto flex-1 p-2">
        {listeFiltree.length === 0 && (
            <p className="text-gray-400 text-center p-4">Aucun résultat.</p>
        )}
        {listeFiltree.map((piece) => (
            <div
            key={piece.id}
            className="p-3 hover:bg-gray-700 rounded cursor-pointer transition"
            onClick={() => onSelect(piece)}
            >
            <p className="font-medium">{piece.nom}</p>
            <p className="text-sm text-gray-400">
            {'rarete' in piece ? `Rareté ${piece.rarete}` : ''}
            </p>
            </div>
        ))}
        </div>
        </div>
        </div>
    );
}

---

FILE : main/src/components/SelectionJoyauModal.tsx

import { useState } from 'react';
import type { Joyau, SlotEquipement } from '../types/wilds';
import { joyauCompatible } from '../utils/calculations';

interface Props {
    slot: SlotEquipement;
    tailleMax: number;
    joyaux: Joyau[];
    onSelect: (joyau: Joyau) => void;
    onClose: () => void;
}

/** Modale de sélection d'un joyau pour un emplacement précis.
 * Filtre automatiquement selon la compatibilité (taille + type arme/armure).
 */
export default function SelectionJoyauModal({
    slot,
    tailleMax,
    joyaux,
    onSelect,
    onClose,
}: Props) {
    const [recherche, setRecherche] = useState('');

    const listeCompatible = joyaux.filter((j) =>
    joyauCompatible(j.taille, tailleMax, j.kind, slot)
    );

    const listeFiltree = listeCompatible.filter((j) =>
    j.nom.toLowerCase().includes(recherche.toLowerCase())
    );

    return (
        <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        >
        <div
        className="bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choisir un joyau (taille max {tailleMax})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
        ✕
        </button>
        </div>

        <div className="p-4 border-b border-gray-700">
        <input
        type="text"
        placeholder="Rechercher par nom..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full bg-gray-700 rounded px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
        />
        </div>

        <div className="overflow-y-auto flex-1 p-2">
        {listeFiltree.length === 0 && (
            <p className="text-gray-400 text-center p-4">Aucun joyau compatible.</p>
        )}
        {listeFiltree.map((joyau) => (
            <div
            key={joyau.id}
            className="p-3 hover:bg-gray-700 rounded cursor-pointer transition"
            onClick={() => onSelect(joyau)}
            >
            <p className="font-medium">{joyau.nom}</p>
            <p className="text-sm text-gray-400">
            Taille {joyau.taille} —{' '}
            {joyau.talents.map((t) => `${t.nom} Nv.${t.niveau}`).join(', ')}
            </p>
            </div>
        ))}
        </div>
        </div>
        </div>
    );
}

---

FILE : main/src/components/SelectionJoyauxSlot.tsx

import type { JoyauxInseres } from '../types/wilds';

interface Props {
    emplacements: number[]; // taille de chaque emplacement, ex: [1, 2]
    joyauxInseres: JoyauxInseres;
    onSlotClick: (index: number, tailleMax: number) => void;
    onRetirerJoyau: (index: number) => void;
}

/** Affiche les emplacements à joyaux d'une pièce d'équipement.
 * Chaque emplacement est cliquable pour ouvrir la sélection de joyau,
 * ou peut être vidé via le bouton ✕ s'il contient déjà un joyau.
 */
export default function SelectionJoyauxSlot({
    emplacements,
    joyauxInseres,
    onSlotClick,
    onRetirerJoyau,
}: Props) {
    return (
        <div className="flex gap-2 mt-1 ml-3 flex-wrap">
        {emplacements.map((taille, index) => {
            const joyau = joyauxInseres[index] ?? null;

            return (
                <div
                key={index}
                className="flex items-center bg-gray-900 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-700 transition"
                onClick={() => onSlotClick(index, taille)}
                >
                <span className="text-gray-400 mr-1">💎[{taille}]</span>
                <span className={joyau ? 'text-white' : 'text-gray-500 italic'}>
                {joyau ? joyau.nom : 'Vide'}
                </span>
                {joyau && (
                    <button
                    className="ml-2 text-red-400 hover:text-red-300"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRetirerJoyau(index);
                    }}
                    aria-label="Retirer le joyau"
                    >
                    ✕
                    </button>
                )}
                </div>
            );
        })}
        </div>
    );
}

---

**Questions spécifiques sur l’interface :**

- `BuilderLayout` calcule-t-il les stats à partir du build le plus récent, sans snapshot obsolète ?
- `StatsPanel` reçoit-il les stats calculées et les talents agrégés, ou recalcule-t-il une autre version ?
- Les callbacks de sélection transmettent-ils l’objet complet et le niveau de talent ?
- Les modales utilisent-elles les bons identifiants et le bon slot lors de la confirmation ?
- La sélection d’un joyau met-elle à jour l’état global réellement consommé par `StatsPanel` ?
- Les listes React ont-elles des `key` stables, afin d’éviter un affichage visuel désynchronisé ?
- Des conditions d’affichage masquent-elles les talents de niveau zéro ou les bonus calculés ?
- Les libellés affichés sont-ils uniquement traduits, sans modifier par erreur la clé utilisée pour le calcul ?

---

## 3. Configuration et point d’entrée

Ces fichiers peuvent expliquer un problème de build, de résolution de modules, de variables d’environnement ou de compilation qui masque le comportement réel.

FILE : main/src/App.tsx
import BuilderLayout from './components/BuilderLayout';

function App() {
  return <BuilderLayout />;
}

export default App;

---


FILE : main/src/main.tsx

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
---

FILE : main/package.json

{
  "name": "mh-wilds-builder",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.3.3",
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.4",
    "autoprefixer": "^10.5.4",
    "lz-string": "^1.5.0",
    "oxlint": "^1.75.0",
    "postcss": "^8.5.26",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.2",
    "vite": "^8.2.0"
  }
}

---

FILE : main/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

---

FILE : main/tsconfig.json

{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}

---

FILE : main/tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

---

FILE : main/postcss.config.js

export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

**À vérifier :**

- scripts `build`, `test` et éventuels outils de lint ;
- compilation TypeScript stricte et erreurs ignorées ;
- versions React/TypeScript et dépendances réellement installées ;
- configuration Tailwind couvrant bien `src/**/*.{ts,tsx}` ;
- import effectif de la feuille de styles ;
- absence de doublon entre logique CSS et logique métier ;
- warnings de console et erreurs runtime reproductibles en production.

---

## 4. Assets et données de référence


FILE : main/skills_fr_complet.json

[
    {
        "name": "Aura draconique",
        "kind": "armor",
        "description": "Augmente la protection contre les attaques \u00e9l\u00e9mentaires dragon puis les attaques physiques.",
        "ranks": [
            {
                "skill": {
                    "id": 1
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9sistance Dragon +6",
                "setPiecesRequired": null,
                "id": 1
            },
            {
                "skill": {
                    "id": 1
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9sistance Dragon +12",
                "setPiecesRequired": null,
                "id": 2
            },
            {
                "skill": {
                    "id": 1
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9sistance Dragon +20 D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 3
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 1,
        "gameId": -2125233152
    },
    {
        "name": "D\u00e9sign\u00e9 pour mourir",
        "kind": "weapon",
        "description": "Augmente l'attaque des munitions \u00e0 grenaille (fusarbal\u00e8te) et Tir de guerre/Tir rapide (arc).",
        "ranks": [
            {
                "skill": {
                    "id": 2
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la puissance des munitions et fl\u00e8ches indiqu\u00e9es.",
                "setPiecesRequired": null,
                "id": 4
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 2,
        "gameId": -2123993856
    },
    {
        "name": "Ma\u00eetre d'armes",
        "kind": "weapon",
        "description": "Augmente l'affinit\u00e9.",
        "ranks": [
            {
                "skill": {
                    "id": 3
                },
                "level": 1,
                "name": null,
                "description": "Affinit\u00e9 +4 %",
                "setPiecesRequired": null,
                "id": 5
            },
            {
                "skill": {
                    "id": 3
                },
                "level": 2,
                "name": null,
                "description": "Affinit\u00e9 +8 %",
                "setPiecesRequired": null,
                "id": 6
            },
            {
                "skill": {
                    "id": 3
                },
                "level": 3,
                "name": null,
                "description": "Affinit\u00e9 +12 %",
                "setPiecesRequired": null,
                "id": 7
            },
            {
                "skill": {
                    "id": 3
                },
                "level": 4,
                "name": null,
                "description": "Affinit\u00e9 +16 %",
                "setPiecesRequired": null,
                "id": 8
            },
            {
                "skill": {
                    "id": 3
                },
                "level": 5,
                "name": null,
                "description": "Affinit\u00e9 +20 %",
                "setPiecesRequired": null,
                "id": 9
            }
        ],
        "icon": {
            "id": 2,
            "kind": "affinity"
        },
        "id": 3,
        "gameId": -2096489472
    },
    {
        "name": "Protection du Gardien",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 4
                },
                "level": 1,
                "name": "Protection de Wyveria",
                "description": "R\u00e9duit les d\u00e9g\u00e2ts uniques et \u00e9l\u00e9mentaires dans les Ruines de Wyveria.",
                "setPiecesRequired": 3,
                "id": 10
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 4,
        "gameId": -2041451904
    },
    {
        "name": "Ma\u00eetre bombardier",
        "kind": "weapon",
        "description": "Permet d'utiliser des fioles explosives.",
        "ranks": [
            {
                "skill": {
                    "id": 5
                },
                "level": 1,
                "name": null,
                "description": "Permet d'utiliser des fioles explosives.",
                "setPiecesRequired": null,
                "id": 11
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 5,
        "gameId": -2022542848
    },
    {
        "name": "Tir maximum",
        "kind": "weapon",
        "description": "Augmente la puissance des munitions et des fl\u00e8ches normales, et de Tir d'hirondelle volante.",
        "ranks": [
            {
                "skill": {
                    "id": 6
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la puissance des munitions et fl\u00e8ches indiqu\u00e9es.",
                "setPiecesRequired": null,
                "id": 12
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 6,
        "gameId": -1961297152
    },
    {
        "name": "Morphose rapide",
        "kind": "weapon",
        "description": "Augmente la vitesse de la morphose et la puissance des morpho-haches et des volto-haches.",
        "ranks": [
            {
                "skill": {
                    "id": 7
                },
                "level": 1,
                "name": null,
                "description": "Vitesse +10 %",
                "setPiecesRequired": null,
                "id": 13
            },
            {
                "skill": {
                    "id": 7
                },
                "level": 2,
                "name": null,
                "description": "Vitesse +20 % Puissance morphose +10 %",
                "setPiecesRequired": null,
                "id": 14
            },
            {
                "skill": {
                    "id": 7
                },
                "level": 3,
                "name": null,
                "description": "Vitesse +30 % Puissance morphose +20 %",
                "setPiecesRequired": null,
                "id": 15
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 7,
        "gameId": -1961116288
    },
    {
        "name": "Batto-jutsu",
        "kind": "weapon",
        "description": "Ajoute un \u00e9tourdissement aux attaques d\u00e9gain\u00e9es. Augmente un peu l'attaque (sans effet en chevauchant).",
        "ranks": [
            {
                "skill": {
                    "id": 8
                },
                "level": 1,
                "name": null,
                "description": "Les attaques d\u00e9gain\u00e9es ont Attaque +3 et infligent des d\u00e9g\u00e2ts l\u00e9gers d'\u00e9tourdissement.",
                "setPiecesRequired": null,
                "id": 16
            },
            {
                "skill": {
                    "id": 8
                },
                "level": 2,
                "name": null,
                "description": "Les attaques d\u00e9gain\u00e9es ont Attaque +5 et infligent des d\u00e9g\u00e2ts moyens d'\u00e9tourdissement.",
                "setPiecesRequired": null,
                "id": 17
            },
            {
                "skill": {
                    "id": 8
                },
                "level": 3,
                "name": null,
                "description": "Les attaques d\u00e9gain\u00e9es ont Attaque +7 et infligent des d\u00e9g\u00e2ts importants d'\u00e9tourdissement.",
                "setPiecesRequired": null,
                "id": 18
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 8,
        "gameId": -1946345856
    },
    {
        "name": "Neutralisation",
        "kind": "weapon",
        "description": "Augmente la puissance des afflictions de type paralysie. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 9
                },
                "level": 1,
                "name": null,
                "description": "Accumulation paralysie +5 % Accumulation paralysie +10",
                "setPiecesRequired": null,
                "id": 19
            },
            {
                "skill": {
                    "id": 9
                },
                "level": 2,
                "name": null,
                "description": "Accumulation paralysie +10 % Accumulation paralysie +20",
                "setPiecesRequired": null,
                "id": 20
            },
            {
                "skill": {
                    "id": 9
                },
                "level": 3,
                "name": null,
                "description": "Accumulation paralysie +20 % Accumulation paralysie +50",
                "setPiecesRequired": null,
                "id": 21
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 9,
        "gameId": -1863702144
    },
    {
        "name": "Faveur du seigneur",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 10
                },
                "level": 1,
                "name": "Inspiration",
                "description": "Augmente temporairement la puissance d'attaque avec les effets qui affectent les compagnons (comme les M\u00e9lodies).",
                "setPiecesRequired": 3,
                "id": 22
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 10,
        "gameId": -1769550080
    },
    {
        "name": "Volont\u00e9 de l'Anjanath tonnerre",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 11
                },
                "level": 1,
                "name": "Second souffle I",
                "description": "Conf\u00e8re une jauge d'endurance suppl\u00e9mentaire.",
                "setPiecesRequired": 2,
                "id": 23
            },
            {
                "skill": {
                    "id": 11
                },
                "level": 2,
                "name": "Second souffle II",
                "description": "Conf\u00e8re une grande jauge d'endurance suppl\u00e9mentaire.",
                "setPiecesRequired": 4,
                "id": 24
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 11,
        "gameId": -1768553344
    },
    {
        "name": "Mort-aux-rats",
        "kind": "weapon",
        "description": "Augmente la puissance des afflictions de type poison. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 12
                },
                "level": 1,
                "name": null,
                "description": "Accumulation poison +5 % Accumulation poison +10",
                "setPiecesRequired": null,
                "id": 25
            },
            {
                "skill": {
                    "id": 12
                },
                "level": 2,
                "name": null,
                "description": "Accumulation poison +10 % Accumulation poison +20",
                "setPiecesRequired": null,
                "id": 26
            },
            {
                "skill": {
                    "id": 12
                },
                "level": 3,
                "name": null,
                "description": "Accumulation poison +20 % Accumulation poison +50",
                "setPiecesRequired": null,
                "id": 27
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 12,
        "gameId": -1716324608
    },
    {
        "name": "Union",
        "kind": "armor",
        "description": "Augmente temporairement l'attaque \u00e9l\u00e9mentaire et les afflictions apr\u00e8s la fin d'un fl\u00e9au ou d'un statut anormal.",
        "ranks": [
            {
                "skill": {
                    "id": 13
                },
                "level": 1,
                "name": null,
                "description": "Lorsqu'il est actif, l'attaque \u00e9l\u00e9mentaire et les afflictions augmentent l\u00e9g\u00e8rement.",
                "setPiecesRequired": null,
                "id": 28
            },
            {
                "skill": {
                    "id": 13
                },
                "level": 2,
                "name": null,
                "description": "Lorsqu'il est actif, l'attaque \u00e9l\u00e9mentaire et les afflictions augmentent.",
                "setPiecesRequired": null,
                "id": 29
            },
            {
                "skill": {
                    "id": 13
                },
                "level": 3,
                "name": null,
                "description": "Lorsqu'il est actif, l'attaque \u00e9l\u00e9mentaire et les afflictions augmentent grandement.",
                "setPiecesRequired": null,
                "id": 30
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 13,
        "gameId": -1700743296
    },
    {
        "name": "Athl\u00e8te",
        "kind": "armor",
        "description": "R\u00e9duit la consommation d'endurance de certaines actions comme l'esquive.",
        "ranks": [
            {
                "skill": {
                    "id": 14
                },
                "level": 1,
                "name": null,
                "description": "Co\u00fbt d'endurance fixe -10 %",
                "setPiecesRequired": null,
                "id": 31
            },
            {
                "skill": {
                    "id": 14
                },
                "level": 2,
                "name": null,
                "description": "Co\u00fbt d'endurance fixe -20 %",
                "setPiecesRequired": null,
                "id": 32
            },
            {
                "skill": {
                    "id": 14
                },
                "level": 3,
                "name": null,
                "description": "Co\u00fbt d'endurance fixe -30 %",
                "setPiecesRequired": null,
                "id": 33
            },
            {
                "skill": {
                    "id": 14
                },
                "level": 4,
                "name": null,
                "description": "Co\u00fbt d'endurance fixe -40 %",
                "setPiecesRequired": null,
                "id": 34
            },
            {
                "skill": {
                    "id": 14
                },
                "level": 5,
                "name": null,
                "description": "Co\u00fbt d'endurance fixe -50 %",
                "setPiecesRequired": null,
                "id": 35
            }
        ],
        "icon": {
            "id": 8,
            "kind": "stamina"
        },
        "id": 14,
        "gameId": -1689391744
    },
    {
        "name": "Chimiste",
        "kind": "armor",
        "description": "Augmente la dur\u00e9e des effets pour certains objets.",
        "ranks": [
            {
                "skill": {
                    "id": 15
                },
                "level": 1,
                "name": null,
                "description": "Dur\u00e9e +10 %",
                "setPiecesRequired": null,
                "id": 36
            },
            {
                "skill": {
                    "id": 15
                },
                "level": 2,
                "name": null,
                "description": "Dur\u00e9e +25 %",
                "setPiecesRequired": null,
                "id": 37
            },
            {
                "skill": {
                    "id": 15
                },
                "level": 3,
                "name": null,
                "description": "Dur\u00e9e +50 %",
                "setPiecesRequired": null,
                "id": 38
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 15,
        "gameId": -1684613760
    },
    {
        "name": "Ultra garde",
        "kind": "weapon",
        "description": "R\u00e9duit les d\u00e9g\u00e2ts lorsque vous bloquez et permet de parer des attaques normalement imparables.",
        "ranks": [
            {
                "skill": {
                    "id": 16
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit les d\u00e9g\u00e2ts subis de 10 %, et de 20 % additionnels dans certaines conditions.",
                "setPiecesRequired": null,
                "id": 39
            },
            {
                "skill": {
                    "id": 16
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9duit les d\u00e9g\u00e2ts subis de 20 %, et de 30 % additionnels dans certaines conditions.",
                "setPiecesRequired": null,
                "id": 40
            },
            {
                "skill": {
                    "id": 16
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9duit les d\u00e9g\u00e2ts subis de 30 %, et de 50 % additionnels dans certaines conditions.",
                "setPiecesRequired": null,
                "id": 41
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 16,
        "gameId": -1674114176
    },
    {
        "name": "\u00c9cailles superpos\u00e9es",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 17
                },
                "level": 1,
                "name": "Adr\u00e9naline",
                "description": "R\u00e9duit temporairement la perte d'endurance lorsque la vie est inf\u00e9rieure ou \u00e9gale \u00e0 40 %.",
                "setPiecesRequired": 3,
                "id": 42
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 17,
        "gameId": -1664678272
    },
    {
        "name": "Antivirus",
        "kind": "armor",
        "description": "En cas d'infection, permet de surmonter plus facilement la Furie et augmente l'affinit\u00e9 en gu\u00e9rissant.",
        "ranks": [
            {
                "skill": {
                    "id": 18
                },
                "level": 1,
                "name": null,
                "description": "Acc\u00e9l\u00e8re l\u00e9g\u00e8rement la gu\u00e9rison apr\u00e8s avoir contract\u00e9 la Furie. Augmente ensuite l'affinit\u00e9 de 3 %.",
                "setPiecesRequired": null,
                "id": 43
            },
            {
                "skill": {
                    "id": 18
                },
                "level": 2,
                "name": null,
                "description": "Acc\u00e9l\u00e8re la gu\u00e9rison apr\u00e8s avoir contract\u00e9 la Furie. Augmente ensuite l'affinit\u00e9 de 6 %.",
                "setPiecesRequired": null,
                "id": 44
            },
            {
                "skill": {
                    "id": 18
                },
                "level": 3,
                "name": null,
                "description": "Acc\u00e9l\u00e8re grandement la gu\u00e9rison apr\u00e8s avoir contract\u00e9 la Furie. Augmente ensuite l'affinit\u00e9 de 10 %.",
                "setPiecesRequired": null,
                "id": 45
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 18,
        "gameId": -1662120192
    },
    {
        "name": "Cuir souple",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 19
                },
                "level": 1,
                "name": "Chasseur cueilleur",
                "description": "Augmente la vitesse de collecte et emp\u00eache les attaques de vous repousser pendant la collecte ou le d\u00e9pe\u00e7age.",
                "setPiecesRequired": 3,
                "id": 46
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 19,
        "gameId": -1648695680
    },
    {
        "name": "Sagesse transmise",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 20
                },
                "level": 1,
                "name": "Chance de l'explorateur",
                "description": "Augmente les chances de trouver des points de collecte rare.",
                "setPiecesRequired": 3,
                "id": 47
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 20,
        "gameId": -1642078720
    },
    {
        "name": "Poison +",
        "kind": "weapon",
        "description": "Prolonge la dur\u00e9e de l'effet de votre poison sur les monstres.",
        "ranks": [
            {
                "skill": {
                    "id": 21
                },
                "level": 1,
                "name": null,
                "description": "Prolonge la dur\u00e9e de l'effet de votre poison de 20 %.",
                "setPiecesRequired": null,
                "id": 48
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 21,
        "gameId": -1629629184
    },
    {
        "name": "Berserker",
        "kind": "weapon",
        "description": "Augmente les d\u00e9g\u00e2ts des coups critiques.",
        "ranks": [
            {
                "skill": {
                    "id": 22
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9g\u00e2ts des coups critiques +28 %.",
                "setPiecesRequired": null,
                "id": 49
            },
            {
                "skill": {
                    "id": 22
                },
                "level": 2,
                "name": null,
                "description": "D\u00e9g\u00e2ts des coups critiques +31 %.",
                "setPiecesRequired": null,
                "id": 50
            },
            {
                "skill": {
                    "id": 22
                },
                "level": 3,
                "name": null,
                "description": "D\u00e9g\u00e2ts des coups critiques +34 %.",
                "setPiecesRequired": null,
                "id": 51
            },
            {
                "skill": {
                    "id": 22
                },
                "level": 4,
                "name": null,
                "description": "D\u00e9g\u00e2ts des coups critiques +37 %.",
                "setPiecesRequired": null,
                "id": 52
            },
            {
                "skill": {
                    "id": 22
                },
                "level": 5,
                "name": null,
                "description": "D\u00e9g\u00e2ts des coups critiques +40 %.",
                "setPiecesRequired": null,
                "id": 53
            }
        ],
        "icon": {
            "id": 2,
            "kind": "affinity"
        },
        "id": 22,
        "gameId": -1607763456
    },
    {
        "name": "Tir super rapide",
        "kind": "weapon",
        "description": "Tir rapide fusarbal\u00e8te l\u00e9ger am\u00e9lior\u00e9.",
        "ranks": [
            {
                "skill": {
                    "id": 23
                },
                "level": 1,
                "name": null,
                "description": "Puissance tir rapide +5 %",
                "setPiecesRequired": null,
                "id": 54
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 23,
        "gameId": -1507579776
    },
    {
        "name": "Ma\u00eetre de la charge",
        "kind": "weapon",
        "description": "Augmente la puissance \u00e9l\u00e9mentaire et les afflictions des attaques charg\u00e9es.",
        "ranks": [
            {
                "skill": {
                    "id": 24
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement l'attaque \u00e9l\u00e9mentaire et les afflictions des attaques charg\u00e9es.",
                "setPiecesRequired": null,
                "id": 55
            },
            {
                "skill": {
                    "id": 24
                },
                "level": 2,
                "name": null,
                "description": "Augmente l'attaque \u00e9l\u00e9mentaire et les afflictions des attaques charg\u00e9es.",
                "setPiecesRequired": null,
                "id": 56
            },
            {
                "skill": {
                    "id": 24
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement l'attaque \u00e9l\u00e9mentaire et les afflictions des attaques charg\u00e9es.",
                "setPiecesRequired": null,
                "id": 57
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 24,
        "gameId": -1475134080
    },
    {
        "name": "Vigueur du Xu Wu",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 25
                },
                "level": 1,
                "name": "Pro des prot\u00e9ines I",
                "description": "Conf\u00e8re temporairement +15 d'attaque apr\u00e8s avoir consomm\u00e9 des objets tels que des steaks \u00e0 point.",
                "setPiecesRequired": 2,
                "id": 58
            },
            {
                "skill": {
                    "id": 25
                },
                "level": 2,
                "name": "Pro des prot\u00e9ines II",
                "description": "Conf\u00e8re temporairement +30 d'attaque apr\u00e8s avoir consomm\u00e9 des objets tels que des steaks \u00e0 point.",
                "setPiecesRequired": 4,
                "id": 59
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 25,
        "gameId": -1468066176
    },
    {
        "name": "Vitalit\u00e9 de l'Arkveld Gardien",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 26
                },
                "level": 1,
                "name": "D\u00e9cimeur I",
                "description": "Restaure une quantit\u00e9 mod\u00e9r\u00e9e de vie quand vous d\u00e9truisez une blessure sur un grand monstre.",
                "setPiecesRequired": 2,
                "id": 60
            },
            {
                "skill": {
                    "id": 26
                },
                "level": 2,
                "name": "D\u00e9cimeur II",
                "description": "Restaure de la vie quand vous d\u00e9truisez une blessure sur un grand monstre.",
                "setPiecesRequired": 4,
                "id": 61
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 26,
        "gameId": -1432692352
    },
    {
        "name": "Pouls du Gardien",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 27
                },
                "level": 1,
                "name": "Afflux de wylait",
                "description": "Acc\u00e9l\u00e8re la r\u00e9cup\u00e9ration d'endurance et de la jauge rouge pr\u00e8s des cristaux de wylait.",
                "setPiecesRequired": 3,
                "id": 62
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 27,
        "gameId": -1305836672
    },
    {
        "name": "Saut de la foi",
        "kind": "armor",
        "description": "Permet d'esquiver de grands monstres en sautant vers eux et d'\u00e9tendre la distance d'esquive.",
        "ranks": [
            {
                "skill": {
                    "id": 28
                },
                "level": 1,
                "name": null,
                "description": "L'utilisation du talent devient possible.",
                "setPiecesRequired": null,
                "id": 63
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 28,
        "gameId": -1304512512
    },
    {
        "name": "Maestro",
        "kind": "weapon",
        "description": "Prolonge la dur\u00e9e des m\u00e9lodies des cornes de chasse (effet perdu lorsque vous changez d'arme).",
        "ranks": [
            {
                "skill": {
                    "id": 29
                },
                "level": 1,
                "name": null,
                "description": "Augmente la dur\u00e9e des effets des m\u00e9lodies et les chances de r\u00e9cup\u00e9rer plus de vie avec les m\u00e9lodies de soin.",
                "setPiecesRequired": null,
                "id": 64
            },
            {
                "skill": {
                    "id": 29
                },
                "level": 2,
                "name": null,
                "description": "Augmente encore plus la dur\u00e9e des effets des m\u00e9lodies.",
                "setPiecesRequired": null,
                "id": 65
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 29,
        "gameId": -1237438336
    },
    {
        "name": "Cercle de vie",
        "kind": "armor",
        "description": "Augmente la quantit\u00e9 de vie restaur\u00e9e.",
        "ranks": [
            {
                "skill": {
                    "id": 30
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la r\u00e9cup\u00e9ration.",
                "setPiecesRequired": null,
                "id": 66
            },
            {
                "skill": {
                    "id": 30
                },
                "level": 2,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la r\u00e9cup\u00e9ration.",
                "setPiecesRequired": null,
                "id": 67
            },
            {
                "skill": {
                    "id": 30
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la r\u00e9cup\u00e9ration.",
                "setPiecesRequired": null,
                "id": 68
            }
        ],
        "icon": {
            "id": 7,
            "kind": "health"
        },
        "id": 30,
        "gameId": -1235658624
    },
    {
        "name": "Halo de gu\u00e9rison",
        "kind": "armor",
        "description": "Augmente la vitesse de gu\u00e9rison des d\u00e9g\u00e2ts temporaires (zone rouge de la jauge de vie).",
        "ranks": [
            {
                "skill": {
                    "id": 31
                },
                "level": 1,
                "name": null,
                "description": "Double la vitesse de r\u00e9cup\u00e9ration des d\u00e9g\u00e2ts temporaires.",
                "setPiecesRequired": null,
                "id": 69
            },
            {
                "skill": {
                    "id": 31
                },
                "level": 2,
                "name": null,
                "description": "Triple la vitesse de r\u00e9cup\u00e9ration des d\u00e9g\u00e2ts temporaires.",
                "setPiecesRequired": null,
                "id": 70
            },
            {
                "skill": {
                    "id": 31
                },
                "level": 3,
                "name": null,
                "description": "Quadruple la vitesse de r\u00e9cup\u00e9ration des d\u00e9g\u00e2ts temporaires.",
                "setPiecesRequired": null,
                "id": 71
            }
        ],
        "icon": {
            "id": 7,
            "kind": "health"
        },
        "id": 31,
        "gameId": -1121468544
    },
    {
        "name": "Rengainage \u00e9clair",
        "kind": "armor",
        "description": "Augmente la vitesse de rengainage.",
        "ranks": [
            {
                "skill": {
                    "id": 32
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la vitesse de rengainage.",
                "setPiecesRequired": null,
                "id": 72
            },
            {
                "skill": {
                    "id": 32
                },
                "level": 2,
                "name": null,
                "description": "Augmente la vitesse de rengainage.",
                "setPiecesRequired": null,
                "id": 73
            },
            {
                "skill": {
                    "id": 32
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la vitesse de rengainage.",
                "setPiecesRequired": null,
                "id": 74
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 32,
        "gameId": -1073401280
    },
    {
        "name": "App\u00e9tit de l'Arkveld",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 33
                },
                "level": 1,
                "name": "R\u00e9cup\u00e9ration rapide I",
                "description": "Restaure une quantit\u00e9 mod\u00e9r\u00e9e de vie tant que vous attaquez. La r\u00e9g\u00e9n\u00e9ration varie selon l'arme.",
                "setPiecesRequired": 2,
                "id": 75
            },
            {
                "skill": {
                    "id": 33
                },
                "level": 2,
                "name": "R\u00e9cup\u00e9ration rapide II",
                "description": "Restaure de la vie tant que vous attaquez. La r\u00e9g\u00e9n\u00e9ration varie selon l'arme.",
                "setPiecesRequired": 4,
                "id": 76
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 33,
        "gameId": -964369920
    },
    {
        "name": "Pri\u00e8re Danse des fleurs",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 34
                },
                "level": 1,
                "name": "B\u00e9n\u00e9diction des fleurs I",
                "description": "Pendant Danse des fleurs, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses. (Hors qu\u00eate rejointe en cours de route.)",
                "setPiecesRequired": 2,
                "id": 77
            },
            {
                "skill": {
                    "id": 34
                },
                "level": 2,
                "name": "B\u00e9n\u00e9diction des fleurs II",
                "description": "Pendant Danse des fleurs, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses de qu\u00eate. Augmente attaque et d\u00e9fense.",
                "setPiecesRequired": 4,
                "id": 78
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 34,
        "gameId": -911441792
    },
    {
        "name": "Pare-vent",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance aux bourrasques.",
        "ranks": [
            {
                "skill": {
                    "id": 35
                },
                "level": 1,
                "name": null,
                "description": "Annule les petites bourrasques et r\u00e9duit de moiti\u00e9 les effets des grandes bourrasques.",
                "setPiecesRequired": null,
                "id": 79
            },
            {
                "skill": {
                    "id": 35
                },
                "level": 2,
                "name": null,
                "description": "Annule les petites et grandes bourrasques et r\u00e9duit de moiti\u00e9 les effets des bourrasques draconiques.",
                "setPiecesRequired": null,
                "id": 80
            },
            {
                "skill": {
                    "id": 35
                },
                "level": 3,
                "name": null,
                "description": "Annule toutes les bourrasques.",
                "setPiecesRequired": null,
                "id": 81
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 35,
        "gameId": -895828480
    },
    {
        "name": "Cogneur",
        "kind": "weapon",
        "description": "Permet d'\u00e9tourdir plus facilement les monstres.",
        "ranks": [
            {
                "skill": {
                    "id": 36
                },
                "level": 1,
                "name": null,
                "description": "\u00c9tourdissement +20 %",
                "setPiecesRequired": null,
                "id": 82
            },
            {
                "skill": {
                    "id": 36
                },
                "level": 2,
                "name": null,
                "description": "\u00c9tourdissement +30 %",
                "setPiecesRequired": null,
                "id": 83
            },
            {
                "skill": {
                    "id": 36
                },
                "level": 3,
                "name": null,
                "description": "\u00c9tourdissement +40 %",
                "setPiecesRequired": null,
                "id": 84
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 36,
        "gameId": -893407296
    },
    {
        "name": "Bombardier",
        "kind": "armor",
        "description": "Augmente les d\u00e9g\u00e2ts occasionn\u00e9s par les objets explosifs.",
        "ranks": [
            {
                "skill": {
                    "id": 37
                },
                "level": 1,
                "name": null,
                "description": "Puissance explosive +10 %",
                "setPiecesRequired": null,
                "id": 85
            },
            {
                "skill": {
                    "id": 37
                },
                "level": 2,
                "name": null,
                "description": "Puissance explosive +20 %",
                "setPiecesRequired": null,
                "id": 86
            },
            {
                "skill": {
                    "id": 37
                },
                "level": 3,
                "name": null,
                "description": "Puissance explosive +30 %",
                "setPiecesRequired": null,
                "id": 87
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 37,
        "gameId": -857543744
    },
    {
        "name": "\u00c9corcheur",
        "kind": "armor",
        "description": "Facilite la cr\u00e9ation de blessures. Infligez assez de d\u00e9g\u00e2ts pour un bonus de d\u00e9g\u00e2ts non \u00e9l\u00e9mentaires. (Sauf certaines attaques.)",
        "ranks": [
            {
                "skill": {
                    "id": 38
                },
                "level": 1,
                "name": null,
                "description": "Facilite l\u00e9g\u00e8rement la cr\u00e9ation d'une blessure. Inflige aussi des d\u00e9g\u00e2ts non \u00e9l\u00e9mentaires.",
                "setPiecesRequired": null,
                "id": 88
            },
            {
                "skill": {
                    "id": 38
                },
                "level": 2,
                "name": null,
                "description": "Facilite mod\u00e9r\u00e9ment la cr\u00e9ation d'une blessure. Inflige aussi l\u00e9g\u00e8rement plus de d\u00e9g\u00e2ts non \u00e9l\u00e9mentaires.",
                "setPiecesRequired": null,
                "id": 89
            },
            {
                "skill": {
                    "id": 38
                },
                "level": 3,
                "name": null,
                "description": "Facilite la cr\u00e9ation d'une blessure. Inflige aussi un peu plus de d\u00e9g\u00e2ts non \u00e9l\u00e9mentaires.",
                "setPiecesRequired": null,
                "id": 90
            },
            {
                "skill": {
                    "id": 38
                },
                "level": 4,
                "name": null,
                "description": "Facilite grandement la cr\u00e9ation d'une blessure. Inflige aussi plus de d\u00e9g\u00e2ts non \u00e9l\u00e9mentaires.",
                "setPiecesRequired": null,
                "id": 91
            },
            {
                "skill": {
                    "id": 38
                },
                "level": 5,
                "name": null,
                "description": "Facilite \u00e9norm\u00e9ment la cr\u00e9ation d'une blessure. Inflige beaucoup plus de d\u00e9g\u00e2ts non \u00e9l\u00e9mentaires.",
                "setPiecesRequired": null,
                "id": 92
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 38,
        "gameId": -856322816
    },
    {
        "name": "Lame glissante",
        "kind": "weapon",
        "description": "Augmente l'affinit\u00e9 lorsque vous \u00eates mouill\u00e9 ou subissez l'affliction fl\u00e9au-bulles (les effets se cumulent).",
        "ranks": [
            {
                "skill": {
                    "id": 39
                },
                "level": 1,
                "name": null,
                "description": "Affinit\u00e9 +3 % lorsque vous \u00eates mouill\u00e9 et +7 % en cas de fl\u00e9au-bulles.",
                "setPiecesRequired": null,
                "id": 93
            },
            {
                "skill": {
                    "id": 39
                },
                "level": 2,
                "name": null,
                "description": "Affinit\u00e9 +6 % lorsque vous \u00eates mouill\u00e9 et +14 % en cas de fl\u00e9au-bulles.",
                "setPiecesRequired": null,
                "id": 94
            },
            {
                "skill": {
                    "id": 39
                },
                "level": 3,
                "name": null,
                "description": "Affinit\u00e9 +9 % lorsque vous \u00eates mouill\u00e9 et +21 % en cas de fl\u00e9au-bulles.",
                "setPiecesRequired": null,
                "id": 95
            }
        ],
        "icon": {
            "id": 2,
            "kind": "affinity"
        },
        "id": 39,
        "gameId": -847539392
    },
    {
        "name": "Destruction massive",
        "kind": "weapon",
        "description": "Augmente la puissance des afflictions de type explosion. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 40
                },
                "level": 1,
                "name": null,
                "description": "Accumulation explosion +5 % Accumulation explosion +10",
                "setPiecesRequired": null,
                "id": 96
            },
            {
                "skill": {
                    "id": 40
                },
                "level": 2,
                "name": null,
                "description": "Accumulation explosion +10 % Accumulation explosion +20",
                "setPiecesRequired": null,
                "id": 97
            },
            {
                "skill": {
                    "id": 40
                },
                "level": 3,
                "name": null,
                "description": "Accumulation explosion +20 % Accumulation explosion +50",
                "setPiecesRequired": null,
                "id": 98
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 40,
        "gameId": -844978880
    },
    {
        "name": "Pourfendeur de dragon",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques \u00e9l\u00e9mentaires draconiques. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 41
                },
                "level": 1,
                "name": null,
                "description": "Attaque Dragon +40",
                "setPiecesRequired": null,
                "id": 99
            },
            {
                "skill": {
                    "id": 41
                },
                "level": 2,
                "name": null,
                "description": "Attaque Dragon +10 % Attaque Dragon +50",
                "setPiecesRequired": null,
                "id": 100
            },
            {
                "skill": {
                    "id": 41
                },
                "level": 3,
                "name": null,
                "description": "Attaque Dragon +20 % Attaque Dragon +60",
                "setPiecesRequired": null,
                "id": 101
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 41,
        "gameId": -776946176
    },
    {
        "name": "Monte-en-l'air",
        "kind": "armor",
        "description": "R\u00e9duit la perte d'endurance lorsque vous grimpez sur des lianes.",
        "ranks": [
            {
                "skill": {
                    "id": 42
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit de 50 % la consommation d'endurance lorsque vous grimpez.",
                "setPiecesRequired": null,
                "id": 102
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 42,
        "gameId": -692636288
    },
    {
        "name": "Marathonien",
        "kind": "armor",
        "description": "R\u00e9duit la consommation d'endurance des actions qui en utilisent en continu (exemple : courir).",
        "ranks": [
            {
                "skill": {
                    "id": 43
                },
                "level": 1,
                "name": null,
                "description": "Co\u00fbt d'endurance -15 %",
                "setPiecesRequired": null,
                "id": 103
            },
            {
                "skill": {
                    "id": 43
                },
                "level": 2,
                "name": null,
                "description": "Co\u00fbt d'endurance -30 %",
                "setPiecesRequired": null,
                "id": 104
            },
            {
                "skill": {
                    "id": 43
                },
                "level": 3,
                "name": null,
                "description": "Co\u00fbt d'endurance -50 %",
                "setPiecesRequired": null,
                "id": 105
            }
        ],
        "icon": {
            "id": 8,
            "kind": "stamina"
        },
        "id": 43,
        "gameId": -682586176
    },
    {
        "name": "Gibier de potence",
        "kind": "weapon",
        "description": "Permet d'utiliser des fioles de paralysie.",
        "ranks": [
            {
                "skill": {
                    "id": 44
                },
                "level": 1,
                "name": null,
                "description": "Permet d'utiliser des fioles de paralysie.",
                "setPiecesRequired": null,
                "id": 106
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 44,
        "gameId": -676967744
    },
    {
        "name": "Antichocs",
        "kind": "armor",
        "description": "D\u00e9sactive les r\u00e9actions aux d\u00e9g\u00e2ts lorsque vous touchez un alli\u00e9 ou inversement.",
        "ranks": [
            {
                "skill": {
                    "id": 45
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 107
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 45,
        "gameId": -632440576
    },
    {
        "name": "Sismologie",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance aux secousses.",
        "ranks": [
            {
                "skill": {
                    "id": 46
                },
                "level": 1,
                "name": null,
                "description": "Annule les tr\u00e8s petites secousses et r\u00e9duit de moiti\u00e9 les effets des petites secousses.",
                "setPiecesRequired": null,
                "id": 108
            },
            {
                "skill": {
                    "id": 46
                },
                "level": 2,
                "name": null,
                "description": "Annule jusqu'aux petites secousses et r\u00e9duit grandement les effets des grandes secousses.",
                "setPiecesRequired": null,
                "id": 109
            },
            {
                "skill": {
                    "id": 46
                },
                "level": 3,
                "name": null,
                "description": "Annule toutes les secousses.",
                "setPiecesRequired": null,
                "id": 110
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 46,
        "gameId": -609509888
    },
    {
        "name": "BOUM !",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques explosives : lancecanon, Feu de wyverne, fioles de choc et munitions antiblindage.",
        "ranks": [
            {
                "skill": {
                    "id": 47
                },
                "level": 1,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la puissance des attaques et la vitesse du Feu de wyverne. Attaque feu du Bombardement +30.",
                "setPiecesRequired": null,
                "id": 111
            },
            {
                "skill": {
                    "id": 47
                },
                "level": 2,
                "name": null,
                "description": "Augmente la puissance des attaques et la vitesse du Feu de wyverne. Attaque feu du Bombardement +60.",
                "setPiecesRequired": null,
                "id": 112
            },
            {
                "skill": {
                    "id": 47
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la puissance des attaques et la vitesse du Feu de wyverne. Attaque feu du Bombardement +90.",
                "setPiecesRequired": null,
                "id": 113
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 47,
        "gameId": -596764096
    },
    {
        "name": "Ami de la nature",
        "kind": "armor",
        "description": "Vous r\u00e9cup\u00e9rez plus de vie en interagissant avec des \u00e9l\u00e9ments de l'environnement.",
        "ranks": [
            {
                "skill": {
                    "id": 48
                },
                "level": 1,
                "name": null,
                "description": "Restaure 50 points de vie.",
                "setPiecesRequired": null,
                "id": 114
            },
            {
                "skill": {
                    "id": 48
                },
                "level": 2,
                "name": null,
                "description": "Restaure 80 points de vie.",
                "setPiecesRequired": null,
                "id": 115
            },
            {
                "skill": {
                    "id": 48
                },
                "level": 3,
                "name": null,
                "description": "Restaure 100 points de vie.",
                "setPiecesRequired": null,
                "id": 116
            }
        ],
        "icon": {
            "id": 7,
            "kind": "health"
        },
        "id": 48,
        "gameId": -593005376
    },
    {
        "name": "Totem \u00e9l\u00e9mentaire",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance \u00e0 tous les fl\u00e9aux \u00e9l\u00e9mentaires.",
        "ranks": [
            {
                "skill": {
                    "id": 49
                },
                "level": 1,
                "name": null,
                "description": "Dur\u00e9e fl\u00e9aux \u00e9l\u00e9mentaires -50 %",
                "setPiecesRequired": null,
                "id": 117
            },
            {
                "skill": {
                    "id": 49
                },
                "level": 2,
                "name": null,
                "description": "Dur\u00e9e fl\u00e9aux \u00e9l\u00e9mentaires -75 %",
                "setPiecesRequired": null,
                "id": 118
            },
            {
                "skill": {
                    "id": 49
                },
                "level": 3,
                "name": null,
                "description": "Annule les fl\u00e9aux \u00e9l\u00e9mentaires.",
                "setPiecesRequired": null,
                "id": 119
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 49,
        "gameId": -568838336
    },
    {
        "name": "Pyromane",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques \u00e9l\u00e9mentaires feu. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 50
                },
                "level": 1,
                "name": null,
                "description": "Attaque Feu +40",
                "setPiecesRequired": null,
                "id": 120
            },
            {
                "skill": {
                    "id": 50
                },
                "level": 2,
                "name": null,
                "description": "Attaque Feu +10 % Attaque Feu +50",
                "setPiecesRequired": null,
                "id": 121
            },
            {
                "skill": {
                    "id": 50
                },
                "level": 3,
                "name": null,
                "description": "Attaque Feu +20 % Attaque Feu +60",
                "setPiecesRequired": null,
                "id": 122
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 50,
        "gameId": -562534336
    },
    {
        "name": "Pouls du Zoh Shia",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 51
                },
                "level": 1,
                "name": "Super r\u00e9cup\u00e9ration I",
                "description": "La jauge de vie continue de se r\u00e9g\u00e9n\u00e9rer lentement jusqu'\u00e0 la valeur maximale m\u00eame s'il n'y a pas de portion rouge.",
                "setPiecesRequired": 2,
                "id": 123
            },
            {
                "skill": {
                    "id": 51
                },
                "level": 2,
                "name": "Super r\u00e9cup\u00e9ration II",
                "description": "La jauge de vie continue de se r\u00e9g\u00e9n\u00e9rer jusqu'\u00e0 la valeur maximale m\u00eame s'il n'y a pas de portion rouge.",
                "setPiecesRequired": 4,
                "id": 124
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 51,
        "gameId": -555494336
    },
    {
        "name": "Mycologue extr\u00eame",
        "kind": "armor",
        "description": "Permet de dig\u00e9rer des champignons non comestibles pour b\u00e9n\u00e9ficier de leurs effets positifs.",
        "ranks": [
            {
                "skill": {
                    "id": 52
                },
                "level": 1,
                "name": null,
                "description": "Permet de dig\u00e9rer les champignons bleus et les champignons v\u00e9n\u00e9neux.",
                "setPiecesRequired": null,
                "id": 125
            },
            {
                "skill": {
                    "id": 52
                },
                "level": 2,
                "name": null,
                "description": "Permet \u00e9galement de dig\u00e9rer les champinitros et les champaralysies.",
                "setPiecesRequired": null,
                "id": 126
            },
            {
                "skill": {
                    "id": 52
                },
                "level": 3,
                "name": null,
                "description": "Permet \u00e9galement de dig\u00e9rer les mandragores, les fl\u00e9aux du diable et les champexciteurs.",
                "setPiecesRequired": null,
                "id": 127
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 52,
        "gameId": -481419552
    },
    {
        "name": "Balistique",
        "kind": "weapon",
        "description": "Augmente la port\u00e9e \u00e0 laquelle munitions et fl\u00e8ches sont \u00e0 puissance max, et am\u00e9liore la puissance quand le niveau augmente.",
        "ranks": [
            {
                "skill": {
                    "id": 53
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la port\u00e9e.",
                "setPiecesRequired": null,
                "id": 128
            },
            {
                "skill": {
                    "id": 53
                },
                "level": 2,
                "name": null,
                "description": "Augmente la port\u00e9e.",
                "setPiecesRequired": null,
                "id": 129
            },
            {
                "skill": {
                    "id": 53
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la port\u00e9e et am\u00e9liore la puissance des attaques r\u00e9alis\u00e9es \u00e0 bonne distance.",
                "setPiecesRequired": null,
                "id": 130
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 53,
        "gameId": -420608864
    },
    {
        "name": "Protection du Gravios",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 54
                },
                "level": 1,
                "name": "Armure sans d\u00e9faut I",
                "description": "R\u00e9duit les d\u00e9g\u00e2ts subis de 20 % quand votre vie est pleine.",
                "setPiecesRequired": 2,
                "id": 131
            },
            {
                "skill": {
                    "id": 54
                },
                "level": 2,
                "name": "Armure sans d\u00e9faut II",
                "description": "R\u00e9duit les d\u00e9g\u00e2ts subis de 35 % quand votre vie est pleine.",
                "setPiecesRequired": 4,
                "id": 132
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 54,
        "gameId": -418246240
    },
    {
        "name": "Antipuanteur",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance \u00e0 la puanteur.",
        "ranks": [
            {
                "skill": {
                    "id": 55
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit la dur\u00e9e de la puanteur de 50 %.",
                "setPiecesRequired": null,
                "id": 133
            },
            {
                "skill": {
                    "id": 55
                },
                "level": 2,
                "name": null,
                "description": "Prot\u00e8ge de la puanteur.",
                "setPiecesRequired": null,
                "id": 134
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 55,
        "gameId": -411441344
    },
    {
        "name": "Prouesse du Mizutsune",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 56
                },
                "level": 1,
                "name": "\u00c9bullition I",
                "description": "Prot\u00e8ge du fl\u00e9au-bulles majeur et permet d'activer le fl\u00e9au-bulles mineur en esquivant plusieurs fois.",
                "setPiecesRequired": 2,
                "id": 135
            },
            {
                "skill": {
                    "id": 56
                },
                "level": 2,
                "name": "\u00c9bullition II",
                "description": "Permet \u00e9galement d'augmenter l'esquive en cas de fl\u00e9au-bulles mineur.",
                "setPiecesRequired": 4,
                "id": 136
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 56,
        "gameId": -403054144
    },
    {
        "name": "Mise \u00e0 mort",
        "kind": "armor",
        "description": "Augmente l'affinit\u00e9 lorsque vous attaquez le point faible d'un monstre et ses blessures.",
        "ranks": [
            {
                "skill": {
                    "id": 57
                },
                "level": 1,
                "name": null,
                "description": "Affinit\u00e9 +5 % pour les attaques qui touchent un point faible et bonus parties bless\u00e9es de +3 %.",
                "setPiecesRequired": null,
                "id": 137
            },
            {
                "skill": {
                    "id": 57
                },
                "level": 2,
                "name": null,
                "description": "Affinit\u00e9 +10 % pour les attaques qui touchent un point faible et bonus parties bless\u00e9es de +5 %.",
                "setPiecesRequired": null,
                "id": 138
            },
            {
                "skill": {
                    "id": 57
                },
                "level": 3,
                "name": null,
                "description": "Affinit\u00e9 +15 % pour les attaques qui touchent un point faible et bonus parties bless\u00e9es de +10 %.",
                "setPiecesRequired": null,
                "id": 139
            },
            {
                "skill": {
                    "id": 57
                },
                "level": 4,
                "name": null,
                "description": "Affinit\u00e9 +20 % pour les attaques qui touchent un point faible et bonus parties bless\u00e9es de +15 %.",
                "setPiecesRequired": null,
                "id": 140
            },
            {
                "skill": {
                    "id": 57
                },
                "level": 5,
                "name": null,
                "description": "Affinit\u00e9 +30 % pour les attaques qui touchent un point faible et bonus parties bless\u00e9es de +20 %.",
                "setPiecesRequired": null,
                "id": 141
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 57,
        "gameId": -397570464
    },
    {
        "name": "M\u00e9tabolisme",
        "kind": "armor",
        "description": "Acc\u00e9l\u00e8re la r\u00e9cup\u00e9ration d'endurance.",
        "ranks": [
            {
                "skill": {
                    "id": 58
                },
                "level": 1,
                "name": null,
                "description": "Vitesse de r\u00e9cup\u00e9ration d'endurance +10 %",
                "setPiecesRequired": null,
                "id": 142
            },
            {
                "skill": {
                    "id": 58
                },
                "level": 2,
                "name": null,
                "description": "Vitesse de r\u00e9cup\u00e9ration d'endurance +30 %",
                "setPiecesRequired": null,
                "id": 143
            },
            {
                "skill": {
                    "id": 58
                },
                "level": 3,
                "name": null,
                "description": "Vitesse de r\u00e9cup\u00e9ration d'endurance +50 %.",
                "setPiecesRequired": null,
                "id": 144
            }
        ],
        "icon": {
            "id": 8,
            "kind": "stamina"
        },
        "id": 58,
        "gameId": -315492576
    },
    {
        "name": "Paladin",
        "kind": "weapon",
        "description": "R\u00e9duit les repoussements et la perte d'endurance lorsque vous bloquez.",
        "ranks": [
            {
                "skill": {
                    "id": 59
                },
                "level": 1,
                "name": null,
                "description": "Diminue l\u00e9g\u00e8rement l'impact des attaques et r\u00e9duit la perte d'endurance de 15 %.",
                "setPiecesRequired": null,
                "id": 145
            },
            {
                "skill": {
                    "id": 59
                },
                "level": 2,
                "name": null,
                "description": "Diminue l'impact des attaques et r\u00e9duit la perte d'endurance de 30 %.",
                "setPiecesRequired": null,
                "id": 146
            },
            {
                "skill": {
                    "id": 59
                },
                "level": 3,
                "name": null,
                "description": "Diminue grandement l'impact des attaques et r\u00e9duit la perte d'endurance de 50 %.",
                "setPiecesRequired": null,
                "id": 147
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 59,
        "gameId": -307644128
    },
    {
        "name": "Concentration",
        "kind": "weapon",
        "description": "Am\u00e9liore la vitesse de remplissage des armes \u00e0 jauges et la vitesse de chargement des armes \u00e0 charges.",
        "ranks": [
            {
                "skill": {
                    "id": 60
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement le taux de remplissage de la jauge et r\u00e9duit le temps de charge de 5 %.",
                "setPiecesRequired": null,
                "id": 148
            },
            {
                "skill": {
                    "id": 60
                },
                "level": 2,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment le taux de remplissage de la jauge et r\u00e9duit le temps de charge de 10 %.",
                "setPiecesRequired": null,
                "id": 149
            },
            {
                "skill": {
                    "id": 60
                },
                "level": 3,
                "name": null,
                "description": "Augmente le taux de remplissage de la jauge et r\u00e9duit le temps de charge de 15 %.",
                "setPiecesRequired": null,
                "id": 150
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 60,
        "gameId": -283334048
    },
    {
        "name": "Aveuglement",
        "kind": "armor",
        "description": "Am\u00e9liore l'efficacit\u00e9 des attaques et objets flash.",
        "ranks": [
            {
                "skill": {
                    "id": 61
                },
                "level": 1,
                "name": null,
                "description": "Am\u00e9liore l'efficacit\u00e9 des attaques et objets flash.",
                "setPiecesRequired": null,
                "id": 151
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 61,
        "gameId": -257693696
    },
    {
        "name": "R\u00e9volte du Jin Dahaad",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 62
                },
                "level": 1,
                "name": "Contre paralysant I",
                "description": "Augmente l'attaque \u00e0 la fin de l'\u00e9tat Toile, du fl\u00e9au-givre, d'une immobilisation ou d'un Duel de force.",
                "setPiecesRequired": 2,
                "id": 152
            },
            {
                "skill": {
                    "id": 62
                },
                "level": 2,
                "name": "Contre paralysant II",
                "description": "Augmente grandement l'attaque \u00e0 la fin de l'\u00e9tat Toile, du fl\u00e9au-givre, d'une immobilisation ou d'un Duel de force.",
                "setPiecesRequired": 4,
                "id": 153
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 62,
        "gameId": -215826112
    },
    {
        "name": "Mobilit\u00e9 eau/boue huileuse",
        "kind": "armor",
        "description": "Augmente la r\u00e9sistance contre les entraves \u00e0 la mobilit\u00e9 dans l'eau, la boue huileuse ou les ruisseaux.",
        "ranks": [
            {
                "skill": {
                    "id": 63
                },
                "level": 1,
                "name": null,
                "description": "Annule les effets des ruisseaux boueux et le ralentissement dans l'eau et la boue huileuse. R\u00e9duit le ralentissement par l'huile de dragon.",
                "setPiecesRequired": null,
                "id": 154
            },
            {
                "skill": {
                    "id": 63
                },
                "level": 2,
                "name": null,
                "description": "Annule aussi les effets des vagues.",
                "setPiecesRequired": null,
                "id": 155
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 63,
        "gameId": -201445760
    },
    {
        "name": "Insomnie",
        "kind": "armor",
        "description": "R\u00e9duit la dur\u00e9e de sommeil.",
        "ranks": [
            {
                "skill": {
                    "id": 64
                },
                "level": 1,
                "name": null,
                "description": "Dur\u00e9e sommeil -30 %",
                "setPiecesRequired": null,
                "id": 156
            },
            {
                "skill": {
                    "id": 64
                },
                "level": 2,
                "name": null,
                "description": "Dur\u00e9e sommeil -60 %",
                "setPiecesRequired": null,
                "id": 157
            },
            {
                "skill": {
                    "id": 64
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge du sommeil.",
                "setPiecesRequired": null,
                "id": 158
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 64,
        "gameId": -193031552
    },
    {
        "name": "Pattes engourdies",
        "kind": "weapon",
        "description": "Permet d'utiliser des fioles de l\u00e9thargie.",
        "ranks": [
            {
                "skill": {
                    "id": 65
                },
                "level": 1,
                "name": null,
                "description": "Permet d'utiliser des fioles de l\u00e9thargie.",
                "setPiecesRequired": null,
                "id": 159
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 65,
        "gameId": -181774400
    },
    {
        "name": "Garde offensive",
        "kind": "weapon",
        "description": "Accro\u00eet temporairement la puissance d'attaque apr\u00e8s une garde parfaitement synchronis\u00e9e.",
        "ranks": [
            {
                "skill": {
                    "id": 66
                },
                "level": 1,
                "name": null,
                "description": "Attaque +5 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 160
            },
            {
                "skill": {
                    "id": 66
                },
                "level": 2,
                "name": null,
                "description": "Attaque +10 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 161
            },
            {
                "skill": {
                    "id": 66
                },
                "level": 3,
                "name": null,
                "description": "Attaque +15 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 162
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 66,
        "gameId": -181127504
    },
    {
        "name": "Embuscade",
        "kind": "armor",
        "description": "Augmente temporairement les d\u00e9g\u00e2ts inflig\u00e9s aux grands monstres par les attaques furtives.",
        "ranks": [
            {
                "skill": {
                    "id": 67
                },
                "level": 1,
                "name": null,
                "description": "Attaque +5 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 163
            },
            {
                "skill": {
                    "id": 67
                },
                "level": 2,
                "name": null,
                "description": "Attaque +10 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 164
            },
            {
                "skill": {
                    "id": 67
                },
                "level": 3,
                "name": null,
                "description": "Attaque +15 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 165
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 67,
        "gameId": -171796848
    },
    {
        "name": "Attaque perfide",
        "kind": "weapon",
        "description": "Augmente les afflictions (paralysie, poison, sommeil, explosion) inflig\u00e9es par des coups critiques.",
        "ranks": [
            {
                "skill": {
                    "id": 68
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement les afflictions inflig\u00e9es par des coups critiques.",
                "setPiecesRequired": null,
                "id": 166
            },
            {
                "skill": {
                    "id": 68
                },
                "level": 2,
                "name": null,
                "description": "Augmente les afflictions inflig\u00e9es par des coups critiques.",
                "setPiecesRequired": null,
                "id": 167
            },
            {
                "skill": {
                    "id": 68
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement les afflictions inflig\u00e9es par des coups critiques.",
                "setPiecesRequired": null,
                "id": 168
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 68,
        "gameId": -168922880
    },
    {
        "name": "Salve mortelle",
        "kind": "weapon",
        "description": "Augmente la puissance des munitions sp\u00e9ciales (fusarbal\u00e8te) et Perce-dragon/ Mille dragons/Munitions tra\u00e7antes (arc).",
        "ranks": [
            {
                "skill": {
                    "id": 69
                },
                "level": 1,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la puissance des munitions et fl\u00e8ches indiqu\u00e9es.",
                "setPiecesRequired": null,
                "id": 169
            },
            {
                "skill": {
                    "id": 69
                },
                "level": 2,
                "name": null,
                "description": "Augmente la puissance des munitions et fl\u00e8ches indiqu\u00e9es.",
                "setPiecesRequired": null,
                "id": 170
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 69,
        "gameId": -160562336
    },
    {
        "name": "Puissance du Doshaguma",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 70
                },
                "level": 1,
                "name": "Culturiste I",
                "description": "Octroie temporairement Attaque +10 apr\u00e8s une Neutralisation ou un Duel de force r\u00e9ussi.",
                "setPiecesRequired": 2,
                "id": 171
            },
            {
                "skill": {
                    "id": 70
                },
                "level": 2,
                "name": "Culturiste II",
                "description": "Octroie temporairement Attaque +25 apr\u00e8s une Neutralisation ou un Duel de force r\u00e9ussi.",
                "setPiecesRequired": 4,
                "id": 172
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 70,
        "gameId": -62248528
    },
    {
        "name": "\u00c9clat du Rathalos",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 71
                },
                "level": 1,
                "name": "Carbonisateur I",
                "description": "Chances d'infliger des d\u00e9g\u00e2ts de feu suppl\u00e9mentaires apr\u00e8s une attaque r\u00e9ussie.",
                "setPiecesRequired": 2,
                "id": 173
            },
            {
                "skill": {
                    "id": 71
                },
                "level": 2,
                "name": "Carbonisateur II",
                "description": "Augmente les d\u00e9g\u00e2ts de feu suppl\u00e9mentaires apr\u00e8s une attaque r\u00e9ussie.",
                "setPiecesRequired": 4,
                "id": 174
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 71,
        "gameId": -3666104
    },
    {
        "name": "Machine de guerre",
        "kind": "weapon",
        "description": "Augmente l'attaque.",
        "ranks": [
            {
                "skill": {
                    "id": 72
                },
                "level": 1,
                "name": null,
                "description": "Attaque +3",
                "setPiecesRequired": null,
                "id": 175
            },
            {
                "skill": {
                    "id": 72
                },
                "level": 2,
                "name": null,
                "description": "Attaque +5",
                "setPiecesRequired": null,
                "id": 176
            },
            {
                "skill": {
                    "id": 72
                },
                "level": 3,
                "name": null,
                "description": "Attaque +7",
                "setPiecesRequired": null,
                "id": 177
            },
            {
                "skill": {
                    "id": 72
                },
                "level": 4,
                "name": null,
                "description": "Attaque +2 % Attaque +8",
                "setPiecesRequired": null,
                "id": 178
            },
            {
                "skill": {
                    "id": 72
                },
                "level": 5,
                "name": null,
                "description": "Attaque +4 % Attaque +9",
                "setPiecesRequired": null,
                "id": 179
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 72,
        "gameId": 1
    },
    {
        "name": "Faveur de la gloire",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 73
                },
                "level": 1,
                "name": "Chance",
                "description": "Permet d'obtenir plus de r\u00e9compenses cible. (Hors qu\u00eate rejointe en cours de route.)",
                "setPiecesRequired": 3,
                "id": 180
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 73,
        "gameId": 2237
    },
    {
        "name": "Esprit du festival",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 74
                },
                "level": 1,
                "name": "Ma\u00eetre d\u00e9peceur",
                "description": "Permet de d\u00e9pecer les monstres une fois de plus lors des qu\u00eates. (Hors qu\u00eate rejointe en cours de route.)",
                "setPiecesRequired": 3,
                "id": 181
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 74,
        "gameId": 13941
    },
    {
        "name": "Incursion",
        "kind": "armor",
        "description": "Augmente l'attaque et l'affinit\u00e9 contre les grands monstres empoisonn\u00e9s ou paralys\u00e9s.",
        "ranks": [
            {
                "skill": {
                    "id": 75
                },
                "level": 1,
                "name": null,
                "description": "Attaque +6 contre les grands monstres empoisonn\u00e9s ou paralys\u00e9s.",
                "setPiecesRequired": null,
                "id": 182
            },
            {
                "skill": {
                    "id": 75
                },
                "level": 2,
                "name": null,
                "description": "Attaque +8 et affinit\u00e9 +5 % contre les grands monstres empoisonn\u00e9s ou paralys\u00e9s.",
                "setPiecesRequired": null,
                "id": 183
            },
            {
                "skill": {
                    "id": 75
                },
                "level": 3,
                "name": null,
                "description": "Attaque +10 et affinit\u00e9 +10 % contre les grands monstres empoisonn\u00e9s ou paralys\u00e9s.",
                "setPiecesRequired": null,
                "id": 184
            },
            {
                "skill": {
                    "id": 75
                },
                "level": 4,
                "name": null,
                "description": "Attaque +12 et affinit\u00e9 +15 % contre les grands monstres empoisonn\u00e9s ou paralys\u00e9s.",
                "setPiecesRequired": null,
                "id": 185
            },
            {
                "skill": {
                    "id": 75
                },
                "level": 5,
                "name": null,
                "description": "Attaque +15 et affinit\u00e9 +20 % contre les grands monstres empoisonn\u00e9s ou paralys\u00e9s.",
                "setPiecesRequired": null,
                "id": 186
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 75,
        "gameId": 27684744
    },
    {
        "name": "Acrobate",
        "kind": "armor",
        "description": "Emp\u00eache les attaques de vous repousser pendant un saut.",
        "ranks": [
            {
                "skill": {
                    "id": 76
                },
                "level": 1,
                "name": null,
                "description": "Annule les repoussements durant les sauts.",
                "setPiecesRequired": null,
                "id": 187
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 76,
        "gameId": 78208296
    },
    {
        "name": "Fen\u00eatre d'invuln\u00e9rabilit\u00e9",
        "kind": "armor",
        "description": "Augmente la dur\u00e9e de l'invuln\u00e9rabilit\u00e9 en cas d'esquive.",
        "ranks": [
            {
                "skill": {
                    "id": 77
                },
                "level": 1,
                "name": null,
                "description": "Augmente tr\u00e8s l\u00e9g\u00e8rement la fen\u00eatre d'invuln\u00e9rabilit\u00e9.",
                "setPiecesRequired": null,
                "id": 188
            },
            {
                "skill": {
                    "id": 77
                },
                "level": 2,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la fen\u00eatre d'invuln\u00e9rabilit\u00e9.",
                "setPiecesRequired": null,
                "id": 189
            },
            {
                "skill": {
                    "id": 77
                },
                "level": 3,
                "name": null,
                "description": "Augmente la fen\u00eatre d'invuln\u00e9rabilit\u00e9.",
                "setPiecesRequired": null,
                "id": 190
            },
            {
                "skill": {
                    "id": 77
                },
                "level": 4,
                "name": null,
                "description": "Augmente grandement la fen\u00eatre d'invuln\u00e9rabilit\u00e9.",
                "setPiecesRequired": null,
                "id": 191
            },
            {
                "skill": {
                    "id": 77
                },
                "level": 5,
                "name": null,
                "description": "Augmente \u00e9norm\u00e9ment la fen\u00eatre d'invuln\u00e9rabilit\u00e9.",
                "setPiecesRequired": null,
                "id": 192
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 77,
        "gameId": 144660544
    },
    {
        "name": "La nuit porte conseil",
        "kind": "weapon",
        "description": "Augmente la puissance des afflictions de type sommeil. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 78
                },
                "level": 1,
                "name": null,
                "description": "Accumulation sommeil +5 % Accumulation sommeil +10",
                "setPiecesRequired": null,
                "id": 193
            },
            {
                "skill": {
                    "id": 78
                },
                "level": 2,
                "name": null,
                "description": "Accumulation sommeil +10 % Accumulation sommeil +20",
                "setPiecesRequired": null,
                "id": 194
            },
            {
                "skill": {
                    "id": 78
                },
                "level": 3,
                "name": null,
                "description": "Accumulation sommeil +20 % Accumulation sommeil +50",
                "setPiecesRequired": null,
                "id": 195
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 78,
        "gameId": 166057120
    },
    {
        "name": "Marchand de sable",
        "kind": "weapon",
        "description": "Permet d'utiliser des fioles de sommeil.",
        "ranks": [
            {
                "skill": {
                    "id": 79
                },
                "level": 1,
                "name": null,
                "description": "Permet d'utiliser des fioles de sommeil.",
                "setPiecesRequired": null,
                "id": 196
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 79,
        "gameId": 169998480
    },
    {
        "name": "Bouchon d'oreilles",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance aux rugissements des grands monstres.",
        "ranks": [
            {
                "skill": {
                    "id": 80
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit les effets des petits rugissements.",
                "setPiecesRequired": null,
                "id": 197
            },
            {
                "skill": {
                    "id": 80
                },
                "level": 2,
                "name": null,
                "description": "Annule les petits rugissements et r\u00e9duit les effets des grands rugissements.",
                "setPiecesRequired": null,
                "id": 198
            },
            {
                "skill": {
                    "id": 80
                },
                "level": 3,
                "name": null,
                "description": "Annule les petits et grands rugissements.",
                "setPiecesRequired": null,
                "id": 199
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 80,
        "gameId": 192746944
    },
    {
        "name": "Contre-attaque",
        "kind": "armor",
        "description": "Accro\u00eet temporairement la puissance d'attaque apr\u00e8s avoir \u00e9t\u00e9 projet\u00e9.",
        "ranks": [
            {
                "skill": {
                    "id": 81
                },
                "level": 1,
                "name": null,
                "description": "Attaque +10 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 200
            },
            {
                "skill": {
                    "id": 81
                },
                "level": 2,
                "name": null,
                "description": "Attaque +15 lorsqu'il est actif. Augmente mod\u00e9r\u00e9ment la dur\u00e9e de l'effet.",
                "setPiecesRequired": null,
                "id": 201
            },
            {
                "skill": {
                    "id": 81
                },
                "level": 3,
                "name": null,
                "description": "Attaque +25 lorsqu'il est actif. Augmente la dur\u00e9e de l'effet.",
                "setPiecesRequired": null,
                "id": 202
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 81,
        "gameId": 280489184
    },
    {
        "name": "Rage \u00e9l\u00e9mentaire",
        "kind": "weapon",
        "description": "Augmente les d\u00e9g\u00e2ts \u00e9l\u00e9mentaires (feu, eau, foudre, glace, dragon) inflig\u00e9s par des coups critiques.",
        "ranks": [
            {
                "skill": {
                    "id": 82
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement les d\u00e9g\u00e2ts \u00e9l\u00e9mentaires lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 203
            },
            {
                "skill": {
                    "id": 82
                },
                "level": 2,
                "name": null,
                "description": "Augmente les d\u00e9g\u00e2ts \u00e9l\u00e9mentaires lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 204
            },
            {
                "skill": {
                    "id": 82
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement les d\u00e9g\u00e2ts \u00e9l\u00e9mentaires lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 205
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 82,
        "gameId": 313598432
    },
    {
        "name": "Surcharge",
        "kind": "weapon",
        "description": "Augmente les d\u00e9g\u00e2ts et la puissance de l'\u00e9tourdissement des attaques de marteau charg\u00e9es.",
        "ranks": [
            {
                "skill": {
                    "id": 83
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 206
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 83,
        "gameId": 353114912
    },
    {
        "name": "\u00c9tanch\u00e9it\u00e9",
        "kind": "armor",
        "description": "Augmente la protection contre les attaques \u00e9l\u00e9mentaires eau puis les attaques physiques.",
        "ranks": [
            {
                "skill": {
                    "id": 84
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9sistance Eau +6",
                "setPiecesRequired": null,
                "id": 207
            },
            {
                "skill": {
                    "id": 84
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9sistance Eau +12",
                "setPiecesRequired": null,
                "id": 208
            },
            {
                "skill": {
                    "id": 84
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9sistance Eau +20 D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 209
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 84,
        "gameId": 383104832
    },
    {
        "name": "Matraquage",
        "kind": "weapon",
        "description": "Augmente les d\u00e9g\u00e2ts inflig\u00e9s quand votre arme est \u00e9mouss\u00e9e.",
        "ranks": [
            {
                "skill": {
                    "id": 85
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9g\u00e2ts +5 % lorsque la jauge de tranchant est dans le jaune ou moins.",
                "setPiecesRequired": null,
                "id": 210
            },
            {
                "skill": {
                    "id": 85
                },
                "level": 2,
                "name": null,
                "description": "D\u00e9g\u00e2ts +10 % lorsque la jauge de tranchant est dans le jaune ou moins.",
                "setPiecesRequired": null,
                "id": 211
            },
            {
                "skill": {
                    "id": 85
                },
                "level": 3,
                "name": null,
                "description": "D\u00e9g\u00e2ts +10 % lorsque la jauge de tranchant est dans le vert ou moins.",
                "setPiecesRequired": null,
                "id": 212
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 85,
        "gameId": 397306144
    },
    {
        "name": "Mort venue d'en haut",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques saut\u00e9es.",
        "ranks": [
            {
                "skill": {
                    "id": 86
                },
                "level": 1,
                "name": null,
                "description": "Attaques saut\u00e9es +10 %",
                "setPiecesRequired": null,
                "id": 213
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 86,
        "gameId": 402237312
    },
    {
        "name": "H\u00e9ro\u00efsme",
        "kind": "armor",
        "description": "Augmente l'attaque et la d\u00e9fense lorsque la vie est inf\u00e9rieure ou \u00e9gale \u00e0 35 %.",
        "ranks": [
            {
                "skill": {
                    "id": 87
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9fense +50 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 214
            },
            {
                "skill": {
                    "id": 87
                },
                "level": 2,
                "name": null,
                "description": "Attaque +5 % et d\u00e9fense physique +50 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 215
            },
            {
                "skill": {
                    "id": 87
                },
                "level": 3,
                "name": null,
                "description": "Attaque +5 % et d\u00e9fense physique +100 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 216
            },
            {
                "skill": {
                    "id": 87
                },
                "level": 4,
                "name": null,
                "description": "Attaque +10 % et d\u00e9fense physique +100 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 217
            },
            {
                "skill": {
                    "id": 87
                },
                "level": 5,
                "name": null,
                "description": "Attaque +30 % et bonus de d\u00e9fense annul\u00e9s lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 218
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 87,
        "gameId": 422666624
    },
    {
        "name": "Adaptabilit\u00e9",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance aux d\u00e9g\u00e2ts environnementaux, comme la chaleur ou le froid.",
        "ranks": [
            {
                "skill": {
                    "id": 88
                },
                "level": 1,
                "name": null,
                "description": "Annule les effets du froid et de la chaleur.",
                "setPiecesRequired": null,
                "id": 219
            },
            {
                "skill": {
                    "id": 88
                },
                "level": 2,
                "name": null,
                "description": "Annule les d\u00e9g\u00e2ts environnementaux.",
                "setPiecesRequired": null,
                "id": 220
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 88,
        "gameId": 424768352
    },
    {
        "name": "Douceur du cuir",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 89
                },
                "level": 1,
                "name": "Roi de la glisse",
                "description": "Augmente temporairement votre affinit\u00e9 pendant les glissades.",
                "setPiecesRequired": 3,
                "id": 221
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 89,
        "gameId": 451472896
    },
    {
        "name": "Expert en survie",
        "kind": "armor",
        "description": "R\u00e9duit le d\u00e9lai de r\u00e9utilisation des outils de survie.",
        "ranks": [
            {
                "skill": {
                    "id": 90
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9lai de r\u00e9utilisation -10 %",
                "setPiecesRequired": null,
                "id": 222
            },
            {
                "skill": {
                    "id": 90
                },
                "level": 2,
                "name": null,
                "description": "D\u00e9lai de r\u00e9utilisation -20 %",
                "setPiecesRequired": null,
                "id": 223
            },
            {
                "skill": {
                    "id": 90
                },
                "level": 3,
                "name": null,
                "description": "D\u00e9lai de r\u00e9utilisation -30 %",
                "setPiecesRequired": null,
                "id": 224
            },
            {
                "skill": {
                    "id": 90
                },
                "level": 4,
                "name": null,
                "description": "D\u00e9lai de r\u00e9utilisation -40 %",
                "setPiecesRequired": null,
                "id": 225
            },
            {
                "skill": {
                    "id": 90
                },
                "level": 5,
                "name": null,
                "description": "D\u00e9lai de r\u00e9utilisation -50 %",
                "setPiecesRequired": null,
                "id": 226
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 90,
        "gameId": 469540352
    },
    {
        "name": "Maelstrom",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques \u00e9l\u00e9mentaires eau. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 91
                },
                "level": 1,
                "name": null,
                "description": "Attaque Eau +40",
                "setPiecesRequired": null,
                "id": 227
            },
            {
                "skill": {
                    "id": 91
                },
                "level": 2,
                "name": null,
                "description": "Attaque Eau +10 % Attaque Eau +50",
                "setPiecesRequired": null,
                "id": 228
            },
            {
                "skill": {
                    "id": 91
                },
                "level": 3,
                "name": null,
                "description": "Attaque Eau +20 % Attaque Eau +60",
                "setPiecesRequired": null,
                "id": 229
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 91,
        "gameId": 508916704
    },
    {
        "name": "Antiparalysie",
        "kind": "armor",
        "description": "R\u00e9duit la dur\u00e9e de paralysie.",
        "ranks": [
            {
                "skill": {
                    "id": 92
                },
                "level": 1,
                "name": null,
                "description": "Dur\u00e9e paralysie -30 %",
                "setPiecesRequired": null,
                "id": 230
            },
            {
                "skill": {
                    "id": 92
                },
                "level": 2,
                "name": null,
                "description": "Dur\u00e9e paralysie -60 %",
                "setPiecesRequired": null,
                "id": 231
            },
            {
                "skill": {
                    "id": 92
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge de la paralysie.",
                "setPiecesRequired": null,
                "id": 232
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 92,
        "gameId": 522288832
    },
    {
        "name": "Tension du Rey Dau",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 93
                },
                "level": 1,
                "name": "Rage foudroyante I",
                "description": "Augmente mod\u00e9r\u00e9ment la dur\u00e9e de Force latente.",
                "setPiecesRequired": 2,
                "id": 233
            },
            {
                "skill": {
                    "id": 93
                },
                "level": 2,
                "name": "Rage foudroyante II",
                "description": "Augmente la dur\u00e9e de Force latente.",
                "setPiecesRequired": 4,
                "id": 234
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 93,
        "gameId": 539707072
    },
    {
        "name": "Traque sans merci",
        "kind": "weapon",
        "description": "Augmente l'attaque des munitions perforantes (fusarbal\u00e8te) et de Perce-dragon/Mille dragons (arc).",
        "ranks": [
            {
                "skill": {
                    "id": 94
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la puissance des munitions et fl\u00e8ches indiqu\u00e9es.",
                "setPiecesRequired": null,
                "id": 235
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 94,
        "gameId": 552982656
    },
    {
        "name": "Vendetta",
        "kind": "armor",
        "description": "Attaquez sans arr\u00eat pour augmenter progressivement l'attaque et l'attaque \u00e9l\u00e9mentaire. (L'augmentation d\u00e9pend de l'arme.)",
        "ranks": [
            {
                "skill": {
                    "id": 95
                },
                "level": 1,
                "name": null,
                "description": "L'attaque et les attaques \u00e9l\u00e9mentaires augmentent l\u00e9g\u00e8rement au premier coup, et encore plus apr\u00e8s le cinqui\u00e8me coup.",
                "setPiecesRequired": null,
                "id": 236
            },
            {
                "skill": {
                    "id": 95
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9ussir 5 attaques d'affil\u00e9e renforce mod\u00e9r\u00e9ment l'effet.",
                "setPiecesRequired": null,
                "id": 237
            },
            {
                "skill": {
                    "id": 95
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9ussir 5 attaques d'affil\u00e9e renforce un peu plus l'effet.",
                "setPiecesRequired": null,
                "id": 238
            },
            {
                "skill": {
                    "id": 95
                },
                "level": 4,
                "name": null,
                "description": "R\u00e9ussir 5 attaques d'affil\u00e9e renforce encore plus l'effet.",
                "setPiecesRequired": null,
                "id": 239
            },
            {
                "skill": {
                    "id": 95
                },
                "level": 5,
                "name": null,
                "description": "R\u00e9ussir 5 attaques d'affil\u00e9e renforce \u00e9norm\u00e9ment l'effet.",
                "setPiecesRequired": null,
                "id": 240
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 95,
        "gameId": 565867136
    },
    {
        "name": "Brasier blanc",
        "kind": "weapon",
        "description": "Chances d'infliger des d\u00e9g\u00e2ts suppl\u00e9mentaires apr\u00e8s une attaque r\u00e9ussie.",
        "ranks": [
            {
                "skill": {
                    "id": 96
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet. (Ne se cumule pas avec Carbonisateur, mais inflige des d\u00e9g\u00e2ts de feu suppl\u00e9mentaires.)",
                "setPiecesRequired": null,
                "id": 241
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 96,
        "gameId": 576193792
    },
    {
        "name": "Pelage attrayant",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 97
                },
                "level": 1,
                "name": "Diversion",
                "description": "Attire davantage l'attention d'un monstre quand vous l'attaquez.",
                "setPiecesRequired": 3,
                "id": 242
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 97,
        "gameId": 583598144
    },
    {
        "name": "G\u00e9ologiste",
        "kind": "armor",
        "description": "Augmente le nombre d'objets r\u00e9cup\u00e9r\u00e9s aux points de collecte.",
        "ranks": [
            {
                "skill": {
                    "id": 98
                },
                "level": 1,
                "name": null,
                "description": "Un objet suppl\u00e9mentaire obtenu depuis les carcasses.",
                "setPiecesRequired": null,
                "id": 243
            },
            {
                "skill": {
                    "id": 98
                },
                "level": 2,
                "name": null,
                "description": "Ajoute en plus un objet suppl\u00e9mentaire en collectant des objets sp\u00e9ciaux.",
                "setPiecesRequired": null,
                "id": 244
            },
            {
                "skill": {
                    "id": 98
                },
                "level": 3,
                "name": null,
                "description": "Ajoute en plus un objet suppl\u00e9mentaire depuis les gisements miniers.",
                "setPiecesRequired": null,
                "id": 245
            }
        ],
        "icon": {
            "id": 12,
            "kind": "gathering"
        },
        "id": 98,
        "gameId": 595870656
    },
    {
        "name": "Corps et \u00e2me",
        "kind": "armor",
        "description": "Augmente l'affinit\u00e9 si l'endurance est \u00e0 son maximum pendant un certain temps.",
        "ranks": [
            {
                "skill": {
                    "id": 99
                },
                "level": 1,
                "name": null,
                "description": "Affinit\u00e9 +10 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 246
            },
            {
                "skill": {
                    "id": 99
                },
                "level": 2,
                "name": null,
                "description": "Affinit\u00e9 +20 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 247
            },
            {
                "skill": {
                    "id": 99
                },
                "level": 3,
                "name": null,
                "description": "Affinit\u00e9 +30 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 248
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 99,
        "gameId": 632127488
    },
    {
        "name": "Carnassier",
        "kind": "armor",
        "description": "Augmente la vitesse de consommation de viande et d'objets.",
        "ranks": [
            {
                "skill": {
                    "id": 100
                },
                "level": 1,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la vitesse des repas.",
                "setPiecesRequired": null,
                "id": 249
            },
            {
                "skill": {
                    "id": 100
                },
                "level": 2,
                "name": null,
                "description": "Augmente la vitesse des repas.",
                "setPiecesRequired": null,
                "id": 250
            },
            {
                "skill": {
                    "id": 100
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la vitesse des repas.",
                "setPiecesRequired": null,
                "id": 251
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 100,
        "gameId": 634068352
    },
    {
        "name": "Antigel",
        "kind": "armor",
        "description": "Augmente la protection contre les attaques \u00e9l\u00e9mentaires glace puis les attaques physiques.",
        "ranks": [
            {
                "skill": {
                    "id": 101
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9sistance Glace +6",
                "setPiecesRequired": null,
                "id": 252
            },
            {
                "skill": {
                    "id": 101
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9sistance Glace +12",
                "setPiecesRequired": null,
                "id": 253
            },
            {
                "skill": {
                    "id": 101
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9sistance Glace +20 D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 254
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 101,
        "gameId": 652161472
    },
    {
        "name": "Trompe-la-mort",
        "kind": "armor",
        "description": "Augmente la distance d'esquive.",
        "ranks": [
            {
                "skill": {
                    "id": 102
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la distance d'esquive.",
                "setPiecesRequired": null,
                "id": 255
            },
            {
                "skill": {
                    "id": 102
                },
                "level": 2,
                "name": null,
                "description": "Augmente la distance d'esquive.",
                "setPiecesRequired": null,
                "id": 256
            },
            {
                "skill": {
                    "id": 102
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la distance d'esquive.",
                "setPiecesRequired": null,
                "id": 257
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 102,
        "gameId": 673822976
    },
    {
        "name": "D\u00e9gainage \u00e9clair",
        "kind": "weapon",
        "description": "Augmente l'affinit\u00e9 lorsque vous ex\u00e9cutez des attaques d\u00e9gain\u00e9es (sans effet en chevauchant).",
        "ranks": [
            {
                "skill": {
                    "id": 103
                },
                "level": 1,
                "name": null,
                "description": "Affinit\u00e9 +50 %",
                "setPiecesRequired": null,
                "id": 258
            },
            {
                "skill": {
                    "id": 103
                },
                "level": 2,
                "name": null,
                "description": "Affinit\u00e9 +75 %",
                "setPiecesRequired": null,
                "id": 259
            },
            {
                "skill": {
                    "id": 103
                },
                "level": 3,
                "name": null,
                "description": "Affinit\u00e9 +100 %",
                "setPiecesRequired": null,
                "id": 260
            }
        ],
        "icon": {
            "id": 2,
            "kind": "affinity"
        },
        "id": 103,
        "gameId": 686533440
    },
    {
        "name": "Puissance absolue",
        "kind": "weapon",
        "description": "Les \u00e9p\u00e9es longues, insectoglaives, lames doubles, morpho-haches, et volto-haches restent charg\u00e9s plus longtemps.",
        "ranks": [
            {
                "skill": {
                    "id": 104
                },
                "level": 1,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la dur\u00e9e pendant laquelle les armes sont charg\u00e9es.",
                "setPiecesRequired": null,
                "id": 261
            },
            {
                "skill": {
                    "id": 104
                },
                "level": 2,
                "name": null,
                "description": "Augmente la dur\u00e9e pendant laquelle les armes sont charg\u00e9es.",
                "setPiecesRequired": null,
                "id": 262
            },
            {
                "skill": {
                    "id": 104
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la dur\u00e9e pendant laquelle les armes sont charg\u00e9s.",
                "setPiecesRequired": null,
                "id": 263
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 104,
        "gameId": 691199232
    },
    {
        "name": "Cr\u00e2ne d'acier",
        "kind": "armor",
        "description": "R\u00e9duit la dur\u00e9e d'\u00e9tourdissement.",
        "ranks": [
            {
                "skill": {
                    "id": 105
                },
                "level": 1,
                "name": null,
                "description": "Dur\u00e9e \u00e9tourdissement -30 %",
                "setPiecesRequired": null,
                "id": 264
            },
            {
                "skill": {
                    "id": 105
                },
                "level": 2,
                "name": null,
                "description": "Dur\u00e9e \u00e9tourdissement -60 %.",
                "setPiecesRequired": null,
                "id": 265
            },
            {
                "skill": {
                    "id": 105
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge des \u00e9tourdissements.",
                "setPiecesRequired": null,
                "id": 266
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 105,
        "gameId": 705317568
    },
    {
        "name": "Tyrannie du Gore Magala",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 106
                },
                "level": 1,
                "name": "\u00c9clipse noire I",
                "description": "Vous inflige la Furie face aux grands monstres.",
                "setPiecesRequired": 2,
                "id": 267
            },
            {
                "skill": {
                    "id": 106
                },
                "level": 2,
                "name": "\u00c9clipse noire II",
                "description": "Vous inflige la Furie et augmente votre attaque face aux grands monstres. Apr\u00e8s gu\u00e9rison, l'attaque est encore accrue.",
                "setPiecesRequired": 4,
                "id": 268
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 106,
        "gameId": 722735744
    },
    {
        "name": "Esprit du Blangonga",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 107
                },
                "level": 1,
                "name": "Cri de guerre I",
                "description": "Utiliser l'\u00e9mote [Victoire !] augmente mod\u00e9r\u00e9ment l'attaque des alli\u00e9s proches. (Accru sur Palicos/Chasseurs de soutien.)",
                "setPiecesRequired": 2,
                "id": 269
            },
            {
                "skill": {
                    "id": 107
                },
                "level": 2,
                "name": "Cri de guerre II",
                "description": "Utiliser l'\u00e9mote [Victoire !] augmente l'attaque des alli\u00e9s proches. (Accru sur Palicos/Chasseurs de soutien.)",
                "setPiecesRequired": 4,
                "id": 270
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 107,
        "gameId": 741102208
    },
    {
        "name": "Nerfs d'acier",
        "kind": "armor",
        "description": "\u00c9vite les chutes et autres r\u00e9actions aux d\u00e9g\u00e2ts mineurs.",
        "ranks": [
            {
                "skill": {
                    "id": 108
                },
                "level": 1,
                "name": null,
                "description": "\u00c9vite les repoussements.",
                "setPiecesRequired": null,
                "id": 271
            },
            {
                "skill": {
                    "id": 108
                },
                "level": 2,
                "name": null,
                "description": "\u00c9vite les repoussements et transforme les chutes en repoussements.",
                "setPiecesRequired": null,
                "id": 272
            },
            {
                "skill": {
                    "id": 108
                },
                "level": 3,
                "name": null,
                "description": "\u00c9vite les chutes et les repoussements.",
                "setPiecesRequired": null,
                "id": 273
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 108,
        "gameId": 742695104
    },
    {
        "name": "Recharge charg\u00e9e",
        "kind": "weapon",
        "description": "Am\u00e9liore le rechargement et augmente le nombre de munitions du lancecanon et de fioles de volto-hache.",
        "ranks": [
            {
                "skill": {
                    "id": 109
                },
                "level": 1,
                "name": null,
                "description": "Acc\u00e9l\u00e8re le rechargement des obus et des fioles.",
                "setPiecesRequired": null,
                "id": 274
            },
            {
                "skill": {
                    "id": 109
                },
                "level": 2,
                "name": null,
                "description": "Acc\u00e9l\u00e8re le rechargement (obus/fioles). Capacit\u00e9 lancecanon +1. Volto-hache : 5 fioles (jauge jaune).",
                "setPiecesRequired": null,
                "id": 275
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 109,
        "gameId": 802725120
    },
    {
        "name": "Antiexplosion",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance au fl\u00e9au-explosion.",
        "ranks": [
            {
                "skill": {
                    "id": 110
                },
                "level": 1,
                "name": null,
                "description": "Retarde et r\u00e9duit les d\u00e9g\u00e2ts des fl\u00e9aux-explosion.",
                "setPiecesRequired": null,
                "id": 276
            },
            {
                "skill": {
                    "id": 110
                },
                "level": 2,
                "name": null,
                "description": "Retarde et r\u00e9duit grandement les d\u00e9g\u00e2ts des fl\u00e9aux-explosion.",
                "setPiecesRequired": null,
                "id": 277
            },
            {
                "skill": {
                    "id": 110
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge du fl\u00e9au-explosion.",
                "setPiecesRequired": null,
                "id": 278
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 110,
        "gameId": 820385792
    },
    {
        "name": "Pique-assiette",
        "kind": "armor",
        "description": "Octroie une chance pr\u00e9d\u00e9finie de consommer une nourriture ou un breuvage gratuitement.",
        "ranks": [
            {
                "skill": {
                    "id": 111
                },
                "level": 1,
                "name": null,
                "description": "Chances d'activation +10 %",
                "setPiecesRequired": null,
                "id": 279
            },
            {
                "skill": {
                    "id": 111
                },
                "level": 2,
                "name": null,
                "description": "Chances d'activation +25 %",
                "setPiecesRequired": null,
                "id": 280
            },
            {
                "skill": {
                    "id": 111
                },
                "level": 3,
                "name": null,
                "description": "Chances d'activation +45 %",
                "setPiecesRequired": null,
                "id": 281
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 111,
        "gameId": 850626240
    },
    {
        "name": "Botaniste",
        "kind": "armor",
        "description": "Augmente la quantit\u00e9 d'herbes et d'objets utilisables que vous collectez.",
        "ranks": [
            {
                "skill": {
                    "id": 112
                },
                "level": 1,
                "name": null,
                "description": "Une herbe suppl\u00e9mentaire par collecte.",
                "setPiecesRequired": null,
                "id": 282
            },
            {
                "skill": {
                    "id": 112
                },
                "level": 2,
                "name": null,
                "description": "Ajoute en plus un fruit, une noix ou une graine suppl\u00e9mentaire par collecte.",
                "setPiecesRequired": null,
                "id": 283
            },
            {
                "skill": {
                    "id": 112
                },
                "level": 3,
                "name": null,
                "description": "Ajoute en plus un insecte par collecte.",
                "setPiecesRequired": null,
                "id": 284
            },
            {
                "skill": {
                    "id": 112
                },
                "level": 4,
                "name": null,
                "description": "Ajoute en plus un champignon par collecte.",
                "setPiecesRequired": null,
                "id": 285
            }
        ],
        "icon": {
            "id": 12,
            "kind": "gathering"
        },
        "id": 112,
        "gameId": 860517760
    },
    {
        "name": "Un pour tous",
        "kind": "armor",
        "description": "Partage les effets de certains objets avec les alli\u00e9s \u00e0 proximit\u00e9.",
        "ranks": [
            {
                "skill": {
                    "id": 113
                },
                "level": 1,
                "name": null,
                "description": "Permet de partager 33 % des effets des objets avec les alli\u00e9s \u00e0 proximit\u00e9.",
                "setPiecesRequired": null,
                "id": 286
            },
            {
                "skill": {
                    "id": 113
                },
                "level": 2,
                "name": null,
                "description": "Permet de partager 33 % des effets des objets avec les alli\u00e9s m\u00eame \u00e0 grande distance.",
                "setPiecesRequired": null,
                "id": 287
            },
            {
                "skill": {
                    "id": 113
                },
                "level": 3,
                "name": null,
                "description": "Permet de partager 66 % des effets des objets avec les alli\u00e9s m\u00eame \u00e0 grande distance.",
                "setPiecesRequired": null,
                "id": 288
            },
            {
                "skill": {
                    "id": 113
                },
                "level": 4,
                "name": null,
                "description": "Permet de partager 66 % des effets des objets avec les alli\u00e9s m\u00eame \u00e0 tr\u00e8s grande distance.",
                "setPiecesRequired": null,
                "id": 289
            },
            {
                "skill": {
                    "id": 113
                },
                "level": 5,
                "name": null,
                "description": "Permet de partager tous les effets des objets avec les alli\u00e9s m\u00eame \u00e0 tr\u00e8s grande distance.",
                "setPiecesRequired": null,
                "id": 290
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 113,
        "gameId": 894530496
    },
    {
        "name": "Entomologiste",
        "kind": "armor",
        "description": "Les corps des petits monstres insectes ne sont pas d\u00e9truits, ce qui permet de les d\u00e9pecer (avec quelques exceptions).",
        "ranks": [
            {
                "skill": {
                    "id": 114
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 291
            }
        ],
        "icon": {
            "id": 12,
            "kind": "gathering"
        },
        "id": 114,
        "gameId": 898284480
    },
    {
        "name": "Pouvoir de l'Odogaron d\u00e9sastre",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 115
                },
                "level": 1,
                "name": "Bonus Vendetta I",
                "description": "Augmente la dur\u00e9e du talent Vendetta et conf\u00e8re Attaque +8 quand Vendetta est actif. ",
                "setPiecesRequired": 2,
                "id": 292
            },
            {
                "skill": {
                    "id": 115
                },
                "level": 2,
                "name": "Bonus Vendetta II",
                "description": "Augmente encore la dur\u00e9e du talent Vendetta et conf\u00e8re Attaque +18 quand Vendetta est actif.",
                "setPiecesRequired": 4,
                "id": 293
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 115,
        "gameId": 918165056
    },
    {
        "name": "Apothicaire",
        "kind": "weapon",
        "description": "Permet d'utiliser des fioles de poison.",
        "ranks": [
            {
                "skill": {
                    "id": 116
                },
                "level": 1,
                "name": null,
                "description": "Permet d'utiliser des fioles de poison.",
                "setPiecesRequired": null,
                "id": 294
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 116,
        "gameId": 919683456
    },
    {
        "name": "Samoura\u00ef",
        "kind": "weapon",
        "description": "Emp\u00eache votre arme de perdre son tranchant.",
        "ranks": [
            {
                "skill": {
                    "id": 117
                },
                "level": 1,
                "name": null,
                "description": "10 % de chances d'annuler la perte de tranchant.",
                "setPiecesRequired": null,
                "id": 295
            },
            {
                "skill": {
                    "id": 117
                },
                "level": 2,
                "name": null,
                "description": "25 % de chances d'annuler la perte de tranchant.",
                "setPiecesRequired": null,
                "id": 296
            },
            {
                "skill": {
                    "id": 117
                },
                "level": 3,
                "name": null,
                "description": "50 % de chances d'annuler la perte de tranchant.",
                "setPiecesRequired": null,
                "id": 297
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 117,
        "gameId": 1050520384
    },
    {
        "name": "Bastion",
        "kind": "armor",
        "description": "Augmente la d\u00e9fense, ainsi que les r\u00e9sistances \u00e9l\u00e9mentaires aux niveaux sup\u00e9rieurs.",
        "ranks": [
            {
                "skill": {
                    "id": 118
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9fense +5",
                "setPiecesRequired": null,
                "id": 298
            },
            {
                "skill": {
                    "id": 118
                },
                "level": 2,
                "name": null,
                "description": "D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 299
            },
            {
                "skill": {
                    "id": 118
                },
                "level": 3,
                "name": null,
                "description": "D\u00e9fense +5 % D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 300
            },
            {
                "skill": {
                    "id": 118
                },
                "level": 4,
                "name": null,
                "description": "D\u00e9fense +5 % D\u00e9fense +20 R\u00e9sistances \u00e9l\u00e9mentaires +3",
                "setPiecesRequired": null,
                "id": 301
            },
            {
                "skill": {
                    "id": 118
                },
                "level": 5,
                "name": null,
                "description": "D\u00e9fense +8 % D\u00e9fense +20 R\u00e9sistances \u00e9l\u00e9mentaires +3",
                "setPiecesRequired": null,
                "id": 302
            },
            {
                "skill": {
                    "id": 118
                },
                "level": 6,
                "name": null,
                "description": "D\u00e9fense +8 % D\u00e9fense +35 R\u00e9sistances \u00e9l\u00e9mentaires +5",
                "setPiecesRequired": null,
                "id": 303
            },
            {
                "skill": {
                    "id": 118
                },
                "level": 7,
                "name": null,
                "description": "D\u00e9fense +10 % D\u00e9fense +35 R\u00e9sistances \u00e9l\u00e9mentaires +5",
                "setPiecesRequired": null,
                "id": 304
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 118,
        "gameId": 1077686656
    },
    {
        "name": "Savoir-faire",
        "kind": "weapon",
        "description": "Augmente la jauge de tranchant de l'arme. Ne peut d\u00e9passer la limite maximum.",
        "ranks": [
            {
                "skill": {
                    "id": 119
                },
                "level": 1,
                "name": null,
                "description": "Tranchant +10",
                "setPiecesRequired": null,
                "id": 305
            },
            {
                "skill": {
                    "id": 119
                },
                "level": 2,
                "name": null,
                "description": "Tranchant +20",
                "setPiecesRequired": null,
                "id": 306
            },
            {
                "skill": {
                    "id": 119
                },
                "level": 3,
                "name": null,
                "description": "Tranchant +30",
                "setPiecesRequired": null,
                "id": 307
            },
            {
                "skill": {
                    "id": 119
                },
                "level": 4,
                "name": null,
                "description": "Tranchant +40",
                "setPiecesRequired": null,
                "id": 308
            },
            {
                "skill": {
                    "id": 119
                },
                "level": 5,
                "name": null,
                "description": "Tranchant +50",
                "setPiecesRequired": null,
                "id": 309
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 119,
        "gameId": 1160639488
    },
    {
        "name": "Pouss\u00e9e d'adr\u00e9naline",
        "kind": "armor",
        "description": "Esquivez juste avant une attaque pour un bonus d'attaque temporaire.",
        "ranks": [
            {
                "skill": {
                    "id": 120
                },
                "level": 1,
                "name": null,
                "description": "Attaque +10 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 310
            },
            {
                "skill": {
                    "id": 120
                },
                "level": 2,
                "name": null,
                "description": "Attaque +15 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 311
            },
            {
                "skill": {
                    "id": 120
                },
                "level": 3,
                "name": null,
                "description": "Attaque +20 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 312
            },
            {
                "skill": {
                    "id": 120
                },
                "level": 4,
                "name": null,
                "description": "Attaque +25 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 313
            },
            {
                "skill": {
                    "id": 120
                },
                "level": 5,
                "name": null,
                "description": "Attaque +30 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 314
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 120,
        "gameId": 1174975744
    },
    {
        "name": "Blizzard",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques \u00e9l\u00e9mentaires glace. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 121
                },
                "level": 1,
                "name": null,
                "description": "Attaque Glace +40",
                "setPiecesRequired": null,
                "id": 315
            },
            {
                "skill": {
                    "id": 121
                },
                "level": 2,
                "name": null,
                "description": "Attaque Glace +10 % Attaque Glace +50",
                "setPiecesRequired": null,
                "id": 316
            },
            {
                "skill": {
                    "id": 121
                },
                "level": 3,
                "name": null,
                "description": "Attaque Glace +20 % Attaque Glace +60",
                "setPiecesRequired": null,
                "id": 317
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 121,
        "gameId": 1268070400
    },
    {
        "name": "B\u00e9n\u00e9diction",
        "kind": "armor",
        "description": "A une chance pr\u00e9d\u00e9finie de r\u00e9duire les d\u00e9g\u00e2ts que vous subissez.",
        "ranks": [
            {
                "skill": {
                    "id": 122
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9g\u00e2ts subis -15 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 318
            },
            {
                "skill": {
                    "id": 122
                },
                "level": 2,
                "name": null,
                "description": "D\u00e9g\u00e2ts subis -30 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 319
            },
            {
                "skill": {
                    "id": 122
                },
                "level": 3,
                "name": null,
                "description": "D\u00e9g\u00e2ts subis -50 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 320
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 122,
        "gameId": 1346775424
    },
    {
        "name": "Vengeance",
        "kind": "armor",
        "description": "Augmente l'attaque lorsque vous avez subi des d\u00e9g\u00e2ts temporaires (zone rouge de la jauge de vie).",
        "ranks": [
            {
                "skill": {
                    "id": 123
                },
                "level": 1,
                "name": null,
                "description": "Attaque +5 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 321
            },
            {
                "skill": {
                    "id": 123
                },
                "level": 2,
                "name": null,
                "description": "Attaque +10 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 322
            },
            {
                "skill": {
                    "id": 123
                },
                "level": 3,
                "name": null,
                "description": "Attaque +15 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 323
            },
            {
                "skill": {
                    "id": 123
                },
                "level": 4,
                "name": null,
                "description": "Attaque +20 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 324
            },
            {
                "skill": {
                    "id": 123
                },
                "level": 5,
                "name": null,
                "description": "Attaque +25 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 325
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 123,
        "gameId": 1359821952
    },
    {
        "name": "Main de ma\u00eetre",
        "kind": "weapon",
        "description": "Emp\u00eache votre arme de perdre son tranchant lors de coups critiques.",
        "ranks": [
            {
                "skill": {
                    "id": 124
                },
                "level": 1,
                "name": null,
                "description": "80 % de chances d'annuler la perte de tranchant lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 326
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 124,
        "gameId": 1389859584
    },
    {
        "name": "Ignifuge",
        "kind": "armor",
        "description": "Augmente la protection contre les attaques \u00e9l\u00e9mentaires feu puis les attaques physiques.",
        "ranks": [
            {
                "skill": {
                    "id": 125
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9sistance Feu +6",
                "setPiecesRequired": null,
                "id": 327
            },
            {
                "skill": {
                    "id": 125
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9sistance Feu +12",
                "setPiecesRequired": null,
                "id": 328
            },
            {
                "skill": {
                    "id": 125
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9sistance Feu +20 D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 329
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 125,
        "gameId": 1425756032
    },
    {
        "name": "Aff\u00fbtage rapide",
        "kind": "weapon",
        "description": "Acc\u00e9l\u00e8re l'aff\u00fbtage d'une arme avec un aiguisoir.",
        "ranks": [
            {
                "skill": {
                    "id": 126
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit l'aff\u00fbtage d'un cycle.",
                "setPiecesRequired": null,
                "id": 330
            },
            {
                "skill": {
                    "id": 126
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9duit l'aff\u00fbtage de deux cycles.",
                "setPiecesRequired": null,
                "id": 331
            }
        ],
        "icon": {
            "id": 11,
            "kind": "item"
        },
        "id": 126,
        "gameId": 1444935552
    },
    {
        "name": "Feu du ciel",
        "kind": "weapon",
        "description": "Augmente la puissance des attaques \u00e9l\u00e9mentaires foudre. Il y a une limite aux augmentations.",
        "ranks": [
            {
                "skill": {
                    "id": 127
                },
                "level": 1,
                "name": null,
                "description": "Attaque Foudre +40",
                "setPiecesRequired": null,
                "id": 332
            },
            {
                "skill": {
                    "id": 127
                },
                "level": 2,
                "name": null,
                "description": "Attaque Foudre +10 % Attaque Foudre +50",
                "setPiecesRequired": null,
                "id": 333
            },
            {
                "skill": {
                    "id": 127
                },
                "level": 3,
                "name": null,
                "description": "Attaque Foudre +20 % Attaque Foudre +60",
                "setPiecesRequired": null,
                "id": 334
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 127,
        "gameId": 1452140672
    },
    {
        "name": "Toxicologie",
        "kind": "armor",
        "description": "R\u00e9duit les d\u00e9g\u00e2ts subis en cas d'empoisonnement.",
        "ranks": [
            {
                "skill": {
                    "id": 128
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit le nombre de fois que vous subissez des d\u00e9g\u00e2ts de poison.",
                "setPiecesRequired": null,
                "id": 335
            },
            {
                "skill": {
                    "id": 128
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9duit grandement le nombre de fois que vous subissez des d\u00e9g\u00e2ts de poison.",
                "setPiecesRequired": null,
                "id": 336
            },
            {
                "skill": {
                    "id": 128
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge du poison.",
                "setPiecesRequired": null,
                "id": 337
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 128,
        "gameId": 1459579264
    },
    {
        "name": "Destructeur",
        "kind": "armor",
        "description": "Facilite la destruction des parties des monstres et augmente les d\u00e9g\u00e2ts quand vous d\u00e9truisez une blessure avec une Attaque Focus.",
        "ranks": [
            {
                "skill": {
                    "id": 129
                },
                "level": 1,
                "name": null,
                "description": "Augmente les d\u00e9g\u00e2ts contre les parties et les d\u00e9g\u00e2ts inflig\u00e9s de 10 % si les conditions sont remplies.",
                "setPiecesRequired": null,
                "id": 338
            },
            {
                "skill": {
                    "id": 129
                },
                "level": 2,
                "name": null,
                "description": "Augmente les d\u00e9g\u00e2ts contre les parties et les d\u00e9g\u00e2ts inflig\u00e9s de 20 % si les conditions sont remplies.",
                "setPiecesRequired": null,
                "id": 339
            },
            {
                "skill": {
                    "id": 129
                },
                "level": 3,
                "name": null,
                "description": "Augmente les d\u00e9g\u00e2ts contre les parties et les d\u00e9g\u00e2ts inflig\u00e9s de 30 % si les conditions sont remplies.",
                "setPiecesRequired": null,
                "id": 340
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 129,
        "gameId": 1470960256
    },
    {
        "name": "Intimidation",
        "kind": "armor",
        "description": "R\u00e9duit les chances de vous faire attaquer par de petits monstres s'ils vous rep\u00e8rent. Sans effet sur certains monstres.",
        "ranks": [
            {
                "skill": {
                    "id": 130
                },
                "level": 1,
                "name": null,
                "description": "D\u00e9courage les monstres de vous attaquer m\u00eame s'ils vous rep\u00e8rent.",
                "setPiecesRequired": null,
                "id": 341
            },
            {
                "skill": {
                    "id": 130
                },
                "level": 2,
                "name": null,
                "description": "D\u00e9courage grandement les monstres de vous attaquer m\u00eame s'ils vous rep\u00e8rent.",
                "setPiecesRequired": null,
                "id": 342
            },
            {
                "skill": {
                    "id": 130
                },
                "level": 3,
                "name": null,
                "description": "Emp\u00eache les monstres de vous attaquer m\u00eame s'ils vous rep\u00e8rent.",
                "setPiecesRequired": null,
                "id": 343
            }
        ],
        "icon": {
            "id": 10,
            "kind": "utility"
        },
        "id": 130,
        "gameId": 1472632704
    },
    {
        "name": "\u00c2me du seigneur",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 131
                },
                "level": 1,
                "name": "Bravoure (T\u00e9nacit\u00e9)",
                "description": "Augmente l'attaque, r\u00e9duit la d\u00e9fense et permet de survivre \u00e0 un coup fatal, puis augmente d\u00e9fense et r\u00e9sistance.",
                "setPiecesRequired": 3,
                "id": 344
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 131,
        "gameId": 1484575872
    },
    {
        "name": "Ma\u00eetrise des \u00e9cailles",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 132
                },
                "level": 1,
                "name": "Ma\u00eetre-cavalier",
                "description": "Permet de monter et de blesser les monstres plus facilement.",
                "setPiecesRequired": 3,
                "id": 345
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 132,
        "gameId": 1487598336
    },
    {
        "name": "Absorption \u00e9l\u00e9mentaire",
        "kind": "armor",
        "description": "En subissant des d\u00e9g\u00e2ts \u00e9l\u00e9mentaires, conf\u00e8re temporairement des effets \u00e9l\u00e9mentaires. (Temps de rechargement apr\u00e8s activation.)",
        "ranks": [
            {
                "skill": {
                    "id": 133
                },
                "level": 1,
                "name": null,
                "description": "Lorsqu'il est actif, augmente l\u00e9g\u00e8rement l'attaque \u00e9l\u00e9mentaire. R\u00e9sistance \u00e0 l'\u00e9l\u00e9ment subi \u00e0 l'activation : +4.",
                "setPiecesRequired": null,
                "id": 346
            },
            {
                "skill": {
                    "id": 133
                },
                "level": 2,
                "name": null,
                "description": "Lorsqu'il est actif, augmente mod\u00e9r\u00e9ment l'attaque \u00e9l\u00e9mentaire. R\u00e9sistance \u00e0 l'\u00e9l\u00e9ment subi \u00e0 l'activation : +6",
                "setPiecesRequired": null,
                "id": 347
            },
            {
                "skill": {
                    "id": 133
                },
                "level": 3,
                "name": null,
                "description": "Lorsqu'il est actif, augmente l'attaque \u00e9l\u00e9mentaire. R\u00e9sistance \u00e0 l'\u00e9l\u00e9ment subi \u00e0 l'activation : +8",
                "setPiecesRequired": null,
                "id": 348
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 133,
        "gameId": 1489568384
    },
    {
        "name": "Acier tremp\u00e9",
        "kind": "weapon",
        "description": "Le tranchant de l'arme ne diminue pas pendant un certain temps apr\u00e8s l'aff\u00fbtage.",
        "ranks": [
            {
                "skill": {
                    "id": 134
                },
                "level": 1,
                "name": null,
                "description": "Annule la perte de tranchant pendant 30 s apr\u00e8s activation.",
                "setPiecesRequired": null,
                "id": 349
            },
            {
                "skill": {
                    "id": 134
                },
                "level": 2,
                "name": null,
                "description": "Annule la perte de tranchant pendant 60 s apr\u00e8s activation.",
                "setPiecesRequired": null,
                "id": 350
            },
            {
                "skill": {
                    "id": 134
                },
                "level": 3,
                "name": null,
                "description": "Annule la perte de tranchant pendant 90 s apr\u00e8s activation.",
                "setPiecesRequired": null,
                "id": 351
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 134,
        "gameId": 1500129152
    },
    {
        "name": "Peau de fer",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance aux effets de D\u00e9fense r\u00e9duite.",
        "ranks": [
            {
                "skill": {
                    "id": 135
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit la dur\u00e9e des effets de D\u00e9fense r\u00e9duite de 50 %.",
                "setPiecesRequired": null,
                "id": 352
            },
            {
                "skill": {
                    "id": 135
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9duit la dur\u00e9e des effets de D\u00e9fense r\u00e9duite de 75 %.",
                "setPiecesRequired": null,
                "id": 353
            },
            {
                "skill": {
                    "id": 135
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge des effets de D\u00e9fense r\u00e9duite.",
                "setPiecesRequired": null,
                "id": 354
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 135,
        "gameId": 1522518528
    },
    {
        "name": "\u0152il de l'esprit",
        "kind": "weapon",
        "description": "Vos attaques sont moins d\u00e9vi\u00e9es et sont plus puissantes contre les parties dures des monstres.",
        "ranks": [
            {
                "skill": {
                    "id": 136
                },
                "level": 1,
                "name": null,
                "description": "50 % de chances d'emp\u00eacher vos attaques d'\u00eatre d\u00e9vi\u00e9es, attaque +10 % sur les cibles dures.",
                "setPiecesRequired": null,
                "id": 355
            },
            {
                "skill": {
                    "id": 136
                },
                "level": 2,
                "name": null,
                "description": "100 % de chances d'emp\u00eacher vos attaques d'\u00eatre d\u00e9vi\u00e9es, attaque +15 % sur les cibles dures.",
                "setPiecesRequired": null,
                "id": 356
            },
            {
                "skill": {
                    "id": 136
                },
                "level": 3,
                "name": null,
                "description": "100 % de chances d'emp\u00eacher vos attaques d'\u00eatre d\u00e9vi\u00e9es, attaque +30 % sur les cibles dures.",
                "setPiecesRequired": null,
                "id": 357
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 136,
        "gameId": 1594792704
    },
    {
        "name": "Quatri\u00e8me tir",
        "kind": "weapon",
        "description": "Augmente l'affinit\u00e9 des munitions (fusarbal\u00e8te) et fioles (arc) d\u00e8s le 4e tir et l'attaque pour les 4e et 6e tirs.",
        "ranks": [
            {
                "skill": {
                    "id": 137
                },
                "level": 1,
                "name": null,
                "description": "Augmente l\u00e9g\u00e8rement la puissance d'attaque et l'affinit\u00e9 des munitions sous certaines conditions.",
                "setPiecesRequired": null,
                "id": 358
            },
            {
                "skill": {
                    "id": 137
                },
                "level": 2,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la puissance d'attaque et l'affinit\u00e9 des munitions sous certaines conditions.",
                "setPiecesRequired": null,
                "id": 359
            },
            {
                "skill": {
                    "id": 137
                },
                "level": 3,
                "name": null,
                "description": "Augmente la puissance d'attaque et l'affinit\u00e9 des munitions sous certaines conditions.",
                "setPiecesRequired": null,
                "id": 360
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 137,
        "gameId": 1613139840
    },
    {
        "name": "Auto-am\u00e9lioration",
        "kind": "armor",
        "description": "Augmente progressivement l'attaque et la d\u00e9fense pendant une qu\u00eate. (N'augmente plus apr\u00e8s 30 minutes.)",
        "ranks": [
            {
                "skill": {
                    "id": 138
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 361
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 138,
        "gameId": 1639440000
    },
    {
        "name": "Camouflage Neopteron",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 139
                },
                "level": 1,
                "name": "Pas de loup",
                "description": "Augmente la vitesse de d\u00e9placement en position accroupie. Les monstres vous rep\u00e8rent moins facilement.",
                "setPiecesRequired": 3,
                "id": 362
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 139,
        "gameId": 1685697920
    },
    {
        "name": "Premier tir",
        "kind": "weapon",
        "description": "Augmente la vitesse de rechargement du fusarbal\u00e8te et la puissance des balles quand il est charg\u00e9.",
        "ranks": [
            {
                "skill": {
                    "id": 140
                },
                "level": 1,
                "name": null,
                "description": "Augmente mod\u00e9r\u00e9ment la vitesse de rech. du fusarbal\u00e8te et la puissance du tir si les conditions sont remplies.",
                "setPiecesRequired": null,
                "id": 363
            },
            {
                "skill": {
                    "id": 140
                },
                "level": 2,
                "name": null,
                "description": "Augmente la vitesse de rechargement du fusarbal\u00e8te et la puissance du tir si les conditions sont remplies.",
                "setPiecesRequired": null,
                "id": 364
            },
            {
                "skill": {
                    "id": 140
                },
                "level": 3,
                "name": null,
                "description": "Augmente grandement la vitesse de rech. du fusarbal\u00e8te et la puissance du tir si les conditions sont remplies.",
                "setPiecesRequired": null,
                "id": 365
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 140,
        "gameId": 1711950720
    },
    {
        "name": "Vol d'endurance",
        "kind": "weapon",
        "description": "Augmente la capacit\u00e9 de certaines attaques \u00e0 infliger l'affliction l\u00e9thargie aux monstres.",
        "ranks": [
            {
                "skill": {
                    "id": 141
                },
                "level": 1,
                "name": null,
                "description": "Drain d'endurance +20 %",
                "setPiecesRequired": null,
                "id": 366
            },
            {
                "skill": {
                    "id": 141
                },
                "level": 2,
                "name": null,
                "description": "Drain d'endurance +30 %",
                "setPiecesRequired": null,
                "id": 367
            },
            {
                "skill": {
                    "id": 141
                },
                "level": 3,
                "name": null,
                "description": "Drain d'endurance +40 %",
                "setPiecesRequired": null,
                "id": 368
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 141,
        "gameId": 1758661504
    },
    {
        "name": "Force latente",
        "kind": "armor",
        "description": "Augmente temporairement l'affinit\u00e9 et r\u00e9duit la perte d'endurance dans certaines conditions.",
        "ranks": [
            {
                "skill": {
                    "id": 142
                },
                "level": 1,
                "name": null,
                "description": "Affinit\u00e9 +10 % Perte d'endurance -30 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 369
            },
            {
                "skill": {
                    "id": 142
                },
                "level": 2,
                "name": null,
                "description": "Affinit\u00e9 +20 % Perte d'endurance -30 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 370
            },
            {
                "skill": {
                    "id": 142
                },
                "level": 3,
                "name": null,
                "description": "Affinit\u00e9 +30 % Perte d'endurance -50 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 371
            },
            {
                "skill": {
                    "id": 142
                },
                "level": 4,
                "name": null,
                "description": "Affinit\u00e9 +40 % Perte d'endurance -50 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 372
            },
            {
                "skill": {
                    "id": 142
                },
                "level": 5,
                "name": null,
                "description": "Affinit\u00e9 +50 % Perte d'endurance -50 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 373
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 142,
        "gameId": 1763191040
    },
    {
        "name": "Art de la chasse",
        "kind": "armor",
        "description": "Am\u00e9liore la p\u00eache, le gril et les capacit\u00e9s de d\u00e9placement.",
        "ranks": [
            {
                "skill": {
                    "id": 143
                },
                "level": 1,
                "name": null,
                "description": "Am\u00e9liore la p\u00eache, la cuisson au gril et les capacit\u00e9s de transport.",
                "setPiecesRequired": null,
                "id": 374
            }
        ],
        "icon": {
            "id": 12,
            "kind": "gathering"
        },
        "id": 143,
        "gameId": 1845834112
    },
    {
        "name": "T\u00e9m\u00e9rit\u00e9",
        "kind": "armor",
        "description": "Augmente l'attaque et l'affinit\u00e9 lorsque les grands monstres sont enrag\u00e9s.",
        "ranks": [
            {
                "skill": {
                    "id": 144
                },
                "level": 1,
                "name": null,
                "description": "Attaque +4 et affinit\u00e9 +3 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 375
            },
            {
                "skill": {
                    "id": 144
                },
                "level": 2,
                "name": null,
                "description": "Attaque +8 et affinit\u00e9 +5 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 376
            },
            {
                "skill": {
                    "id": 144
                },
                "level": 3,
                "name": null,
                "description": "Attaque +12 et affinit\u00e9 +7 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 377
            },
            {
                "skill": {
                    "id": 144
                },
                "level": 4,
                "name": null,
                "description": "Attaque +16 et affinit\u00e9 +10 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 378
            },
            {
                "skill": {
                    "id": 144
                },
                "level": 5,
                "name": null,
                "description": "Attaque +20 et affinit\u00e9 +15 % lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 379
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 144,
        "gameId": 1865909632
    },
    {
        "name": "Esprit Palico",
        "kind": "armor",
        "description": "Augmente l'attaque et la d\u00e9fense du Palico.",
        "ranks": [
            {
                "skill": {
                    "id": 145
                },
                "level": 1,
                "name": null,
                "description": "Augmente l'attaque et la d\u00e9fense du Palico de 5 %.",
                "setPiecesRequired": null,
                "id": 380
            },
            {
                "skill": {
                    "id": 145
                },
                "level": 2,
                "name": null,
                "description": "Augmente l'attaque et la d\u00e9fense du Palico de 10 %.",
                "setPiecesRequired": null,
                "id": 381
            },
            {
                "skill": {
                    "id": 145
                },
                "level": 3,
                "name": null,
                "description": "Augmente l'attaque et la d\u00e9fense du Palico de 15 %.",
                "setPiecesRequired": null,
                "id": 382
            },
            {
                "skill": {
                    "id": 145
                },
                "level": 4,
                "name": null,
                "description": "Augmente l'attaque et la d\u00e9fense du Palico de 20 %.",
                "setPiecesRequired": null,
                "id": 383
            },
            {
                "skill": {
                    "id": 145
                },
                "level": 5,
                "name": null,
                "description": "Augmente l'attaque et la d\u00e9fense du Palico de 25 %.",
                "setPiecesRequired": null,
                "id": 384
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 145,
        "gameId": 1934955136
    },
    {
        "name": "Antih\u00e9morragie",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance \u00e0 l'h\u00e9morragie.",
        "ranks": [
            {
                "skill": {
                    "id": 146
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9duit les d\u00e9g\u00e2ts subis en cas d'h\u00e9morragie.",
                "setPiecesRequired": null,
                "id": 385
            },
            {
                "skill": {
                    "id": 146
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9duit grandement les d\u00e9g\u00e2ts subis en cas d'h\u00e9morragie.",
                "setPiecesRequired": null,
                "id": 386
            },
            {
                "skill": {
                    "id": 146
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge des h\u00e9morragies.",
                "setPiecesRequired": null,
                "id": 387
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 146,
        "gameId": 1940820864
    },
    {
        "name": "Anti-immobilisation",
        "kind": "armor",
        "description": "Conf\u00e8re une r\u00e9sistance \u00e0 l'\u00e9tat Toile et au fl\u00e9au-givre.",
        "ranks": [
            {
                "skill": {
                    "id": 147
                },
                "level": 1,
                "name": null,
                "description": "Permet de vous d\u00e9barrasser rapidement de l'\u00e9tat Toile et du fl\u00e9au-givre.",
                "setPiecesRequired": null,
                "id": 388
            },
            {
                "skill": {
                    "id": 147
                },
                "level": 2,
                "name": null,
                "description": "Permet de vous d\u00e9barrasser tr\u00e8s rapidement de l'\u00e9tat Toile et du fl\u00e9au-givre.",
                "setPiecesRequired": null,
                "id": 389
            },
            {
                "skill": {
                    "id": 147
                },
                "level": 3,
                "name": null,
                "description": "Prot\u00e8ge de l'\u00e9tat Toile et du fl\u00e9au-givre.",
                "setPiecesRequired": null,
                "id": 390
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 147,
        "gameId": 1966172160
    },
    {
        "name": "Alerte Neopteron",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 148
                },
                "level": 1,
                "name": "Amoureux du miel",
                "description": "Augmente la quantit\u00e9 de miel obtenu aux points de collecte.",
                "setPiecesRequired": 3,
                "id": 391
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 148,
        "gameId": 1968728576
    },
    {
        "name": "Mutinerie du Nu Udra",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 149
                },
                "level": 1,
                "name": "Mauvais sang I",
                "description": "Inflige une quantit\u00e9 mod\u00e9r\u00e9e de d\u00e9g\u00e2ts suppl\u00e9mentaires quand le talent Vengeance est actif.",
                "setPiecesRequired": 2,
                "id": 392
            },
            {
                "skill": {
                    "id": 149
                },
                "level": 2,
                "name": "Mauvais sang II",
                "description": "Inflige des d\u00e9g\u00e2ts suppl\u00e9mentaires quand le talent Vengeance est actif.",
                "setPiecesRequired": 4,
                "id": 393
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 149,
        "gameId": 1980404096
    },
    {
        "name": "Pelage de renforcement",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 150
                },
                "level": 1,
                "name": "Jamais vaincu",
                "description": "Augmente l'attaque et la d\u00e9fense apr\u00e8s un \u00e9vanouissement pendant une qu\u00eate. *Deux fois max.",
                "setPiecesRequired": 3,
                "id": 394
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 150,
        "gameId": 1998066176
    },
    {
        "name": "Coupe-faim",
        "kind": "armor",
        "description": "R\u00e9duit la perte d'endurance maximum au fil du temps.",
        "ranks": [
            {
                "skill": {
                    "id": 151
                },
                "level": 1,
                "name": null,
                "description": "Augmente de 50 % le d\u00e9lai jusqu'\u00e0 la r\u00e9duction de votre endurance maximum.",
                "setPiecesRequired": null,
                "id": 395
            },
            {
                "skill": {
                    "id": 151
                },
                "level": 2,
                "name": null,
                "description": "Augmente de 100 % le d\u00e9lai jusqu'\u00e0 la r\u00e9duction de votre endurance maximum.",
                "setPiecesRequired": null,
                "id": 396
            },
            {
                "skill": {
                    "id": 151
                },
                "level": 3,
                "name": null,
                "description": "Emp\u00eache la r\u00e9duction de l'endurance maximum.",
                "setPiecesRequired": null,
                "id": 397
            }
        ],
        "icon": {
            "id": 8,
            "kind": "stamina"
        },
        "id": 151,
        "gameId": 2045149568
    },
    {
        "name": "Conversion \u00e9l\u00e9mentaire",
        "kind": "armor",
        "description": "En subissant des d\u00e9g\u00e2ts \u00e9l\u00e9mentaires, conf\u00e8re temporairement des effets de l'\u00e9l\u00e9ment dragon. (Temps de rechargement apr\u00e8s activation.)",
        "ranks": [
            {
                "skill": {
                    "id": 152
                },
                "level": 1,
                "name": null,
                "description": "Inflige des d\u00e9g\u00e2ts dragon additionnels en accumulant les d\u00e9g\u00e2ts \u00e9l\u00e9mentaires. Augmente l\u00e9g\u00e8rement l'attaque dragon.",
                "setPiecesRequired": null,
                "id": 398
            },
            {
                "skill": {
                    "id": 152
                },
                "level": 2,
                "name": null,
                "description": "Augmente les d\u00e9g\u00e2ts draconiques additionnels et l'attaque dragon.",
                "setPiecesRequired": null,
                "id": 399
            },
            {
                "skill": {
                    "id": 152
                },
                "level": 3,
                "name": null,
                "description": "Augmente encore plus les d\u00e9g\u00e2ts draconiques additionnels et augmente grandement l'attaque dragon.",
                "setPiecesRequired": null,
                "id": 400
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 152,
        "gameId": 2083363072
    },
    {
        "name": "Couverture de l'Uth Duna",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 153
                },
                "level": 1,
                "name": "Voile protecteur I",
                "description": "Augmente temporairement la d\u00e9fense quand vous utilisez un outil de survie.",
                "setPiecesRequired": 2,
                "id": 401
            },
            {
                "skill": {
                    "id": 153
                },
                "level": 2,
                "name": "Voile protecteur II",
                "description": "Augmente grandement la d\u00e9fense et la r\u00e9sistance temporairement quand vous utilisez un outil de survie.",
                "setPiecesRequired": 4,
                "id": 402
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 153,
        "gameId": 2104075392
    },
    {
        "name": "Performance optimale",
        "kind": "armor",
        "description": "Augmente l'attaque quand votre vie est \u00e0 son maximum.",
        "ranks": [
            {
                "skill": {
                    "id": 154
                },
                "level": 1,
                "name": null,
                "description": "Attaque +3 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 403
            },
            {
                "skill": {
                    "id": 154
                },
                "level": 2,
                "name": null,
                "description": "Attaque +6 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 404
            },
            {
                "skill": {
                    "id": 154
                },
                "level": 3,
                "name": null,
                "description": "Attaque +10 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 405
            },
            {
                "skill": {
                    "id": 154
                },
                "level": 4,
                "name": null,
                "description": "Attaque +15 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 406
            },
            {
                "skill": {
                    "id": 154
                },
                "level": 5,
                "name": null,
                "description": "Attaque +20 lorsqu'il est actif.",
                "setPiecesRequired": null,
                "id": 407
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 154,
        "gameId": 2106877312
    },
    {
        "name": "Rage sup\u00e9rieure",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 155
                },
                "level": 1,
                "name": "Esprit indomptable",
                "description": "Augmente l'attaque quand vous \u00eates victime d'une affliction.",
                "setPiecesRequired": 3,
                "id": 408
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 155,
        "gameId": 2107855744
    },
    {
        "name": "Paratonnerre",
        "kind": "armor",
        "description": "Augmente la protection contre les attaques \u00e9l\u00e9mentaires foudre puis les attaques physiques.",
        "ranks": [
            {
                "skill": {
                    "id": 156
                },
                "level": 1,
                "name": null,
                "description": "R\u00e9sistance Foudre +6",
                "setPiecesRequired": null,
                "id": 409
            },
            {
                "skill": {
                    "id": 156
                },
                "level": 2,
                "name": null,
                "description": "R\u00e9sistance Foudre +12",
                "setPiecesRequired": null,
                "id": 410
            },
            {
                "skill": {
                    "id": 156
                },
                "level": 3,
                "name": null,
                "description": "R\u00e9sistance Foudre +20 D\u00e9fense +10",
                "setPiecesRequired": null,
                "id": 411
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 156,
        "gameId": 2143068800
    },
    {
        "name": "Le Ma\u00eetre du poing",
        "kind": "group",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 157
                },
                "level": 1,
                "name": "Satsui no Hado",
                "description": "Actions sp\u00e9ciales renforc\u00e9es. Les Drive Impacts peuvent neutraliser. Apr\u00e8s une Neutralisation, augmente la puissance.",
                "setPiecesRequired": 3,
                "id": 412
            }
        ],
        "icon": {
            "id": 13,
            "kind": "group"
        },
        "id": 157,
        "gameId": 4554
    },
    {
        "name": "Onigiri",
        "kind": "armor",
        "description": "Augmente la puissance des actions et des d\u00e9g\u00e2ts d'\u00e9tourdissement d'Akuma.",
        "ranks": [
            {
                "skill": {
                    "id": 158
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 413
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 158,
        "gameId": 10503
    },
    {
        "name": "Ma\u00efs cr\u00e9pitant",
        "kind": "weapon",
        "description": "Augmente la puissance de tir et les attaques de feu lorsque l'arme est en surchauffe.",
        "ranks": [
            {
                "skill": {
                    "id": 159
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 414
            }
        ],
        "icon": {
            "id": 9,
            "kind": "offense"
        },
        "id": 159,
        "gameId": 1826
    },
    {
        "name": "Chargement lam\u00e9caille",
        "kind": "weapon",
        "description": "Esquiver de justesse une attaque quand l'arme est d\u00e9gain\u00e9e conf\u00e8re des munitions/fioles sp\u00e9ciales.",
        "ranks": [
            {
                "skill": {
                    "id": 160
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 415
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 160,
        "gameId": 3504
    },
    {
        "name": "Pri\u00e8re F\u00eate des flammes",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 161
                },
                "level": 1,
                "name": "B\u00e9n\u00e9diction des flammes I",
                "description": "Pendant F\u00eate des flammes, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses. (Hors qu\u00eate rejointe en cours de route.)",
                "setPiecesRequired": 2,
                "id": 416
            },
            {
                "skill": {
                    "id": 161
                },
                "level": 2,
                "name": "B\u00e9n\u00e9diction des flammes II",
                "description": "Pendant F\u00eate des flammes, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses de qu\u00eate. Augmente attaque et d\u00e9fense.",
                "setPiecesRequired": 4,
                "id": 417
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 161,
        "gameId": 8694
    },
    {
        "name": "Furie du L\u00e9viathan",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 162
                },
                "level": 1,
                "name": "Fl\u00e8che d'azur I",
                "description": "Augmente temporairement l'affinit\u00e9. Infligez assez de d\u00e9g\u00e2ts pour un bonus de d\u00e9g\u00e2ts de foudre. (Sauf certaines attaques.)",
                "setPiecesRequired": 2,
                "id": 418
            },
            {
                "skill": {
                    "id": 162
                },
                "level": 2,
                "name": "Fl\u00e8che d'azur II",
                "description": "Augmente davantage le bonus de d\u00e9g\u00e2ts de foudre et prolonge mod\u00e9r\u00e9ment la dur\u00e9e d'augmentation de l'affinit\u00e9.",
                "setPiecesRequired": 4,
                "id": 419
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 162,
        "gameId": 16835
    },
    {
        "name": "Aiguisage lam\u00e9caille",
        "kind": "weapon",
        "description": "Esquiver de justesse une attaque quand l'arme est d\u00e9gain\u00e9e conf\u00e8re un tranchant sp\u00e9cial.",
        "ranks": [
            {
                "skill": {
                    "id": 163
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 420
            }
        ],
        "icon": {
            "id": 4,
            "kind": "handicraft"
        },
        "id": 163,
        "gameId": 25070
    },
    {
        "name": "Pierre de pouvoir",
        "kind": "weapon",
        "description": "Augmente temporairement l'attaque lorsque vous obtenez du minerai.",
        "ranks": [
            {
                "skill": {
                    "id": 164
                },
                "level": 1,
                "name": null,
                "description": "Extraire des mat\u00e9riaux tr\u00e8s rares augmente grandement l'attaque (jusqu'\u00e0 une certaine limite).",
                "setPiecesRequired": null,
                "id": 421
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 164,
        "gameId": 28385
    },
    {
        "name": "Conversion r\u00e9sistance foudre",
        "kind": "weapon",
        "description": "Augmente l'attaque \u00e9l\u00e9mentaire de votre arme proportionnellement \u00e0 votre r\u00e9sistance \u00e0 la foudre.",
        "ranks": [
            {
                "skill": {
                    "id": 165
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 422
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 165,
        "gameId": 30201
    },
    {
        "name": "Rechargement fugitif",
        "kind": "weapon",
        "description": "Esquiver recharge automatiquement les munitions actuellement s\u00e9lectionn\u00e9es.",
        "ranks": [
            {
                "skill": {
                    "id": 166
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 423
            }
        ],
        "icon": {
            "id": 5,
            "kind": "ranged"
        },
        "id": 166,
        "gameId": 30828
    },
    {
        "name": "T\u00e9nacit\u00e9 du Seregios",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 167
                },
                "level": 1,
                "name": "Fil du rasoir I",
                "description": "Prolonge Pouss\u00e9e d'adr\u00e9naline. Prolonge l'effet une fois en cas de r\u00e9activation alors que le talent est actif.",
                "setPiecesRequired": 2,
                "id": 424
            },
            {
                "skill": {
                    "id": 167
                },
                "level": 2,
                "name": "Fil du rasoir II",
                "description": "Augmente \u00e9galement l'attaque en cas de r\u00e9activation alors que le talent est actif.",
                "setPiecesRequired": 4,
                "id": 425
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 167,
        "gameId": 30992
    },
    {
        "name": "T\u00e9n\u00e8bres int\u00e9rieures",
        "kind": "weapon",
        "description": "Effectuer certaines attaques charg\u00e9es de nv 2 ou plus vous inflige des d\u00e9g\u00e2ts. L'attaque augmente temporairement.",
        "ranks": [
            {
                "skill": {
                    "id": 168
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet. (N\u00e9cessite un temps de rechargement, mais les attaques charg\u00e9es vous infligent toujours des d\u00e9g\u00e2ts.)",
                "setPiecesRequired": null,
                "id": 426
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 168,
        "gameId": 3813
    },
    {
        "name": "Bouclier optionnel",
        "kind": "weapon",
        "description": "Augmente temporairement votre d\u00e9fense et celle des personnes \u00e0 proximit\u00e9 apr\u00e8s une Garde parfaite r\u00e9ussie.",
        "ranks": [
            {
                "skill": {
                    "id": 169
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 427
            }
        ],
        "icon": {
            "id": 6,
            "kind": "defense"
        },
        "id": 169,
        "gameId": 7506
    },
    {
        "name": "Pri\u00e8re Veill\u00e9e des r\u00eaves",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 170
                },
                "level": 1,
                "name": "B\u00e9n\u00e9diction des r\u00eaves I",
                "description": "Pendant Veill\u00e9e des r\u00eaves, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses. (Hors qu\u00eate rejointe en cours de route.)",
                "setPiecesRequired": 2,
                "id": 428
            },
            {
                "skill": {
                    "id": 170
                },
                "level": 2,
                "name": "B\u00e9n\u00e9diction des r\u00eaves II",
                "description": "Pendant Veill\u00e9e des r\u00eaves, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses de qu\u00eate. Augmente attaque et d\u00e9fense.",
                "setPiecesRequired": 4,
                "id": 429
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 170,
        "gameId": 11709
    },
    {
        "name": "Chef BBQ",
        "kind": "weapon",
        "description": "Grillez de la viande pour aiguiser votre arme et augmenter votre attaque. (Dur\u00e9e et effet varient selon le r\u00e9sultat).",
        "ranks": [
            {
                "skill": {
                    "id": 171
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 430
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 171,
        "gameId": 16931
    },
    {
        "name": "Cristal de chevalier noir",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 172
                },
                "level": 1,
                "name": "Arts t\u00e9n\u00e9breux",
                "description": "Subir des d\u00e9g\u00e2ts temporaires augmente l'att. \u00e9l\u00e9mentaire, et certaines attaques charg\u00e9es (nv 3) de la grande \u00e9p\u00e9e sont renforc\u00e9es.",
                "setPiecesRequired": 2,
                "id": 431
            },
            {
                "skill": {
                    "id": 172
                },
                "level": 2,
                "name": "Nuit noirissime",
                "description": "Vous permet d'effectuer l'action sp\u00e9ciale : Nuit noirissime.",
                "setPiecesRequired": 4,
                "id": 432
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 172,
        "gameId": 24531
    },
    {
        "name": "R\u00e9sonance Om\u00e9ga",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 173
                },
                "level": 1,
                "name": "R\u00e9sonance I",
                "description": "(Au d\u00e9but de la qu\u00eate) R\u00e9sonance proche et R\u00e9sonance \u00e9loign\u00e9e alternent, augmentant l'attaque ou l'affinit\u00e9 lorsque les conditions sont remplies.",
                "setPiecesRequired": 2,
                "id": 433
            },
            {
                "skill": {
                    "id": 173
                },
                "level": 2,
                "name": "R\u00e9sonance II",
                "description": "Augmente l'effet de R\u00e9sonance I, du talent d'arme Bouclier synth\u00e9tique ou de Programme synergique.",
                "setPiecesRequired": 4,
                "id": 434
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 173,
        "gameId": 31540
    },
    {
        "name": "Programme synergique",
        "kind": "weapon",
        "description": "Augmente temporairement votre affinit\u00e9 et celle des personnes \u00e0 proximit\u00e9 apr\u00e8s un Cyclone mortel montant.",
        "ranks": [
            {
                "skill": {
                    "id": 174
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 435
            }
        ],
        "icon": {
            "id": 2,
            "kind": "affinity"
        },
        "id": 174,
        "gameId": 31998
    },
    {
        "name": "Gogmapocalypse",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 178
                },
                "level": 1,
                "name": "Hostilit\u00e9 mutuelle I",
                "description": "Augmente l'attaque \u00e9l\u00e9mentaire lorsque les grands monstres sont enrag\u00e9s.",
                "setPiecesRequired": 2,
                "id": 441
            },
            {
                "skill": {
                    "id": 178
                },
                "level": 2,
                "name": "Hostilit\u00e9 mutuelle II",
                "description": "L'effet du niveau I augmente et vous gagnez une barri\u00e8re temporaire qui se r\u00e9active apr\u00e8s le temps de recharge.",
                "setPiecesRequired": 4,
                "id": 442
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 178,
        "gameId": 5590
    },
    {
        "name": "Chat voleur",
        "kind": "weapon",
        "description": "Octroie une faible chance d'obtenir divers objets en cas de coup critique r\u00e9ussi.",
        "ranks": [
            {
                "skill": {
                    "id": 179
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 443
            }
        ],
        "icon": {
            "id": 12,
            "kind": "gathering"
        },
        "id": 179,
        "gameId": 30554
    },
    {
        "name": "Pri\u00e8re Chant des lumi\u00e8res",
        "kind": "set",
        "description": null,
        "ranks": [
            {
                "skill": {
                    "id": 180
                },
                "level": 1,
                "name": "B\u00e9n\u00e9diction des lumi\u00e8res I",
                "description": "Pendant Chant des lumi\u00e8res, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses. (Hors qu\u00eate rejointe en cours de route.)",
                "setPiecesRequired": 2,
                "id": 444
            },
            {
                "skill": {
                    "id": 180
                },
                "level": 2,
                "name": "B\u00e9n\u00e9diction des lumi\u00e8res II",
                "description": "Pendant Chant des lumi\u00e8res, ajoute des objets sp\u00e9ciaux aux r\u00e9compenses de qu\u00eate. Augmente attaque et d\u00e9fense.",
                "setPiecesRequired": 4,
                "id": 445
            }
        ],
        "icon": {
            "id": 14,
            "kind": "set"
        },
        "id": 180,
        "gameId": 30815
    },
    {
        "name": "Conversion r\u00e9sistance eau",
        "kind": "weapon",
        "description": "Augmente l'attaque \u00e9l\u00e9mentaire de votre arme proportionnellement \u00e0 votre r\u00e9sistance \u00e0 l'eau.",
        "ranks": [
            {
                "skill": {
                    "id": 181
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 446
            }
        ],
        "icon": {
            "id": 3,
            "kind": "element"
        },
        "id": 181,
        "gameId": 11481
    },
    {
        "name": "Reflet \u00e9parpill\u00e9",
        "kind": "weapon",
        "description": "Les attaques charg\u00e9es de niveau 3 infligent des d\u00e9g\u00e2ts de zone lorsqu'elles touchent le sol.",
        "ranks": [
            {
                "skill": {
                    "id": 182
                },
                "level": 1,
                "name": null,
                "description": "Active l'effet.",
                "setPiecesRequired": null,
                "id": 447
            }
        ],
        "icon": {
            "id": 1,
            "kind": "attack"
        },
        "id": 182,
        "gameId": 12877
    }
]

---

FILE : main/descriptions_uniques.txt

(Au début de la quête) Résonance proche et Résonance éloignée alternent, augmentant l'attaque ou l'affinité lorsque les conditions sont remplies.
10 % de chances d'annuler la perte de tranchant.
100 % de chances d'empêcher vos attaques d'être déviées, attaque +15 % sur les cibles dures.
100 % de chances d'empêcher vos attaques d'être déviées, attaque +30 % sur les cibles dures.
25 % de chances d'annuler la perte de tranchant.
50 % de chances d'annuler la perte de tranchant.
50 % de chances d'empêcher vos attaques d'être déviées, attaque +10 % sur les cibles dures.
80 % de chances d'annuler la perte de tranchant lorsqu'il est actif.
Accumulation explosion +10 % Accumulation explosion +20
Accumulation explosion +20 % Accumulation explosion +50
Accumulation explosion +5 % Accumulation explosion +10
Accumulation paralysie +10 % Accumulation paralysie +20
Accumulation paralysie +20 % Accumulation paralysie +50
Accumulation paralysie +5 % Accumulation paralysie +10
Accumulation poison +10 % Accumulation poison +20
Accumulation poison +20 % Accumulation poison +50
Accumulation poison +5 % Accumulation poison +10
Accumulation sommeil +10 % Accumulation sommeil +20
Accumulation sommeil +20 % Accumulation sommeil +50
Accumulation sommeil +5 % Accumulation sommeil +10
Accélère grandement la guérison après avoir contracté la Furie. Augmente ensuite l'affinité de 10 %.
Accélère la guérison après avoir contracté la Furie. Augmente ensuite l'affinité de 6 %.
Accélère la récupération d'endurance et de la jauge rouge près des cristaux de wylait.
Accélère le rechargement (obus/fioles). Capacité lancecanon +1. Volto-hache : 5 fioles (jauge jaune).
Accélère le rechargement des obus et des fioles.
Accélère légèrement la guérison après avoir contracté la Furie. Augmente ensuite l'affinité de 3 %.
Actions spéciales renforcées. Les Drive Impacts peuvent neutraliser. Après une Neutralisation, augmente la puissance.
Active l'effet.
Active l'effet. (Ne se cumule pas avec Carbonisateur, mais inflige des dégâts de feu supplémentaires.)
Active l'effet. (Nécessite un temps de rechargement, mais les attaques chargées vous infligent toujours des dégâts.)
Affinité +10 % Perte d'endurance -30 % lorsqu'il est actif.
Affinité +10 % lorsqu'il est actif.
Affinité +10 % pour les attaques qui touchent un point faible et bonus parties blessées de +5 %.
Affinité +100 %
Affinité +12 %
Affinité +15 % pour les attaques qui touchent un point faible et bonus parties blessées de +10 %.
Affinité +16 %
Affinité +20 %
Affinité +20 % Perte d'endurance -30 % lorsqu'il est actif.
Affinité +20 % lorsqu'il est actif.
Affinité +20 % pour les attaques qui touchent un point faible et bonus parties blessées de +15 %.
Affinité +3 % lorsque vous êtes mouillé et +7 % en cas de fléau-bulles.
Affinité +30 % Perte d'endurance -50 % lorsqu'il est actif.
Affinité +30 % lorsqu'il est actif.
Affinité +30 % pour les attaques qui touchent un point faible et bonus parties blessées de +20 %.
Affinité +4 %
Affinité +40 % Perte d'endurance -50 % lorsqu'il est actif.
Affinité +5 % pour les attaques qui touchent un point faible et bonus parties blessées de +3 %.
Affinité +50 %
Affinité +50 % Perte d'endurance -50 % lorsqu'il est actif.
Affinité +6 % lorsque vous êtes mouillé et +14 % en cas de fléau-bulles.
Affinité +75 %
Affinité +8 %
Affinité +9 % lorsque vous êtes mouillé et +21 % en cas de fléau-bulles.
Ajoute en plus un champignon par collecte.
Ajoute en plus un fruit, une noix ou une graine supplémentaire par collecte.
Ajoute en plus un insecte par collecte.
Ajoute en plus un objet supplémentaire depuis les gisements miniers.
Ajoute en plus un objet supplémentaire en collectant des objets spéciaux.
Améliore l'efficacité des attaques et objets flash.
Améliore la pêche, la cuisson au gril et les capacités de transport.
Annule aussi les effets des vagues.
Annule jusqu'aux petites secousses et réduit grandement les effets des grandes secousses.
Annule la perte de tranchant pendant 30 s après activation.
Annule la perte de tranchant pendant 60 s après activation.
Annule la perte de tranchant pendant 90 s après activation.
Annule les dégâts environnementaux.
Annule les effets des ruisseaux boueux et le ralentissement dans l'eau et la boue huileuse. Réduit le ralentissement par l'huile de dragon.
Annule les effets du froid et de la chaleur.
Annule les fléaux élémentaires.
Annule les petites bourrasques et réduit de moitié les effets des grandes bourrasques.
Annule les petites et grandes bourrasques et réduit de moitié les effets des bourrasques draconiques.
Annule les petits et grands rugissements.
Annule les petits rugissements et réduit les effets des grands rugissements.
Annule les repoussements durant les sauts.
Annule les très petites secousses et réduit de moitié les effets des petites secousses.
Annule toutes les bourrasques.
Annule toutes les secousses.
Attaque +10 % et défense physique +100 lorsqu'il est actif.
Attaque +10 % lorsqu'il est actif.
Attaque +10 et affinité +10 % contre les grands monstres empoisonnés ou paralysés.
Attaque +10 lorsqu'il est actif.
Attaque +12 et affinité +15 % contre les grands monstres empoisonnés ou paralysés.
Attaque +12 et affinité +7 % lorsqu'il est actif.
Attaque +15 % lorsqu'il est actif.
Attaque +15 et affinité +20 % contre les grands monstres empoisonnés ou paralysés.
Attaque +15 lorsqu'il est actif.
Attaque +15 lorsqu'il est actif. Augmente modérément la durée de l'effet.
Attaque +16 et affinité +10 % lorsqu'il est actif.
Attaque +2 % Attaque +8
Attaque +20 et affinité +15 % lorsqu'il est actif.
Attaque +20 lorsqu'il est actif.
Attaque +25 lorsqu'il est actif.
Attaque +25 lorsqu'il est actif. Augmente la durée de l'effet.
Attaque +3
Attaque +3 lorsqu'il est actif.
Attaque +30 % et bonus de défense annulés lorsqu'il est actif.
Attaque +30 lorsqu'il est actif.
Attaque +4 % Attaque +9
Attaque +4 et affinité +3 % lorsqu'il est actif.
Attaque +5
Attaque +5 % et défense physique +100 lorsqu'il est actif.
Attaque +5 % et défense physique +50 lorsqu'il est actif.
Attaque +5 % lorsqu'il est actif.
Attaque +5 lorsqu'il est actif.
Attaque +6 contre les grands monstres empoisonnés ou paralysés.
Attaque +6 lorsqu'il est actif.
Attaque +7
Attaque +8 et affinité +5 % contre les grands monstres empoisonnés ou paralysés.
Attaque +8 et affinité +5 % lorsqu'il est actif.
Attaque Dragon +10 % Attaque Dragon +50
Attaque Dragon +20 % Attaque Dragon +60
Attaque Dragon +40
Attaque Eau +10 % Attaque Eau +50
Attaque Eau +20 % Attaque Eau +60
Attaque Eau +40
Attaque Feu +10 % Attaque Feu +50
Attaque Feu +20 % Attaque Feu +60
Attaque Feu +40
Attaque Foudre +10 % Attaque Foudre +50
Attaque Foudre +20 % Attaque Foudre +60
Attaque Foudre +40
Attaque Glace +10 % Attaque Glace +50
Attaque Glace +20 % Attaque Glace +60
Attaque Glace +40
Attaques sautées +10 %
Attire davantage l'attention d'un monstre quand vous l'attaquez.
Augmente davantage le bonus de dégâts de foudre et prolonge modérément la durée d'augmentation de l'affinité.
Augmente de 100 % le délai jusqu'à la réduction de votre endurance maximum.
Augmente de 50 % le délai jusqu'à la réduction de votre endurance maximum.
Augmente encore la durée du talent Vendetta et confère Attaque +18 quand Vendetta est actif.
Augmente encore plus la durée des effets des mélodies.
Augmente encore plus les dégâts draconiques additionnels et augmente grandement l'attaque dragon.
Augmente grandement l'attaque à la fin de l'état Toile, du fléau-givre, d'une immobilisation ou d'un Duel de force.
Augmente grandement l'attaque élémentaire et les afflictions des attaques chargées.
Augmente grandement la distance d'esquive.
Augmente grandement la durée pendant laquelle les armes sont chargés.
Augmente grandement la défense et la résistance temporairement quand vous utilisez un outil de survie.
Augmente grandement la fenêtre d'invulnérabilité.
Augmente grandement la portée et améliore la puissance des attaques réalisées à bonne distance.
Augmente grandement la puissance des attaques et la vitesse du Feu de wyverne. Attaque feu du Bombardement +90.
Augmente grandement la récupération.
Augmente grandement la vitesse de rech. du fusarbalète et la puissance du tir si les conditions sont remplies.
Augmente grandement la vitesse de rengainage.
Augmente grandement la vitesse des repas.
Augmente grandement les afflictions infligées par des coups critiques.
Augmente grandement les dégâts élémentaires lorsqu'il est actif.
Augmente l'attaque et la défense après un évanouissement pendant une quête. *Deux fois max.
Augmente l'attaque et la défense du Palico de 10 %.
Augmente l'attaque et la défense du Palico de 15 %.
Augmente l'attaque et la défense du Palico de 20 %.
Augmente l'attaque et la défense du Palico de 25 %.
Augmente l'attaque et la défense du Palico de 5 %.
Augmente l'attaque quand vous êtes victime d'une affliction.
Augmente l'attaque à la fin de l'état Toile, du fléau-givre, d'une immobilisation ou d'un Duel de force.
Augmente l'attaque élémentaire et les afflictions des attaques chargées.
Augmente l'attaque élémentaire lorsque les grands monstres sont enragés.
Augmente l'attaque, réduit la défense et permet de survivre à un coup fatal, puis augmente défense et résistance.
Augmente l'effet de Résonance I, du talent d'arme Bouclier synthétique ou de Programme synergique.
Augmente la distance d'esquive.
Augmente la durée de Force latente.
Augmente la durée des effets des mélodies et les chances de récupérer plus de vie avec les mélodies de soin.
Augmente la durée du talent Vendetta et confère Attaque +8 quand Vendetta est actif. 
Augmente la durée pendant laquelle les armes sont chargées.
Augmente la fenêtre d'invulnérabilité.
Augmente la portée.
Augmente la puissance d'attaque et l'affinité des munitions sous certaines conditions.
Augmente la puissance des attaques et la vitesse du Feu de wyverne. Attaque feu du Bombardement +60.
Augmente la puissance des munitions et flèches indiquées.
Augmente la quantité de miel obtenu aux points de collecte.
Augmente la vitesse de collecte et empêche les attaques de vous repousser pendant la collecte ou le dépeçage.
Augmente la vitesse de déplacement en position accroupie. Les monstres vous repèrent moins facilement.
Augmente la vitesse de rechargement du fusarbalète et la puissance du tir si les conditions sont remplies.
Augmente la vitesse de rengainage.
Augmente la vitesse des repas.
Augmente le taux de remplissage de la jauge et réduit le temps de charge de 15 %.
Augmente les afflictions infligées par des coups critiques.
Augmente les chances de trouver des points de collecte rare.
Augmente les dégâts contre les parties et les dégâts infligés de 10 % si les conditions sont remplies.
Augmente les dégâts contre les parties et les dégâts infligés de 20 % si les conditions sont remplies.
Augmente les dégâts contre les parties et les dégâts infligés de 30 % si les conditions sont remplies.
Augmente les dégâts de feu supplémentaires après une attaque réussie.
Augmente les dégâts draconiques additionnels et l'attaque dragon.
Augmente les dégâts élémentaires lorsqu'il est actif.
Augmente légèrement l'attaque élémentaire et les afflictions des attaques chargées.
Augmente légèrement la distance d'esquive.
Augmente légèrement la fenêtre d'invulnérabilité.
Augmente légèrement la portée.
Augmente légèrement la puissance d'attaque et l'affinité des munitions sous certaines conditions.
Augmente légèrement la puissance des munitions et flèches indiquées.
Augmente légèrement la récupération.
Augmente légèrement la vitesse de rengainage.
Augmente légèrement le taux de remplissage de la jauge et réduit le temps de charge de 5 %.
Augmente légèrement les afflictions infligées par des coups critiques.
Augmente légèrement les dégâts élémentaires lorsqu'il est actif.
Augmente modérément la durée de Force latente.
Augmente modérément la durée pendant laquelle les armes sont chargées.
Augmente modérément la puissance d'attaque et l'affinité des munitions sous certaines conditions.
Augmente modérément la puissance des attaques et la vitesse du Feu de wyverne. Attaque feu du Bombardement +30.
Augmente modérément la puissance des munitions et flèches indiquées.
Augmente modérément la récupération.
Augmente modérément la vitesse de rech. du fusarbalète et la puissance du tir si les conditions sont remplies.
Augmente modérément la vitesse des repas.
Augmente modérément le taux de remplissage de la jauge et réduit le temps de charge de 10 %.
Augmente temporairement l'affinité. Infligez assez de dégâts pour un bonus de dégâts de foudre. (Sauf certaines attaques.)
Augmente temporairement la défense quand vous utilisez un outil de survie.
Augmente temporairement la puissance d'attaque avec les effets qui affectent les compagnons (comme les Mélodies).
Augmente temporairement votre affinité pendant les glissades.
Augmente très légèrement la fenêtre d'invulnérabilité.
Augmente également l'attaque en cas de réactivation alors que le talent est actif.
Augmente énormément la fenêtre d'invulnérabilité.
Chances d'activation +10 %
Chances d'activation +25 %
Chances d'activation +45 %
Chances d'infliger des dégâts de feu supplémentaires après une attaque réussie.
Confère temporairement +15 d'attaque après avoir consommé des objets tels que des steaks à point.
Confère temporairement +30 d'attaque après avoir consommé des objets tels que des steaks à point.
Confère une grande jauge d'endurance supplémentaire.
Confère une jauge d'endurance supplémentaire.
Coût d'endurance -15 %
Coût d'endurance -30 %
Coût d'endurance -50 %
Coût d'endurance fixe -10 %
Coût d'endurance fixe -20 %
Coût d'endurance fixe -30 %
Coût d'endurance fixe -40 %
Coût d'endurance fixe -50 %
Diminue grandement l'impact des attaques et réduit la perte d'endurance de 50 %.
Diminue l'impact des attaques et réduit la perte d'endurance de 30 %.
Diminue légèrement l'impact des attaques et réduit la perte d'endurance de 15 %.
Double la vitesse de récupération des dégâts temporaires.
Drain d'endurance +20 %
Drain d'endurance +30 %
Drain d'endurance +40 %
Durée +10 %
Durée +25 %
Durée +50 %
Durée fléaux élémentaires -50 %
Durée fléaux élémentaires -75 %
Durée paralysie -30 %
Durée paralysie -60 %
Durée sommeil -30 %
Durée sommeil -60 %
Durée étourdissement -30 %
Durée étourdissement -60 %.
Décourage grandement les monstres de vous attaquer même s'ils vous repèrent.
Décourage les monstres de vous attaquer même s'ils vous repèrent.
Défense +10
Défense +10 % Défense +35 Résistances élémentaires +5
Défense +5
Défense +5 % Défense +10
Défense +5 % Défense +20 Résistances élémentaires +3
Défense +50 lorsqu'il est actif.
Défense +8 % Défense +20 Résistances élémentaires +3
Défense +8 % Défense +35 Résistances élémentaires +5
Dégâts +10 % lorsque la jauge de tranchant est dans le jaune ou moins.
Dégâts +10 % lorsque la jauge de tranchant est dans le vert ou moins.
Dégâts +5 % lorsque la jauge de tranchant est dans le jaune ou moins.
Dégâts des coups critiques +28 %.
Dégâts des coups critiques +31 %.
Dégâts des coups critiques +34 %.
Dégâts des coups critiques +37 %.
Dégâts des coups critiques +40 %.
Dégâts subis -15 % lorsqu'il est actif.
Dégâts subis -30 % lorsqu'il est actif.
Dégâts subis -50 % lorsqu'il est actif.
Délai de réutilisation -10 %
Délai de réutilisation -20 %
Délai de réutilisation -30 %
Délai de réutilisation -40 %
Délai de réutilisation -50 %
Empêche la réduction de l'endurance maximum.
Empêche les monstres de vous attaquer même s'ils vous repèrent.
Extraire des matériaux très rares augmente grandement l'attaque (jusqu'à une certaine limite).
Facilite grandement la création d'une blessure. Inflige aussi plus de dégâts non élémentaires.
Facilite la création d'une blessure. Inflige aussi un peu plus de dégâts non élémentaires.
Facilite légèrement la création d'une blessure. Inflige aussi des dégâts non élémentaires.
Facilite modérément la création d'une blessure. Inflige aussi légèrement plus de dégâts non élémentaires.
Facilite énormément la création d'une blessure. Inflige beaucoup plus de dégâts non élémentaires.
Inflige des dégâts dragon additionnels en accumulant les dégâts élémentaires. Augmente légèrement l'attaque dragon.
Inflige des dégâts supplémentaires quand le talent Vengeance est actif.
Inflige une quantité modérée de dégâts supplémentaires quand le talent Vengeance est actif.
L'attaque et les attaques élémentaires augmentent légèrement au premier coup, et encore plus après le cinquième coup.
L'effet du niveau I augmente et vous gagnez une barrière temporaire qui se réactive après le temps de recharge.
L'utilisation du talent devient possible.
La jauge de vie continue de se régénérer jusqu'à la valeur maximale même s'il n'y a pas de portion rouge.
La jauge de vie continue de se régénérer lentement jusqu'à la valeur maximale même s'il n'y a pas de portion rouge.
Les attaques dégainées ont Attaque +3 et infligent des dégâts légers d'étourdissement.
Les attaques dégainées ont Attaque +5 et infligent des dégâts moyens d'étourdissement.
Les attaques dégainées ont Attaque +7 et infligent des dégâts importants d'étourdissement.
Lorsqu'il est actif, augmente l'attaque élémentaire. Résistance à l'élément subi à l'activation : +8
Lorsqu'il est actif, augmente légèrement l'attaque élémentaire. Résistance à l'élément subi à l'activation : +4.
Lorsqu'il est actif, augmente modérément l'attaque élémentaire. Résistance à l'élément subi à l'activation : +6
Lorsqu'il est actif, l'attaque élémentaire et les afflictions augmentent grandement.
Lorsqu'il est actif, l'attaque élémentaire et les afflictions augmentent légèrement.
Lorsqu'il est actif, l'attaque élémentaire et les afflictions augmentent.
Octroie temporairement Attaque +10 après une Neutralisation ou un Duel de force réussi.
Octroie temporairement Attaque +25 après une Neutralisation ou un Duel de force réussi.
Pendant Chant des lumières, ajoute des objets spéciaux aux récompenses de quête. Augmente attaque et défense.
Pendant Chant des lumières, ajoute des objets spéciaux aux récompenses. (Hors quête rejointe en cours de route.)
Pendant Danse des fleurs, ajoute des objets spéciaux aux récompenses de quête. Augmente attaque et défense.
Pendant Danse des fleurs, ajoute des objets spéciaux aux récompenses. (Hors quête rejointe en cours de route.)
Pendant Fête des flammes, ajoute des objets spéciaux aux récompenses de quête. Augmente attaque et défense.
Pendant Fête des flammes, ajoute des objets spéciaux aux récompenses. (Hors quête rejointe en cours de route.)
Pendant Veillée des rêves, ajoute des objets spéciaux aux récompenses de quête. Augmente attaque et défense.
Pendant Veillée des rêves, ajoute des objets spéciaux aux récompenses. (Hors quête rejointe en cours de route.)
Permet d'obtenir plus de récompenses cible. (Hors quête rejointe en cours de route.)
Permet d'utiliser des fioles de léthargie.
Permet d'utiliser des fioles de paralysie.
Permet d'utiliser des fioles de poison.
Permet d'utiliser des fioles de sommeil.
Permet d'utiliser des fioles explosives.
Permet de digérer les champignons bleus et les champignons vénéneux.
Permet de dépecer les monstres une fois de plus lors des quêtes. (Hors quête rejointe en cours de route.)
Permet de monter et de blesser les monstres plus facilement.
Permet de partager 33 % des effets des objets avec les alliés même à grande distance.
Permet de partager 33 % des effets des objets avec les alliés à proximité.
Permet de partager 66 % des effets des objets avec les alliés même à grande distance.
Permet de partager 66 % des effets des objets avec les alliés même à très grande distance.
Permet de partager tous les effets des objets avec les alliés même à très grande distance.
Permet de vous débarrasser rapidement de l'état Toile et du fléau-givre.
Permet de vous débarrasser très rapidement de l'état Toile et du fléau-givre.
Permet également d'augmenter l'esquive en cas de fléau-bulles mineur.
Permet également de digérer les champinitros et les champaralysies.
Permet également de digérer les mandragores, les fléaux du diable et les champexciteurs.
Prolonge Poussée d'adrénaline. Prolonge l'effet une fois en cas de réactivation alors que le talent est actif.
Prolonge la durée de l'effet de votre poison de 20 %.
Protège de l'état Toile et du fléau-givre.
Protège de la paralysie.
Protège de la puanteur.
Protège des effets de Défense réduite.
Protège des hémorragies.
Protège des étourdissements.
Protège du fléau-bulles majeur et permet d'activer le fléau-bulles mineur en esquivant plusieurs fois.
Protège du fléau-explosion.
Protège du poison.
Protège du sommeil.
Puissance explosive +10 %
Puissance explosive +20 %
Puissance explosive +30 %
Puissance tir rapide +5 %
Quadruple la vitesse de récupération des dégâts temporaires.
Restaure 100 points de vie.
Restaure 50 points de vie.
Restaure 80 points de vie.
Restaure de la vie quand vous détruisez une blessure sur un grand monstre.
Restaure de la vie tant que vous attaquez. La régénération varie selon l'arme.
Restaure une quantité modérée de vie quand vous détruisez une blessure sur un grand monstre.
Restaure une quantité modérée de vie tant que vous attaquez. La régénération varie selon l'arme.
Retarde et réduit grandement les dégâts des fléaux-explosion.
Retarde et réduit les dégâts des fléaux-explosion.
Réduit de 50 % la consommation d'endurance lorsque vous grimpez.
Réduit grandement le nombre de fois que vous subissez des dégâts de poison.
Réduit grandement les dégâts subis en cas d'hémorragie.
Réduit l'affûtage d'un cycle.
Réduit l'affûtage de deux cycles.
Réduit la durée de la puanteur de 50 %.
Réduit la durée des effets de Défense réduite de 50 %.
Réduit la durée des effets de Défense réduite de 75 %.
Réduit le nombre de fois que vous subissez des dégâts de poison.
Réduit les dégâts subis de 10 %, et de 20 % additionnels dans certaines conditions.
Réduit les dégâts subis de 20 % quand votre vie est pleine.
Réduit les dégâts subis de 20 %, et de 30 % additionnels dans certaines conditions.
Réduit les dégâts subis de 30 %, et de 50 % additionnels dans certaines conditions.
Réduit les dégâts subis de 35 % quand votre vie est pleine.
Réduit les dégâts subis en cas d'hémorragie.
Réduit les dégâts uniques et élémentaires dans les Ruines de Wyveria.
Réduit les effets des petits rugissements.
Réduit temporairement la perte d'endurance lorsque la vie est inférieure ou égale à 40 %.
Résistance Dragon +12
Résistance Dragon +20 Défense +10
Résistance Dragon +6
Résistance Eau +12
Résistance Eau +20 Défense +10
Résistance Eau +6
Résistance Feu +12
Résistance Feu +20 Défense +10
Résistance Feu +6
Résistance Foudre +12
Résistance Foudre +20 Défense +10
Résistance Foudre +6
Résistance Glace +12
Résistance Glace +20 Défense +10
Résistance Glace +6
Réussir 5 attaques d'affilée renforce encore plus l'effet.
Réussir 5 attaques d'affilée renforce modérément l'effet.
Réussir 5 attaques d'affilée renforce un peu plus l'effet.
Réussir 5 attaques d'affilée renforce énormément l'effet.
Subir des dégâts temporaires augmente l'att. élémentaire, et certaines attaques chargées (nv 3) de la grande épée sont renforcées.
Tranchant +10
Tranchant +20
Tranchant +30
Tranchant +40
Tranchant +50
Triple la vitesse de récupération des dégâts temporaires.
Un objet supplémentaire obtenu depuis les carcasses.
Une herbe supplémentaire par collecte.
Utiliser l'émote [Victoire !] augmente l'attaque des alliés proches. (Accru sur Palicos/Chasseurs de soutien.)
Utiliser l'émote [Victoire !] augmente modérément l'attaque des alliés proches. (Accru sur Palicos/Chasseurs de soutien.)
Vitesse +10 %
Vitesse +20 % Puissance morphose +10 %
Vitesse +30 % Puissance morphose +20 %
Vitesse de récupération d'endurance +10 %
Vitesse de récupération d'endurance +30 %
Vitesse de récupération d'endurance +50 %.
Vous inflige la Furie et augmente votre attaque face aux grands monstres. Après guérison, l'attaque est encore accrue.
Vous inflige la Furie face aux grands monstres.
Vous permet d'effectuer l'action spéciale : Nuit noirissime.
Étourdissement +20 %
Étourdissement +30 %
Étourdissement +40 %
Évite les chutes et les repoussements.
Évite les repoussements et transforme les chutes en repoussements.
Évite les repoussements.

---

FILE : main/README.md

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

---


**Questions sur les données :**

- `skills_fr_complet.json` est-il chargé par l’application ou seulement présent dans le dépôt ?
- Sa structure correspond-elle à celle des talents renvoyés par `useWildsAPI`/`useJoyauxAPI` ?
- Les identifiants sont-ils uniques et cohérents entre données françaises, API et équipements ?
- `descriptions_uniques.txt` contient-il des formats non couverts par le parser ?
- Les données sont-elles complètes, valides JSON et compatibles avec les types TypeScript ?
- Existe-t-il des doublons de noms français, accents, apostrophes ou variantes de casse ?

---

## 5. Priorités d’audit

### Priorité P0 — chemin critique du bug

1. Lire `src/utils/calculations.ts` et établir la liste exacte des entrées consommées.
2. Suivre la provenance d’un talent depuis les objets API jusqu’au `build`.
3. Comparer cette structure aux types de `src/types/wilds.ts` et `src/types/stats.ts`.
4. Vérifier le contrat de sortie de `statsParser.ts` et son utilisation réelle.
5. Reproduire avec un cas contrôlé : une pièce connue + un talent connu + niveau 1.
6. Ajouter des logs temporaires ou assertions sur : talents bruts, talents normalisés, agrégat final et stats finales.

### Priorité P1 — causes fréquentes de neutralisation

- mauvais nom de propriété (`skill`/`skills`, `level`/`rank`, `id` chaîne vs nombre) ;
- talents présents dans l’UI mais absents de l’état calculé ;
- mutation directe d’un tableau ou objet dans `useBuildState` ;
- dépendance React manquante entraînant un calcul périmé ;
- parser limité aux descriptions anglaises ou à un format exact ;
- bonus stocké comme texte et additionné/converti de façon incorrecte ;
- talent agrégé mais jamais appliqué à une statistique ;
- rendu conditionnel qui masque un résultat pourtant calculé.

### Priorité P2 — robustesse et maintenance

- tests unitaires des calculs et du parsing ;
- validation runtime des réponses API ;
- séparation claire entre normalisation des données, agrégation des talents et calcul des stats ;
- messages de diagnostic pour les talents non reconnus ;
- documentation du contrat de données et des règles de calcul.

---

## 6. Résultat attendu de l’audit

Le rapport final doit fournir :

1. **Cause racine**, avec fichiers, fonctions et lignes concernées ;
2. **Chemin de données** avant/après correction ;
3. **Liste des incohérences de typage ou de structure** ;
4. **Correctif recommandé**, idéalement minimal et compatible avec l’architecture actuelle ;
5. **Tests de non-régression** à ajouter ou exécuter ;
6. **Cas restant volontairement non pris en charge**, s’il y en a ;
7. une confirmation que la modification d’une pièce, d’un talisman ou d’un joyau entraîne bien une mise à jour des talents et des statistiques visibles.
8. **Optimisation du code** meilleure optimsation possible pour une base solide et propre en vue d'un nombreux nombres de lignes de données à ajouter entre 2000 et 5000 lignes et d'un déploiement et utilisation fluide sur Vercel
9. **Transmission des instruction complètes étape par étape pour Claude Sonnet** Rédiger des instructions précises et complète pour que Claude Sonnet puisse poursuivre le projet et faire une base optimiser et solide

### Format conseillé pour chaque anomalie

```text
- Gravité : P0 / P1 / P2
- Fichier et fonction : …
- Symptôme observé : …
- Cause technique : …
- Preuve / reproduction : …
- Correction proposée : …
- Test de validation : …
```

> **Important :** ne pas se limiter à vérifier que le talent apparaît dans l’interface. Le point déterminant est de prouver que le talent sélectionné est présent dans l’état source du calcul, correctement agrégé, puis effectivement appliqué à la statistique concernée. Et d'optimiser l'ensemble des fichiers et du code de manière général

