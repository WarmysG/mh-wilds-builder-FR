import type { JoyauxInseres } from '../types/wilds';

interface Props {
    emplacements: number[]; // taille de chaque emplacement, ex: [1, 2]
    joyauxInseres: JoyauxInseres;
    onSlotClick: (index: number, tailleMax: number) => void;
    onRetirerJoyau: (index: number) => void;
}

/** Affiche les emplacements à joyaux d'une pièce d'équipement.
 * Chaque emplacement est cliquable pour ouvrir la sélection de joyau,
 * ou peut être vidé via le bouton ✕ s'il contient déjà un joyau.
 */
export default function SelectionJoyauxSlot({
    emplacements,
    joyauxInseres,
    onSlotClick,
    onRetirerJoyau,
}: Props) {
    return (
        <div className="flex gap-2 mt-1 ml-3 flex-wrap">
        {emplacements.map((taille, index) => {
            const joyau = joyauxInseres[index] ?? null;

            return (
                <div
                key={index}
                className="flex items-center bg-gray-900 rounded px-2 py-1 text-sm cursor-pointer hover:bg-gray-700 transition"
                onClick={() => onSlotClick(index, taille)}
                >
                <span className="text-gray-400 mr-1">💎[{taille}]</span>
                <span className={joyau ? 'text-white' : 'text-gray-500 italic'}>
                {joyau ? joyau.nom : 'Vide'}
                </span>
                {joyau && (
                    <button
                    className="ml-2 text-red-400 hover:text-red-300"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRetirerJoyau(index);
                    }}
                    aria-label="Retirer le joyau"
                    >
                    ✕
                    </button>
                )}
                </div>
            );
        })}
        </div>
    );
}
