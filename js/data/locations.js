// js/data/locations.js
import { getRandomInt } from '../utils.js'; // For random gold
// No import for playerManager or uiManager here, they are passed as arguments

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
                        uiManager.addMessage({text: "You've already searched here thoroughly for coins.", type: "system-message"});
                        return;
                    }
                    const goldFound = getRandomInt(3, 8);
                    playerManager.addGold(goldFound);
                    playerManager.gameState.flags.set('lumina_field_searched_gold', true);
                    uiManager.addMessage({text: `You find ${goldFound} gold pieces amidst the petals!`, type: "success-message"});
                }
            },
            {
                id: "gather_lumina_petal", name: "Gather a Lumina Petal",
                action: "custom",
                message: "You gently pluck a glowing petal.",
                 condition: (pm) => !pm.hasItem("i002"), // Only if player doesn't have one for quest
                execute: (pm, ui) => {
                    pm.addItem("i002", 1); // For early quest
                    ui.addMessage({text: "The Lumina Petal feels warm in your hand.", type: "system-message"});
                }
            }
        ],
        onEnter: (uiManager, playerManager) => { // uiManager here is the simplified {addMessage} object
            if (!playerManager.gameState.flags.get('intro_field_visited')) {
                playerManager.gameState.flags.set('intro_field_visited', true);
            }
             uiManager.addMessage("A gentle breeze rustles the Lumina Flowers. Your head still throbs, but the name... " + playerManager.gameState.partnerName + "... echoes clearly now.", "lore-message");
        },
        music: "theme_serene_fields" 
    },
    whispering_woods_edge: {
        id: "whispering_woods_edge",
        name: "Edge of the Whispering Woods",
        description: "Ancient, gnarled trees loom before you, their leaves rustling with secrets. The path splits here, one leading deeper into the woods, another towards what looks like old ruins to the east.",
        exits: {
            south: "lumina_field",
            north: "deep_woods_path", 
            east: "ruined_outpost_exterior"
        },
        interactions: [
            { id: "listen_to_woods", name: "Listen to the woods", action: "examine", message: "The wind whispers through the leaves, carrying faint, unidentifiable sounds. You feel a sense of unease."}
        ],
        encounterTable: [ 
            { enemyGroupId: "goblin_scout_single", chance: 30 }, // Higher chance for single scout
            { enemyGroupId: "forest_spider_single", chance: 20 },
            { enemyGroupId: "goblin_scouts_pair", chance: 10 } // Lower chance for pair
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
            if (playerManager.gameState.quests["main001_find_partner"] && !playerManager.gameState.quests["main001_find_partner"].completed &&
                playerManager.gameState.quests["main001_find_partner"].stage === 0) { 
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
                action: "dialogue", npcId: "elman_the_scholar", 
                condition: (pm) => {
                    const quest = pm.gameState.quests["main002_scholars_plea"];
                    return !quest || (quest.stage === 1 && !pm.gameState.flags.get("elman_the_scholar_post_rescue_thanks_done"));
                }
            }
        ],
        onEnter: (uiManager, playerManager) => {
             if (playerManager.gameState.quests["main002_scholars_plea"]?.stage === 0 && !playerManager.gameState.flags.get("ruined_outpost_interior_fixed_encounter_cleared")) {
                uiManager.addMessage("'Help me!' the man cries out as you enter. 'Those goblins... they took my research!'", "dialogue");
            } else if (playerManager.gameState.flags.get("ruined_outpost_interior_fixed_encounter_cleared") && playerManager.gameState.quests["main002_scholars_plea"]?.stage === 0) {
                // This case means boss defeated, quest stage should advance.
                // QuestManager will handle this through flag check.
            }
        },
        encounterTableFixed: ["goblin_brute_boss", "goblin_scout"], 
        flagsOnClear: ["outpost_cleared"] 
    },

    // --- SLEEPY HOLLOW (Town Area) ---
    sleepy_hollow_gates: {
        id: "sleepy_hollow_gates",
        name: "Sleepy Hollow Gates",
        description: "A rickety wooden gate marks the entrance to the small village of Sleepy Hollow. It seems quiet, almost too quiet.",
        exits: { enter: "sleepy_hollow_square", south: "deep_woods_path"  },
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
            east: "lyceum_path", 
            west: "hollow_general_store" 
        },
        interactions: [
            { id: "examine_notice_board", name: "Examine Notice Board", action: "custom", execute: (pm, ui) => {
                ui.addMessage({text: "The notice board has a few weathered parchments:", type: "system-message"});
                if (!pm.gameState.quests["side001_lost_cat"] && !pm.gameState.flags.get("side001_lost_cat_completed")) {
                    ui.addMessage({text: "- 'MISSING: My dear cat, Mittens. Last seen near the old well. Reward offered! - Old Lady Gable'", type: "lore-message"});
                    ui.renderActionButtons([{text: "Accept 'Lost Cat' Quest", command: "quest start side001_lost_cat"}]);
                } else {
                     ui.addMessage({text: "- A faded poster about a local festival, long past.", type: "system-message"});
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
        condition: (pm) => pm.gameState.flags.get("access_to_lyceum_granted"), 
        onEnterMessage: "The path to the Lyceum Arcanum. Only those with permission may proceed further north."
    },
    study_hub_entrance: {
        id: "study_hub_entrance",
        name: "Study Hub Entrance",
        description: "A welcoming, if somewhat eccentric, annex building. A sign reads 'The Elmsworth Study Hub - All Curious Minds Welcome!'",
        exits: { west: "lyceum_path", enter: "study_hub_interior" },
        condition: (pm) => pm.gameState.flags.get("study_hub_unlocked"), 
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
            { id: "study_easy_math", name: "Study: Easy Math (Gain 1 SP)", action: "study_sp", difficulty: "easy", subject: "math", sp_reward: 1, message: "You spend some time on basic calculations.", cost: { time: 5 } }, 
            { id: "study_history_quiz", name: "Study: History Quiz (Gain 3 SP)", action: "study_sp", difficulty: "medium", subject: "history", sp_reward: 3, message: "You test your knowledge of Aethelgard's past.", cost: { time: 10 } },
            { id: "claim_welcome_sp", name: "Claim Welcome Gift (100 SP)", action: "claim_sp", sp_amount: 100, message: "A kindly proctor smiles. 'Ah, a new face! Lord Elmsworth insists all newcomers receive a stipend for their initial studies.'",
              condition: (pm) => !pm.gameState.flags.get("claimed_welcome_sp_hub")},
            { id: "gacha_pull_device", name: "Use Shimmering Device (10 SP)", action: "gacha_pull", poolId: "standard_study_rewards", cost: 10, message: "You insert 10 SP into the strange device..." }
        ],
        music: "theme_library_calm"
    }
}
