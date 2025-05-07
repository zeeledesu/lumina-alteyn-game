// js/inputParser.js
import { eventBus } from './eventManager.js';
import { worldManager } from './worldManager.js';
import { playerManager } from './playerManager.js';
import { uiManager } from './uiManager.js'; // For showing allocation modal directly
import { QUESTS_DATA, questManager } from './questManager.js'; // Assuming questManager is created

class InputParser {
    constructor() {
        eventBus.subscribe('parseInput', (commandText) => this.parse(commandText));
    }

    parse(commandText) {
        const [command, ...args] = commandText.toLowerCase().split(' ');

        switch (command) {
            case 'go':
            case 'move':
                if (args.length > 0) {
                    worldManager.move(args[0]);
                } else {
                    eventBus.publish('uiNotification', { message: "Go where? (e.g., go north)", type: 'error' });
                }
                break;
            case 'look':
            case 'l':
                eventBus.publish('locationChanged', { newLocationId: playerManager.gameState.currentLocationId, oldLocationId: playerManager.gameState.currentLocationId }); // Re-display current location
                break;
            case 'search':
                this.handleInteraction('search', args.join(' ') || worldManager.getCurrentLocation()?.interactions?.find(i => i.action === 'search')?.id);
                break;
            case 'interact':
                this.handleInteraction('interact', args.join(' '));
                break;
            case 'examine':
                this.handleInteraction('examine', args.join(' '));
                break;
            case 'talk':
                this.handleInteraction('dialogue', args.join(' '));
                break;
            case 'inv':
            case 'inventory':
                // For V0.1, inventory is just displayed. Future: open inventory modal.
                eventBus.publish('uiNotification', { message: "Your inventory is shown in the sidebar.", type: 'system' });
                break;
            case 'stats':
            case 'char':
                // For V0.1, stats are displayed. Future: open character sheet modal.
                eventBus.publish('uiNotification', { message: "Your stats are shown in the sidebar.", type: 'system' });
                break;
            case 'alloc': // allocate str, alloc dex
                if (args.length > 0) {
                    if (playerManager.allocateAttributePoint(args[0])) {
                        // Message handled by playerManager
                    }
                } else {
                    uiManager.showAttributeAllocationModal(); // Open modal if no arg
                }
                break;
            case 'skills':
                // For V0.1, skills are displayed. Future: open skills modal.
                eventBus.publish('uiNotification', { message: "Your skills are shown in the sidebar.", type: 'system' });
                break;
            case 'help':
                this.showHelp();
                break;
            // --- Quest related commands ---
            case 'quest':
                 if (args[0] === 'start' && args[1]) {
                    questManager.startQuest(args[1]);
                 } else if (args[0] === 'log') {
                    questManager.showQuestLog();
                 } else {
                    eventBus.publish('uiNotification', { message: "Quest command unclear. Try 'quest log' or 'quest start <id>'.", type: 'error' });
                 }
                break;
            // --- SP/Gacha related commands (from location interactions) ---
            case 'study_sp': // e.g. "study_sp easy_math"
                 this.handleInteraction('study_sp', args.join(' '));
                break;
            case 'claim_sp': // e.g. "claim_sp welcome_gift"
                 this.handleInteraction('claim_sp', args.join(' '));
                break;
            case 'gacha_pull': // e.g. "gacha_pull device_1"
                 this.handleInteraction('gacha_pull', args.join(' '));
                break;
            default:
                eventBus.publish('uiNotification', { message: `Unknown command: "${commandText}"`, type: 'error' });
        }
        // After any action that might change state, check quests
        questManager.checkAllQuestObjectives();
    }

    handleInteraction(actionType, interactionId) {
        const location = worldManager.getCurrentLocation();
        if (!location || !location.interactions) {
            eventBus.publish('uiNotification', { message: "Nothing to interact with here.", type: 'error' });
            return;
        }
        
        const interaction = location.interactions.find(i => i.id === interactionId && (i.action === actionType || actionType === 'interact'));

        if (!interaction) {
            eventBus.publish('uiNotification', { message: `Cannot ${actionType} '${interactionId}'.`, type: 'error' });
            return;
        }
        
        // Check condition for interaction
        if (interaction.condition && !interaction.condition(playerManager)) {
            eventBus.publish('uiNotification', { message: `You cannot do that right now.`, type: 'error' });
            return;
        }

        if (interaction.message) {
            eventBus.publish('addMessage', { text: interaction.message, type: 'system' });
        }

        if (interaction.result) {
            let resultMessage;
            if (typeof interaction.result === 'function') {
                resultMessage = interaction.result(playerManager, eventBus); // Pass playerManager and eventBus
            } else if (interaction.result.type === 'item') {
                // Simplified item result
                playerManager.addItem(interaction.result.itemId, interaction.result.quantity || 1);
                resultMessage = interaction.result.message || `You received ${interaction.result.itemId}.`;
            }
            // More result types later (gold, xp, flag set)
            if (resultMessage) {
                 eventBus.publish('addMessage', { text: resultMessage, type: 'success' });
            }
        }
        
        // Specific action handlers
        if (actionType === 'study_sp' && interaction.sp_reward) {
            playerManager.addSp(interaction.sp_reward);
        } else if (actionType === 'claim_sp' && interaction.sp_amount) {
            if (playerManager.gameState.flags.get(`claimed_${interaction.id}`)) {
                eventBus.publish('uiNotification', { message: "You have already claimed this.", type: 'error' });
            } else {
                playerManager.addSp(interaction.sp_amount);
                playerManager.gameState.flags.set(`claimed_${interaction.id}`, true);
            }
        } else if (actionType === 'gacha_pull') {
            playerManager.gachaPull();
        } else if (actionType === 'quest_start' && interaction.questId) {
            questManager.startQuest(interaction.questId);
        }


        // If interaction is 'once' and was successful, mark it (needs better state management)
        // This is tricky without knowing if the "result" was truly successful or just a message.
        // For now, some interactions (like claim_sp) handle their own 'once' logic.
    }

    showHelp() {
        let helpText = "<strong>Available Commands:</strong><br>";
        helpText += "<strong>go [direction]</strong> - Move (e.g., go north)<br>";
        helpText += "<strong>look / l</strong> - Describe current location<br>";
        helpText += "<strong>search</strong> - Search the current area (if searchable)<br>";
        helpText += "<strong>interact [target]</strong> - Interact with something specific<br>";
        helpText += "<strong>examine [target]</strong> - Examine something specific<br>";
        helpText += "<strong>alloc [attribute]</strong> - Allocate an attribute point (e.g., alloc str) or 'alloc' to open UI<br>";
        helpText += "<strong>inv / stats / skills</strong> - View information (sidebar)<br>";
        helpText += "<strong>quest log</strong> - View active quests<br>";
        helpText += "<strong>help</strong> - Show this help message<br>";
        eventBus.publish('addMessage', { text: helpText, type: 'system-message' });
    }
}
export const inputParser = new InputParser();