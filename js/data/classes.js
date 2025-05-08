// js/data/classes.js

export const PLAYER_CLASSES = {
    warrior: {
        name: "Warrior",
        description: "A master of martial combat, excelling in strength and resilience.",
        baseStats: { str: 12, dex: 10, con: 11, int: 8, wis: 8, cha: 9,
                     hp: 30, mp: 10, mpRegen: 0.3 },
        skillSlotsOnLevelUp: 1,
        skillTree: ["warrior_basic_strikes", "warrior_defensive_maneuvers", "warrior_advanced_combat"]
    },
    mage: {
        name: "Mage",
        description: "A wielder of arcane energies, potent but fragile.",
        baseStats: { str: 8, dex: 9, con: 8, int: 12, wis: 11, cha: 10,
                     hp: 22, mp: 25, mpRegen: 1.2 },
        skillSlotsOnLevelUp: 1,
        skillTree: ["mage_elemental_bolts", "mage_arcane_wards", "mage_conjuration_mastery"]
    },
    rogue: {
        name: "Rogue",
        description: "A cunning operative, striking from the shadows with deadly precision.",
        baseStats: { str: 9, dex: 12, con: 9, int: 10, wis: 8, cha: 10,
                     hp: 25, mp: 15, mpRegen: 0.6 },
        skillSlotsOnLevelUp: 1,
        skillTree: ["rogue_stealth_tactics", "rogue_debilitating_strikes", "rogue_evasion_arts"]
    }
    // Ally classes are defined in allies.js
};

export const ATTRIBUTES = ["str", "dex", "con", "int", "wis", "cha"];
export const DERIVED_STATS_COMBAT = ["attack", "defense", "accuracy", "critChance", "evasion", "speed"];
export const DERIVED_STATS_PLAYER = ["maxHp", "currentHp", "maxMp", "currentMp", "mpRegen", ...DERIVED_STATS_COMBAT];

export const INITIAL_ATTRIBUTE_POINTS = 5;
export const ATTRIBUTE_POINTS_PER_LEVEL_INTERVAL = 1; // Now gain point every level
export const ATTRIBUTE_POINTS_GAIN = 1;
