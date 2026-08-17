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
