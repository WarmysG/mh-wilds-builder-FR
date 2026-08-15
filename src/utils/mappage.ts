import type {
    Arme,
    Armure,
    ArmorAPI,
    CharmAPI,
    SkillAPI,
    SkillWrapperAPI,
    Talent,
    TypeArme,
    WeaponAPI,
    Talisman,
} from '../types/wilds';

export const KIND_ARME_FR: Record<string, TypeArme> = {
    'bow': 'Arc',
    'light-bowgun': 'Arbalète légère',
    'heavy-bowgun': 'Arbalète lourde',
    'long-sword': 'Épée longue',
    'great-sword': 'Grande épée',
    'sword-shield': 'Épée et bouclier',
    'dual-blades': 'Lames doubles',
    'lance': 'Lance',
    'gunlance': 'Lancecanon',
    'hammer': 'Marteau',
    'hunting-horn': 'Corne de chasse',
    'switch-axe': 'Morpho-hache',
    'charge-blade': 'Volto-hache',
    'insect-glaive': 'Insectoglaive',
};

export const KIND_ARMURE_FR: Record<string, string> = {
    head: 'Tête',
    chest: 'Torse',
    arms: 'Bras',
    waist: 'Taille',
    legs: 'Jambes',
};

export const RANG_FR: Record<string, string> = {
    low: 'Bas',
    high: 'Élevé',
    master: 'Maître', // Non observé dans l'échantillon du 15/08/2026, gardé par précaution
};

export const RESISTANCE_FR = {
    fire: 'feu',
    water: 'eau',
    ice: 'glace',
    thunder: 'tonnerre',
    dragon: 'dragon',
} as const;

export const KIND_TALENT_FR: Record<string, string> = {
    armor: 'armure',
    weapon: 'arme',
    set: 'ensemble',
    group: 'groupe',
};

/** Convertit un wrapper de talent brut (venant d'une arme, armure ou talisman)
 * vers le type Talent du domaine français.
 */
function talentDepuisWrapper(t: SkillWrapperAPI): Talent {
    return {
        id: t.skill.id,
        nom: t.skill.name ?? 'Talent inconnu',
        description: t.description,
        niveau: t.level,
        piecesRequises: t.setPiecesRequired,
    };
}

export function mapperArme(a: WeaponAPI): Arme {
    return {
        id: a.id,
        nom: a.name,
        type: KIND_ARME_FR[a.kind] ?? a.kind,
        rarete: a.rarity,
        degatsBruts: a.damage.raw,
        degatsAffiches: a.damage.display,
        affinite: a.affinity,
        defenseBonus: a.defenseBonus,
        emplacements: a.slots,
        talents: a.skills.map(talentDepuisWrapper),
    };
}

export function mapperArmure(a: ArmorAPI): Armure {
    return {
        id: a.id,
        nom: a.name,
        emplacement: KIND_ARMURE_FR[a.kind] ?? a.kind,
        rang: RANG_FR[a.rank] ?? a.rank,
        rarete: a.rarity,
        defenseBase: a.defense.base,
        defenseMax: a.defense.max,
        resistances: {
            feu: a.resistances.fire,
            eau: a.resistances.water,
            glace: a.resistances.ice,
            tonnerre: a.resistances.thunder,
            dragon: a.resistances.dragon,
        },
        talents: a.skills.map(talentDepuisWrapper),
        set: { id: a.armorSet.id, nom: a.armorSet.name },
    };
}

/** Ne garde que le premier rang (niveau 1) du talisman.
 * Retourne null si le talisman n'a aucun rang (cas non observé mais possible).
 */
export function mapperTalisman(c: CharmAPI): Talisman | null {
    const r = c.ranks[0];
    if (!r) return null;
    return {
        id: c.id,
        nom: r.name,
        niveau: r.level,
        rarete: r.rarity,
        talents: r.skills.map(talentDepuisWrapper),
    };
}


/** Ne garde que le premier rang du talent pour l'affichage de base.
 * Retourne un Talent avec niveau 0 si aucun rang n'existe (cas non observé).
 */
export function mapperTalent(s: SkillAPI): Talent {
    const r = s.ranks[0];
    return {
        id: s.id,
        nom: s.name,
        description: s.description ?? r?.description ?? '',
        niveau: r?.level ?? 0,
        piecesRequises: r?.setPiecesRequired ?? null,
    };
}
