import { useState } from 'react';
import type { Arme, Armure, Talisman, SlotEquipement } from '../types/wilds';

type PieceSelectionnable = Arme | Armure | Talisman;

interface Props {
    slot: SlotEquipement;
    armes: Arme[];
    armures: Armure[];
    talismans: Talisman[];
    onSelect: (piece: PieceSelectionnable) => void;
    onClose: () => void;
}

const SLOTS_ARMURE: SlotEquipement[] = ['casque', 'torse', 'bras', 'taille', 'jambes'];

/** Correspondance entre nos slots FR et la valeur 'kind' brute renvoyée par l'API
 * (a priori en anglais : "head", "chest", "arms", "waist", "legs").
 */
const KIND_ARMURE_PAR_SLOT: Record<string, string> = {
    casque: 'head',
    torse: 'chest',
    bras: 'arms',
    taille: 'waist',
    jambes: 'legs',
};

/** Modale de sélection d'équipement. Filtre automatiquement la liste selon le slot
 * demandé (arme, une des 5 pièces d'armure, ou talisman) et permet une recherche
 * textuelle simple par nom.
 */
export default function SelectionModal({
    slot,
    armes,
    armures,
    talismans,
    onSelect,
    onClose,
}: Props) {
    const [recherche, setRecherche] = useState('');

    let liste: PieceSelectionnable[] = [];

    if (slot === 'arme') {
        liste = armes;
    } else if (slot === 'talisman') {
        liste = talismans;
    } else if (SLOTS_ARMURE.includes(slot)) {
        const kindAttendu = KIND_ARMURE_PAR_SLOT[slot];
        liste = armures.filter((a) => a.emplacement === kindAttendu);
    }

    const listeFiltree = liste.filter((piece) =>
    piece.nom.toLowerCase().includes(recherche.toLowerCase())
    );

    return (
        <div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        >
        <div
        className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choisir un équipement</h3>
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
            <p className="text-gray-400 text-center p-4">Aucun résultat.</p>
        )}
        {listeFiltree.map((piece) => (
            <div
            key={piece.id}
            className="p-3 hover:bg-gray-700 rounded cursor-pointer transition"
            onClick={() => onSelect(piece)}
            >
            <p className="font-medium">{piece.nom}</p>
            <p className="text-sm text-gray-400">
            {'rarete' in piece ? `Rareté ${piece.rarete}` : ''}
            </p>
            </div>
        ))}
        </div>
        </div>
        </div>
    );
}
