import { useState, useEffect } from 'react';
import type { Arme, Armure, Talisman, Joyau, Skill } from '../types/wilds';
import {
    mapperArme,
    mapperArmure,
    mapperTalisman,
    mapperDecoration,
    mapperSkill,
    resoudreNomsTalents,
} from '../utils/mappage';
import type { WeaponAPI, ArmorAPI, CharmAPI, DecorationAPI, SkillAPI } from '../types/wilds';

const BASE_URL = 'https://wilds.mhdb.io/fr';

interface DonneesWilds {
    armes: Arme[];
    armures: Armure[];
    talismans: Talisman[];
    joyaux: Joyau[];
    talents: Skill[];
    chargement: boolean;
    erreur: string | null;
}

/** Récupère toutes les données nécessaires au builder depuis l'API Wilds (en français).
 * Effectue les 5 requêtes en parallèle, mappe chaque réponse vers le domaine français,
 * puis résout les noms de talents manquants (armes/talismans) via la table des Skills.
 */
export function useWildsAPI(): DonneesWilds {
    const [armes, setArmes] = useState<Arme[]>([]);
    const [armures, setArmures] = useState<Armure[]>([]);
    const [talismans, setTalismans] = useState<Talisman[]>([]);
    const [joyaux, setJoyaux] = useState<Joyau[]>([]);
    const [talents, setTalents] = useState<Skill[]>([]);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        let annule = false;

        async function chargerDonnees() {
            try {
                setChargement(true);

                const [resArmes, resArmures, resTalismans, resJoyaux, resTalents] =
                await Promise.all([
                    fetch(`${BASE_URL}/weapons`),
                                  fetch(`${BASE_URL}/armor`),
                                  fetch(`${BASE_URL}/charms`),
                                  fetch(`${BASE_URL}/decorations`),
                                  fetch(`${BASE_URL}/skills`),
                ]);

                if (!resArmes.ok || !resArmures.ok || !resTalismans.ok || !resJoyaux.ok || !resTalents.ok) {
                    throw new Error('Une des requêtes API a échoué.');
                }

                const [dataArmes, dataArmures, dataTalismans, dataJoyaux, dataTalents]: [
                    WeaponAPI[],
                    ArmorAPI[],
                    CharmAPI[],
                    DecorationAPI[],
                    SkillAPI[]
                ] = await Promise.all([
                    resArmes.json(),
                                      resArmures.json(),
                                      resTalismans.json(),
                                      resJoyaux.json(),
                                      resTalents.json(),
                ]);

                if (annule) return;

                const talentsMappes = dataTalents.map(mapperSkill);
                const talentsParId = new Map<number, string>(
                    talentsMappes.map((t) => [t.id, t.nom])
                );

                const armesMappees = resoudreNomsTalents(
                    dataArmes.map(mapperArme),
                                                         talentsParId
                );
                const talismansMappes = resoudreNomsTalents(
                    dataTalismans.map(mapperTalisman),
                                                            talentsParId
                );

                setArmes(armesMappees);
                setArmures(dataArmures.map(mapperArmure));
                setTalismans(talismansMappes);
                setJoyaux(dataJoyaux.map(mapperDecoration));
                setTalents(talentsMappes);
                setErreur(null);
            } catch (e) {
                if (!annule) {
                    setErreur(e instanceof Error ? e.message : 'Erreur inconnue lors du chargement.');
                }
            } finally {
                if (!annule) setChargement(false);
            }
        }

        chargerDonnees();

        return () => {
            annule = true;
        };
    }, []);

    return { armes, armures, talismans, joyaux, talents, chargement, erreur };
}
