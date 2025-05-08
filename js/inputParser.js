parse(commandText) {
    commandText = commandText.trim();
    if (!commandText) return;

    const lowerCommandText = commandText.toLowerCase();

    if (playerManager.gameState.sansanDialogue.promptActive) {
        if (aiManager.processSansanReply(commandText)) { 
            return;
        }
    }

    const [command, ...args] = lowerCommandText.split(' ');
    const originalArgs = commandText.split(' ').slice(1); 


    if (playerManager.gameState.inCombat) {
        this.parseCombatCommand(command, args, originalArgs);
        return;
    }

    switch (command) {
        case 'go': case 'move': case 'n': case 's': case 'e': case 'w': case 'u': case 'd':
            let direction = args[0];
            if (['n','s','e','w','u','d'].includes(command)) direction = command; 
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
                this.handleInteraction('examine', originalArgs.join(' ')); // Try to handle 'look at X' as examine
            } else {
                eventBus.publish('forceLocationUpdate'); 
            }
            break;
        case 'search':
            const searchInteraction = worldManager.getCurrentLocation()?.interactions?.find(i => i.action === 'search' || i.id.toLowerCase().includes('search'));
            if (searchInteraction) {
                this.handleInteraction('interact', searchInteraction.id); // Use 'interact' and the found ID
            } else {
                 eventBus.publish('uiNotification', { message: "Nothing obvious to search here.", type: 'system' });
            }
            break;
        case 'interact':
        case 'examine':
        case 'talk':
        case 'use': 
            if (args.length > 0) {
                this.handleInteraction(command, originalArgs.join(' ')); 
            } else {
                eventBus.publish('uiNotification', { message: `${command} what/who?`, type: 'error' });
            }
            break;
        case 'inv': case 'inventory': uiManager.showInventoryModal(); break;
        case 'stats': case 'char': uiManager.showCharacterSheetModal(); break;
        case 'equip':
            if (originalArgs.length > 0) {
                uiManager.showEquipmentModal(originalArgs.join(' ')); 
            } else {
                uiManager.showEquipmentModal();
            }
            break;
        case 'unequip':
            if (args.length > 0) { 
                const slotToUnequip = args.join('_').replace(/ /g, '_'); // "off hand" -> "off_hand"
                const validSlotsPlayer = EQUIPMENT_SLOTS.player || [];
                let foundSlot = validSlotsPlayer.find(s => s.toLowerCase() === slotToUnequip) || 
                                validSlotsPlayer.find(s => s.toLowerCase() === args[0]); // try just "weapon"

                if (!foundSlot && EQUIPMENT_SLOTS.player[slotToUnequip]) foundSlot = slotToUnequip; 

                if (foundSlot) {
                     playerManager.unequipItem(foundSlot);
                } else {
                     eventBus.publish('uiNotification', { message: `Invalid slot to unequip: ${args.join(' ')}. Try weapon, head, body, etc.`, type: 'error' });
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
        case 'quest': 
             if (args[0] === 'start' && args[1] && QUESTS_DATA[args[1]]) questManager.startQuest(args[1]);
             else if (args[0] === 'complete' && args[1] && QUESTS_DATA[args[1]]) questManager.completeQuest(args[1]); 
             else if (args[0] === 'setstage' && args[1] && QUESTS_DATA[args[1]] && args[2] !== undefined) { 
                 const questProgress = playerManager.gameState.quests[args[1]];
                 if(questProgress) {
                     questProgress.stage = parseInt(args[2]);
                     questManager.checkQuestObjective(args[1]); // Recheck after manual stage set
                     eventBus.publish('uiNotification', {text: `Quest ${args[1]} stage set to ${args[2]}`, type: 'dev'});
                 } else {
                     eventBus.publish('uiNotification', {text: `Quest ${args[1]} not active.`, type: 'error'});
                 }
             }
             else questManager.showQuestLog();
            break;
        case 'dev_additem': if (args[0] && ITEMS_DATA[args[0]] && playerManager.addItem(args[0], parseInt(args[1] || 1))) {} break;
        case 'dev_addgold': if (args[0]) playerManager.addGold(parseInt(args[0])); break;
        case 'dev_addxp': if (args[0]) playerManager.addXp(parseInt(args[0])); break;
        case 'dev_setflag': if (args[0]) { questManager.setQuestFlag(args[0], args[1] !== 'false'); eventBus.publish('uiNotification', {text: `Flag ${args[0]} set to ${args[1] !== 'false'}.`, type: 'dev'});} break;
        case 'dev_goto': if (args[0] && LOCATIONS_DATA[args[0]]) { playerManager.gameState.currentLocationId = args[0]; eventBus.publish('locationChanged', {newLocationId: args[0], oldLocationId: playerManager.gameState.currentLocationId}); } break;
        case 'dev_startcombat': if (args[0] && ENEMY_GROUPS[args[0]]) { eventBus.publish('startCombat', {enemies: encounterManager.buildEnemyPartyFromGroup(args[0])}); } else {eventBus.publish('uiNotification', {text: `Enemy group ${args[0]} not found.`, type: 'error'});} break;

        default:
            eventBus.publish('uiNotification', { message: `Unknown command: "${commandText}"`, type: 'error' });
    }
    if (!playerManager.gameState.inCombat) { 
        questManager.checkAllQuestObjectives();
         playerManager.updateAllStats(); 
         eventBus.publish('playerDataUpdated', playerManager.getPublicData()); 
    }
}

parseCombatCommand(command, args, originalArgs) {
    const currentCombatActor = combatManager.currentActor; // Can be player or controlled ally
    if (!currentCombatActor || !(currentCombatActor.isPlayer || currentCombatActor.isPlayerControlled)) {
        eventBus.publish('uiNotification', { message: "Not your turn or invalid combat state.", type: 'error' });
        return;
    }
    
    if (combatManager.pendingPlayerAction) {
        const targetClickedByNameOrId = originalArgs.join(' ').toLowerCase();
        let foundTarget = null;

        // Try to find target by name first (case-insensitive partial match), then by ID
        foundTarget = [...combatManager.playerParty, ...combatManager.enemyParty]
                        .find(c => c.stats.currentHp > 0 && 
                                   (c.name.toLowerCase().includes(targetClickedByNameOrId) || c.instanceId === originalArgs[0]));
        
        if (foundTarget) {
             combatManager.playerSelectsTarget(foundTarget.instanceId);
             return;
        } else if (command !== 'cancel') { // if not trying to cancel, and no valid target found for current input
            // Don't cancel if the command itself is a new valid action
            // For now, simple cancel:
            // combatManager.cancelPlayerTargetSelection(); 
            // This line above might be too aggressive, player might be typing a new command.
            // The UI now handles clicks on cards for targeting. Typing a target name is less common.
        }
    }


    switch (command) {
        case 'attack': 
            combatManager.playerInitiatesTargetedAction('attack', null);
            break;
        case 'skill': 
            const skillQuery = args[0];
            let skillsSource = currentCombatActor.isPlayer ? playerManager.getPublicData().skills : 
                               (currentCombatActor.isAlly ? currentCombatActor.skills.map(id => SKILLS_DATA[id]) : []);
            
            const foundSkill = skillsSource.find(s => s && (s.id.toLowerCase() === skillQuery || s.name.toLowerCase().includes(skillQuery)));

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
             const itemQuery = args[0]; 
             const inventoryItem = playerManager.gameState.inventory.find(invItem => {
                 const itemData = ITEMS_DATA[invItem.itemId];
                 return itemData && (itemData.id.toLowerCase() === itemQuery || itemData.name.toLowerCase().includes(itemQuery));
             });

             if (inventoryItem && ITEMS_DATA[inventoryItem.itemId]?.use_effect && ITEMS_DATA[inventoryItem.itemId].use_effect.target !== 'non_combat') {
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
        case 'cancel': // Explicit command to cancel target selection
            if(combatManager.pendingPlayerAction) combatManager.cancelPlayerTargetSelection();
            else eventBus.publish('uiNotification', {message: "Nothing to cancel.", type: "system"});
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
        eventBus.publish('uiNotification', { message: "Nothing to interact with here.", type: 'error' }); return;
    }
    
    let interaction = location.interactions.find(i => i.id.toLowerCase() === interactionTargetId.toLowerCase());
    if (!interaction) {
        interaction = location.interactions.find(i => i.name.toLowerCase().includes(interactionTargetId.toLowerCase()));
    }
    
    if (!interaction) {
        eventBus.publish('uiNotification', { message: `Cannot find '${interactionTargetId}' to ${actionType}.`, type: 'error' }); return;
    }
    
    // Use the action defined in the interaction data, or default to the command type if appropriate
    const effectiveAction = interaction.action || actionType;

    if (interaction.condition && !interaction.condition(playerManager)) {
        eventBus.publish('uiNotification', { message: interaction.conditionFailMessage || `You cannot do that right now.`, type: 'error' }); return;
    }

    // If a message is defined for the interaction, show it before executing
    if (interaction.messageOnInteract) {
         eventBus.publish('addMessage', { text: interaction.messageOnInteract.replace("[PlayerName]", playerManager.gameState.name), type: 'system' });
    }


    if (effectiveAction === 'custom' && typeof interaction.execute === 'function') {
        interaction.execute(playerManager, uiManager); 
    } else if (effectiveAction === 'dialogue' && interaction.npcId) {
        eventBus.publish('addMessage', {text: `You talk to ${interaction.name || interaction.npcId}.`, type: 'system'});
         // Example dialogue flag setting for MQ002 Elman
         if (interaction.npcId === "elman_the_scholar" && playerManager.gameState.quests["main002_scholars_plea"]?.stage === 1) {
             eventBus.publish('addMessage', {text: "Elman: 'Thank the stars! You saved me! I saw someone... much like your friend... heading towards Sleepy Hollow. Here, take this pass to the Study Hub I sponsor there, and this ring as a token of my gratitude!'", type: 'dialogue'});
             questManager.setQuestFlag("elman_the_scholar_post_rescue_thanks_done"); 
         } else {
             // Generic dialogue placeholder
             eventBus.publish('addMessage', {text: `(Dialogue with ${interaction.name || interaction.npcId} not fully implemented yet.)`, type: 'system'});
         }
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
    } else if (effectiveAction === 'examine' || actionType === 'look') { // For 'look at X' or 'examine X'
        const examineText = interaction.examineText || interaction.description || `You examine the ${interaction.name}. Nothing more to note.`;
        eventBus.publish('addMessage', { text: examineText, type: 'system' });
    } else {
        // Fallback for unhandled specific actions but valid interaction
        if (interaction.message) eventBus.publish('addMessage', { text: interaction.message, type: 'system' });
        else eventBus.publish('uiNotification', { message: `You interact with ${interaction.name}.`, type: 'system'});
    }
    
    if (interaction.once && !playerManager.gameState.flags.get(`interacted_${interaction.id}`)) {
        playerManager.gameState.flags.set(`interacted_${interaction.id}`, true);
    }
}

showHelp(inCombat = false) {
    let helpText = "<strong>Lumina Alteyn - V0.5 Help</strong><br><br>";
    if (inCombat) {
        helpText += "<strong>Combat Commands:</strong><br>";
        helpText += "<strong>attack</strong> - Initiate an attack (will prompt for target if multiple).<br>";
        helpText += "<strong>skill [skill name]</strong> - Initiate skill use (prompts for target).<br>";
        helpText += "<strong>item [item name]</strong> - Initiate item use (prompts for target if applicable).<br>";
        helpText += "<strong>flee</strong> - Attempt to escape combat (player only).<br>";
        helpText += "<strong>pass</strong> - Skip your turn.<br>";
        helpText += "<strong>cancel</strong> - Cancel target selection.<br>";
        helpText += "<strong>help</strong> - Show this combat help.<br><br>";
        helpText += "During target selection, click target cards or type target's name/ID.<br>";
    } else {
        helpText += "<strong>Movement:</strong><br>";
        helpText += "<strong>go [direction]</strong> (or n, s, e, w, up, down) - Move.<br><br>";
        helpText += "<strong>Interaction:</strong><br>";
        helpText += "<strong>look (l)</strong> - Describe current location.<br>";
        helpText += "<strong>look at [target] / examine [target]</strong> - Examine something specific.<br>";
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
