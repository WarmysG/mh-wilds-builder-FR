import type {
    Arme,
    Armure,
    ArmorAPI,
    CharmAPI,
    DecorationAPI,
    Joyau,
    Skill,
    SkillAPI,
    Talent,
    TypeArme,
    WeaponAPI,
    Talisman,
} from '../types/wilds';

import { analyserDescriptionTalent } from './statsParser';

/** Mappe une arme brute de l'API vers le type Arme du domaine français. */
export function mapperArme(w: WeaponAPI): Arme {
    return {
        id: w.id,
        nom: w.name,
        type: w.kind as TypeArme,
        rarete: w.rarity,
        degatsAffiches: w.damage.display,
        affinite: 0, // Non fourni par l'API weapons actuellement
        defenseBonus: 0, // Non fourni par l'API weapons actuellement
        emplacements: w.slots,
        talents: w.skills.map((s) => ({
            id: s.skill.id,
            nom: '',
            niveau: s.level,
        })),
    };
}

/** Mappe une armure brute de l'API vers le type Armure du domaine français. */
export function mapperArmure(a: ArmorAPI): Armure {
    const talentsNormaux = a.skills.filter((s) => s.skill.kind === 'armor');
    const bonusDeSet = a.skills.filter((s) => s.skill.kind !== 'armor');

    return {
        id: a.id,
        nom: a.name,
        description: a.description,
        emplacement: a.kind,
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
        emplacements: a.slots,
        talents: talentsNormaux.map((s) => ({
            id: s.skill.id,
            nom: s.skill.name ?? '',
            niveau: s.level,
        })),
        bonusEnsemble: bonusDeSet.map((s) => ({
            id: s.skill.id,
            nom: s.name ?? s.skill.name ?? '',
            niveau: s.setPiecesRequired ?? s.level,
        })),
        ensemble: a.armorSet
        ? { id: a.armorSet.id, nom: a.armorSet.name }
        : undefined,
    };
}

/** Mappe un talisman brut de l'API vers le type Talisman du domaine français.
 * Ne conserve que le premier rang (niveau de base) du talisman.
 * Les noms des talents seront résolus ensuite via resoudreNomsTalents.
 */
export function mapperTalisman(c: CharmAPI): Talisman {
    const premierRang = c.ranks?.[0];
    return {
        id: c.id,
        nom: premierRang?.name ?? 'Talisman inconnu',
        niveau: premierRang?.level ?? 1,
        talents: (premierRang?.skills ?? []).map((s) => ({
            id: s.skill.id,
            nom: '', // sera résolu ensuite via resoudreNomsTalents
            niveau: s.level,
        })),
    };
}

/** Mappe un joyau (décoration) brut de l'API vers le type Joyau du domaine français.
 * Un joyau peut conférer plusieurs talents à la fois (ex: "Joyau châtiment/artisanat").
 */
export function mapperDecoration(d: DecorationAPI): Joyau {
    return {
        id: d.id,
        nom: d.name,
        taille: d.slot,
        kind: d.kind,
        talents: d.skills.map((s) => ({
            id: s.skill.id,
            nom: s.skill.name,
            niveau: s.level,
        })),
    };
}

/** Alias : le hook useJoyauxAPI attend une fonction nommée mapperJoyau. */
export const mapperJoyau = mapperDecoration;

/** Mappe la réponse brute de l'API (/fr/skills) vers le type Skill du domaine français.
 * Conserve tous les rangs (contrairement aux talents d'équipement qui n'en ont qu'un).
 */
export function mapperSkill(s: SkillAPI): Skill {
    return {
        id: s.id,
        nom: s.name,
        description: s.description ?? '',
        ranks: s.ranks.map((r) => ({
            niveau: r.level,
            description: r.description,
            effets: analyserDescriptionTalent(r.description),
        })),
    };
}
/** Complète le nom des talents d'une liste de pièces (armes ou talismans)
 * en le résolvant depuis la table des Skills (id → nom).
 * Nécessaire car /fr/weapons et /fr/charms ne renvoient que skill.id, pas skill.name.
 */
export function resoudreNomsTalents<T extends { talents: Talent[] }>(
    pieces: T[],
    talentsParId: Map<number, string>
): T[] {
    return pieces.map((piece) => ({
        ...piece,
        talents: piece.talents.map((t) => ({
            ...t,
            nom: talentsParId.get(t.id) ?? t.nom,
        })),
    }));
}
