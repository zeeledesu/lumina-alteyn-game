// js/data/skills.js
// This is a very simplified skill structure for V0.1
// A full skill tree would need more complex relationships (prerequisites, branches)
export const SKILLS_DATA = {
    // Warrior
    skill_strike: {
        id: "skill_strike",
        name: "Power Strike",
        description: "A focused blow dealing 120% weapon damage.",
        mpCost: 3,
        type: "attack",
        target: "enemy",
        effect: { type: "damage", multiplier: 1.2, element: "physical" },
        levelRequirement: 1,
    },
    skill_defend_stance: {
        id: "skill_defend_stance",
        name: "Defensive Stance",
        description: "Increases Defense by 30% for 3 turns.",
        mpCost: 5,
        type: "buff",
        target: "self",
        effect: { type: "stat_change", stat: "defense", multiplier: 1.3, duration: 3 },
        levelRequirement: 3,
    },
    // Mage
    skill_mana_bolt: {
        id: "skill_mana_bolt",
        name: "Mana Bolt",
        description: "Hurls a bolt of raw energy, dealing 10 + INT damage.",
        mpCost: 4,
        type: "attack",
        target: "enemy",
        effect: { type: "damage", basePower: 10, scaleStat: "int", element: "arcane" },
        levelRequirement: 1,
    },
    skill_minor_heal: {
        id: "skill_minor_heal",
        name: "Minor Heal",
        description: "Restores a small amount of HP (15 + WIS).",
        mpCost: 6,
        type: "heal",
        target: "self", // Could be 'ally' in future
        effect: { type: "heal", basePower: 15, scaleStat: "wis" },
        levelRequirement: 2,
    },
    // Rogue
    skill_quick_strike: {
        id: "skill_quick_strike",
        name: "Quick Strike",
        description: "A swift attack dealing 90% weapon damage, but with higher accuracy.",
        mpCost: 2,
        type: "attack",
        target: "enemy",
        effect: { type: "damage", multiplier: 0.9, accuracyBonus: 15, element: "physical" },
        levelRequirement: 1,
    },
    skill_stealth: {
        id: "skill_stealth",
        name: "Stealth",
        description: "Become hidden for 2 turns, increasing critical chance of next attack.",
        mpCost: 7,
        type: "buff",
        target: "self",
        effect: { type: "status_effect", status: "stealthed", duration: 2, bonus: {critChance: 25} },
        levelRequirement: 3,
    },
};