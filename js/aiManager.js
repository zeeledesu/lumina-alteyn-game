// js/aiManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { combatManager } from './combatManager.js'; // To get combat state
import { SKILLS_DATA, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ALLY_DATA } from './data/allies.js'; // For Sansan's specific dialogue
import { getRandomInt, rollPercentage } from './utils.js';

class AIManager {
    constructor() {
        // For Sansan's random chats
        this.sansanChatCooldown = 0;
        this.SANSAN_CHAT_COOLDOWN_TURNS = 15; // Player actions/turns between potential chats
        this.SANSAN_CHAT_CHANCE = 20; // % chance to chat when cooldown is met

        eventBus.subscribe('playerActionTaken', () => this.handlePlayerActionSideEffects()); // For Sansan's chat cooldown
        eventBus.subscribe('combatTurnAdvanced', ({ currentTurnActor }) => {
            if (currentTurnActor?.isAlly && currentTurnActor.id === ALLY_DATA.sansan_dino.id && !currentTurnActor.isPlayerControlled) { // Only if AI controlled
                this.handleSansanRandomChat(false); // Less likely in combat
            }
        });
    }

    handlePlayerActionSideEffects() {
        // Check if Sansan is in party and AI-controlled for random chats
        const sansanAlly = playerManager.gameState.allies.find(a => a.allyId === ALLY_DATA.sansan_dino.id);
        if (sansanAlly && !sansanAlly.isPlayerControlled) {
            if (this.sansanChatCooldown > 0) {
                this.sansanChatCooldown--;
            }
            if (this.sansanChatCooldown <= 0) {
                this.handleSansanRandomChat(true); // More likely out of combat
            }
        }
    }

    /**
     * Gets the next action for an AI-controlled combatant (enemy or ally).
     * @param {object} combatant - The AI combatant object.
     * @param {Array} playerParty - Array of player and ally combatants.
     * @param {Array} enemyParty - Array of enemy combatants.
     * @returns {object} - Action object { type: "attack"/"skill"/"item", targetId: "...", skillId: "..." }
     */
    getCombatAction(combatant, playerParty, enemyParty) {
        if (combatant.isAlly && !combatant.isPlayerControlled) { // Ensure ally is AI controlled
            return this.getAllyCombatAction(combatant, playerParty, enemyParty);
        } else if (!combatant.isPlayer && !combatant.isAlly) { // Enemy
            return this.getEnemyCombatAction(combatant, playerParty, enemyParty);
        }
        // Should not reach here for player-controlled allies or players
        eventBus.publish('aiActionLog', { actorName: combatant.name, action: `is player-controlled or player, skipping AI.` });
        return { type: 'pass', actorName: combatant.name };
    }

    getEnemyCombatAction(enemy, playerParty, enemyParty) {
        // Basic AI:
        // 1. If has usable skill and MP, 50% chance to use skill, otherwise attack.
        // 2. Target lowest HP player/ally.

        const usableSkills = enemy.skills
            .map(id => SKILLS_DATA[id])
            .filter(skill => skill && skill.mpCost <= enemy.stats.currentMp && (skill.type.includes('attack') || skill.type.includes('debuff'))); // Corrected filter

        if (usableSkills.length > 0 && rollPercentage(50)) {
            const skillToUse = usableSkills[getRandomInt(0, usableSkills.length - 1)];
            let targetId = null;

            // Basic targeting for skills
            if (skillToUse.target === 'enemy_single' || skillToUse.target === 'enemy_single_splash') { // From enemy's perspective, "enemy" is player party
                targetId = this.findLowestHpTarget(playerParty)?.instanceId;
            } else if (skillToUse.target === 'self') {
                targetId = enemy.instanceId;
            }
             // Add more targeting logic for AOE etc.
            if (targetId || skillToUse.target.includes('_all') || skillToUse.target.includes('_aoe')) {
                 eventBus.publish('aiActionLog', { actorName: enemy.name, action: `decides to use ${skillToUse.name}` });
                return { type: 'skill', skillId: skillToUse.id, casterId: enemy.instanceId, targetId: targetId }; // targetId can be null for 'enemy_all'
            }
        }

        // Default to attack
        const target = this.findLowestHpTarget(playerParty);
        if (target) {
            eventBus.publish('aiActionLog', { actorName: enemy.name, action: `decides to attack ${target.name}` });
            return { type: 'attack', casterId: enemy.instanceId, targetId: target.instanceId };
        }
        eventBus.publish('aiActionLog', { actorName: enemy.name, action: `is confused and does nothing` });
        return { type: 'pass', actorName: enemy.name }; // Should not happen if playerParty has members
    }

    getAllyCombatAction(ally, playerParty, enemyParty) {
        // This function is now only for AI-controlled allies.
        // Player-controlled allies will have their actions chosen via UI.

        // Sansan's AI (if not player controlled)
        if (ally.id === ALLY_DATA.sansan_dino.id && !ally.isPlayerControlled) {
            // Priority:
            // 1. If Cutiepatotie is low HP, and Sansan has Protective Aura and MP, use it.
            // 2. If multiple enemies and Sansan has Taunt and MP, use it.
            // 3. If MP for Dino Bash, use it on lowest HP enemy.
            // 4. Basic attack lowest HP enemy.

            const cutiepatotie = playerParty.find(p => p.isPlayer); // Assuming player is Cutiepatotie
            const protectiveAuraSkill = SKILLS_DATA['skill_protective_aura'];
            if (cutiepatotie && (cutiepatotie.stats.currentHp / cutiepatotie.stats.maxHp < 0.4) &&
                ally.skills.includes(protectiveAuraSkill.id) && ally.stats.currentMp >= protectiveAuraSkill.mpCost &&
                !combatManager.targetHasStatusEffect(cutiepatotie.instanceId, 'se_def_up_20_ally')) {
                eventBus.publish('aiActionLog', { actorName: ally.name, action: `uses ${protectiveAuraSkill.name} on ${cutiepatotie.name}` });
                return { type: 'skill', skillId: protectiveAuraSkill.id, casterId: ally.instanceId, targetId: cutiepatotie.instanceId };
            }

            const tauntSkill = SKILLS_DATA['skill_dino_roar_taunt'];
            const activeEnemies = enemyParty.filter(e => e.stats.currentHp > 0);
            if (activeEnemies.length > 1 && ally.skills.includes(tauntSkill.id) && ally.stats.currentMp >= tauntSkill.mpCost &&
                !activeEnemies.every(e => combatManager.targetHasStatusEffect(e.instanceId, 'se_taunted_by_sansan'))) {
                eventBus.publish('aiActionLog', { actorName: ally.name, action: `uses ${tauntSkill.name}` });
                return { type: 'skill', skillId: tauntSkill.id, casterId: ally.instanceId, targetId: null }; // Targets all enemies + self
            }

            const bashSkill = SKILLS_DATA['skill_dino_bash'];
            const primaryTarget = this.findLowestHpTarget(enemyParty);
            if (primaryTarget && ally.skills.includes(bashSkill.id) && ally.stats.currentMp >= bashSkill.mpCost) {
                eventBus.publish('aiActionLog', { actorName: ally.name, action: `uses ${bashSkill.name} on ${primaryTarget.name}` });
                return { type: 'skill', skillId: bashSkill.id, casterId: ally.instanceId, targetId: primaryTarget.instanceId };
            }

            if (primaryTarget) {
                eventBus.publish('aiActionLog', { actorName: ally.name, action: `attacks ${primaryTarget.name}` });
                return { type: 'attack', casterId: ally.instanceId, targetId: primaryTarget.instanceId };
            }
        }

        // Generic Ally AI (if not Sansan or Sansan has no specific action, and is AI controlled)
        const target = this.findLowestHpTarget(enemyParty);
        if (target) {
            eventBus.publish('aiActionLog', { actorName: ally.name, action: `attacks ${target.name}` });
            return { type: 'attack', casterId: ally.instanceId, targetId: target.instanceId };
        }
        eventBus.publish('aiActionLog', { actorName: ally.name, action: `observes the battlefield` });
        return { type: 'pass', actorName: ally.name };
    }

    findLowestHpTarget(partyArray) {
        if (!partyArray || partyArray.length === 0) return null;
        return partyArray
            .filter(p => p.stats.currentHp > 0)
            .sort((a, b) => (a.stats.currentHp / a.stats.maxHp) - (b.stats.currentHp / b.stats.maxHp))[0] || null;
    }


    // --- Sansan's Special Dialogue Logic ---
    handleSansanRandomChat(isOutOfCombat) {
        if (!playerManager.isPlayerCharacter("Cutiepatotie") || !playerManager.hasAlly(ALLY_DATA.sansan_dino.id)) return;
        
        const sansanAlly = playerManager.gameState.allies.find(a => a.allyId === ALLY_DATA.sansan_dino.id);
        if (!sansanAlly || sansanAlly.isPlayerControlled) return; // Only for AI controlled Sansan

        if (playerManager.gameState.sansanDialogue.promptActive || playerManager.gameState.sansanDialogue.gameOverTriggered) return;

        if (this.sansanChatCooldown <= 0 && rollPercentage(this.SANSAN_CHAT_CHANCE)) {
            this.sansanChatCooldown = this.SANSAN_CHAT_COOLDOWN_TURNS + getRandomInt(-5, 5); // Reset cooldown with some variance
            const sansanData = ALLY_DATA.sansan_dino;
            let chatMessage = "";

            if (!playerManager.gameState.flags.get('sansan_first_i_love_you_done')) {
                chatMessage = sansanData.dialogueTriggers.loveYouPrompt1;
                playerManager.gameState.sansanDialogue.promptActive = "loveYouPrompt1_reply";
            } else if (rollPercentage(60)) { // More likely to say I miss you
                chatMessage = sansanData.dialogueTriggers.missYouPrompt;
                playerManager.gameState.sansanDialogue.promptActive = "missYouPrompt_reply";
            } else {
                chatMessage = sansanData.dialogueTriggers.loveYouPrompt2;
                playerManager.gameState.sansanDialogue.promptActive = "loveYouPrompt2_reply";
            }

            if (chatMessage) {
                eventBus.publish('addMessage', { text: `Sansan: "${chatMessage}"`, type: 'sansan-chat' });
            }
        }
    }

    processSansanReply(playerInputText) {
        if (!playerManager.isPlayerCharacter("Cutiepatotie") || !playerManager.gameState.sansanDialogue.promptActive) return false;

        const dialogueState = playerManager.gameState.sansanDialogue;
        const sansanTriggers = ALLY_DATA.sansan_dino.dialogueTriggers;
        let sansanResponse = "";
        let positiveReply = false;
        const lowerInput = playerInputText.toLowerCase();

        switch (dialogueState.promptActive) {
            case "missYouPrompt_reply":
                if (lowerInput.includes("miss")) {
                    sansanResponse = sansanTriggers.hugReply;
                    positiveReply = true;
                }
                break;
            case "loveYouPrompt1_reply": // First "I love you"
                if (lowerInput.includes("love")) {
                    sansanResponse = sansanTriggers.loveReply1;
                    dialogueState.promptActive = "proposalPrompt1_reply"; // Next stage
                    playerManager.gameState.flags.set('sansan_first_i_love_you_done', true);
                    positiveReply = true;
                }
                break;
            case "proposalPrompt1_reply": // "kita lang okay..."
                if (lowerInput.includes("oo") || lowerInput.includes("yes") || lowerInput.includes("sige") || lowerInput.includes("kita lang gid")) {
                    sansanResponse = sansanTriggers.proposalAcceptReply; // "Will you be my forever?"
                    dialogueState.promptActive = "proposalAccept_reply";
                    positiveReply = true;
                }
                break;
            case "proposalAccept_reply": // Actual proposal with ring
                 if (lowerInput.includes("oo") || lowerInput.includes("yes") || lowerInput.includes("sige")) {
                    // This needs to trigger a UI modal from UIManager
                    eventBus.publish('sansanProposalAttempt'); // UIManager listens to this
                    // sansanResponse is handled by the modal interaction
                    positiveReply = true; // Assume positive for now, modal handles actual item grant
                }
                break;
            case "loveYouPrompt2_reply": // Subsequent "I love you"
                if (lowerInput.includes("love")) {
                    sansanResponse = sansanTriggers.loveReply2;
                    positiveReply = true;
                }
                break;
        }

        if (sansanResponse && positiveReply) {
            eventBus.publish('addMessage', { text: `Sansan: "${sansanResponse}"`, type: 'sansan-chat' });
             if (dialogueState.promptActive !== "proposalPrompt1_reply" && dialogueState.promptActive !== "proposalAccept_reply") { // Don't clear if waiting for next step in proposal
                dialogueState.promptActive = null;
            }
            dialogueState.negativeStrikeCount = 0; // Reset strikes on positive reply
        } else if (dialogueState.promptActive) { // No positive match, or no specific response defined for this stage yet
            dialogueState.negativeStrikeCount++;
            if (dialogueState.negativeStrikeCount === 1) {
                sansanResponse = sansanTriggers.negativeResponse1;
            } else if (dialogueState.negativeStrikeCount === 2) {
                sansanResponse = sansanTriggers.negativeResponse2;
            } else {
                sansanResponse = sansanTriggers.leavePartyMessage;
                eventBus.publish('addMessage', { text: `Sansan: "${sansanResponse}"`, type: 'sansan-chat error-message' });
                playerManager.removeAlly(ALLY_DATA.sansan_dino.id);
                dialogueState.gameOverTriggered = true;
                dialogueState.promptActive = null;
                eventBus.publish('gameOver', { reason: "Sansan left due to heartbreak." });
                return true; // Handled game over
            }
            eventBus.publish('addMessage', { text: `Sansan: "${sansanResponse}"`, type: 'sansan-chat' });
            // Keep promptActive until 3 strikes or positive reply
             if (dialogueState.negativeStrikeCount >=3) dialogueState.promptActive = null;
        }
        return true; // Input was processed (or attempted) for Sansan
    }
}

export const aiManager = new AIManager();
