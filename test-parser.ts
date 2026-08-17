import { analyserDescriptionTalent } from './src/utils/statsParser';

const exemples = [
  "Défense +5 % Défense +10",
  "Défense +5 % Défense +20 Résistances élémentaires +3",
  "Augmente légèrement l'attaque élémentaire. Résistance à l'élément subi à l'activation : +4.",
  "Permet d'utiliser des fioles explosives",
  "Réduit la durée de la puanteur de 50 %.",
  "Facilite légèrement la création d'une blessure. Inflige aussi des dégâts non élémentaires.",
  "Lorsqu'il est actif, augmente légèrement l'attaque élémentaire. Résistance à l'élément subi à l'activation : +4.",
  "Réduit légèrement l'impact des attaques et réduit la perte d'endurance de 15 %.",
  "Augmente les dégâts contre les parties et les dégâts infligés de 10 % si les conditions sont remplies.",
  "Étourdissement +20 %",
];

exemples.forEach((desc, index) => {
  console.log(`\n=== Test ${index + 1} ===`);
  console.log('Description:', desc);
  console.log('Résultat:', JSON.stringify(analyserDescriptionTalent(desc), null, 2));
});
