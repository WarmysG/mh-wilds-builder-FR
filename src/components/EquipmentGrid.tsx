import type { EtatBuild, SlotEquipement } from '../types/wilds';

interface Props {
    build: EtatBuild;
    onSlotClick: (slot: SlotEquipement) => void;
    onSlotClear: (slot: SlotEquipement) => void;
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
    'arme',
'casque',
'torse',
'bras',
'taille',
'jambes',
'talisman',
];

/** Affiche les 7 emplacements d'équipement du build. Chaque slot ouvre la modale
 * de sélection au clic, ou peut être vidé via le bouton de suppression.
 */
export default function EquipmentGrid({ build, onSlotClick, onSlotClear }: Props) {
    return (
        <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Équipement</h2>
        <div className="space-y-2">
        {ORDRE_SLOTS.map((slot) => {
            const piece = build[slot];
            return (
                <div
                key={slot}
                className="flex items-center justify-between bg-gray-700 rounded p-3 hover:bg-gray-600 cursor-pointer transition"
                onClick={() => onSlotClick(slot)}
                >
                <div>
                <span className="font-medium">{LIBELLES_SLOTS[slot]}</span>
                <span className="ml-3 text-gray-300">
                {piece ? `— ${piece.nom}` : 'Aucun équipement sélectionné'}
                </span>
                </div>
                {piece && (
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
            );
        })}
        </div>
        </div>
    );
}
