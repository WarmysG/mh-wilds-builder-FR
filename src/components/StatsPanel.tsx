import type { StatsCalculees } from '../types/wilds';

interface Props {
    stats: StatsCalculees;
}

const LIBELLES_RESISTANCES: Record<keyof StatsCalculees['resistances'], string> = {
    feu: '🔥 Feu',
    eau: '💧 Eau',
    glace: '❄️ Glace',
    tonnerre: '⚡ Tonnerre',
    dragon: '🐲 Dragon',
};

/** Affiche le panneau de statistiques calculées du build : attaque, défense,
 * résistances élémentaires et talents actifs cumulés.
 */
export default function StatsPanel({ stats }: Props) {
    return (
        <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Statistiques</h2>

        <div className="space-y-2 mb-6">
        <div className="flex justify-between">
        <span>⚔️ Attaque</span>
        <span className="font-bold">{stats.attaque}</span>
        </div>
        <div className="flex justify-between">
        <span>🎯 Affinité</span>
        <span className={`font-bold ${stats.affinite >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {stats.affinite > 0 ? '+' : ''}{stats.affinite}%
        </span>
        </div>
        <div className="flex justify-between">
        <span>🛡️ Défense</span>
        <span className="font-bold">{stats.defense}</span>
        </div>
        {(Object.keys(stats.resistances) as (keyof StatsCalculees['resistances'])[]).map(
            (cle) => (
                <div key={cle} className="flex justify-between">
                <span>{LIBELLES_RESISTANCES[cle]}</span>
                <span className="font-bold">{stats.resistances[cle]}</span>
                </div>
            )
        )}
        </div>

        <h3 className="text-lg font-semibold mb-2">📊 Talents actifs</h3>
        <div className="space-y-1">
        {stats.talentsActifs.length === 0 && (
            <p className="text-gray-400">Aucun talent actif.</p>
        )}
        {stats.talentsActifs.map((talent) => (
            <div key={talent.nom} className="flex justify-between text-sm">
            <span>{talent.nom}</span>
            <span className="text-gray-300">Niveau {talent.niveau}</span>
            </div>
        ))}
        </div>
        </div>
    );
}
