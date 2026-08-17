import { useState, useEffect } from 'react';
import type { DecorationAPI, Joyau } from '../types/wilds';
import { mapperJoyau } from '../utils/mappage';

interface EtatJoyauxAPI {
    joyaux: Joyau[];
    chargement: boolean;
    erreur: string | null;
}

/** Récupère la liste des décorations (joyaux) depuis l'API Wilds
 * et les convertit vers le domaine français.
 */
export function useJoyauxAPI(): EtatJoyauxAPI {
    const [joyaux, setJoyaux] = useState<Joyau[]>([]);
    const [chargement, setChargement] = useState<boolean>(true);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        let annule = false;

        async function chargerJoyaux() {
            try {
                setChargement(true);
                setErreur(null);

                const reponse = await fetch('https://wilds.mhdb.io/fr/decorations');

                if (!reponse.ok) {
                    throw new Error(`Erreur HTTP : ${reponse.status}`);
                }

                const donnees: DecorationAPI[] = await reponse.json();

                if (!annule) {
                    const joyauxMappes = donnees.map(mapperJoyau);
                    setJoyaux(joyauxMappes);
                }
            } catch (e) {
                if (!annule) {
                    const message = e instanceof Error ? e.message : 'Erreur inconnue';
                    setErreur(`Impossible de charger les joyaux : ${message}`);
                    console.error('Erreur useJoyauxAPI :', e);
                }
            } finally {
                if (!annule) {
                    setChargement(false);
                }
            }
        }

        chargerJoyaux();

        // Nettoyage : évite de mettre à jour l'état si le composant est démonté
        // pendant que la requête est en cours.
        return () => {
            annule = true;
        };
    }, []);

    return { joyaux, chargement, erreur };
}
