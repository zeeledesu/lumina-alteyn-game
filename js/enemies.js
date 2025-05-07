// js/data/enemies.js
export const ENEMIES_DATA = {
    goblin_scout: {
        id: "goblin_scout",
        name: "Goblin Scout",
        hp: 15,
        attack: 4,
        defense: 2,
        xp_reward: 10,
        gold_reward: {min: 1, max: 5},
        loot_table: [ // {itemId, chance (0-100)}
            { itemId: "i001", chance: 50 },
            { itemId: "c001", chance: 10 }
        ],
        skills: [] // Can add enemy skills later
    }
};