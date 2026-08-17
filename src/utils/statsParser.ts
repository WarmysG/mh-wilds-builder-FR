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
