// js/data/items.js
export const ITEMS_DATA = {
    i001: {
        id: "i001",
        name: "Old Coin",
        type: "currency_junk",
        description: "A tarnished copper coin. Might be worth something to someone.",
        rarity: "common",
        value: 1,
        stackable: true,
    },
    i002: {
        id: "i002",
        name: "Lumina Petal",
        type: "quest_item",
        description: "A glowing petal from a Lumina Flower. It feels warm to the touch.",
        rarity: "uncommon",
        value: 0,
        stackable: false,
    },
    w001: {
        id: "w001",
        name: "Rusty Shortsword",
        type: "weapon",
        slot: "weapon",
        description: "A simple, somewhat pitted shortsword.",
        rarity: "common",
        value: 10,
        damage: 5,
        effects: [], // { type: "stat_bonus", stat: "str", value: 1 }
    },
    c001: {
        id: "c001",
        name: "Minor Healing Draught",
        type: "consumable",
        description: "Restores 20 HP.",
        rarity: "common",
        value: 15,
        stackable: true,
        use_effect: { type: "heal", amount: 20 }
    },
    sp_orb_small: {
        id: "sp_orb_small",
        name: "Small SP Orb",
        type: "consumable",
        description: "Grants 10 Study Points when consumed.",
        rarity: "uncommon",
        value: 0, // Not meant to be sold
        stackable: true,
        use_effect: { type: "grant_sp", amount: 10 }
    }
};

export const STARTING_ITEMS = {
    warrior: [{itemId: "w001", quantity: 1}, {itemId: "c001", quantity: 2}],
    mage: [{itemId: "c001", quantity: 3}], // Mage might start with a basic staff later
    rogue: [{itemId: "w001", quantity: 1}, {itemId: "c001", quantity: 1}] // Rogue might start with daggers
};