// js/data/locations.js
import { getRandomInt } from '../utils.js'; // For random gold

export const LOCATIONS_DATA = {
    // --- STARTING AREA ---
    lumina_field: {
        id: "lumina_field",
        name: "Lumina Flower Field",
        description: "A vast field bathed in the soft, ethereal glow of countless Lumina Flowers. The air is calm, and a sense of ancient magic lingers. A faint path leads north.",
        exits: { north: "whispering_woods_edge" },
        interactions: [
            {
                id: "search_flowers_gold", name: "Search for loose change",
                action: "custom",
                message: "You carefully search among the glowing flora.",
                execute: (playerManager, uiManager) => {
                    if (playerManager.gameState.flags.get('lumina_field_searched_gold')) {
                        uiManager.addMessage("You've already searched here thoroughly for coins.", "system-message");
                        return;
                    }
                    const goldFound = getRandomInt(3, 8);
                    playerManager.addGold(goldFound);
                    playerManager.gameState.flags.set('lumina_field_searched_gold', true);
                    uiManager.addMessage(`You find ${goldFound} gold pieces amidst the petals!`, "success-message");
                }
            },
            {
                id: "gather_lumina_petal", name: "Gather a Lumina Petal",
                action: "custom",
                message: "You gently pluck a glowing petal.",
                 condition: (pm) => !pm.hasItem("i002"), // Only if player doesn't have one for quest
                execute: (pm, ui) => {
                    pm.addItem("i002", 1); // For early quest
                    ui.addMessage("The Lumina Petal feels warm in your hand.", "system-message");
                }
            }
        ],
        onEnter: (uiManager, playerManager) => {
            if (!playerManager.gameState.flags.get('intro_field_visited')) {
                // This initial lore will now be part of the animated intro sequence handled by UIManager
                playerManager.gameState.flags.set('intro_field_visited', true);
            }
             uiManager.addMessage("A gentle breeze rustles the Lumina Flowers. Your head still throbs, but the name... " + playerManager.gameState.partnerName + "... echoes clearly now.", "lore-message", true, 30);
        },
        music: "theme_serene_fields" // Placeholder for future sound system
    },
    whispering_woods_edge: {
        id: "whispering_woods_edge",
        name: "Edge of the Whispering Woods",
        description: "Ancient, gnarled trees loom before you, their leaves rustling with secrets. The path splits here, one leading deeper into the woods, another towards what looks like old ruins to the east.",
        exits: {
            south: "lumina_field",
            north: "deep_woods_path", // Leads to more dangerous area
            east: "ruined_outpost_exterior"
        },
        interactions: [
            { id: "listen_to_woods", name: "Listen to the woods", action: "examine", message: "The wind whispers through the leaves, carrying faint, unidentifiable sounds. You feel a sense of unease."}
        ],
        encounterTable: [ // Chance to encounter enemies when entering this location
            { enemyGroupId: "goblin_scouts_pair", chance: 25 }, // 25% chance for 2 goblin scouts
            { enemyGroupId: "forest_spider_single", chance: 15 }
        ],
        firstVisitMessage: "The air grows cooler as you approach the ancient woods. A shiver runs down your spine."
    },
    ruined_outpost_exterior: {
        id: "ruined_outpost_exterior",
        name: "Ruined Outpost Exterior",
        description: "Crumbling stone walls mark what was once a small watchtower or outpost. It looks abandoned, but a faint light flickers from a broken window.",
        exits: { west: "whispering_woods_edge", enter: "ruined_outpost_interior" },
        interactions: [
            { id: "examine_walls", name: "Examine crumbling walls", action: "examine", message: "The stonework is ancient, possibly from the Dragon Wars era. Strange symbols are carved in places."}
        ],
        encounterTable: [{ enemyGroupId: "goblin_thugs_one", chance: 30 }],
        onEnter: (uiManager, playerManager) => {
            // Start MQ002 if player has MQ001 active and reaches here
            if (playerManager.gameState.quests["main001_find_partner"] && !playerManager.gameState.quests["main001_find_partner"].completed &&
                playerManager.gameState.quests["main001_find_partner"].stage === 0) { // Assuming stage 0 is to find clues
                // This is where MQ002 might naturally start or a clue appears
                uiManager.addMessage("You notice fresh tracks leading towards the outpost entrance. Could this be a lead to finding " + playerManager.gameState.partnerName + "?", "lore-message");
            }
        }
    },
    ruined_outpost_interior: {
        id: "ruined_outpost_interior",
        name: "Ruined Outpost - Dusty Interior",
        description: "Inside, the air is stale and thick with dust. Cobwebs hang like shrouds. A single, sputtering torch illuminates a small, desperate-looking man huddled in a corner.",
        exits: { leave: "ruined_outpost_exterior" },
        interactions: [
            {
                id: "talk_elman", name: "Talk to the huddled man",
                action: "dialogue", npcId: "elman_the_scholar", // Link to NPC dialogue
                condition: (pm) => !pm.gameState.flags.get("elman_rescued") && !pm.gameState.flags.get("elman_hostile"),
            }
        ],
        // This location could trigger MQ002: The Scholar's Plea
        // Or if MQ002 is active, Elman is here.
        onEnter: (uiManager, playerManager) => {
             if (playerManager.gameState.quests["main002_scholars_plea"]?.stage === 0 && !playerManager.gameState.flags.get("elman_rescued")) {
                uiManager.addMessage("'Help me!' the man cries out as you enter. 'Those goblins... they took my research!'", "dialogue");
                // Could automatically start combat here if goblins are with him initially
                // encounterManager.startFixedCombat(["goblin_brute_boss", "goblin_scout_single"]);
            }
        },
        encounterTableFixed: ["goblin_brute_boss", "goblin_scout_single"], // Fixed encounter on first entry if quest conditions met
        flagsOnClear: ["outpost_cleared"] // Flag set when fixed encounter is won
    },

    // --- SLEEPY HOLLOW (Town Area) ---
    sleepy_hollow_gates: {
        id: "sleepy_hollow_gates",
        name: "Sleepy Hollow Gates",
        description: "A rickety wooden gate marks the entrance to the small village of Sleepy Hollow. It seems quiet, almost too quiet.",
        exits: { enter: "sleepy_hollow_square", south: "deep_woods_path" /* Or another route */ },
        onEnter: (uiManager, playerManager) => {
            uiManager.addMessage("The village of Sleepy Hollow. It looks peaceful enough, but you sense an underlying tension.", "system-message");
        }
    },
    sleepy_hollow_square: {
        id: "sleepy_hollow_square",
        name: "Sleepy Hollow Square",
        description: "The modest village square. A few shuttered stalls, a well, and a notice board. An inn called 'The Snoozing Dragon' stands to the north, and a path leads east towards what looks like an academy.",
        exits: {
            leave: "sleepy_hollow_gates",
            north: "snoozing_dragon_inn",
            east: "lyceum_path", // Path to Study Hub / Lyceum
            west: "hollow_general_store" // Future shop
        },
        interactions: [
            { id: "examine_notice_board", name: "Examine Notice Board", action: "custom", execute: (pm, ui) => {
                // This is where side quests could be picked up
                ui.addMessage("The notice board has a few weathered parchments:", "system-message");
                if (!pm.gameState.quests["side001_lost_cat"] && !pm.gameState.flags.get("side001_lost_cat_completed")) {
                    ui.addMessage("- 'MISSING: My dear cat, Mittens. Last seen near the old well. Reward offered! - Old Lady Gable'", "lore-message");
                    ui.renderActionButtons([{text: "Accept 'Lost Cat' Quest", command: "quest start side001_lost_cat"}]);
                } else {
                     ui.addMessage("- A faded poster about a local festival, long past.", "system-message");
                }
            }},
            { id: "talk_villager_generic", name: "Talk to a Villager", action: "dialogue", npcId: "generic_hollow_villager" }
        ]
    },
    lyceum_path: {
        id: "lyceum_path",
        name: "Path to the Lyceum",
        description: "A well-maintained path leads towards an impressive building in the distance, clearly an institution of learning. You see a small, elegant annex to its side.",
        exits: { west: "sleepy_hollow_square", north: "lyceum_arcanum_gates", east: "study_hub_entrance" },
        condition: (pm) => pm.gameState.flags.get("access_to_lyceum_granted"), // e.g., from MQ002
        onEnterMessage: "The path to the Lyceum Arcanum. Only those with permission may proceed further north."
    },
    study_hub_entrance: {
        id: "study_hub_entrance",
        name: "Study Hub Entrance",
        description: "A welcoming, if somewhat eccentric, annex building. A sign reads 'The Elmsworth Study Hub - All Curious Minds Welcome!'",
        exits: { west: "lyceum_path", enter: "study_hub_interior" },
        condition: (pm) => pm.gameState.flags.get("study_hub_unlocked"), // Unlocked by MQ002
        onEnter: (ui, pm) => {
            if (!pm.gameState.flags.get("study_hub_intro_done")) {
                ui.addMessage("Lord Elmsworth's generosity has provided this haven for scholars. You feel a surge of intellectual curiosity.", "system-message");
                pm.gameState.flags.set("study_hub_intro_done", true);
            }
        }
    },
    study_hub_interior: {
        id: "study_hub_interior",
        name: "The Study Hub",
        description: "Inside, scholars and mages of all ages are engrossed in books and experiments. A peculiar, shimmering device hums in one corner, drawing occasional glances.",
        exits: { leave: "study_hub_entrance" },
        interactions: [
            { id: "study_easy_math", name: "Study: Easy Math (Gain 1 SP)", action: "study_sp", difficulty: "easy", subject: "math", sp_reward: 1, message: "You spend some time on basic calculations.", cost: { time: 5 } }, // time in minutes, conceptual
            { id: "study_history_quiz", name: "Study: History Quiz (Gain 3 SP)", action: "study_sp", difficulty: "medium", subject: "history", sp_reward: 3, message: "You test your knowledge of Aethelgard's past.", cost: { time: 10 } },
            { id: "claim_welcome_sp", name: "Claim Welcome Gift (100 SP)", action: "claim_sp", sp_amount: 100, message: "A kindly proctor smiles. 'Ah, a new face! Lord Elmsworth insists all newcomers receive a stipend for their initial studies.'",
              condition: (pm) => !pm.gameState.flags.get("claimed_welcome_sp_hub")},
            { id: "gacha_pull_device", name: "Use Shimmering Device (10 SP)", action: "gacha_pull", poolId: "standard_study_rewards", cost: 10, message: "You insert 10 SP into the strange device..." }
        ],
        music: "theme_library_calm"
    }
    // More locations for main quests and side quests
};
```

---
**7. `js/data/enemies.js`** (Define actual enemies)

```javascript
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
