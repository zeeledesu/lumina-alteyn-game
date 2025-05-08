// js/inputParser.js
import { eventBus } from './eventManager.js';
import { worldManager } from './worldManager.js';
import { playerManager } from './playerManager.js';
import { uiManager } from './uiManager.js';
import { questManager, QUESTS_DATA } from './questManager.js';
import { combatManager } from './combatManager.js';
import { aiManager } from './aiManager.js';
import { encounterManager } from './encounterManager.js'; // Added missing import
import { ITEMS_DATA, EQUIPMENT_SLOTS } from './data/items.js';
import { SKILLS_DATA } from './data/skills.js';
import { ATTRIBUTES } from './data/classes.js'; // Import ATTRIBUTES for alloc command validation
import { ENEMIES_DATA, ENEMY_GROUPS } from './data/enemies.js';
import { LOCATIONS_DATA } from './data/locations.js';

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

        // --- Non-Combat Commands ---
        switch (command) {
            case 'go': case 'move': case 'n': case 's': case 'e': case 'w': case 'u': case 'd':
                let direction = args[0];
                if (['n','s','e','w','u','d'].includes(command)) direction = command; // Allow shorthand
                if (direction) {
                    // Normalize direction
                    const directionMap = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
                    direction = directionMap[direction] || direction; // Use mapped or original if not shorthand
                    worldManager.move(direction);
                } else {
                    eventBus.publish('uiNotification', { message: "Go where? (e.g., go north, n, s, e, w, up, down)", type: 'error' });
                }
                break;

            case 'look': case 'l':
                const targetToLook = originalArgs.join(' '); // Keep original case for target matching
                if (targetToLook) {
                    this.handleInteraction('examine', targetToLook); // Try to handle 'look at X' as examine
                } else {
                    eventBus.publish('forceLocationUpdate'); // Re-display current location
                }
                break;

            case 'search':
                // Find specific 'search' interaction or a generic one
                const searchInteraction = worldManager.getCurrentLocation()?.interactions?.find(i => i.action === 'search' || i.id.toLowerCase() === 'search');
                if (searchInteraction) {
                    // Use 'interact' command internally to trigger handleInteraction
                    this.handleInteraction('interact', searchInteraction.id);
                } else {
                     eventBus.publish('uiNotification', { message: "You search the area, but find nothing obvious.", type: 'system' });
                }
                break;

            case 'interact':
            case 'examine': // Treat examine like interact, handleInteraction decides based on interaction data
            case 'talk': // Treat talk like interact, handleInteraction uses interaction.action
            case 'use': // General use for items or interactables
                if (args.length > 0) {
                    this.handleInteraction(command, originalArgs.join(' ')); // Use original case for ID/name matching
                } else {
                    eventBus.publish('uiNotification', { message: `${command} what/who?`, type: 'error' });
                }
                break;

            // --- UI Commands ---
            case 'inv': case 'inventory': uiManager.showInventoryModal(); break;
            case 'stats': case 'char': uiManager.showCharacterSheetModal(); break;
            case 'equip':
                if (originalArgs.length > 0) {
                     // Try to find item in inventory first
                     const itemQuery = originalArgs.join(' ').toLowerCase();
                     const itemToEquip = playerManager.gameState.inventory.find(invItem => {
                         const itemData = ITEMS_DATA[invItem.itemId];
                         // Match by name primarily for direct equip command
                         return itemData && itemData.name.toLowerCase().includes(itemQuery);
                     });
                     if (itemToEquip && ITEMS_DATA[itemToEquip.itemId]?.slot) { // Check if item is equippable
                        playerManager.equipItem(itemToEquip.instanceId);
                     } else if (itemToEquip && !ITEMS_DATA[itemToEquip.itemId]?.slot) {
                         eventBus.publish('uiNotification', { message: `${ITEMS_DATA[itemToEquip.itemId].name} is not equippable.`, type: 'error' });
                         uiManager.showEquipmentModal(); // Show modal for manual equip if typed item isn't equippable
                     }
                     else {
                        eventBus.publish('uiNotification', { message: `Item "${originalArgs.join(' ')}" not found in inventory to equip.`, type: 'error' });
                        uiManager.showEquipmentModal(); // Show modal anyway for manual equip
                     }
                } else {
                    uiManager.showEquipmentModal();
                }
                break;

            case 'unequip':
                if (args.length > 0) {
                    const slotToUnequip = args.join('_').replace(/ /g, '_'); // e.g., "off hand" -> "off_hand"
                    const validSlotsPlayer = EQUIPMENT_SLOTS.player || [];

                    // Find the canonical slot name (case-insensitive match)
                    let foundSlot = validSlotsPlayer.find(s => s.toLowerCase() === slotToUnequip);

                    // If not found, check if the input is a substring of a valid slot (e.g., "weapon" matches "weapon")
                    if (!foundSlot) {
                         foundSlot = validSlotsPlayer.find(s => s.toLowerCase().includes(args[0]));
                    }

                    if (foundSlot) {
                         playerManager.unequipItem(foundSlot);
                    } else {
                         eventBus.publish('uiNotification', { message: `Invalid slot to unequip: ${args.join(' ')}. Try: ${validSlotsPlayer.join(', ')}`, type: 'error' });
                    }
                } else {
                     eventBus.publish('uiNotification', { message: "Unequip what slot? (e.g., unequip weapon, unequip head)", type: 'error' });
                }
                break;

            case 'alloc': case 'allocate':
                if (args.length > 0) {
                    if (ATTRIBUTES.includes(args[0])) {
                        playerManager.allocateAttributePoint(args[0]);
                    } else {
                         eventBus.publish('uiNotification', { message: `Invalid attribute: ${args[0]}. Choose from: ${ATTRIBUTES.join(', ')}`, type: 'error' });
                    }
                }
                else uiManager.showAttributeAllocationModal();
                break;

            case 'skills': case 'skilltree': uiManager.showSkillTreeModal(); break;
            case 'quests': case 'questlog': case 'journal': questManager.showQuestLog(); break;
            case 'help': this.showHelp(); break;

            // --- Quest Commands (mostly for debug/testing now) ---
            case 'quest':
                 if (args[0] === 'start' && args[1] && QUESTS_DATA[args[1]]) {
                     questManager.startQuest(args[1]);
                 } else if (args[0] === 'complete' && args[1] && QUESTS_DATA[args[1]]) {
                     questManager.completeQuest(args[1]); // Dev command
                 } else if (args[0] === 'setstage' && args[1] && QUESTS_DATA[args[1]] && args[2] !== undefined) {
                     const questProgress = playerManager.gameState.quests[args[1]];
                     if(questProgress) {
                         const stageNum = parseInt(args[2]);
                         if (!isNaN(stageNum) && stageNum >= 0 && stageNum < QUESTS_DATA[args[1]].stages.length) {
                            questProgress.stage = stageNum;
                            // Reset objectives met for future stages if setting stage backwards? Maybe not needed.
                            questManager.checkQuestObjective(args[1]); // Recheck after manual stage set
                            eventBus.publish('uiNotification', {text: `Quest ${args[1]} stage set to ${stageNum}`, type: 'dev'});
                            eventBus.publish('playerDataUpdated', playerManager.getPublicData()); // Update quest log display
                         } else {
                              eventBus.publish('uiNotification', {text: `Invalid stage number ${args[2]} for quest ${args[1]}`, type: 'error'});
                         }
                     } else {
                         eventBus.publish('uiNotification', {text: `Quest ${args[1]} not active.`, type: 'error'});
                     }
                 } else {
                     questManager.showQuestLog();
                 }
                break;

            // --- Dev Commands ---
            case 'dev_additem':
                if (args[0] && ITEMS_DATA[args[0]]) {
                    playerManager.addItem(args[0], parseInt(args[1] || 1));
                } else {
                    eventBus.publish('uiNotification', {text: `Unknown item ID: ${args[0]}`, type: 'error'});
                }
                break;
            case 'dev_addgold':
                if (args[0] && !isNaN(parseInt(args[0]))) {
                    playerManager.addGold(parseInt(args[0]));
                } else {
                    eventBus.publish('uiNotification', {text: `Invalid gold amount: ${args[0]}`, type: 'error'});
                }
                break;
            case 'dev_addxp':
                if (args[0] && !isNaN(parseInt(args[0]))) {
                    playerManager.addXp(parseInt(args[0]));
                } else {
                    eventBus.publish('uiNotification', {text: `Invalid XP amount: ${args[0]}`, type: 'error'});
                }
                break;
            case 'dev_setflag':
                if (args[0]) {
                    const flagValue = args[1] !== 'false'; // Set to true unless explicitly 'false'
                    questManager.setQuestFlag(args[0], flagValue); // Use questManager helper
                    eventBus.publish('uiNotification', {text: `Flag ${args[0]} set to ${flagValue}.`, type: 'dev'});
                } else {
                     eventBus.publish('uiNotification', {text: `Usage: dev_setflag <flagName> [true|false]`, type: 'error'});
                }
                break;
            case 'dev_goto':
                if (args[0] && LOCATIONS_DATA[args[0]]) {
                    const oldLocationId = playerManager.gameState.currentLocationId;
                    playerManager.gameState.currentLocationId = args[0];
                    // Publish location changed but skip encounter checks for dev command
                    eventBus.publish('locationChanged', {newLocationId: args[0], oldLocationId: oldLocationId});
                    // Manually trigger display since encounter manager listener won't run
                     uiManager.displayLocation(args[0]);
                } else {
                     eventBus.publish('uiNotification', {text: `Unknown location ID: ${args[0]}`, type: 'error'});
                }
                break;
            case 'dev_startcombat':
                if (args[0] && ENEMY_GROUPS[args[0]]) {
                    const enemyParty = encounterManager.buildEnemyPartyFromGroup(args[0]);
                    if (enemyParty.length > 0) {
                        eventBus.publish('startCombat', {enemies: enemyParty});
                    } else {
                         eventBus.publish('uiNotification', {text: `Could not build enemy party for group ${args[0]}`, type: 'error'});
                    }
                } else {
                     eventBus.publish('uiNotification', {text: `Unknown enemy group: ${args[0]}`, type: 'error'});
                }
                break;
             case 'dev_setlevel': // New Dev command
                if (args[0] && !isNaN(parseInt(args[0]))) {
                    const newLevel = Math.max(1, Math.min(99, parseInt(args[0])));
                    const levelDiff = newLevel - playerManager.gameState.level;
                    if (levelDiff > 0) {
                         playerManager.gameState.attributePoints += levelDiff * ATTRIBUTE_POINTS_GAIN;
                         playerManager.gameState.skillPoints += levelDiff;
                    }
                    playerManager.gameState.level = newLevel;
                    playerManager.gameState.xp = 0; // Reset XP for new level
                    playerManager.updateAllStats();
                    playerManager.gameState.derivedStats.currentHp = playerManager.gameState.derivedStats.maxHp; // Full heal
                    playerManager.gameState.derivedStats.currentMp = playerManager.gameState.derivedStats.maxMp;
                    eventBus.publish('playerDataUpdated', playerManager.getPublicData());
                    eventBus.publish('uiNotification', {text: `Player level set to ${newLevel}. Points added: ${levelDiff > 0 ? (levelDiff * ATTRIBUTE_POINTS_GAIN) + ' Attr, ' + levelDiff + ' Skill.' : '0'}`, type: 'dev'});
                } else {
                     eventBus.publish('uiNotification', {text: `Invalid level: ${args[0]}`, type: 'error'});
                }
                break;

            default:
                eventBus.publish('uiNotification', { message: `Unknown command: "${commandText}". Type 'help' for options.`, type: 'error' });
        }

        // After any non-combat action that might change state, check quests and update UI
        if (!playerManager.gameState.inCombat) {
            questManager.checkAllQuestObjectives(); // Check if any quest objectives were met
            // playerManager.updateAllStats(); // Stats are generally updated by specific actions (alloc, equip), maybe redundant here unless flags change derived stats
            eventBus.publish('playerDataUpdated', playerManager.getPublicData()); // Ensure UI reflects any changes
        }
    }

    parseCombatCommand(command, args, originalArgs) {
        const currentCombatActor = combatManager.currentActor; // Can be player or controlled ally
        if (!currentCombatActor || !(currentCombatActor.isPlayer || currentCombatActor.isPlayerControlled)) {
            eventBus.publish('uiNotification', { message: "Not your turn or invalid combat state.", type: 'error' });
            return;
        }

        // If waiting for target, only process target selection clicks (handled by UI) or 'cancel' command.
        if (combatManager.pendingPlayerAction) {
            if (command === 'cancel') {
                combatManager.cancelPlayerTargetSelection();
            } else {
                 // Feedback that target selection is pending. Typing other commands won't work here.
                 eventBus.publish('uiNotification', { message: `Waiting for target selection for ${combatManager.pendingPlayerAction.type}. Click a target or type 'cancel'.`, type: 'warning-message' });
            }
            return; // Don't process other commands while waiting for target
        }


        switch (command) {
            case 'attack':
                combatManager.playerInitiatesTargetedAction('attack', null);
                break;

            case 'skill':
                const skillQuery = args.join(' '); // Allow multi-word skill names
                if (!skillQuery) {
                     eventBus.publish('uiNotification', { message: `Usage: skill <skill name>`, type: 'error' });
                     uiManager.showPlayerCombatActions(combatManager.getCombatState(), true, currentCombatActor.isAlly, currentCombatActor);
                     return;
                }

                // Get skills for the current actor (player or controlled ally)
                 let skillsSource = [];
                 if (currentCombatActor.isPlayer) {
                    // Use the full data already present in getPublicData
                    skillsSource = playerManager.getPublicData().skills; // Array of skill objects {id, name, ...}
                 } else if (currentCombatActor.isAlly) {
                     // Allies in combat state have skill IDs; map them to full data
                     skillsSource = currentCombatActor.skills.map(id => SKILLS_DATA[id]).filter(Boolean); // Get full data, filter out nulls if ID invalid
                 }

                const foundSkill = skillsSource.find(s => s && s.name.toLowerCase().includes(skillQuery));

                if (foundSkill) {
                    combatManager.playerInitiatesTargetedAction('skill', foundSkill.id);
                } else {
                    eventBus.publish('uiNotification', { message: `Skill "${skillQuery}" not known or invalid.`, type: 'error' });
                    uiManager.showPlayerCombatActions(combatManager.getCombatState(), true, currentCombatActor.isAlly, currentCombatActor); // Re-show actions
                }
                break;

            case 'item':
                 if (!currentCombatActor.isPlayer) {
                     eventBus.publish('uiNotification', {message: "Allies cannot use items directly.", type: "error"});
                     uiManager.showPlayerCombatActions(combatManager.getCombatState(), true, currentCombatActor.isAlly, currentCombatActor);
                     return;
                 }
                 const itemQuery = args.join(' '); // Allow multi-word item names
                 if (!itemQuery) {
                      eventBus.publish('uiNotification', { message: `Usage: item <item name>`, type: 'error' });
                      uiManager.showPlayerCombatActions(combatManager.getCombatState(), true, false, null);
                      return;
                 }

                 // Find item in player's inventory by name match
                 const inventoryItem = playerManager.gameState.inventory.find(invItem => {
                     const itemData = ITEMS_DATA[invItem.itemId];
                     return itemData && itemData.name.toLowerCase().includes(itemQuery);
                 });

                 if (inventoryItem && ITEMS_DATA[inventoryItem.itemId]?.use_effect && ITEMS_DATA[inventoryItem.itemId].use_effect.target !== 'non_combat' && ITEMS_DATA[inventoryItem.itemId].use_effect.type !== 'grant_sp') {
                     combatManager.playerInitiatesTargetedAction('item', inventoryItem.instanceId);
                 } else {
                     eventBus.publish('uiNotification', { message: `Item "${itemQuery}" not found or not usable in combat.`, type: 'error' });
                     uiManager.showPlayerCombatActions(combatManager.getCombatState(), true, false, null);
                 }
                break;

            case 'flee':
                 if (!currentCombatActor.isPlayer) {
                     eventBus.publish('uiNotification', {message: "Only the party leader can attempt to flee.", type: "error"});
                     uiManager.showPlayerCombatActions(combatManager.getCombatState(), true, currentCombatActor.isAlly, currentCombatActor);
                     return;
                 }
                eventBus.publish('combatAction', { type: 'flee', casterId: currentCombatActor.instanceId });
                break;

            case 'pass':
                 eventBus.publish('combatAction', { type: 'pass', casterId: currentCombatActor.instanceId });
                break;

            case 'cancel': // Explicit command to cancel target selection (already handled above if pending)
                if(!combatManager.pendingPlayerAction) {
                    eventBus.publish('uiNotification', {message: "Nothing to cancel.", type: "system"});
                }
                break;

            case 'help':
                this.showHelp(true);
                break;

            default:
                eventBus.publish('uiNotification', { message: `Unknown combat command: "${command}". Try attack, skill, item, flee, pass, help, cancel.`, type: 'error' });
        }
    }


    handleInteraction(actionType, interactionTargetId) {
        const location = worldManager.getCurrentLocation();
        if (!location || !location.interactions) {
            // If no location interactions, check if it's a 'use' command for an inventory item
             if (actionType === 'use') {
                const itemQuery = interactionTargetId.toLowerCase();
                const inventoryItem = playerManager.gameState.inventory.find(invItem => {
                     const itemData = ITEMS_DATA[invItem.itemId];
                     return itemData && itemData.name.toLowerCase().includes(itemQuery);
                 });
                 if (inventoryItem && ITEMS_DATA[inventoryItem.itemId]?.use_effect && ITEMS_DATA[inventoryItem.itemId].use_effect.target !== 'combat_only') {
                     playerManager.useItem(inventoryItem.instanceId); // Assume useItem exists in playerManager
                     return; // Handled as item use
                 }
            }
            // If not an item use or no interactions defined
            eventBus.publish('uiNotification', { message: `There is nothing called '${interactionTargetId}' to ${actionType} here.`, type: 'error' });
            return;
        }

        // Prioritize exact ID match (case-insensitive), then partial name match (case-insensitive)
        let interaction = location.interactions.find(i => i.id.toLowerCase() === interactionTargetId.toLowerCase());
        if (!interaction) {
            interaction = location.interactions.find(i => i.name.toLowerCase().includes(interactionTargetId.toLowerCase()));
        }

        if (!interaction) {
             // Check again if it's a 'use' command for an inventory item (fallback)
             if (actionType === 'use') {
                const itemQuery = interactionTargetId.toLowerCase();
                const inventoryItem = playerManager.gameState.inventory.find(invItem => {
                     const itemData = ITEMS_DATA[invItem.itemId];
                     return itemData && itemData.name.toLowerCase().includes(itemQuery);
                 });
                 if (inventoryItem && ITEMS_DATA[inventoryItem.itemId]?.use_effect && ITEMS_DATA[inventoryItem.itemId].use_effect.target !== 'combat_only') {
                     playerManager.useItem(inventoryItem.instanceId); // Assumes useItem exists
                     return; // Handled as item use
                 }
            }
            eventBus.publish('uiNotification', { message: `Cannot find '${interactionTargetId}' to ${actionType}.`, type: 'error' });
            return;
        }

        // Use the action defined in the interaction data, or default to the command type if appropriate
        const effectiveAction = interaction.action || actionType;

        // Check if the attempted command is valid for this interaction
        if (actionType === 'talk' && effectiveAction !== 'dialogue') {
             eventBus.publish('uiNotification', { message: `You cannot talk to ${interaction.name}. Try 'interact' or 'examine'.`, type: 'error' }); return;
        }
         if (actionType === 'examine' && effectiveAction !== 'examine' && !interaction.examineText && !interaction.description) {
             eventBus.publish('uiNotification', { message: `There's nothing more to see on ${interaction.name}.`, type: 'system' }); return;
        }
         if (actionType === 'use' && effectiveAction !== 'custom' && effectiveAction !== 'gacha_pull' && effectiveAction !== 'study_sp' && effectiveAction !== 'claim_sp' ) { // Only allow 'use' for specific action types or custom execute
             eventBus.publish('uiNotification', { message: `Cannot 'use' ${interaction.name}. Try 'interact' or 'examine'.`, type: 'error' }); return;
         }


        // Check condition *after* finding the interaction and validating action type
        if (interaction.condition && !interaction.condition(playerManager)) {
            eventBus.publish('uiNotification', { message: interaction.conditionFailMessage || `You cannot ${effectiveAction} ${interaction.name} right now.`, type: 'error' }); return;
        }

        // If a message is defined for the interaction, show it before executing
        if (interaction.messageOnInteract) {
             eventBus.publish('addMessage', { text: interaction.messageOnInteract.replace("[PlayerName]", playerManager.gameState.name), type: 'system' });
        }


        // --- Execute based on effectiveAction ---
        if (effectiveAction === 'custom' && typeof interaction.execute === 'function') {
             const simpleUI = {
                 addMessage: (msgData) => eventBus.publish('addMessage', msgData),
                 renderActionButtons: (btns) => eventBus.publish('showActionButtons', btns),
                 showModal: (modalData) => eventBus.publish('showModal', modalData),
                 hideModal: () => eventBus.publish('hideModal')
             };
            interaction.execute(playerManager, simpleUI);
        } else if (effectiveAction === 'dialogue' && interaction.npcId) {
            eventBus.publish('addMessage', {text: `You talk to ${interaction.name || interaction.npcId}.`, type: 'system'});
             // --- Specific Dialogue Handling Example (Replace with Dialogue Manager later) ---
             if (interaction.npcId === "elman_the_scholar" && playerManager.gameState.quests["main002_scholars_plea"]?.stage === 1) {
                 eventBus.publish('addMessage', {text: "Elman: 'Thank the stars! You saved me! I saw someone... much like your friend... heading towards Sleepy Hollow. Here, take this pass to the Study Hub I sponsor there, and this ring as a token of my gratitude!'", type: 'dialogue'});
                 questManager.setQuestFlag("elman_the_scholar_post_rescue_thanks_done"); // Set flag for quest
             } else if (interaction.npcId === "old_lady_gable" && playerManager.gameState.quests["side001_lost_cat"]?.stage === 1) {
                  eventBus.publish('addMessage', {text: "Old Lady Gable: 'Mittens! Oh, thank you, dearie! You found her! Here's a little something for your trouble.'", type: 'dialogue'});
                  questManager.setQuestFlag("returned_mittens_to_gable"); // Set flag for quest
             }
             else {
                 // Generic dialogue placeholder
                 const genericDialogue = interaction.genericDialogue || `(Dialogue with ${interaction.name || interaction.npcId} not fully implemented yet.)`;
                 eventBus.publish('addMessage', {text: genericDialogue, type: 'system'});
             }
             // ------------------------------------------------------------------------------
        } else if (effectiveAction === 'quest_start' && interaction.questId) {
            questManager.startQuest(interaction.questId);
        } else if (effectiveAction === 'study_sp' && interaction.sp_reward) {
            playerManager.addSp(interaction.sp_reward);
             if (interaction.message) eventBus.publish('addMessage', { text: interaction.message, type: 'system' });
        } else if (effectiveAction === 'claim_sp' && interaction.sp_amount) {
            const flagId = `claimed_${interaction.id}`;
            if (playerManager.gameState.flags.get(flagId)) {
                eventBus.publish('uiNotification', { message: interaction.alreadyClaimedMessage || "You have already claimed this.", type: 'system' });
            } else {
                playerManager.addSp(interaction.sp_amount);
                playerManager.gameState.flags.set(flagId, true);
                if (interaction.message) eventBus.publish('addMessage', { text: interaction.message, type: 'success-message' });
            }
        } else if (effectiveAction === 'gacha_pull' && interaction.poolId) {
            if (interaction.message) eventBus.publish('addMessage', { text: interaction.message, type: 'system' });
            playerManager.gachaPull(interaction.poolId);
        } else if (effectiveAction === 'examine' || actionType === 'examine' || actionType === 'look') {
            const examineText = interaction.examineText || interaction.description || `You examine the ${interaction.name}. Nothing more to note.`;
            eventBus.publish('addMessage', { text: examineText, type: 'system' });
        } else {
            // Fallback for unhandled specific actions but valid interaction attempt
             eventBus.publish('uiNotification', { message: `You interact with ${interaction.name}. (Action: ${effectiveAction})`, type: 'system'});
        }

        // Set 'once' flag if interaction should only happen once
        if (interaction.once && !playerManager.gameState.flags.get(`interacted_${interaction.id}`)) {
            playerManager.gameState.flags.set(`interacted_${interaction.id}`, true);
        }
    }

    showHelp(inCombat = false) {
        let helpText = "<strong>Lumina Alteyn - V0.5 Help</strong><br><br>";
        if (inCombat) {
            helpText += "<strong>Combat Commands:</strong><br>";
            helpText += "<strong>attack</strong> - Initiate an attack (prompts for target).<br>";
            helpText += "<strong>skill [skill name]</strong> - Initiate skill use (prompts for target).<br>";
            helpText += "<strong>item [item name]</strong> - Initiate item use (prompts for target).<br>";
            helpText += "<strong>flee</strong> - Attempt to escape combat (player only).<br>";
            helpText += "<strong>pass</strong> - Skip current turn.<br>";
            helpText += "<strong>cancel</strong> - Cancel current target selection.<br>";
            helpText += "<strong>help</strong> - Show this combat help.<br><br>";
            helpText += "During target selection, click the target's card.<br>";
        } else {
            helpText += "<strong>Movement:</strong><br>";
            helpText += "<strong>go [direction]</strong> (or n, s, e, w, up, down) - Move.<br><br>";
            helpText += "<strong>Interaction:</strong><br>";
            helpText += "<strong>look (l)</strong> - Describe current location.<br>";
            helpText += "<strong>look at [target] / examine [target]</strong> - Examine something specific.<br>";
            helpText += "<strong>search</strong> - Search the area for obvious points of interest.<br>";
            helpText += "<strong>interact [target]</strong> - Interact with an object or NPC.<br>";
            helpText += "<strong>talk [NPC name]</strong> - Speak to an NPC.<br>";
            helpText += "<strong>use [item/object name]</strong> - Use an item from inventory or an object.<br><br>";
            helpText += "<strong>Character Management:</strong><br>";
            helpText += "<strong>inv / inventory</strong> - Open inventory screen.<br>";
            helpText += "<strong>stats / char</strong> - View character sheet.<br>";
            helpText += "<strong>equip [item name]</strong> - Equip an item from inventory.<br>";
            helpText += "<strong>equip</strong> - Open equipment screen.<br>";
            helpText += "<strong>unequip [slot]</strong> - Unequip item from slot (e.g., unequip weapon).<br>";
            helpText += "<strong>alloc [attribute]</strong> (or 'alloc') - Allocate attribute points / Open screen.<br>";
            helpText += "<strong>skills / skilltree</strong> - View skill tree.<br><br>";
            helpText += "<strong>Game:</strong><br>";
            helpText += "<strong>quests / journal</strong> - View active quests.<br>";
            helpText += "<strong>help</strong> - Show this help message.<br>";
            helpText += "Use buttons in header for Save, Load, New Game.<br>";
            helpText += "<strong>Dev Commands:</strong> dev_additem, dev_addgold, dev_addxp, dev_setflag, dev_goto, dev_startcombat, dev_setlevel, quest start/complete/setstage<br>";
        }
        eventBus.publish('addMessage', { text: helpText, type: 'system-message' });
    }
}

export const inputParser = new InputParser();
