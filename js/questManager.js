// js/questManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
// Import ITEMS_DATA if needed for item collection objectives
// import { ITEMS_DATA } from './data/items.js';

export const QUESTS_DATA = {
    main001_find_partner: {
        id: "main001_find_partner",
        name: "Echoes of a Lost Star",
        log: [
            "Your memories are fragmented, but one name echoes: [PartnerName]. Find clues about their whereabouts.",
            "You heard talk of strange occurrences near the old Aristocrat Manor east of the crossroads. It might be a lead."
        ],
        stages: [
            { // Stage 0
                objective: { type: "reach_location", locationId: "aristocrat_manor_gates" },
                onCompleteMessage: "You've reached the old manor gates. This must be the place.",
            },
            { // Stage 1
                objective: { type: "flag_set", flag: "aristocrat_saved" }, // Set by completing main002
                onCompleteMessage: "The aristocrat you saved mentioned seeing someone fitting [PartnerName]'s description heading towards the northern mountains. You should investigate further."
            }
            // More stages later
        ],
        rewards: { xp: 100, sp: 10 }
    },
    main002_save_aristocrat: {
        id: "main002_save_aristocrat",
        name: "A Cry in the Ruins",
        log: [
            "You heard a cry from within the Aristocrat Manor. Someone might be in trouble.",
            "You found Lord Elmsworth, a young aristocrat, trapped by minor fiends. Defeat them!",
            "Lord Elmsworth is safe. He mentioned seeing someone matching your lost partner's description. He also spoke of a 'Study Hub' he sponsors in Sleepy Hollow."
        ],
        stages: [
            { // Stage 0: Defeat placeholder "fiends" (conceptual for now, no combat yet)
              // For V0.1, auto-completes on starting, or add a simple flag-based interaction
                objective: { type: "interact", locationId: "aristocrat_manor_gates", interactionId: "placeholder_save_lord" },
                // This interaction would be added to aristocrat_manor_gates:
                // { id: "placeholder_save_lord", name: "Help the trapped person", action: "custom_event", eventName: "aristocrat_rescued_event" }
                // For now, let's make it simpler: flag set by interaction
                onCompleteMessage: "You manage to help the trapped individual, a young noble named Lord Elmsworth."
            },
            { // Stage 1: Talk to Elmsworth (conceptual dialogue)
                objective: { type: "flag_set", flag: "talked_to_elmsworth_after_rescue" }, // This flag would be set by a dialogue interaction
                onCompleteMessage: "Lord Elmsworth thanks you profusely. He mentions a 'Study Hub' he sponsors in Sleepy Hollow and gives you a pass. He also saw someone fitting [PartnerName]'s description heading north."
            }
        ],
        rewards: { xp: 150, gold: 50, sp: 25, items: [{itemId: "sp_orb_small", quantity: 1}] },
        onComplete: (pm) => {
            pm.gameState.flags.set('study_hub_unlocked', true);
            pm.gameState.flags.set('aristocrat_saved', true); // For main001 progression
            eventBus.publish('uiNotification', { message: "The Study Hub in Sleepy Hollow is now accessible!", type: 'system' });
        }
    }
};


class QuestManager {
    constructor() {
        // playerManager.gameState.quests will store { questId: { stage: 0, completed: false } }
    }

    startQuest(questId) {
        const questData = QUESTS_DATA[questId];
        if (!questData) {
            eventBus.publish('uiNotification', { message: `Unknown quest: ${questId}`, type: 'error' });
            return;
        }
        if (playerManager.gameState.quests[questId]) {
            eventBus.publish('uiNotification', { message: `Quest "${questData.name}" is already active or completed.`, type: 'system' });
            return;
        }

        playerManager.gameState.quests[questId] = { stage: 0, completed: false };
        const logText = this.getFormattedLogText(questData, 0);
        eventBus.publish('uiNotification', { message: `New Quest: ${questData.name}\n- ${logText}`, type: 'system' });
        eventBus.publish('playerDataUpdated', playerManager.getPublicData()); // Update UI
        this.checkQuestObjective(questId); // Check if stage 0 is already complete
    }
    
    getFormattedLogText(questData, stageIndex) {
        let text = questData.log[stageIndex] || "No description for this stage.";
        return text.replace("[PartnerName]", playerManager.gameState.partnerName);
    }

    advanceQuestStage(questId) {
        const questProgress = playerManager.gameState.quests[questId];
        const questData = QUESTS_DATA[questId];

        if (!questProgress || !questData || questProgress.completed) return;

        questProgress.stage++;
        if (questData.stages[questProgress.stage-1]?.onCompleteMessage) {
             let message = questData.stages[questProgress.stage-1].onCompleteMessage;
             message = message.replace("[PartnerName]", playerManager.gameState.partnerName);
             eventBus.publish('uiNotification', { message: message, type: 'success' });
        }


        if (questProgress.stage >= questData.stages.length) {
            this.completeQuest(questId);
        } else {
            const logText = this.getFormattedLogText(questData, questProgress.stage);
            eventBus.publish('uiNotification', { message: `Quest Updated: ${questData.name}\n- ${logText}`, type: 'system' });
            eventBus.publish('playerDataUpdated', playerManager.getPublicData());
            this.checkQuestObjective(questId); // Check next stage immediately
        }
    }

    completeQuest(questId) {
        const questProgress = playerManager.gameState.quests[questId];
        const questData = QUESTS_DATA[questId];
        if (!questProgress || !questData || questProgress.completed) return;

        questProgress.completed = true;
        eventBus.publish('uiNotification', { message: `Quest Completed: ${questData.name}!`, type: 'success' });

        // Grant rewards
        if (questData.rewards) {
            if (questData.rewards.xp) playerManager.addXp(questData.rewards.xp);
            if (questData.rewards.gold) playerManager.addGold(questData.rewards.gold);
            if (questData.rewards.sp) playerManager.addSp(questData.rewards.sp);
            if (questData.rewards.items) {
                questData.rewards.items.forEach(itemRef => playerManager.addItem(itemRef.itemId, itemRef.quantity));
            }
        }
        
        if (typeof questData.onComplete === 'function') {
            questData.onComplete(playerManager);
        }

        eventBus.publish('playerDataUpdated', playerManager.getPublicData());
        this.checkAllQuestObjectives(); // Other quests might depend on this one
    }

    checkQuestObjective(questId) {
        const questProgress = playerManager.gameState.quests[questId];
        const questData = QUESTS_DATA[questId];
        if (!questProgress || !questData || questProgress.completed) return;

        const currentStageData = questData.stages[questProgress.stage];
        if (!currentStageData || !currentStageData.objective) return;

        const objective = currentStageData.objective;
        let objectiveMet = false;

        switch (objective.type) {
            case "reach_location":
                if (playerManager.gameState.currentLocationId === objective.locationId) {
                    objectiveMet = true;
                }
                break;
            case "flag_set":
                if (playerManager.gameState.flags.get(objective.flag)) {
                    objectiveMet = true;
                }
                break;
            case "collect_item":
                // const itemCount = playerManager.gameState.inventory
                //     .filter(item => item.itemId === objective.itemId)
                //     .reduce((sum, item) => sum + item.quantity, 0);
                // if (itemCount >= objective.quantity) {
                //     objectiveMet = true;
                //     // Optionally remove items: playerManager.removeItem(objective.itemId, objective.quantity);
                // }
                // For V0.1, item collection is more complex, skip full implementation
                break;
            case "interact": // For specific interactions that might set a flag or trigger an event
                // This is usually tied to an interaction setting a flag, so covered by "flag_set"
                // Or a custom event that this quest manager would listen for.
                // For "main002_save_aristocrat" stage 0, we'll assume an interaction in aristocrat_manor_gates
                // sets a flag like 'lord_elmsworth_approached'.
                // For simplicity, let's assume starting main002_save_aristocrat sets a flag for its first stage.
                if (questId === "main002_save_aristocrat" && questProgress.stage === 0 && playerManager.gameState.flags.get('aristocrat_rescued_event_triggered')) {
                    objectiveMet = true;
                }
                // A more robust way is for the interaction itself to publish an event that QuestManager listens to.
                break;
            // Add more objective types: defeat_enemy, talk_npc, etc.
        }

        if (objectiveMet) {
            this.advanceQuestStage(questId);
        }
    }

    checkAllQuestObjectives() {
        for (const questId in playerManager.gameState.quests) {
            this.checkQuestObjective(questId);
        }
    }
    
    showQuestLog() {
        let logOutput = "<strong>Active Quests:</strong><br>";
        let activeQuestFound = false;
        for (const questId in playerManager.gameState.quests) {
            const questProgress = playerManager.gameState.quests[questId];
            const questData = QUESTS_DATA[questId];
            if (questData && !questProgress.completed) {
                activeQuestFound = true;
                const stageDesc = this.getFormattedLogText(questData, questProgress.stage);
                logOutput += `<strong>${questData.name}</strong>: ${stageDesc}<br>`;
            }
        }
        if (!activeQuestFound) {
            logOutput += "No active quests.<br>";
        }
        eventBus.publish('addMessage', { text: logOutput, type: 'system-message' });
    }
}

export const questManager = new QuestManager();

// Example of how an interaction might trigger a quest objective
// This would be in InputParser or the interaction handler itself
// eventBus.subscribe('aristocrat_rescued_event', () => {
//    playerManager.gameState.flags.set('aristocrat_rescued_event_triggered', true);
//    questManager.checkAllQuestObjectives(); // Re-check quests after flag is set
// });
// For V0.1, the interaction for main002 might directly set the flag for simplicity.
// In aristocrat_manor_gates interaction "investigate_cry":
// if action is 'quest_start' and it's main002, also set a flag like:
// playerManager.gameState.flags.set('aristocrat_rescued_event_triggered', true);
// This is a bit of a shortcut.