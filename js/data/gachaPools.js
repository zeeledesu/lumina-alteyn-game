// js/data/gachaPools.js

export const GACHA_POOLS = {
    standard_study_rewards: {
        name: "Standard Study Rewards",
        cost: 10, // SP cost
        pulls: [ 
            {
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
                    // Junk Item
                    { itemId: "i001", weight: 150, quantity: {min: 5, max: 15} } // Old Coins
                    // Rare Gear (Add later if needed)
                    // { itemId: "w005_steel_longsword", weight: 5, quantity: 1 },
                    // { itemId: "a005_chainmail_vest", weight: 5, quantity: 1 },
                ],
                guaranteedRarity: null, 
            }
        ],
        displayQuotes: [ 
            "Knowledge is power!",
            "The pursuit of truth yields unexpected treasures.",
            "Even the smallest discovery can change the world.",
            "A keen mind finds more than just answers.",
            "Fortune favors the studious!"
        ]
    },
};
