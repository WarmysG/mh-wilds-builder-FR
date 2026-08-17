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
