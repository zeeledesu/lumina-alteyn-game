// js/inputParser.js
import { eventBus } from './eventManager.js';
import { worldManager } from './worldManager.js';
import { playerManager } from './playerManager.js';
import { uiManager } from './uiManager.js';
import { questManager } from './questManager.js';
import { combatManager } from './combatManager.js'; // For flee command, etc.
import { aiManager } from './aiManager.js'; // For Sansan's dialogue replies

class InputParser {
    constructor() {
        eventBus.subscribe('parseInput', (commandText) => this.parse(commandText));
    }

    parse(commandText) {
        commandText = commandText.trim();
        if (!commandText) return;

        const lowerCommandText = commandText.toLowerCase();

        // Check for Sansan's dialogue reply first if a prompt is active
        if (playerManager.gameState.sansanDialogue.promptActive) {
            if (aiManager.processSansanReply(commandText)) { // Pass original case for names etc. if needed
                // Sansan's reply handled, don't process as normal command
                return;
            }
        }

        const [command, ...args] = lowerCommandText.split(' ');
        const originalArgs = commandText.split(' ').slice(1); // Keep original case for names etc.


        if (playerManager.gameState.inCombat) {
            this.parseCombatCommand(command, args, originalArgs);
            return;
        }

        switch (command) {
            case 'go': case 'move': case 'n': case 's': case 'e': case 'w': case 'u': case 'd':
                let direction = args[0];
                if (['n','s','e','w','u','d'].includes(command)) direction = command; // Allow shorthand
                if (direction) {
                    if (direction === 'n') direction = 'north';
                    else if (direction === 's') direction = 'south';
                    else if (direction === 'e') direction = 'east';
                    else if (direction === 'w') direction = 'west';
                    else if (direction === 'u') direction = 'up';
                    else if (direction === 'd') direction = 'down';
                    worldManager.move(direction);
                } else {
                    eventBus.publish('uiNotification', { message: "Go where? (e.g., go north, n, s, e, w, up, down)", type: 'error' });
                }
                break;
            case 'look': case 'l':
                const targetToLook = args.join(' ');
                if (targetToLook) {
                    // TODO: Implement 'look at [target]' for items, NPCs, interactables
                    eventBus.publish('addMessage', {text: `You look closely at ${targetToLook}... (Detailed look not yet implemented).`, type: 'system'});
                } else {
                    eventBus.publish('forceLocationUpdate'); // Re-display current location
                }
                break;
            case 'search':
                // Generic search, or specific if location defines it
                const searchInteraction = worldManager.getCurrentLocation()?.interactions?.find(i => i.action === 'search' || i.id === 'search');
                if (searchInteraction) {
                    this.handleInteraction(searchInteraction.action || 'custom', searchInteraction.id);
                } else {
                     eventBus.publish('uiNotification', { message: "Nothing obvious to search here.", type: 'system' });
                }
                break;
            case 'interact':
            case 'examine':
            case 'talk':
            case 'use': // General use for items or interactables
                if (args.length > 0) {
                    this.handleInteraction(command, originalArgs.join(' ')); // Use original case for ID matching
                } else {
                    eventBus.publish('uiNotification', { message: `${command} what/who?`, type: 'error' });
                }
                break;
            case 'inv': case 'inventory': uiManager.showInventoryModal(); break;
            case 'stats': case 'char': uiManager.showCharacterSheetModal(); break;
            case 'equip':
                if (originalArgs.length > 0) {
                    uiManager.showEquipmentModal(originalArgs.join(' ')); // Open modal with intent to equip
                } else {
                    uiManager.showEquipmentModal();
                }
                break;
            case 'unequip':
                if (args.length > 0) { // e.g. unequip weapon, unequip head
                    const slotToUnequip = args.join('_'); // e.g. off_hand -> offHand
                    const validSlots = Object.values(EQUIPMENT_SLOTS.player);
                    let foundSlot = validSlots.find(s => s.toLowerCase() === slotToUnequip);
                    if (!foundSlot && EQUIPMENT_SLOTS.player[slotToUnequip]) foundSlot = slotToUnequip; // Direct match

                    if (foundSlot) {
                         playerManager.unequipItem(foundSlot);
                    } else {
                         eventBus.publish('uiNotification', { message: `Invalid slot to unequip: ${slotToUnequip}. Try weapon, head, body, etc.`, type: 'error' });
                    }
                } else {
                     eventBus.publish('uiNotification', { message: "Unequip what? (e.g., unequip weapon)", type: 'error' });
                }
                break;
            case 'alloc': case 'allocate':
                if (args.length > 0) playerManager.allocateAttributePoint(args[0]);
                else uiManager.showAttributeAllocationModal();
                break;
            case 'skills': case 'skilltree': uiManager.showSkillTreeModal(); break;
            case 'quests': case 'questlog': case 'journal': questManager.showQuestLog(); break;
            case 'help': this.showHelp(); break;
            // --- Quest related commands (mostly triggered by interactions now) ---
            case 'quest': // For manual quest manipulation if needed by dev
                 if (args[0] === 'start' && args[1]) questManager.startQuest(args[1]);
                 else if (args[0] === 'complete' && args[1]) questManager.completeQuest(args[1]); // Dev command
                 else if (args[0] === 'stage' && args[1] && args[2]) { /* Dev: questManager.setStage(args[1], parseInt(args[2])) */ }
                 else questManager.showQuestLog();
                break;
            // --- Dev Commands ---
            case 'dev_additem': if (args[0] && playerManager.addItem(args[0], parseInt(args[1] || 1))) {} break;
            case 'dev_addgold': if (args[0]) playerManager.addGold(parseInt(args[0])); break;
            case 'dev_addxp': if (args[0]) playerManager.addXp(parseInt(args[0])); break;
            case 'dev_setflag': if (args[0]) { playerManager.gameState.flags.set(args[0], true); questManager.checkAllQuestObjectives(); eventBus.publish('uiNotification', {text: `Flag ${args[0]} set.`, type: 'dev'});} break;
            case 'dev_goto': if (args[0] && LOCATIONS_DATA[args[0]]) { playerManager.gameState.currentLocationId = args[0]; eventBus.publish('locationChanged', {newLocationId: args[0]}); } break;
            case 'dev_startcombat': if (ENEMY_GROUPS[args[0]]) { eventBus.publish('startCombat', {enemies: encounterManager.buildEnemyPartyFromGroup(args[0])}); } else {eventBus.publish('uiNotification', {text: `Enemy group ${args[0]} not found.`, type: 'error'});} break;

            default:
                eventBus.publish('uiNotification', { message: `Unknown command: "${commandText}"`, type: 'error' });
        }
        // After any action that might change state, check quests
        if (!playerManager.gameState.inCombat) { // Don't check during combat
            questManager.checkAllQuestObjectives();
             playerManager.updateAllStats(); // Ensure stats are fresh after any action
             eventBus.publish('playerDataUpdated', playerManager.getPublicData()); // Update UI
        }
    }

    parseCombatCommand(command, args, originalArgs) {
        const player = combatManager.currentActor;
        if (!player || !player.isPlayer) {
            eventBus.publish('uiNotification', { message: "Not your turn or invalid combat state.", type: 'error' });
            return;
        }
        // If combatManager has a pendingPlayerAction, it means it's waiting for a target.
        // Any command other than clicking a target should probably cancel target selection.
        if (combatManager.pendingPlayerAction) {
            const targetClicked = combatManager.findCombatant(args[0]); // Check if arg is a target ID
            if (targetClicked) {
                 combatManager.playerSelectsTarget(targetClicked.instanceId);
                 return;
            } else {
                // Any other command cancels target selection
                combatManager.cancelPlayerTargetSelection();
                // Then, re-process the command if it's a valid new action
            }
        }


        switch (command) {
            case 'attack': // 'attack [target_name_or_id]'
                const targetName = originalArgs.join(' ');
                let targetToAttack = null;
                if (targetName) {
                    targetToAttack = combatManager.enemyParty.find(e => e.name.toLowerCase().includes(targetName) && e.stats.currentHp > 0) ||
                                     combatManager.findCombatant(targetName); // Try by ID if name fails
                }
                // If no target specified or found by name, default to first living enemy or prompt
                if (!targetToAttack && combatManager.enemyParty.some(e => e.stats.currentHp > 0)) {
                    if (combatManager.enemyParty.filter(e => e.stats.currentHp > 0).length === 1) {
                        targetToAttack = combatManager.enemyParty.find(e => e.stats.currentHp > 0);
                    } else {
                         combatManager.playerInitiatesTargetedAction('attack', null); // detailId null for basic attack
                         return; // Wait for target selection
                    }
                }

                if (targetToAttack) {
                    eventBus.publish('combatAction', { type: 'attack', casterId: player.instanceId, targetId: targetToAttack.instanceId });
                } else {
                    eventBus.publish('uiNotification', { message: "No valid target to attack.", type: 'error' });
                }
                break;
            case 'skill': // 'skill [skill_name_or_id] [target_name_or_id]'
                const skillQuery = args[0];
                const targetForSkillName = originalArgs.slice(1).join(' ');

                const foundSkill = playerManager.gameState.skills
                    .map(id => SKILLS_DATA[id])
                    .find(s => s && (s.id.toLowerCase() === skillQuery || s.name.toLowerCase().includes(skillQuery)));

                if (foundSkill) {
                    combatManager.playerInitiatesTargetedAction('skill', foundSkill.id); // Will handle targeting
                } else {
                    eventBus.publish('uiNotification', { message: `Skill "${skillQuery}" not known or invalid.`, type: 'error' });
                }
                break;
            case 'item': // 'item [item_name_or_id] [target_name_or_id]'
                 const itemQuery = args[0]; // Assume item name part
                 const targetForItemName = originalArgs.slice(1).join(' '); // Assume target name part

                 // Find item in player's inventory
                 const inventoryItem = playerManager.gameState.inventory.find(invItem => {
                     const itemData = ITEMS_DATA[invItem.itemId];
                     return itemData && (itemData.id.toLowerCase() === itemQuery || itemData.name.toLowerCase().includes(itemQuery));
                 });

                 if (inventoryItem && ITEMS_DATA[inventoryItem.itemId]?.use_effect) {
                     combatManager.playerInitiatesTargetedAction('item', inventoryItem.instanceId);
                 } else {
                     eventBus.publish('uiNotification', { message: `Item "${itemQuery}" not found or not usable.`, type: 'error' });
                 }
                break;
            case 'flee':
                eventBus.publish('combatAction', { type: 'flee', casterId: player.instanceId });
                break;
            case 'pass':
                 eventBus.publish('combatAction', { type: 'pass', casterId: player.instanceId });
                break;
            case 'help':
                this.showHelp(true); // Show combat help
                break;
            default:
                eventBus.publish('uiNotification', { message: `Unknown combat command: "${command}". Try attack, skill, item, flee, pass, help.`, type: 'error' });
        }
    }


    handleInteraction(actionType, interactionTargetId) { // interactionTargetId is original case
        const location = worldManager.getCurrentLocation();
        if (!location || !location.interactions) {
            eventBus.publish('uiNotification', { message: "Nothing to interact with here.", type: 'error' }); return;
        }
        
        // Try exact ID match first, then partial name match for flexibility
        let interaction = location.interactions.find(i => i.id === interactionTargetId);
        if (!interaction) {
            interaction = location.interactions.find(i => i.name.toLowerCase().includes(interactionTargetId.toLowerCase()) && (i.action === actionType || actionType === 'interact' || actionType === 'use' || actionType === 'examine' || actionType === 'talk'));
        }
        
        if (!interaction) {
            eventBus.publish('uiNotification', { message: `Cannot ${actionType} '${interactionTargetId}'. Not found or action incompatible.`, type: 'error' }); return;
        }
        // Check specific action type if provided, otherwise allow general "interact" or "use"
        if (actionType !== 'interact' && actionType !== 'use' && interaction.action && interaction.action !== actionType) {
             eventBus.publish('uiNotification', { message: `Cannot ${actionType} '${interaction.name}'. Try '${interaction.action}'.`, type: 'error' }); return;
        }
        
        if (interaction.condition && !interaction.condition(playerManager)) {
            eventBus.publish('uiNotification', { message: interaction.conditionFailMessage || `You cannot do that right now.`, type: 'error' }); return;
        }

        if (interaction.message) eventBus.publish('addMessage', { text: interaction.message, type: 'system' });

        if (interaction.action === 'custom' && typeof interaction.execute === 'function') {
            interaction.execute(playerManager, uiManager); // Pass full uiManager for custom actions needing complex UI
        } else if (interaction.action === 'dialogue' && interaction.npcId) {
            // TODO: Initiate dialogue with npcId via a DialogueManager
            eventBus.publish('initiateDialogue', { npcId: interaction.npcId });
             eventBus.publish('addMessage', {text: `You start talking to ${interaction.npcId}... (Full dialogue system TBD).`, type: 'system'});
             // For MQ002 Elman example:
             if (interaction.npcId === "elman_the_scholar" && playerManager.gameState.quests["main002_scholars_plea"]?.stage === 1) {
                 questManager.setQuestFlag("elman_the_scholar_post_rescue_thanks_done"); // Manually set flag for quest progression
                 eventBus.publish('addMessage', {text: "Elman: 'Thank the stars! You saved me! I saw someone... much like your friend... heading towards Sleepy Hollow. Here, take this pass to the Study Hub I sponsor there, and this ring as a token of my gratitude!'", type: 'dialogue'});
             }

        } else if (interaction.action === 'quest_start' && interaction.questId) {
            questManager.startQuest(interaction.questId);
        } else if (interaction.action === 'study_sp' && interaction.sp_reward) { // From location data
            playerManager.addSp(interaction.sp_reward);
        } else if (interaction.action === 'claim_sp' && interaction.sp_amount) { // From location data
            const flagId = `claimed_${interaction.id}`;
            if (playerManager.gameState.flags.get(flagId)) {
                eventBus.publish('uiNotification', { message: "You have already claimed this.", type: 'error' });
            } else {
                playerManager.addSp(interaction.sp_amount);
                playerManager.gameState.flags.set(flagId, true);
            }
        } else if (interaction.action === 'gacha_pull' && interaction.poolId) { // From location data
            playerManager.gachaPull(interaction.poolId);
        } else if (interaction.result) { // Legacy simple result handling
            // ... (keep simple result logic if needed for old interactions) ...
        }
        
        if (interaction.once && !playerManager.gameState.flags.get(`interacted_${interaction.id}`)) {
            playerManager.gameState.flags.set(`interacted_${interaction.id}`, true);
        }
    }

    showHelp(inCombat = false) {
        let helpText = "<strong>Lumina Alteyn - V0.5 Help</strong><br><br>";
        if (inCombat) {
            helpText += "<strong>Combat Commands:</strong><br>";
            helpText += "<strong>attack [target]</strong> - Perform a basic attack.<br>";
            helpText += "<strong>skill [skill name] [target]</strong> - Use a learned skill.<br>";
            helpText += "<strong>item [item name] [target]</strong> - Use an item from your inventory.<br>";
            helpText += "<strong>flee</strong> - Attempt to escape combat.<br>";
            helpText += "<strong>pass</strong> - Skip your turn.<br>";
            helpText += "<strong>help</strong> - Show this combat help.<br><br>";
            helpText += "Targets can often be omitted if there's only one valid choice, or to target the first available.<br>";
        } else {
            helpText += "<strong>Movement:</strong><br>";
            helpText += "<strong>go [direction]</strong> (or n, s, e, w, up, down) - Move.<br><br>";
            helpText += "<strong>Interaction:</strong><br>";
            helpText += "<strong>look (l)</strong> - Describe current location.<br>";
            helpText += "<strong>look at [target]</strong> - Examine something specific (basic).<br>";
            helpText += "<strong>search</strong> - Search the area.<br>";
            helpText += "<strong>interact [target]</strong> - Interact with an object or NPC.<br>";
            helpText += "<strong>talk [NPC name]</strong> - Speak to an NPC.<br>";
            helpText += "<strong>use [item/object name]</strong> - Use an item or object.<br><br>";
            helpText += "<strong>Character Management:</strong><br>";
            helpText += "<strong>inv / inventory</strong> - Open inventory.<br>";
            helpText += "<strong>stats / char</strong> - View character sheet.<br>";
            helpText += "<strong>equip [item name]</strong> - Open equipment screen (or equip specific item).<br>";
            helpText += "<strong>unequip [slot]</strong> - Unequip item from slot (e.g., unequip weapon).<br>";
            helpText += "<strong>alloc [attribute]</strong> (or 'alloc') - Allocate attribute points.<br>";
            helpText += "<strong>skills / skilltree</strong> - View skill tree.<br><br>";
            helpText += "<strong>Game:</strong><br>";
            helpText += "<strong>quests / journal</strong> - View active quests.<br>";
            helpText += "<strong>help</strong> - Show this help message.<br>";
            helpText += "Use buttons in header for Save, Load, New Game.<br>";
        }
        eventBus.publish('addMessage', { text: helpText, type: 'system-message' });
    }
}
export const inputParser = new InputParser();
