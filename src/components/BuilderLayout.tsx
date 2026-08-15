import { useState } from 'react';
import { useDonneesWilds } from '../hooks/useWildsAPI';
import { useBuildState } from '../hooks/useBuildState';
import { calculerStatsBuild } from '../utils/calculations';
import EquipmentGrid from './EquipmentGrid';
import StatsPanel from './StatsPanel';
import SelectionModal from './SelectionModal';
import type { SlotEquipement } from '../types/wilds';

/** Composant racine du builder : orchestre les données API, l'état du build,
 * l'affichage des deux panneaux (équipement / statistiques) et la modale de choix.
 */
export default function BuilderLayout() {
    const { armes, armures, talismans, chargement, erreur } = useDonneesWilds();
    const { build, definirPiece, retirerPiece } = useBuildState();

    const [slotSelectionne, setSlotSelectionne] = useState<SlotEquipement | null>(null);

    const stats = calculerStatsBuild(build);

    function ouvrirSelection(slot: SlotEquipement) {
        setSlotSelectionne(slot);
    }

    function fermerSelection() {
        setSlotSelectionne(null);
    }

    if (chargement) {
        return (
            <div className="flex items-center justify-center min-h-screen text-xl">
            Chargement des données Monster Hunter Wilds...
            </div>
        );
    }

    if (erreur) {
        return (
            <div className="flex items-center justify-center min-h-screen text-xl text-red-500">
            Erreur de chargement : {erreur}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-3xl font-bold text-center mb-6">
        Builder Monster Hunter Wilds
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EquipmentGrid
        build={build}
        onSlotClick={ouvrirSelection}
        onSlotClear={retirerPiece}
        />
        <StatsPanel stats={stats} />
        </div>

        {slotSelectionne && (
            <SelectionModal
            slot={slotSelectionne}
            armes={armes.donnees}
            armures={armures.donnees}
            talismans={talismans.donnees}
            onSelect={(piece) => {
                definirPiece(slotSelectionne, piece);
                fermerSelection();
            }}
            onClose={fermerSelection}
            />
        )}
        </div>
    );
}
