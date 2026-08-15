import type { EtatBuild, StatsCalculees, Talent } from '../types/wilds';

const RESISTANCES_VIDES = { feu: 0, eau: 0, glace: 0, tonnerre: 0, dragon: 0 } as const;

/** Regroupe tous les talents d'un build (arme + 5 pièces d'armure + talisman)
 * dans une seule liste avant de fusionner les niveaux identiques.
 */
function collecterTousLesTalents(build: EtatBuild): Talent[] {
    const pieces = [
        build.arme,
        build.casque,
        build.torse,
        build.bras,
        build.taille,
        build.jambes,
        build.talisman,
    ];

    const talents: Talent[] = [];
    for (const piece of pieces) {
        if (piece && 'talents' in piece) {
            talents.push(...piece.talents);
        }
    }
    return talents;
}

/** Fusionne les talents identiques (même id) en additionnant leurs niveaux. */
function fusionnerTalents(talents: Talent[]): { nom: string; niveau: number }[] {
    const cumul = new Map<number, { nom: string; niveau: number }>();

    for (const t of talents) {
        const existant = cumul.get(t.id);
        if (existant) {
            existant.niveau = Math.max(existant.niveau, t.niveau);
        } else {
            cumul.set(t.id, { nom: t.nom, niveau: t.niveau });
        }
    }

    return Array.from(cumul.values()).sort((a, b) => b.niveau - a.niveau);
}

/** Calcule les statistiques totales d'un build complet :
 * attaque de l'arme, défense cumulée des armures, résistances cumulées,
 * et liste fusionnée des talents actifs.
 */
export function calculerStatsBuild(build: EtatBuild): StatsCalculees {
    const attaque = build.arme?.degatsAffiches ?? 0;

    const piecesArmure = [build.casque, build.torse, build.bras, build.taille, build.jambes];

    let defense = 0;
    const resistances = { ...RESISTANCES_VIDES };

    for (const piece of piecesArmure) {
        if (piece) {
            defense += piece.defenseBase;
            resistances.feu += piece.resistances.feu;
            resistances.eau += piece.resistances.eau;
            resistances.glace += piece.resistances.glace;
            resistances.tonnerre += piece.resistances.tonnerre;
            resistances.dragon += piece.resistances.dragon;
        }
    }

    // La défense bonus de l'arme s'ajoute aussi (défenseBonus des armes est parfois négatif)
    if (build.arme) {
        defense += build.arme.defenseBonus;
    }

      const talentsActifs = fusionnerTalents(collecterTousLesTalents(build));

    return { attaque, defense, resistances, talentsActifs };
}
