import { useState } from 'react';
import type { Joyau, SlotEquipement } from '../types/wilds';
import { joyauCompatible } from '../utils/calculations';

interface Props {
    slot: SlotEquipement;
    tailleMax: number;
    joyaux: Joyau[];
    onSelect: (joyau: Joyau) => void;
    onClose: () => void;
}

/** Modale de sélection d'un joyau pour un emplacement précis.
 * Filtre automatiquement selon la compatibilité (taille + type arme/armure).
 */
export default function SelectionJoyauModal({
    slot,
    tailleMax,
    joyaux,
    onSelect,
    onClose,
}: Props) {
    const [recherche, setRecherche] = useState('');

    const listeCompatible = joyaux.filter((j) =>
    joyauCompatible(j.taille, tailleMax, j.kind, slot)
    );

    const listeFiltree = listeCompatible.filter((j) =>
    j.nom.toLowerCase().includes(recherche.toLowerCase())
    );

    return (
        <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        >
        <div
        className="bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choisir un joyau (taille max {tailleMax})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
        ✕
        </button>
        </div>

        <div className="p-4 border-b border-gray-700">
        <input
        type="text"
        placeholder="Rechercher par nom..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        className="w-full bg-gray-700 rounded px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
        />
        </div>

        <div className="overflow-y-auto flex-1 p-2">
        {listeFiltree.length === 0 && (
            <p className="text-gray-400 text-center p-4">Aucun joyau compatible.</p>
        )}
        {listeFiltree.map((joyau) => (
            <div
            key={joyau.id}
            className="p-3 hover:bg-gray-700 rounded cursor-pointer transition"
            onClick={() => onSelect(joyau)}
            >
            <p className="font-medium">{joyau.nom}</p>
            <p className="text-sm text-gray-400">
            Taille {joyau.taille} —{' '}
            {joyau.talents.map((t) => `${t.nom} Nv.${t.niveau}`).join(', ')}
            </p>
            </div>
        ))}
        </div>
        </div>
        </div>
    );
}
