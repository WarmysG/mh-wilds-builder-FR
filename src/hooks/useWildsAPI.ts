import { useState, useEffect } from 'react';
import type {
    WeaponAPI,
    ArmorAPI,
    CharmAPI,
    SkillAPI,
    Arme,
    Armure,
    Talisman,
    Talent,
} from '../types/wilds';
import { mapperArme, mapperArmure, mapperTalisman, mapperTalent } from '../utils/mappage';

const BASE_URL = 'https://wilds.mhdb.io/fr';

interface EtatChargement<T> {
    donnees: T[];
    chargement: boolean;
    erreur: string | null;
}

/** Hook générique de fetch pour un endpoint de l'API Wilds.
 * La racine des réponses est toujours un tableau direct (validé le 15/08/2026),
 * jamais un objet enveloppant du type { weapons: [...] }.
 */
function useEndpointAPI<TBrut, TDomaine>(
    endpoint: string,
    mapper: (brut: TBrut) => TDomaine | null
): EtatChargement<TDomaine> {
    const [donnees, setDonnees] = useState<TDomaine[]>([]);
    const [chargement, setChargement] = useState<boolean>(true);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        let annule = false;

        async function recuperer() {
            setChargement(true);
            setErreur(null);
            try {
                const reponse = await fetch(`${BASE_URL}/${endpoint}`);
                if (!reponse.ok) {
                    throw new Error(`Erreur HTTP ${reponse.status} sur /${endpoint}`);
                }
                const brut: TBrut[] = await reponse.json();
                if (!annule) {
                    const mappees = brut
                    .map(mapper)
                    .filter((item): item is TDomaine => item !== null);
                    setDonnees(mappees);
                }
            } catch (e) {
                if (!annule) {
                    setErreur(e instanceof Error ? e.message : 'Erreur inconnue');
                }
            } finally {
                if (!annule) {
                    setChargement(false);
                }
            }
        }

        recuperer();
        return () => {
            annule = true;
        };
    }, [endpoint]);

    return { donnees, chargement, erreur };
}

/** Récupère toutes les armes traduites en français depuis /fr/weapons. */
export function useArmes(): EtatChargement<Arme> {
    return useEndpointAPI<WeaponAPI, Arme>('weapons', mapperArme);
}

/** Récupère toutes les armures traduites en français depuis /fr/armor
 * (endpoint réel singulier, confirmé par test direct le 15/08/2026).
 */
export function useArmures(): EtatChargement<Armure> {
    return useEndpointAPI<ArmorAPI, Armure>('armor', mapperArmure);
}

/** Récupère tous les talismans depuis /fr/charms.
 * Ne garde que le premier rang de chaque talisman (mapperTalisman renvoie null
 * si aucun rang n'existe, filtré automatiquement).
 */
export function useTalismans(): EtatChargement<Talisman> {
    return useEndpointAPI<CharmAPI, Talisman>('charms', mapperTalisman);
}

/** Récupère tous les talents depuis /fr/skills. */
export function useTalents(): EtatChargement<Talent> {
    return useEndpointAPI<SkillAPI, Talent>('skills', mapperTalent);
}

/** Hook combiné pratique pour charger toutes les données nécessaires au builder
 * en une seule fois (utile dans App.tsx).
 */
export function useDonneesWilds() {
    const armes = useArmes();
    const armures = useArmures();
    const talismans = useTalismans();
    const talents = useTalents();

    const chargement =
    armes.chargement || armures.chargement || talismans.chargement || talents.chargement;

    const erreur = armes.erreur || armures.erreur || talismans.erreur || talents.erreur || null;

    return { armes, armures, talismans, talents, chargement, erreur };
}
