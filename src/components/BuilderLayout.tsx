import { useState, useMemo } from 'react';
import { useWildsAPI } from '../hooks/useWildsAPI';
import { useBuildState } from '../hooks/useBuildState';
import { calculerStats, construireNiveauxMax } from '../utils/calculations';
import type { SlotEquipement, Arme, Armure, Talisman, Joyau } from '../types/wilds';
import EquipementGrille from './EquipmentGrid';
import StatsPanel from './StatsPanel';
import SelectionModal from './SelectionModal';
import SelectionJoyauModal from './SelectionJoyauModal';

type CibleJoyau = { slot: SlotEquipement; index: number; tailleMax: number } | null;

/** Composant racine du builder : orchestre les données API, l'état du build,
 * les calculs de stats, et l'affichage des deux panneaux (équipement / stats),
 * ainsi que les modales de sélection (équipement et joyaux).
 */
export default function BuilderLayout() {
    const { armes, armures, talismans, joyaux, talents, chargement, erreur } = useWildsAPI();
    const { build, definirPiece, retirerPiece, definirJoyau, reinitialiserBuild } = useBuildState();

    const [slotOuvert, setSlotOuvert] = useState<SlotEquipement | null>(null);
    const [cibleJoyau, setCibleJoyau] = useState<CibleJoyau>(null);

    const niveauxMax = useMemo(() => construireNiveauxMax(talents), [talents]);
    const stats = useMemo(() => calculerStats(build, niveauxMax), [build, niveauxMax]);

    function gererSelectionEquipement(piece: Arme | Armure | Talisman) {
        if (slotOuvert) {
            definirPiece(slotOuvert, piece);
            setSlotOuvert(null);
        }
    }

    function gererSelectionJoyau(joyau: Joyau) {
        if (cibleJoyau) {
            definirJoyau(cibleJoyau.slot, cibleJoyau.index, joyau);
            setCibleJoyau(null);
        }
    }

    if (chargement) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <p className="text-xl">Chargement des données...</p>
            </div>
        );
    }

    if (erreur) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <p className="text-xl text-red-400">Erreur : {erreur}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Builder Monster Hunter Wilds</h1>
        <button
        onClick={reinitialiserBuild}
        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition"
        >
        Réinitialiser
        </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EquipementGrille
        build={build}
        onSlotClick={(slot) => setSlotOuvert(slot)}
        onSlotClear={(slot) => retirerPiece(slot)}
        onJoyauSlotClick={(slot, index, tailleMax) =>
            setCibleJoyau({ slot, index, tailleMax })
        }
        onRetirerJoyau={(slot, index) => definirJoyau(slot, index, null)}
        />
        <StatsPanel stats={stats} />
        </div>
        </div>

        {slotOuvert && (
            <SelectionModal
            slot={slotOuvert}
            armes={armes}
            armures={armures}
            talismans={talismans}
            onSelect={gererSelectionEquipement}
            onClose={() => setSlotOuvert(null)}
            />
        )}

        {cibleJoyau && (
            <SelectionJoyauModal
            slot={cibleJoyau.slot}
            tailleMax={cibleJoyau.tailleMax}
            joyaux={joyaux}
            onSelect={gererSelectionJoyau}
            onClose={() => setCibleJoyau(null)}
            />
        )}
        </div>
    );
}
