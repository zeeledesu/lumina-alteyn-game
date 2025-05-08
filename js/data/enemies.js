// js/data/enemies.js
// Define enemy groups for encounters later

export const ENEMIES_DATA = {
    // --- GOBLINS ---
    goblin_scout: {
        id: "goblin_scout", name: "Goblin Scout", level: 1,
        stats: { maxHp: 20, currentHp: 20, attack: 8, defense: 3, speed: 12, accuracy: 75, critChance: 5, evasion: 10 },
        skills: [], // Can learn basic attack
        xp_reward: 10, gold_reward: { min: 2, max: 6 },
        loot_table: [
            { itemId: "i001", chance: 60, quantity: {min:1, max:3} },
            { itemId: "c001", chance: 15 }
        ],
        aiProfile: "basic_attacker",
        description: "A small, wiry goblin with shifty eyes and a rusty dagger."
    },
    goblin_thug: {
        id: "goblin_thug", name: "Goblin Thug", level: 2,
        stats: { maxHp: 35, currentHp: 35, attack: 12, defense: 5, speed: 10, accuracy: 70, critChance: 5, evasion: 5 },
        skills: ["skill_goblin_club_bash"], // Define this skill
        xp_reward: 18, gold_reward: { min: 5, max: 10 },
        loot_table: [
            { itemId: "i001", chance: 70, quantity: {min:2, max:5} },
            { itemId: "w001", chance: 5 } // Chance to drop a rusty shortsword
        ],
        aiProfile: "attacker_with_skills",
        description: "A brutish goblin wielding a crude club."
    },
    goblin_brute_boss: { // For MQ002
        id: "goblin_brute_boss", name: "Groknar the Goblin Chief", level: 5, isBoss: true,
        stats: { maxHp: 120, currentHp: 120, attack: 20, defense: 10, speed: 8, accuracy: 80, critChance: 10, evasion: 8 },
        skills: ["skill_goblin_club_bash", "skill_goblin_frenzy_roar"], // Define these
        xp_reward: 100, gold_reward: { min: 50, max: 75 },
        loot_table: [
            { itemId: "w003", chance: 20 }, // Hunter's Bow
            { itemId: "r001", chance: 15 }, // Ring of Minor Vigor
            { itemId: "i004", chance: 100, questIdLink: "main002_scholars_plea" } // Drops Aristocrat's Signet Ring if quest is active
        ],
        aiProfile: "boss_mixed_attacker",
        description: "A hulking goblin adorned with crude trophies, snarling with authority."
    },

    // --- FOREST CREATURES ---
    forest_spider: {
        id: "forest_spider", name: "Forest Spider", level: 2,
        stats: { maxHp: 25, currentHp: 25, attack: 10, defense: 4, speed: 15, accuracy: 80, critChance: 8, evasion: 15 },
        skills: ["skill_spider_poison_bite"], // Define
        xp_reward: 15, gold_reward: { min: 1, max: 4 },
        loot_table: [
            { itemId: "c003", chance: 10 } // Antidote
        ],
        aiProfile: "fast_debuffer",
        description: "A large, hairy spider with menacing fangs dripping with venom."
    }
    // Add more enemies for variety and quest progression
};

// Define skills used by enemies if not already in skills.js
// e.g., skill_goblin_club_bash, skill_goblin_frenzy_roar, skill_spider_poison_bite

// Define Enemy Groups for Encounter Manager
export const ENEMY_GROUPS = {
    goblin_scouts_pair: { id: "goblin_scouts_pair", enemies: ["goblin_scout", "goblin_scout"] },
    goblin_thugs_one: { id: "goblin_thugs_one", enemies: ["goblin_thug"] },
    forest_spider_single: { id: "forest_spider_single", enemies: ["forest_spider"] },
    mq002_boss_fight: { id: "mq002_boss_fight", enemies: ["goblin_brute_boss", "goblin_scout"] } // Example for fixed quest encounter
};

// Add enemy skills to SKILLS_DATA in skills.js:
/*
// In skills.js
skill_goblin_club_bash: {
    id: "skill_goblin_club_bash", name: "Club Bash",
    description: "A crude but effective bash with a club.",
    mpCost: 0, type: "attack", target: "enemy_single", // Target is player/ally from enemy's perspective
    effect: { type: "damage", baseMultiplier: 1.1, element: "physical" }, // Based on enemy's attack
    animation: "bash_basic", forEnemyOnly: true
},
skill_goblin_frenzy_roar: {
    id: "skill_goblin_frenzy_roar", name: "Frenzy Roar",
    description: "The goblin chief roars, increasing its Attack.",
    mpCost: 0, type: "buff", target: "self",
    effect: { type: "status_effect", statusId: "se_atk_up_20", duration: 3 },
    animation: "roar_self", forEnemyOnly: true
},
skill_spider_poison_bite: {
    id: "skill_spider_poison_bite", name: "Poison Bite",
    description: "A venomous bite that may poison the target.",
    mpCost: 0, type: "attack_debuff", target: "enemy_single",
    effect: [
        { type: "damage", baseMultiplier: 0.8, element: "physical" },
        { type: "status_effect", statusId: "se_poison", duration: 3, chance: 50 }
    ],
    animation: "bite_venom", forEnemyOnly: true
}
// And add se_atk_up_20 to STATUS_EFFECTS_DATA
se_atk_up_20: { id: "se_atk_up_20", name: "Attack Up", type: "buff", statChanges: { attack: { multiplier: 1.2 } }, onApplyMsg: "{targetName} becomes enraged!", onRemoveMsg: "{targetName} calms down." },
*/
