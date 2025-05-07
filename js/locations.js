// js/data/locations.js
export const LOCATIONS_DATA = {
    lumina_field: {
        id: "lumina_field",
        name: "Lumina Flower Field",
        description: "A vast field bathed in the soft, ethereal glow of countless Lumina Flowers. The air is calm, and a sense of ancient magic lingers.",
        exits: { north: "crossroads" },
        interactions: [
            {
                id: "search_flowers",
                name: "Search among the flowers",
                action: "search",
                message: "You carefully search among the glowing flora.",
                // result: { type: "item", itemId: "i002", quantity: 1, once: true, message: "You find a perfectly preserved Lumina Petal!" }
                // For V0.1, simple gold find
                result: (playerManager) => {
                    const goldFound = playerManager.utils.getRandomInt(1, 5);
                    playerManager.addGold(goldFound);
                    return `You find ${goldFound} gold pieces amidst the petals.`;
                }
            }
        ],
        onEnter: (uiManager, playerManager) => {
            // Special event on first enter after character creation
            if (!playerManager.gameState.flags.get('intro_field_visited')) {
                uiManager.addMessage("A gentle breeze rustles the Lumina Flowers. Your head still throbs, but the name... [Partner's Name]... echoes clearly now.", "lore-message");
                playerManager.gameState.flags.set('intro_field_visited', true);
            }
        }
    },
    crossroads: {
        id: "crossroads",
        name: "Old Crossroads",
        description: "An ancient, moss-covered crossroads. Paths lead in multiple directions. A weathered signpost is barely legible.",
        exits: {
            south: "lumina_field",
            north: "sleepy_hollow_entrance",
            east: "aristocrat_manor_gates" // For Study Hub unlock quest
        },
        interactions: [
            {
                id: "read_sign",
                name: "Examine signpost",
                action: "examine",
                message: "The signpost is worn. You can make out 'North: Hollow', 'South: Fields', 'East: Manor Ruins'."
            }
        ]
    },
    sleepy_hollow_entrance: {
        id: "sleepy_hollow_entrance",
        name: "Entrance to Sleepy Hollow",
        description: "A small, quiet village lies ahead. Smoke curls from a few chimneys. It seems peaceful.",
        exits: { south: "crossroads", north: "study_hub" }, // Study Hub access
        interactions: [
            {
                id: "talk_villager",
                name: "Talk to a passing villager",
                action: "dialogue", // Placeholder for future NPC system
                message: "A villager nods warily. 'Welcome to Sleepy Hollow, traveler. Be wary of the old manor to the east...tales say it's haunted.'"
            }
        ]
    },
    aristocrat_manor_gates: {
        id: "aristocrat_manor_gates",
        name: "Gates of Aristocrat Manor",
        description: "Imposing iron gates, rusted but still formidable, block entry to what was once a grand manor. It looks deserted, but you hear a faint cry from within.",
        exits: { west: "crossroads" },
        interactions: [
            {
                id: "investigate_cry",
                name: "Investigate the cry (Start Quest)",
                action: "quest_start",
                questId: "main002_save_aristocrat", // This will trigger the quest
                condition: (playerManager) => !playerManager.gameState.quests.main002_save_aristocrat,
                message: "You decide to investigate the strange sounds..."
            }
        ]
        // Future: Add an enemy encounter here as part of the quest
    },
    study_hub: {
        id: "study_hub",
        name: "The Study Hub",
        description: "A surprisingly well-kept annex, buzzing with quiet intellectual energy. Scholars pore over tomes, and a peculiar device hums in the corner.",
        exits: { south: "sleepy_hollow_entrance" },
        interactions: [
            {
                id: "study_easy_math",
                name: "Study: Easy Math (1 SP)",
                action: "study_sp",
                difficulty: "easy",
                subject: "math", // For future expansion
                sp_reward: 1,
                message: "You spend some time on basic calculations."
            },
            {
                id: "study_claim_free_spins",
                name: "Claim Welcome Gift (100 SP)",
                action: "claim_sp",
                sp_amount: 100,
                once: true, // Can only be claimed once
                message: "A kindly scholar notices you. 'Newcomer? Welcome! Here's a little something to get you started on your... studies.'"
            },
            {
                id: "gacha_pull_one",
                name: "Use Study Device (10 SP)",
                action: "gacha_pull",
                cost: 10,
                message: "You approach the humming device..."
                // Gacha logic will be in PlayerManager or a dedicated GachaManager
            }
        ],
        condition: (playerManager) => playerManager.gameState.flags.get('study_hub_unlocked'), // Only accessible if flag is set
        onEnter: (uiManager, playerManager) => {
            if (!playerManager.gameState.flags.get('study_hub_unlocked')) {
                uiManager.addMessage("This area seems restricted.", "error-message");
                // Potentially force move player back or just show message
                return false; // Prevent entry
            }
            uiManager.addMessage("Welcome to the Study Hub!", "system-message");
            return true;
        }
    }
};