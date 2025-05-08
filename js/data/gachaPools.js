// js/data/gachaPools.js
// Item rarities: common, uncommon, rare, epic, legendary, mythic, artifact, divine

export const GACHA_POOLS = {
    standard_study_rewards: {
        name: "Standard Study Rewards",
        cost: 10, // SP cost
        pulls: [ // Each object is a potential "slot" in the pull, can have multiple items
            {
                // Slot 1: Main Reward
                items: [
                    // Consumables
                    { itemId: "c001", weight: 250, quantity: {min: 2, max: 5} }, // Minor Healing Draught
                    { itemId: "c002", weight: 200, quantity: {min: 2, max: 4} }, // Minor Mana Potion
                    { itemId: "sp_orb_small", weight: 150, quantity: 1 },
                    { itemId: "sp_orb_medium", weight: 50, quantity: 1 },
                    // Common Gear
                    { itemId: "w001", weight: 80, quantity: 1 }, // Rusty Shortsword
                    { itemId: "a001", weight: 80, quantity: 1 }, // Leather Cap
                    // Uncommon Gear
                    { itemId: "w003", weight: 40, quantity: 1 }, // Hunter's Bow
                    { itemId: "r001", weight: 30, quantity: 1 }, // Ring of Minor Vigor
                    // Rare Gear (very low chance)
                    // Define some rare items, e.g., w005_steel_longsword, a005_chainmail_vest
                    // { itemId: "w005_steel_longsword", weight: 5, quantity: 1 },
                    // { itemId: "a005_chainmail_vest", weight: 5, quantity: 1 },
                ],
                guaranteedRarity: null, // e.g., 'uncommon' to ensure at least one uncommon
            }
        ],
        displayQuotes: [ // Flavor text for pulls
            "Knowledge is power!",
            "The pursuit of truth yields unexpected treasures.",
            "Even the smallest discovery can change the world.",
            "A keen mind finds more than just answers.",
            "Fortune favors the studious!"
        ]
    },
    // Future: premium_artifact_cache, event_specific_pool
};
