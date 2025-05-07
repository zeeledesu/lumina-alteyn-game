// js/data/classes.js
export const PLAYER_CLASSES = {
    warrior: {
        name: "Warrior",
        description: "A master of martial combat, excelling in strength and resilience.",
        baseStats: { str: 12, dex: 10, con: 11, int: 8, wis: 8, cha: 9,
                     hp: 25, mp: 5, mpRegen: 0.2 },
        skillSlotsOnLevelUp: 1, // How many new skills can be learned
        availableSkills: ["skill_strike", "skill_defend_stance"] // Initial skills potentially learnable
    },
    mage: {
        name: "Mage",
        description: "A wielder of arcane energies, potent but fragile.",
        baseStats: { str: 8, dex: 9, con: 8, int: 12, wis: 11, cha: 10,
                     hp: 18, mp: 20, mpRegen: 1.0 },
        skillSlotsOnLevelUp: 1,
        availableSkills: ["skill_mana_bolt", "skill_minor_heal"]
    },
    rogue: {
        name: "Rogue",
        description: "A cunning operative, striking from the shadows with deadly precision.",
        baseStats: { str: 9, dex: 12, con: 9, int: 10, wis: 8, cha: 10,
                     hp: 20, mp: 10, mpRegen: 0.5 },
        skillSlotsOnLevelUp: 1,
        availableSkills: ["skill_quick_strike", "skill_stealth"]
    }
};

export const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];