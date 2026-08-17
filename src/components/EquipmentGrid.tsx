import type { EtatBuild, SlotEquipement } from '../types/wilds';
import SelectionJoyauxSlot from './SelectionJoyauxSlot';

interface Props {
    build: EtatBuild;
    onSlotClick: (slot: SlotEquipement) => void;
    onSlotClear: (slot: SlotEquipement) => void;
    onJoyauSlotClick: (slot: SlotEquipement, index: number, tailleMax: number) => void;
    onRetirerJoyau: (slot: SlotEquipement, index: number) => void;
}

const LIBELLES_SLOTS: Record<SlotEquipement, string> = {
    arme: '🗡️ Arme',
    casque: '🪖 Casque',
    torse: '👔 Torse',
    bras: '🤝 Bras',
    taille: '⚙️ Taille',
    jambes: '🦵 Jambes',
    talisman: '✨ Talisman',
};

const ORDRE_SLOTS: SlotEquipement[] = [
    'arme', 'casque', 'torse', 'bras', 'taille', 'jambes', 'talisman',
];

export default function EquipementGrille({
    build,
    onSlotClick,
    onSlotClear,
    onJoyauSlotClick,
    onRetirerJoyau,
}: Props) {
    return (
        <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Équipement</h2>
        <div className="space-y-2">
        {ORDRE_SLOTS.map((slot) => {
            const { equipement, joyaux } = build[slot];
            // 'emplacements' n'existe pas sur Talisman
            const emplacements = equipement && 'emplacements' in equipement
            ? equipement.emplacements
            : [];

            return (
                <div key={slot}>
                <div
                className="flex items-center justify-between bg-gray-700 rounded p-3 hover:bg-gray-600 cursor-pointer transition"
                onClick={() => onSlotClick(slot)}
                >
                <div>
                <span className="font-medium">{LIBELLES_SLOTS[slot]}</span>
                <span className="ml-3 text-gray-300">
                {equipement ? `— ${equipement.nom}` : 'Aucun équipement sélectionné'}
                </span>
                </div>
                {equipement && (
                    <button
                    className="text-red-400 hover:text-red-300 px-2"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSlotClear(slot);
                    }}
                    aria-label={`Retirer ${LIBELLES_SLOTS[slot]}`}
                    >
                    ✕
                    </button>
                )}
                </div>

                {equipement && emplacements.length > 0 && (
                    <SelectionJoyauxSlot
                    emplacements={emplacements}
                    joyauxInseres={joyaux}
                    onSlotClick={(index, tailleMax) =>
                        onJoyauSlotClick(slot, index, tailleMax)
                    }
                    onRetirerJoyau={(index) => onRetirerJoyau(slot, index)}
                    />
                )}
                </div>
            );
        })}
        </div>
        </div>
    );
}
