import { useState, useCallback } from 'react';
import type { EtatBuild, SlotEquipement, Arme, Armure, Talisman } from '../types/wilds';

const BUILD_VIDE: EtatBuild = {
    arme: null,
    casque: null,
    torse: null,
    bras: null,
    taille: null,
    jambes: null,
    talisman: null,
};

type PieceEquipement = Arme | Armure | Talisman | null;

/** Gère l'état complet du build en cours de construction.
 * Fournit des fonctions pour définir ou retirer une pièce par slot.
 */
export function useBuildState() {
    const [build, setBuild] = useState<EtatBuild>(BUILD_VIDE);

    const definirPiece = useCallback((slot: SlotEquipement, piece: PieceEquipement) => {
        setBuild((precedent) => ({
            ...precedent,
            [slot]: piece,
        }));
    }, []);

    const retirerPiece = useCallback((slot: SlotEquipement) => {
        setBuild((precedent) => ({
            ...precedent,
            [slot]: null,
        }));
    }, []);

    const reinitialiserBuild = useCallback(() => {
        setBuild(BUILD_VIDE);
    }, []);

    const chargerBuild = useCallback((nouveauBuild: EtatBuild) => {
        setBuild(nouveauBuild);
    }, []);

    return { build, definirPiece, retirerPiece, reinitialiserBuild, chargerBuild };
}
