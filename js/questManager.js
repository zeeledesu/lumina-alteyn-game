// js/questManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { ITEMS_DATA } from './data/items.js'; 
import { worldManager } from './worldManager.js'; 

export const QUESTS_DATA = {
    main001_find_partner: {
        id: "main001_find_partner",
        name: "Echoes of a Lost Star",
        log: [ 
            "Your memories are fragmented, but one name echoes: [PartnerName]. You feel an overwhelming urge to find them. Search for clues about their whereabouts in the Whispering Woods or nearby ruins.",
            "You found a scholar named Elman in a ruined outpost. He mentioned seeing someone fitting [PartnerName]'s description heading towards the village of Sleepy Hollow. He also gave you a pass to the Study Hub he sponsors there.",
            "In Sleepy Hollow, you heard tales of a reclusive hermit in the Deep Woods who knows many secrets. Perhaps they can help you find [PartnerName]."
        ],
        stages: [
            { 
                objective: { type: "flag_set", flag: "elman_rescued_and_talked" }, 
                onCompleteMessage: "Elman's information points you towards Sleepy Hollow.",
            },
            { 
                objective: { type: "reach_location", locationId: "sleepy_hollow_square" },
                onCompleteMessage: "You've arrived in Sleepy Hollow. Now to find more clues.",
            },
            { 
                objective: { type: "flag_set", flag: "learned_of_deep_woods_hermit" },
                onCompleteMessage: "The Deep Woods Hermit... a risky path, but potentially rewarding."
            }
        ],
        rewards: { xp: 100, sp: 10 }, 
        isMainQuest: true,
    },
    main002_scholars_plea: {
        id: "main002_scholars_plea",
        name: "The Scholar's Plea",
        log: [ 
            "You found a scholar named Elman trapped in a ruined outpost east of the Whispering Woods. He's besieged by goblins and needs help!",
            "You defeated Groknar, the goblin chief, and saved Elman. Talk to him to see what he knows.",
            "Elman thanked you profusely. He mentioned seeing someone matching [PartnerName]'s description. As a reward, he gave you a pass to the Study Hub in Sleepy Hollow and a signet ring."
        ],
        stages: [
            { 
                objective: { type: "flag_set", flag: "ruined_outpost_interior_fixed_encounter_cleared" },
                onCompleteMessage: "The goblin chief lies defeated. The scholar seems safe now."
            },
            { 
                objective: { type: "flag_set", flag: "elman_the_scholar_post_rescue_thanks_done" }, // This flag is set by InputParser dialogue interaction
                onCompleteMessage: "Elman is grateful and has some information for you."
            }
        ],
        rewards: { xp: 250, gold: 100, sp: 50, items: [{itemId: "i004", quantity: 1}, {itemId: "sp_orb_medium", quantity: 1}] },
        onStart: (pm, ui) => {
            ui.addMessage("You've decided to help the trapped scholar. This could be dangerous.", "system-message");
        },
        onComplete: (pm) => {
            pm.gameState.flags.set('study_hub_unlocked', true);
            pm.gameState.flags.set('access_to_lyceum_granted', true); 
            pm.gameState.flags.set('elman_rescued_and_talked', true); 
            eventBus.publish('uiNotification', { message: "The Study Hub in Sleepy Hollow is now accessible!", type: 'system highlight-color' });
        },
        isMainQuest: true,
        autoStartConditions: (pm) => { 
            return pm.gameState.currentLocationId === 'ruined_outpost_exterior' &&
                   pm.gameState.quests["main001_find_partner"] && !pm.gameState.quests["main001_find_partner"].completed &&
                   !pm.gameState.quests["main002_scholars_plea"]; 
        }
    },
    side001_lost_cat: {
        id: "side001_lost_cat",
        name: "Mittens, Come Home!",
        log: [
            "Old Lady Gable in Sleepy Hollow has lost her cat, Mittens. She was last seen near the old well in the village square.",
            "You found Mittens! Return the cat to Old Lady Gable.",
            "Old Lady Gable was overjoyed to have Mittens back. She gave you a small reward."
        ],
        stages: [
            { 
                objective: { type: "flag_set", flag: "found_mittens_cat" },
                onCompleteMessage: "You spot a fluffy cat hiding near the well. It must be Mittens!"
            },
            { 
                objective: { type: "flag_set", flag: "returned_mittens_to_gable" }, // This flag should be set by dialogue interaction
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
};


class QuestManager {
    constructor() {
        eventBus.subscribe('locationChanged', () => this.checkAutoStartQuests());
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
        this.checkQuestObjective(questId); // Check immediately if stage 0 objective is already met
    }
    
    getFormattedLogText(questData, stageIndex) {
        let text = (questData.log && questData.log[stageIndex]) ? questData.log[stageIndex] : "Objective details are currently unavailable.";
        if (!playerManager || !playerManager.gameState) return text; // Guard against early calls
        return text.replace(/\[PartnerName\]/g, playerManager.gameState.partnerName || "your partner")
                   .replace(/\[PlayerName\]/g, playerManager.gameState.name || "Adventurer");
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
            this.checkQuestObjective(questId); 
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
            if (rewardText !== "Rewards: ") { // Only show if there were rewards
                 eventBus.publish('addMessage', { text: rewardText.slice(0, -2) + ".", type: 'system' });
            }
        }
        
        if (typeof questData.onComplete === 'function') {
            questData.onComplete(playerManager);
        }

        eventBus.publish('playerDataUpdated', playerManager.getPublicData());
        this.checkAllQuestObjectives(); 
    }

    checkQuestObjective(questId) {
        const questProgress = playerManager.gameState.quests[questId];
        const questData = QUESTS_DATA[questId];
        if (!questProgress || !questData || questProgress.completed) return;

        const currentStageData = questData.stages[questProgress.stage];
        if (!currentStageData || !currentStageData.objective) return;

        const objective = currentStageData.objective;
        let objectiveMet = false;

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
                    // For now, quest items are not automatically removed unless explicitly handled by interaction.
                }
                break;
            case "dialogue_npc_stage": 
                // This is a placeholder; actual completion depends on a flag set by the dialogue interaction
                // Example: `${objective.npcId}_${objective.dialogueStage}_done`
                // For MQ002: flag "elman_the_scholar_post_rescue_thanks_done" should be set by InputParser on interaction.
                // This objective type definition itself doesn't advance. The flag does.
                // The check for this flag happens implicitly via "flag_set" type if that's how it's defined.
                // Let's assume for "dialogue_npc_stage", we check for a conventionally named flag:
                if (playerManager.gameState.flags.get(`${objective.npcId}_${objective.dialogueStage}_done`)) {
                    objectiveMet = true;
                }
                break;
        }

        if (objectiveMet) {
            questProgress.objectivesMet[`stage_${questProgress.stage}`] = true; 
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
            if (questData.autoStartConditions && !playerManager.gameState.quests[questId]) { 
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
                logOutput += `<details open><summary><strong>${questData.name}</strong></summary><p style="margin-left:1em;">${stageDesc}</p></details>`;
            }
        }
        if (!activeQuestFound) {
            logOutput += "No active quests.<br>";
        }
        eventBus.publish('addMessage', { text: logOutput, type: 'system-message' });
    }

    setQuestFlag(flagName, value = true) { // Allow setting flag to true or false
        playerManager.gameState.flags.set(flagName, value);
        this.checkAllQuestObjectives(); 
        // eventBus.publish('uiNotification', {text: `(Quest flag ${flagName} set to ${value})`, type:'debug-system'}); 
    }
}

export const questManager = new QuestManager();
