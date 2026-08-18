# Demande d’audit — MH Wilds Builder FR

> **Dépôt source :** `WarmysG/mh-wilds-builder-FR`  
> **Branche auditée :** `main`  
> **Objectif principal :** diagnostiquer de la base du code, de sa fiabilité et de son optimisation avant poursuite du projet. Des milliers de lignes supplémentaires sont prévues .

## 1. Contexte et symptôme

Cette application React + TypeScript + Vite permet de composer un build Monster Hunter Wilds à partir d’une arme, de pièces d’armure et d’un talisman, puis d’afficher les statistiques résultantes.

Le problème à investiguer est le suivant : **les talents présents sur l’équipement ou sélectionnés dans l’interface semblent ne pas modifier les statistiques affichées**.

L’audit doit suivre le flux complet :

```text
API / données locales
  → types TypeScript
  → état du build
  → sélection d’équipement et de talents
  → calcul des statistiques
  → affichage dans StatsPanel
```

Merci d’identifier précisément :

- où les talents sont chargés, transformés, stockés et transmis ;
- si les noms, identifiants et niveaux de talents restent cohérents entre l’API et l’interface ;
- si les talents sont réellement inclus dans `calculateBuildStats` ;
- si les bonus sont appliqués au bon niveau et au bon moment ;
- si l’interface affiche un état différent de celui utilisé pour le calcul ;
- si un typage trop permissif, une valeur `undefined`, une mauvaise clé ou une conversion de type neutralise les bonus.

---

## 2. Fichiers à auditer — code TypeScript / React

### 2.1 Types et contrats de données

Ces fichiers définissent les formes attendues pour les équipements, les talents et les statistiques. Vérifier leur compatibilité avec les réponses réelles de l’API et avec les objets effectivement manipulés par les composants.

 Fichier  URL raw GitHub 
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/types/wilds.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/types/stats.ts

**Points de contrôle :**

- représentation d’un talent : `id`, nom, niveau, rangs et bonus ;
- distinction entre talent d’équipement, talent actif et bonus agrégé ;
- types numériques réellement numériques (`number`) et non chaînes (`string`) ;
- propriétés optionnelles, valeurs nulles et valeurs par défaut ;
- correspondance entre les clés de résistances/statistiques et celles attendues par les calculs ;
- perte éventuelle d’informations lors du mapping d’une réponse API.

### 2.2 Logique de calcul et parsing

C’est la zone prioritaire de l’audit : elle doit démontrer, étape par étape, comment les talents deviennent des bonus de statistiques.

 Fichier  URL raw GitHub 

https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/utils/calculations.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/utils/statsParser.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/utils/statsKeywords.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/utils/mappage.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/test-parser.ts

**Questions spécifiques sur le calcul :**

1. `calculateBuildStats` reçoit-il bien le build courant et tous ses équipements ?
2. Les talents de chaque slot sont-ils parcourus, ou seuls attaque/défense/résistances sont-ils additionnés ?
3. Les talents sont-ils regroupés par **identifiant stable** ou par nom affiché ?
4. Le regroupement additionne-t-il correctement les niveaux lorsque le même talent provient de plusieurs pièces ?
5. Le niveau total est-il plafonné au maximum prévu, et ce plafonnement est-il appliqué après l’agrégation ?
6. Le code distingue-t-il le niveau d’un talent (`level`, `rank`, `points`, etc.) d’un bonus numérique ?
7. Les descriptions de talents sont-elles parsées de manière robuste pour les bonus tels que pourcentage, valeur fixe, élément, défense ou affinité ?
8. `statsParser.ts` retourne-t-il réellement une structure consommée par `calculations.ts`, ou produit-il un format différent ?
9. `statsKeywords.ts` reconnaît-il les libellés français et les variantes réelles des données API ?
10. `mappage.ts` conserve-t-il les talents lors de la conversion anglais/français ou équipement/API → modèle interne ?
11. Les bonus en pourcentage sont-ils appliqués au bon ordre : base, addition des bonus fixes, puis multiplicateurs, si nécessaire ?
12. Les opérations arithmétiques ont-elles un effet neutralisé par `|| 0`, `Number(...)`, `parseInt`, concaténation de chaînes ou comparaison stricte d’identifiants ?
13. Les talents sans effet direct sur attaque/défense sont-ils tout de même conservés et affichés correctement ?
14. Existe-t-il des erreurs silencieuses, `catch` trop larges ou retours par défaut qui masquent un échec de parsing ?
15. Les règles de jeu codées correspondent-elles aux descriptions réellement reçues, ou le système suppose-t-il un format non garanti ?

**Tests minimaux à exiger de l’audit :**

- build vide : aucune statistique ni talent fantôme ;
- une pièce avec un talent de niveau 1 : le talent apparaît et son bonus change la statistique attendue ;
- deux pièces avec le même talent : les niveaux s’additionnent correctement ;
- talent au niveau maximal : aucun dépassement non prévu ;
- talents multiples sur une même pièce : aucun talent n’est écrasé ;
- talent sans bonus parsable : le talent reste visible et un diagnostic explicite est disponible ;
- changement/suppression d’une pièce : les bonus retirés disparaissent immédiatement ;
- valeurs API représentées sous forme de chaînes et de nombres ;
- descriptions françaises et anglaises, si les deux formats sont supportés.

### 2.3 Hooks et état du build

 Fichier URL raw GitHub 
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/hooks/useBuildState.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/hooks/useJoyauxAPI.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/hooks/useWildsAPI.ts

**Questions spécifiques sur l’état :**

- Les mises à jour d’un slot sont-elles immuables et déclenchent-elles bien un nouveau rendu ?
- L’équipement sélectionné contient-il ses talents complets, ou uniquement un `id`/nom qui n’est jamais résolu ensuite ?
- Les joyaux sont-ils ajoutés au même agrégat que les talents d’armure et de talisman ?
- Une sélection de talent ou de joyau est-elle écrasée par une mise à jour ultérieure du slot ?
- Le hook expose-t-il la même structure que celle attendue par les fonctions de calcul ?
- Les dépendances des `useMemo`, `useCallback` et `useEffect` sont-elles complètes ?
- Un tableau est-il muté directement, empêchant React de détecter le changement ?
- Les chargements API, états `loading` et erreurs peuvent-ils laisser des données partielles utilisées par le calcul ?
- Les réponses API sont-elles normalisées une seule fois, de façon cohérente et typée ?

### 2.4 Composants React

 Fichier  URL raw GitHub 
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/components/BuilderLayout.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/components/EquipmentGrid.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/components/StatsPanel.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/components/SelectionModal.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/components/SelectionJoyauModal.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/components/SelectionJoyauxSlot.tsx

**Questions spécifiques sur l’interface :**

- `BuilderLayout` calcule-t-il les stats à partir du build le plus récent, sans snapshot obsolète ?
- `StatsPanel` reçoit-il les stats calculées et les talents agrégés, ou recalcule-t-il une autre version ?
- Les callbacks de sélection transmettent-ils l’objet complet et le niveau de talent ?
- Les modales utilisent-elles les bons identifiants et le bon slot lors de la confirmation ?
- La sélection d’un joyau met-elle à jour l’état global réellement consommé par `StatsPanel` ?
- Les listes React ont-elles des `key` stables, afin d’éviter un affichage visuel désynchronisé ?
- Des conditions d’affichage masquent-elles les talents de niveau zéro ou les bonus calculés ?
- Les libellés affichés sont-ils uniquement traduits, sans modifier par erreur la clé utilisée pour le calcul ?

---

## 3. Configuration et point d’entrée

Ces fichiers peuvent expliquer un problème de build, de résolution de modules, de variables d’environnement ou de compilation qui masque le comportement réel.

 Fichier URL raw GitHub 
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/App.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/src/main.tsx
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/package.json
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/vite.config.ts
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/tsconfig.json
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/tailwind.config.js
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/postcss.config.js

**À vérifier :**

- scripts `build`, `test` et éventuels outils de lint ;
- compilation TypeScript stricte et erreurs ignorées ;
- versions React/TypeScript et dépendances réellement installées ;
- configuration Tailwind couvrant bien `src/**/*.{ts,tsx}` ;
- import effectif de la feuille de styles ;
- absence de doublon entre logique CSS et logique métier ;
- warnings de console et erreurs runtime reproductibles en production.

---

## 4. Assets et données de référence


https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/skills_fr_complet.json
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/descriptions_uniques.txt
https://raw.githubusercontent.com/WarmysG/mh-wilds-builder-FR/main/README.md

**Questions sur les données :**

- `skills_fr_complet.json` est-il chargé par l’application ou seulement présent dans le dépôt ?
- Sa structure correspond-elle à celle des talents renvoyés par `useWildsAPI`/`useJoyauxAPI` ?
- Les identifiants sont-ils uniques et cohérents entre données françaises, API et équipements ?
- `descriptions_uniques.txt` contient-il des formats non couverts par le parser ?
- Les données sont-elles complètes, valides JSON et compatibles avec les types TypeScript ?
- Existe-t-il des doublons de noms français, accents, apostrophes ou variantes de casse ?

---

## 5. Priorités d’audit

### Priorité P0 — chemin critique du bug

1. Lire `src/utils/calculations.ts` et établir la liste exacte des entrées consommées.
2. Suivre la provenance d’un talent depuis les objets API jusqu’au `build`.
3. Comparer cette structure aux types de `src/types/wilds.ts` et `src/types/stats.ts`.
4. Vérifier le contrat de sortie de `statsParser.ts` et son utilisation réelle.
5. Reproduire avec un cas contrôlé : une pièce connue + un talent connu + niveau 1.
6. Ajouter des logs temporaires ou assertions sur : talents bruts, talents normalisés, agrégat final et stats finales.

### Priorité P1 — causes fréquentes de neutralisation

- mauvais nom de propriété (`skill`/`skills`, `level`/`rank`, `id` chaîne vs nombre) ;
- talents présents dans l’UI mais absents de l’état calculé ;
- mutation directe d’un tableau ou objet dans `useBuildState` ;
- dépendance React manquante entraînant un calcul périmé ;
- parser limité aux descriptions anglaises ou à un format exact ;
- bonus stocké comme texte et additionné/converti de façon incorrecte ;
- talent agrégé mais jamais appliqué à une statistique ;
- rendu conditionnel qui masque un résultat pourtant calculé.

### Priorité P2 — robustesse et maintenance

- tests unitaires des calculs et du parsing ;
- validation runtime des réponses API ;
- séparation claire entre normalisation des données, agrégation des talents et calcul des stats ;
- messages de diagnostic pour les talents non reconnus ;
- documentation du contrat de données et des règles de calcul.

---

## 6. Résultat attendu de l’audit

Le rapport final doit fournir :

1. **Cause racine**, avec fichiers, fonctions et lignes concernées ;
2. **Chemin de données** avant/après correction ;
3. **Liste des incohérences de typage ou de structure** ;
4. **Correctif recommandé**, idéalement minimal et compatible avec l’architecture actuelle ;
5. **Tests de non-régression** à ajouter ou exécuter ;
6. **Cas restant volontairement non pris en charge**, s’il y en a ;
7. une confirmation que la modification d’une pièce, d’un talisman ou d’un joyau entraîne bien une mise à jour des talents et des statistiques visibles.
8. **Optimisation du code** meilleure optimsation possible pour une base solide et propre en vue d'un nombreux nombres de lignes de données à ajouter entre 2000 et 5000 lignes et d'un déploiement et utilisation fluide sur Vercel
9. **Transmission des instruction complètes étape par étape pour Claude Sonnet** Rédiger des instructions précises et complète pour que Claude Sonnet puisse poursuivre le projet et faire une base optimiser et solide

### Format conseillé pour chaque anomalie

```text
- Gravité : P0 / P1 / P2
- Fichier et fonction : …
- Symptôme observé : …
- Cause technique : …
- Preuve / reproduction : …
- Correction proposée : …
- Test de validation : …
```

> **Important :** ne pas se limiter à vérifier que le talent apparaît dans l’interface. Le point déterminant est de prouver que le talent sélectionné est présent dans l’état source du calcul, correctement agrégé, puis effectivement appliqué à la statistique concernée. Et d'optimiser l'ensemble des fichiers et du code de manière général

