// js/questManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { ITEMS_DATA } from './data/items.js'; // For item rewards/objectives
import { worldManager } from './worldManager.js'; // For location objectives

export const QUESTS_DATA = {
    // --- MAIN QUESTS ---
    main001_find_partner: {
        id: "main001_find_partner",
        name: "Echoes of a Lost Star",
        log: [ // Stage 0
            "Your memories are fragmented, but one name echoes: [PartnerName]. You feel an overwhelming urge to find them. Search for clues about their whereabouts.",
            // Stage 1
            "You found a scholar named Elman in a ruined outpost. He mentioned seeing someone fitting [PartnerName]'s description heading towards the village of Sleepy Hollow. He also gave you a pass to the Study Hub he sponsors there.",
            // Stage 2
            "In Sleepy Hollow, you heard tales of a reclusive hermit in the Deep Woods who knows many secrets. Perhaps they can help you find [PartnerName]."
        ],
        stages: [
            { // Stage 0: Investigate the ruined outpost
                objective: { type: "flag_set", flag: "elman_rescued_and_talked" }, // Set by completing MQ002
                onCompleteMessage: "Elman's information points you towards Sleepy Hollow.",
            },
            { // Stage 1: Reach Sleepy Hollow Square
                objective: { type: "reach_location", locationId: "sleepy_hollow_square" },
                onCompleteMessage: "You've arrived in Sleepy Hollow. Now to find more clues.",
            },
            { // Stage 2: Learn about the Deep Woods Hermit (e.g. by talking to an NPC in the Inn)
                objective: { type: "flag_set", flag: "learned_of_deep_woods_hermit" },
                onCompleteMessage: "The Deep Woods Hermit... a risky path, but potentially rewarding."
            }
            // More stages: Find hermit, get clue about Dragon God cult, etc.
        ],
        rewards: { xp: 100, sp: 10 }, // Initial reward, can add more per stage or final
        isMainQuest: true,
    },
    main002_scholars_plea: {
        id: "main002_scholars_plea",
        name: "The Scholar's Plea",
        log: [ // Stage 0
            "You found a scholar named Elman trapped in a ruined outpost east of the Whispering Woods. He's besieged by goblins and needs help!",
            // Stage 1
            "You defeated Groknar, the goblin chief, and saved Elman. Talk to him to see what he knows.",
            // Stage 2
            "Elman thanked you profusely. He mentioned seeing someone matching [PartnerName]'s description. As a reward, he gave you a pass to the Study Hub in Sleepy Hollow and a signet ring."
        ],
        stages: [
            { // Stage 0: Defeat Groknar in the Ruined Outpost Interior
                objective: { type: "flag_set", flag: "ruined_outpost_interior_fixed_encounter_cleared" },
                onCompleteMessage: "The goblin chief lies defeated. The scholar seems safe now."
            },
            { // Stage 1: Talk to Elman after rescuing him
                objective: { type: "dialogue_npc_stage", npcId: "elman_the_scholar", dialogueStage: "post_rescue_thanks" }, // NPC dialogue system needs to set a flag like "elman_talked_post_rescue"
                onCompleteMessage: "Elman is grateful and has some information for you."
            }
        ],
        rewards: { xp: 250, gold: 100, sp: 50, items: [{itemId: "i004", quantity: 1}, {itemId: "sp_orb_medium", quantity: 1}] },
        onStart: (pm, ui) => {
            ui.addMessage("You've decided to help the trapped scholar. This could be dangerous.", "system-message");
            // Could also add Elman as a temporary follower or make him interactable
        },
        onComplete: (pm) => {
            pm.gameState.flags.set('study_hub_unlocked', true);
            pm.gameState.flags.set('access_to_lyceum_granted', true); // For Lyceum Path
            pm.gameState.flags.set('elman_rescued_and_talked', true); // For MQ001 progression
            eventBus.publish('uiNotification', { message: "The Study Hub in Sleepy Hollow is now accessible!", type: 'system highlight-color' });
        },
        isMainQuest: true,
        autoStartConditions: (pm) => { // Conditions for this quest to auto-start
            return pm.gameState.currentLocationId === 'ruined_outpost_exterior' &&
                   pm.gameState.quests["main001_find_partner"] && !pm.gameState.quests["main001_find_partner"].completed &&
                   !pm.gameState.quests["main002_scholars_plea"]; // Only if MQ001 is active and this one isn't
        }
    },
    // --- SIDE QUESTS ---
    side001_lost_cat: {
        id: "side001_lost_cat",
        name: "Mittens, Come Home!",
        log: [
            "Old Lady Gable in Sleepy Hollow has lost her cat, Mittens. She was last seen near the old well in the village square.",
            "You found Mittens! Return the cat to Old Lady Gable.",
            "Old Lady Gable was overjoyed to have Mittens back. She gave you a small reward."
        ],
        stages: [
            { // Stage 0: Find Mittens (e.g. interaction near well, sets a flag 'found_mittens')
                objective: { type: "flag_set", flag: "found_mittens_cat" },
                onCompleteMessage: "You spot a fluffy cat hiding near the well. It must be Mittens!"
            },
            { // Stage 1: Talk to Old Lady Gable with Mittens (dialogue sets flag 'returned_mittens')
                objective: { type: "dialogue_npc_stage", npcId: "old_lady_gable", dialogueStage: "return_cat" },
                onCompleteMessage: "Old Lady Gable is so happy!"
            }
        ],
        rewards: { xp: 75, gold: 30, items: [{itemId: "c001", quantity: 2}] },
        onStart: (pm, ui) => {
            ui.addMessage("You've decided to help find the lost cat. How noble!", "system-message");
        },
        onComplete: (pm) => {
            pm.gameState.flags.set("side001_lost_cat_completed", true);
        }
    },
    // More side quests: e.g., clear spiders from cellar, deliver a package, etc.
};


class QuestManager {
    constructor() {
        eventBus.subscribe('locationChanged', () => this.checkAutoStartQuests());
        // Listen for custom events that might advance quests
        // eventBus.subscribe('customQuestEvent', ({eventName, eventData}) => this.handleCustomEvent(eventName, eventData));
    }

    startQuest(questId) {
        const questData = QUESTS_DATA[questId];
        if (!questData) {
            eventBus.publish('uiNotification', { message: `Unknown quest: ${questId}`, type: 'error' }); return;
        }
        if (playerManager.gameState.quests[questId] && !playerManager.gameState.quests[questId].completed) {
            eventBus.publish('uiNotification', { message: `Quest "${questData.name}" is already active.`, type: 'system' }); return;
        }
        if (playerManager.gameState.quests[questId]?.completed) {
             eventBus.publish('uiNotification', { message: `You have already completed "${questData.name}".`, type: 'system' }); return;
        }


        playerManager.gameState.quests[questId] = { id: questId, stage: 0, completed: false, objectivesMet: {} };
        const logText = this.getFormattedLogText(questData, 0);
        eventBus.publish('addMessage', { text: `<strong>New Quest Started:</strong> ${questData.name}<br/><em>- ${logText}</em>`, type: 'success-message' });
        
        if (typeof questData.onStart === 'function') {
            questData.onStart(playerManager, { addMessage: (text, type) => eventBus.publish('addMessage', {text, type}) });
        }

        eventBus.publish('playerDataUpdated', playerManager.getPublicData());
        this.checkQuestObjective(questId);
    }
    
    getFormattedLogText(questData, stageIndex) {
        let text = (questData.log && questData.log[stageIndex]) ? questData.log[stageIndex] : "Objective details are currently unavailable.";
        return text.replace(/\[PartnerName\]/g, playerManager.gameState.partnerName)
                   .replace(/\[PlayerName\]/g, playerManager.gameState.name);
    }

    advanceQuestStage(questId) {
        const questProgress = playerManager.gameState.quests[questId];
        const questData = QUESTS_DATA[questId];
        if (!questProgress || !questData || questProgress.completed) return;

        const oldStage = questProgress.stage;
        questProgress.stage++;
        
        if (questData.stages[oldStage]?.onCompleteMessage) {
             let message = this.getFormattedLogText({ log: [questData.stages[oldStage].onCompleteMessage] }, 0);
             eventBus.publish('addMessage', { text: `<em>${message}</em>`, type: 'system highlight-color' });
        }

        if (questProgress.stage >= questData.stages.length) {
            this.completeQuest(questId);
        } else {
            const logText = this.getFormattedLogText(questData, questProgress.stage);
            eventBus.publish('addMessage', { text: `<strong>Quest Updated:</strong> ${questData.name}<br/><em>- ${logText}</em>`, type: 'system' });
            eventBus.publish('playerDataUpdated', playerManager.getPublicData());
            this.checkQuestObjective(questId); // Check next stage immediately
        }
    }

    completeQuest(questId) {
        const questProgress = playerManager.gameState.quests[questId];
        const questData = QUESTS_DATA[questId];
        if (!questProgress || !questData || questProgress.completed) return;

        questProgress.completed = true;
        eventBus.publish('addMessage', { text: `<strong>Quest Completed: ${questData.name}!</strong>`, type: 'success-message highlight-color' });

        if (questData.rewards) {
            let rewardText = "Rewards: ";
            if (questData.rewards.xp) { playerManager.addXp(questData.rewards.xp); rewardText += `${questData.rewards.xp} XP, `; }
            if (questData.rewards.gold) { playerManager.addGold(questData.rewards.gold); rewardText += `${questData.rewards.gold} Gold, `; }
            if (questData.rewards.sp) { playerManager.addSp(questData.rewards.sp); rewardText += `${questData.rewards.sp} SP, `; }
            if (questData.rewards.items) {
                questData.rewards.items.forEach(itemRef => {
                    playerManager.addItem(itemRef.itemId, itemRef.quantity);
                    rewardText += `${ITEMS_DATA[itemRef.itemId]?.name || itemRef.itemId} (x${itemRef.quantity}), `;
                });
            }
            eventBus.publish('addMessage', { text: rewardText.slice(0, -2) + ".", type: 'system' });
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

        // Check if this specific objective within the stage was already met (for multi-objective stages if implemented)
        // For now, assume one objective per stage.
        if (questProgress.objectivesMet[`stage_${questProgress.stage}`]) return;


        switch (objective.type) {
            case "reach_location":
                if (playerManager.gameState.currentLocationId === objective.locationId) objectiveMet = true;
                break;
            case "flag_set":
                if (playerManager.gameState.flags.get(objective.flag)) objectiveMet = true;
                break;
            case "collect_item":
                if (playerManager.hasItem(objective.itemId, objective.quantity)) {
                    objectiveMet = true;
                    if (objective.removeItemOnCompletion) { // Optional: remove quest items
                        // playerManager.removeItemByItemId(objective.itemId, objective.quantity); // Needs careful implementation for stacks/instances
                    }
                }
                break;
            case "defeat_enemy_type": // e.g. { type: "defeat_enemy_type", enemyId: "goblin_scout", count: 3 }
                // This requires tracking defeated enemies, more complex. Placeholder.
                // if (playerManager.gameState.flags.get(`defeated_${objective.enemyId}_count`) >= objective.count) objectiveMet = true;
                break;
            case "dialogue_npc_stage": // e.g. { type: "dialogue_npc_stage", npcId: "elman", dialogueStage: "post_rescue_thanks" }
                // The dialogue system itself should set a specific flag like `flag: "elman_talked_post_rescue"`
                // This objective type is more of a hint; actual check relies on a flag set by dialogue.
                // For now, assume a flag like `${objective.npcId}_${objective.dialogueStage}_done` is set.
                if (playerManager.gameState.flags.get(`${objective.npcId}_${objective.dialogueStage}_done`)) objectiveMet = true;
                break;
            // Add more objective types: use_item_at_location, etc.
        }

        if (objectiveMet) {
            questProgress.objectivesMet[`stage_${questProgress.stage}`] = true; // Mark this objective as met
            this.advanceQuestStage(questId);
        }
    }

    checkAllQuestObjectives() {
        for (const questId in playerManager.gameState.quests) {
            this.checkQuestObjective(questId);
        }
    }
    
    checkAutoStartQuests() {
        for (const questId in QUESTS_DATA) {
            const questData = QUESTS_DATA[questId];
            if (questData.autoStartConditions && !playerManager.gameState.quests[questId]) { // Not started or completed
                if (questData.autoStartConditions(playerManager)) {
                    this.startQuest(questId);
                }
            }
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
                logOutput += `<details><summary><strong>${questData.name}</strong></summary><p style="margin-left:1em;">${stageDesc}</p></details>`;
            }
        }
        if (!activeQuestFound) {
            logOutput += "No active quests.<br>";
        }
        eventBus.publish('addMessage', { text: logOutput, type: 'system-message' });
    }

    // Called by dialogue system or other game events
    setQuestFlag(flagName) {
        playerManager.gameState.flags.set(flagName, true);
        this.checkAllQuestObjectives(); // Re-check all quests as a flag might progress one
        eventBus.publish('uiNotification', {text: `(Quest flag set: ${flagName})`, type:'debug-system'}); // Optional debug
    }
}

export const questManager = new QuestManager();
