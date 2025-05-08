// js/data/enemies.js
import { SKILLS_DATA } from './skills.js'; 

export const ENEMIES_DATA = {
    // --- GOBLINS ---
    goblin_scout: {
        id: "goblin_scout", name: "Goblin Scout", level: 1,
        stats: { maxHp: 20, currentHp: 20, attack: 8, defense: 3, speed: 12, accuracy: 75, critChance: 5, evasion: 10, maxMp: 0, currentMp: 0, mpRegen: 0 }, 
        skills: [],
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
        stats: { maxHp: 35, currentHp: 35, attack: 12, defense: 5, speed: 10, accuracy: 70, critChance: 5, evasion: 5, maxMp: 10, currentMp: 10, mpRegen: 0.2 }, 
        skills: ["skill_goblin_club_bash"],
        xp_reward: 18, gold_reward: { min: 5, max: 10 },
        loot_table: [
            { itemId: "i001", chance: 70, quantity: {min:2, max:5} },
            { itemId: "w001", chance: 5 }
        ],
        aiProfile: "attacker_with_skills",
        description: "A brutish goblin wielding a crude club."
    },
    goblin_brute_boss: {
        id: "goblin_brute_boss", name: "Groknar the Goblin Chief", level: 5, isBoss: true,
        stats: { maxHp: 120, currentHp: 120, attack: 20, defense: 10, speed: 8, accuracy: 80, critChance: 10, evasion: 8, maxMp: 20, currentMp: 20, mpRegen: 0.5 }, 
        skills: ["skill_goblin_club_bash", "skill_goblin_frenzy_roar"],
        xp_reward: 100, gold_reward: { min: 50, max: 75 },
        loot_table: [
            { itemId: "w003", chance: 20 }, // Hunter's Bow
            { itemId: "r001", chance: 15 }, // Ring of Minor Vigor
            { itemId: "i004", chance: 100 } // Aristocrat's Signet Ring - No longer quest linked here, quest objective will be flag
        ],
        aiProfile: "boss_mixed_attacker",
        description: "A hulking goblin adorned with crude trophies, snarling with authority."
    },

    // --- FOREST CREATURES ---
    forest_spider: {
        id: "forest_spider", name: "Forest Spider", level: 2,
        stats: { maxHp: 25, currentHp: 25, attack: 10, defense: 4, speed: 15, accuracy: 80, critChance: 8, evasion: 15, maxMp: 5, currentMp: 5, mpRegen: 0.1 }, 
        skills: ["skill_spider_poison_bite"],
        xp_reward: 15, gold_reward: { min: 1, max: 4 },
        loot_table: [
            { itemId: "c003", chance: 10 }
        ],
        aiProfile: "fast_debuffer",
        description: "A large, hairy spider with menacing fangs dripping with venom."
    }
};

export const ENEMY_GROUPS = {
    goblin_scout_single: { id: "goblin_scout_single", enemies: ["goblin_scout"] }, // New single scout group
    goblin_scouts_pair: { id: "goblin_scouts_pair", enemies: ["goblin_scout", "goblin_scout"] },
    goblin_thugs_one: { id: "goblin_thugs_one", enemies: ["goblin_thug"] },
    forest_spider_single: { id: "forest_spider_single", enemies: ["forest_spider"] },
    mq002_boss_fight: { id: "mq002_boss_fight", enemies: ["goblin_brute_boss", "goblin_scout"] }
};

// For ALLY_DATA, it's better placed in allies.js if it's primarily ally definitions.
// If combatManager needs ALLY_DATA.sansan_dino.id, it should import from allies.js.
// For now, I will ensure it's correctly imported in combatManager if needed.

export { ALLY_DATA } from './allies.js'; // Re-export ALLY_DATA from allies.js if it's there
