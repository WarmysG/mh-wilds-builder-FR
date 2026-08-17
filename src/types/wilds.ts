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
