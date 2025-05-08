// js/data/locations.js
import { getRandomInt } from '../utils.js'; 

export const LOCATIONS_DATA = {
    // --- STARTING AREA ---
    lumina_field: {
        id: "lumina_field",
        name: "Lumina Flower Field",
        description: "A vast field bathed in the soft, ethereal glow of countless Lumina Flowers. The air is calm, and a sense of ancient magic lingers. A faint path leads north into the Whispering Woods.",
        exits: { north: "whispering_woods_edge" },
        interactions: [
            {
                id: "search_flowers_gold", name: "Search for loose change",
                action: "custom", // This will be handled by 'interact search_flowers_gold'
                messageOnInteract: "You carefully search among the glowing flora.",
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
                action: "custom", // Handled by 'interact gather_lumina_petal'
                messageOnInteract: "You gently pluck a glowing petal.",
                 condition: (pm) => !pm.hasItem("i002"), // Only if player doesn't have one
                execute: (pm, ui) => {
                    pm.addItem("i002", 1); 
                    ui.addMessage({text: "The Lumina Petal feels warm in your hand. It might be useful.", type: "system-message"});
                }
            }
        ],
        onEnter: (uiManager, playerManager) => { 
            if (!playerManager.gameState.flags.get('intro_field_visited')) {
                 uiManager.addMessage("A gentle breeze rustles the Lumina Flowers. Your head still throbs, but the name... " + playerManager.gameState.partnerName + "... echoes clearly now.", "lore-message");
                playerManager.gameState.flags.set('intro_field_visited', true);
            }
        },
        music: "theme_serene_fields" 
    },
    whispering_woods_edge: {
        id: "whispering_woods_edge",
        name: "Edge of the Whispering Woods",
        description: "Ancient, gnarled trees loom before you, their leaves rustling with secrets. The path splits here, one leading deeper into the woods (north), another towards what looks like old ruins (east), and the path back to the fields (south).",
        exits: {
            south: "lumina_field",
            north: "deep_woods_path", 
            east: "ruined_outpost_exterior"
        },
        interactions: [
            { id: "listen_to_woods", name: "Listen to the woods", action: "examine", examineText: "The wind whispers through the leaves, carrying faint, unidentifiable sounds. You feel a sense of unease."}
        ],
        encounterTable: [ 
            { enemyGroupId: "goblin_scout_single", chance: 30 }, 
            { enemyGroupId: "forest_spider_single", chance: 20 },
            { enemyGroupId: "goblin_scouts_pair", chance: 10 } 
        ],
        firstVisitMessage: "The air grows cooler as you approach the ancient woods. A shiver runs down your spine."
    },
    // --- ADDED MISSING LOCATION ---
    deep_woods_path: {
        id: "deep_woods_path",
        name: "Deep Woods Path",
        description: "The path winds deeper under the heavy canopy. Sunlight struggles to pierce through the leaves. The air is damp and smells of earth and decay. You hear rustling in the undergrowth.",
        exits: {
            south: "whispering_woods_edge",
            north: "sleepy_hollow_gates", // Leads towards the village
            // west: "hidden_grove" // Example future path
        },
        encounterTable: [
            { enemyGroupId: "goblin_scouts_pair", chance: 25 },
            { enemyGroupId: "forest_spider_single", chance: 35 },
            { enemyGroupId: "goblin_thug", chance: 15 } // Thugs deeper in
        ],
        interactions: [
             { id: "examine_tracks", name: "Examine tracks", action: "examine", examineText: "You see various tracks - some small goblin prints, some multi-legged skittering marks, and larger, indistinct prints." }
        ],
        notes: (pm) => pm.gameState.flags.get("learned_of_deep_woods_hermit") ? "You recall hearing the hermit lives somewhere in these woods..." : ""
    },
    // -----------------------------
    ruined_outpost_exterior: {
        id: "ruined_outpost_exterior",
        name: "Ruined Outpost Exterior",
        description: "Crumbling stone walls mark what was once a small watchtower or outpost. It looks abandoned, but a faint light flickers from a broken window.",
        exits: { west: "whispering_woods_edge", enter: "ruined_outpost_interior" },
        interactions: [
            { id: "examine_walls", name: "Examine crumbling walls", action: "examine", examineText: "The stonework is ancient, possibly from the Dragon Wars era. Strange symbols are carved in places."}
        ],
        encounterTable: [{ enemyGroupId: "goblin_thugs_one", chance: 30 }],
        onEnter: (uiManager, playerManager) => {
            if (playerManager.gameState.quests["main001_find_partner"] && !playerManager.gameState.quests["main001_find_partner"].completed &&
                playerManager.gameState.quests["main001_find_partner"].stage === 0 && !playerManager.gameState.quests["main002_scholars_plea"]) { 
                uiManager.addMessage("You notice fresh goblin tracks leading towards the outpost entrance. Not exactly the lead you were hoping for, but worth investigating?", "lore-message");
            }
        }
    },
    ruined_outpost_interior: {
        id: "ruined_outpost_interior",
        name: "Ruined Outpost - Dusty Interior",
        description: "Inside, the air is stale and thick with dust. Cobwebs hang like shrouds. A single, sputtering torch illuminates a small, desperate-looking man huddled in a corner. He flinches as you enter.",
        exits: { leave: "ruined_outpost_exterior" },
        interactions: [
            {
                id: "elman_the_scholar", name: "Talk to the huddled man", // Use NPC ID as interaction ID for simplicity
                action: "dialogue", npcId: "elman_the_scholar", 
                condition: (pm) => { // Show 'Talk' only if the quest is at stage 1 (boss defeated) but not yet talked to
                    const quest = pm.gameState.quests["main002_scholars_plea"];
                    return quest?.stage === 1 && !pm.gameState.flags.get("elman_the_scholar_post_rescue_thanks_done");
                }
            },
             {
                id: "examine_corner", name: "Examine Corner", action: "examine",
                 condition: (pm) => pm.gameState.flags.get("elman_rescued_and_talked"), // Only after Elman leaves
                examineText: "Where the scholar was hiding, you see some discarded notes and a dropped quill. He left in a hurry."
            }
        ],
        onEnter: (uiManager, playerManager) => {
             if (playerManager.gameState.quests["main002_scholars_plea"]?.stage === 0 && !playerManager.gameState.flags.get("ruined_outpost_interior_fixed_encounter_cleared")) {
                uiManager.addMessage("'Help me!' the man cries out as the goblins turn towards you. 'Protect my research!'", "dialogue");
            }
        },
        // Fixed encounter triggers immediately via EncounterManager on location enter if conditions met
        encounterTableFixed: ["goblin_brute_boss", "goblin_scout"], 
        flagsOnClear: ["outpost_cleared"] // Optional: Flag set by EncounterManager upon clearing fixed encounter
    },

    // --- SLEEPY HOLLOW ---
    sleepy_hollow_gates: {
        id: "sleepy_hollow_gates",
        name: "Sleepy Hollow Gates",
        description: "A rickety wooden gate marks the entrance to the small village of Sleepy Hollow. It seems quiet, perhaps a little *too* quiet.",
        exits: { enter: "sleepy_hollow_square", south: "deep_woods_path"  },
        onEnter: (uiManager, playerManager) => {
            uiManager.addMessage("The village of Sleepy Hollow. It looks peaceful enough, but you sense an underlying tension.", "system-message");
        }
    },
    sleepy_hollow_square: {
        id: "sleepy_hollow_square",
        name: "Sleepy Hollow Square",
        description: "The modest village square. A few shuttered stalls, a mossy well, and a notice board. An inn called 'The Snoozing Dragon' stands to the north, and a path leads east towards what looks like an academy.",
        exits: {
            leave: "sleepy_hollow_gates",
            north: "snoozing_dragon_inn",
            east: "lyceum_path", 
            west: "hollow_general_store" 
        },
        interactions: [
            { id: "examine_notice_board", name: "Examine Notice Board", action: "custom", 
              messageOnInteract: "You examine the notice board...",
              execute: (pm, ui) => {
                let notices = [];
                if (!pm.gameState.quests["side001_lost_cat"] && !pm.gameState.flags.get("side001_lost_cat_completed")) {
                   notices.push("- 'MISSING: My dear cat, Mittens. Fluffy, answers to 'kitty'. Last seen near the old well. Reward offered! - Old Lady Gable'");
                   ui.renderActionButtons([{text: "Ask about 'Lost Cat'", command: "quest start side001_lost_cat"}]); // Button to start quest
                } else {
                   notices.push("- A faded poster about a local festival, long past.");
                   ui.renderActionButtons([]); // Clear buttons if quest is done/active
                }
                if (notices.length > 0) {
                    ui.addMessage({text: notices.join("<br/>"), type: "lore-message"});
                } else {
                    ui.addMessage({text: "The notice board is empty.", type: "system-message"});
                }
            }},
             { id: "examine_well", name: "Examine Well", action: "examine", examineText: "The old well looks deep and dark. You hear a faint splashing sound.", 
               condition: (pm) => pm.gameState.quests["side001_lost_cat"]?.stage === 0, // Only if looking for cat
               execute: (pm, ui) => { // Set flag when well is examined during quest stage 0
                  ui.addMessage({text: "Peering down, you spot a pair of glowing eyes reflecting the faint light! And... is that a cat toy floating nearby?", type: 'system highlight-color'});
                  questManager.setQuestFlag("found_mittens_cat"); // Progress quest
               }
             },
             { id: "talk_gable", name: "Talk to Old Lady Gable", action: "dialogue", npcId: "old_lady_gable", 
               condition: (pm) => pm.gameState.quests["side001_lost_cat"]?.stage === 1, // Only show if you found Mittens
                // Dialogue should handle setting the final flag "returned_mittens_to_gable"
             },
            { id: "talk_villager_generic", name: "Talk to a Villager", action: "dialogue", npcId: "generic_hollow_villager", examineText: "A weary-looking villager glances at you nervously." }
        ],
         onEnter: (ui, pm) => {
            // Check if MQ001 stage requires learning about hermit
             if (pm.gameState.quests["main001_find_partner"]?.stage === 1) {
                 // Set flag after short delay to simulate hearing gossip or asking around
                 setTimeout(() => {
                      questManager.setQuestFlag("learned_of_deep_woods_hermit");
                      ui.addMessage("You overhear some villagers whispering about a strange hermit living deep in the woods north of here...", "system-message");
                 }, 1500);
             }
        }
    },
    snoozing_dragon_inn: {
        id: "snoozing_dragon_inn",
        name: "The Snoozing Dragon Inn",
        description: "A cozy, if slightly dusty, inn. A few patrons nurse drinks quietly. The innkeeper polishes a mug behind the bar.",
        exits: { south: "sleepy_hollow_square" },
        interactions: [
            {id: "talk_innkeeper", name: "Talk to Innkeeper", action: "dialogue", npcId: "innkeeper_barry"},
            {id: "rent_room", name: "Rent a Room (10G)", action: "custom", cost: 10, messageOnInteract: "You approach the innkeeper about a room.", execute: (pm, ui) => {
                if (pm.spendGold(10)) {
                    ui.addMessage({text: "Innkeeper Barry nods. 'Right this way.' You rest for the night.", type: 'success-message'});
                    // Add rest logic: restore HP/MP, advance time maybe?
                    pm.gameState.derivedStats.currentHp = pm.gameState.derivedStats.maxHp;
                    pm.gameState.derivedStats.currentMp = pm.gameState.derivedStats.maxMp;
                    pm.gameState.allies.forEach(ally => {
                        ally.derivedStats.currentHp = ally.derivedStats.maxHp;
                        ally.derivedStats.currentMp = ally.derivedStats.maxMp;
                    });
                    pm.updateAllStats(); // Ensure stats reflect changes
                    eventBus.publish('playerDataUpdated', pm.getPublicData());
                    ui.addMessage({text: "You feel fully rested.", type: 'system highlight-color'});
                } else {
                     ui.addMessage({text: "'Might need a bit more coin for that, friend,' the innkeeper says apologetically.", type: 'dialogue'});
                }
            }}
        ],
         music: "theme_tavern_cozy"
    },
     hollow_general_store: {
        id: "hollow_general_store",
        name: "Sleepy Hollow General Store",
        description: "A small store stocked with basic supplies. Shelves hold foodstuffs, simple tools, and a few odd trinkets. A shopkeeper eyes you curiously.",
        exits: { east: "sleepy_hollow_square" },
        interactions: [
            {id: "talk_shopkeeper", name: "Talk to Shopkeeper", action: "dialogue", npcId: "shopkeeper_hollow"},
            // Add buy/sell interaction later
        ]
    },
    lyceum_path: {
        id: "lyceum_path",
        name: "Path to the Lyceum",
        description: "A well-maintained path leads towards an impressive building in the distance, clearly an institution of learning. You see a small, elegant annex to its side (east). The main gates lie north.",
        exits: { west: "sleepy_hollow_square", north: "lyceum_arcanum_gates", east: "study_hub_entrance" },
        condition: (pm) => pm.gameState.flags.get("access_to_lyceum_granted"), 
        conditionFailMessage: "A shimmering barrier blocks the path north and east. You need permission to proceed." // Message if condition fails
    },
    lyceum_arcanum_gates: {
        id: "lyceum_arcanum_gates",
        name: "Lyceum Arcanum Gates",
        description: "Massive, ornate gates inscribed with arcane symbols mark the entrance to the Lyceum Arcanum proper. Stern-faced guards watch passersby.",
        exits: { south: "lyceum_path" },
        interactions: [
             {id: "talk_guard", name: "Talk to Guard", action: "dialogue", npcId: "lyceum_guard"},
        ]
        // Add condition for entry later
    },
    study_hub_entrance: {
        id: "study_hub_entrance",
        name: "Study Hub Entrance",
        description: "A welcoming, if somewhat eccentric, annex building. A sign reads 'The Elmsworth Study Hub - All Curious Minds Welcome!' You feel the hum of intellectual energy.",
        exits: { west: "lyceum_path", enter: "study_hub_interior" },
        condition: (pm) => pm.gameState.flags.get("study_hub_unlocked"), 
        conditionFailMessage: "The door to the Study Hub seems magically sealed. Perhaps you need an introduction?" // Message if condition fails
    },
    study_hub_interior: {
        id: "study_hub_interior",
        name: "The Study Hub",
        description: "Inside, scholars and mages pore over scrolls and tinker with apparatuses. Books line the walls. A peculiar, shimmering device hums in one corner, attended by a slightly frazzled-looking gnome.",
        exits: { leave: "study_hub_entrance" },
        interactions: [
             { id: "talk_gnome_proctor", name: "Talk to Gnome Proctor", action: "dialogue", npcId: "proctor_fizzwick" },
             { id: "study_easy_math", name: "Study: Easy Math (Gain 1 SP)", action: "study_sp", sp_reward: 1, message: "You spend some time reviewing basic calculations. +1 SP", cost: { time: 5 } }, 
             { id: "study_history_quiz", name: "Study: History Quiz (Gain 3 SP)", action: "study_sp", sp_reward: 3, message: "You test your knowledge of Aethelgard's past. +3 SP", cost: { time: 10 } },
            { id: "claim_welcome_sp", name: "Ask about Welcome Stipend", action: "claim_sp", sp_amount: 100, message: "'Ah, a new face!' the proctor chirps. 'Lord Elmsworth insists all newcomers receive a stipend for their initial studies. Here you are!'",
              alreadyClaimedMessage: "The proctor smiles. 'You've already received your welcome stipend, scholar!'",
              condition: (pm) => !pm.gameState.flags.get("claimed_welcome_sp_hub")},
            { id: "gacha_pull_device", name: "Use Shimmering Device (10 SP)", action: "gacha_pull", poolId: "standard_study_rewards", message: "You approach the shimmering device..." }
        ],
         onEnter: (ui, pm) => {
            if (!pm.gameState.flags.get("study_hub_intro_done")) {
                ui.addMessage("Lord Elmsworth's generosity has provided this haven for scholars. You feel a surge of intellectual curiosity.", "system-message");
                pm.gameState.flags.set("study_hub_intro_done", true);
            }
        },
        music: "theme_library_calm"
    }
};
