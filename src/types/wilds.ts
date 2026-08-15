/** Types bruts de l'API Wilds MHDB (https://wilds.mhdb.io/fr/).
 * Les noms et la forme sont volontairement ceux de l'API ; ne pas les traduire ici.
 * Validé le 15/08/2026 contre un échantillon réel de 1188 armes, 714 armures,
 * 64 talismans et 179 talents. Voir RAPPORT_VALIDATION_API.md pour le détail.
 */

// ============================================================
// TYPES COMMUNS / PARTAGÉS
// ============================================================

export interface IconAPI {
    id: number;
    kind: string;
    colorId?: number;
    color?: string;
}

/** Champ recipes observé uniquement comme tableau vide dans les réponses testées. */
export type RecipeAPI = Record<string, unknown>;

export interface ItemAPI {
    id: number;
    gameId: number;
    rarity: number;
    name: string;
    description: string;
    value: number;
    carryLimit: number;
    recipes: RecipeAPI[];
    icon: IconAPI;
}

export interface MaterialAPI {
    item: ItemAPI;
    quantity: number;
    id: number;
}

export interface SkillRefAPI {
    id: number;
    name?: string | null;
    description?: string;
}

export interface SkillDetailAPI extends SkillRefAPI {
    gameId?: number;
    kind?: string;
    icon?: IconAPI;
}

/** Provenance : /fr/weapons, /fr/armor, /fr/charms et /fr/skills (wrappers de talent).
 * name est null dans les wrappers de talent de weapons/charms et souvent de armor ;
 * setPiecesRequired est null dans ces mêmes wrappers. Certains champs skill (gameId,
 * kind, icon) n'existent que dans les objets armor/skills, pas dans weapon/charm.
 */
export interface SkillWrapperAPI {
    skill: SkillRefAPI | SkillDetailAPI;
    level: number;
    name: string | null;
    description: string;
    setPiecesRequired: number | null;
    id: number;
}

export interface DefenseAPI {
    base: number;
    max: number;
}

export interface ResistanceAPI {
    fire: number;
    water: number;
    ice: number;
    thunder: number;
    dragon: number;
}

// ============================================================
// ARMES (/fr/weapons)
// ============================================================

export interface DamageAPI {
    raw: number;
    display: number;
}

export interface WeaponSpecialAPI {
    element?: string;
    status?: string;
    [key: string]: unknown;
}

export interface AmmoAPI {
    rapid?: boolean;
    [key: string]: unknown;
}

export interface SharpnessAPI {
    red: number;
    orange: number;
    yellow: number;
    green: number;
    blue: number;
    white: number;
    purple: number;
}

export interface MelodyAPI {
    [key: string]: unknown;
}

export interface EchoAPI {
    [key: string]: unknown;
}

export interface WeaponCraftingAPI {
    weapon: { id: number };
    craftable: boolean;
    previous: { id: number } | null;
    branches: { name: string; id: number }[];
    craftingMaterials: MaterialAPI[];
    craftingZennyCost: number;
    upgradeMaterials: MaterialAPI[];
    upgradeZennyCost: number;
    column: number;
    row: number;
    id: number;
}

/** Provenance : /fr/weapons. coatings, ammo, handicraft, sharpness, kinsectLevel,
 * shell/shellLevel, specialAmmo, melody, echoBubble et echoWave sont absents selon
 * le kind ; echoWave peut être null ; phial est string ou objet ; elderseal est null
 * dans tous les échantillons observés ; series est objet ou null.
 */
export interface WeaponAPI {
    coatings?: string[];
    gameId: number;
    crafting: WeaponCraftingAPI;
    rarity: number;
    kind: string;
    damage: DamageAPI;
    specials: WeaponSpecialAPI[];
    name: string;
    description: string;
    defenseBonus: number;
    elderseal: string | null;
    slots: number[];
    affinity: number;
    skills: SkillWrapperAPI[];
    series: { id: number; gameId: number; name: string } | null;
    id: number;
    ammo?: AmmoAPI[];
    handicraft?: number[];
    sharpness?: SharpnessAPI;
    kinsectLevel?: number;
    shell?: string;
    shellLevel?: number;
    specialAmmo?: string;
    phial?: string | { kind: string; damage?: DamageAPI };
    melody?: MelodyAPI;
    echoBubble?: EchoAPI;
    echoWave?: EchoAPI | null;
}

// ============================================================
// ARMURES (/fr/armor — endpoint réel singulier, pas "armors")
// ============================================================

/** Provenance : /fr/armor. rank observé seulement "low" ou "high" (aucun "master"
 * retourné au 15/08/2026) ; skills peut être vide ; dans ses wrappers name et
 * setPiecesRequired sont null ou respectivement string/number.
 */
export interface ArmorCraftingAPI {
    armor: { id: number };
    id: number;
    materials: MaterialAPI[];
    zennyCost: number;
}

export interface ArmorAPI {
    kind: string;
    name: string;
    description: string;
    rank: string;
    rarity: number;
    resistances: ResistanceAPI;
    defense: DefenseAPI;
    skills: SkillWrapperAPI[];
    slots: number[];
    armorSet: { id: number; name: string };
    crafting: ArmorCraftingAPI;
    id: number;
}

// ============================================================
// TALISMANS (/fr/charms)
// ============================================================

/** Provenance : /fr/charms. La racine est un tableau ; ranks peut contenir plusieurs
 * niveaux. Dans les wrappers skills name/setPiecesRequired sont null ; les objets
 * skill ne contiennent ici que id/name.
 */
export interface CharmCraftingAPI {
    charmRank: { id: number };
    craftable: boolean;
    materials: MaterialAPI[];
    id: number;
    zennyCost: number;
}

export interface CharmRankAPI {
    charm: { id: number };
    name: string;
    description: string;
    level: number;
    rarity: number;
    skills: SkillWrapperAPI[];
    crafting: CharmCraftingAPI;
    id: number;
}

export interface CharmAPI {
    ranks: CharmRankAPI[];
    gameId: number;
    id: number;
    random: boolean;
}

// ============================================================
// TALENTS (/fr/skills)
// ============================================================

/** Provenance : /fr/skills. kind racine prend "armor" | "weapon" | "set" | "group".
 * description racine peut être null. Dans ranks[], name et setPiecesRequired sont
 * null ou renseignés ensemble ; l'objet skill imbriqué ne contient que id.
 */
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
// DOMAINE FRANÇAIS — couche indépendante des contrats bruts
// ============================================================

export type TypeArme =
| 'Arc'
| 'Arbalète légère'
| 'Arbalète lourde'
| 'Épée longue'
| 'Grande épée'
| 'Épée et bouclier'
| 'Lames doubles'
| 'Lance'
| 'Lancecanon'
| 'Marteau'
| 'Corne de chasse'
| 'Morpho-hache'
| 'Volto-hache'
| 'Insectoglaive';

export interface Talent {
    id: number;
    nom: string;
    description: string;
    niveau: number;
    piecesRequises: number | null;
}

export interface Materiau {
    id: number;
    nom: string;
    quantite: number;
    item: ItemAPI;
}

export interface Arme {
    id: number;
    nom: string;
    type: TypeArme | string;
    rarete: number;
    degatsBruts: number;
    degatsAffiches: number;
    affinite: number;
    defenseBonus: number;
    emplacements: number[];
    talents: Talent[];
}

export interface Armure {
    id: number;
    nom: string;
    emplacement: string;
    rang: string;
    rarete: number;
    defenseBase: number;
    defenseMax: number;
    resistances: Record<'feu' | 'eau' | 'glace' | 'tonnerre' | 'dragon', number>;
    talents: Talent[];
    set: { id: number; nom: string };
}

export interface Talisman {
    id: number;
    nom: string;
    niveau: number;
    rarete: number;
    talents: Talent[];
}

// ============================================================
// TYPES DU BUILD (état de l'application)
// ============================================================

export type SlotEquipement =
| 'arme'
| 'casque'
| 'torse'
| 'bras'
| 'taille'
| 'jambes'
| 'talisman';

export interface EtatBuild {
    arme: Arme | null;
    casque: Armure | null;
    torse: Armure | null;
    bras: Armure | null;
    taille: Armure | null;
    jambes: Armure | null;
    talisman: Talisman | null;
}

export interface StatsCalculees {
    attaque: number;
    defense: number;
    resistances: Record<'feu' | 'eau' | 'glace' | 'tonnerre' | 'dragon', number>;
    talentsActifs: { nom: string; niveau: number }[];
}
