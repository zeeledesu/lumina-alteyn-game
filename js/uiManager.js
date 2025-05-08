// js/uiManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { worldManager } from './worldManager.js';
import { combatManager } from './combatManager.js';
import { PLAYER_CLASSES, ATTRIBUTES, DERIVED_STATS_PLAYER, INITIAL_ATTRIBUTE_POINTS } from './data/classes.js';
import { SKILLS_DATA, SKILL_TREES_META, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ITEMS_DATA, EQUIPMENT_SLOTS } from './data/items.js';
import * as utils from './utils.js';
import { questManager, QUESTS_DATA } from './questManager.js';


class UIManager {
    constructor() {
        // Main layout
        this.gameContainer = document.getElementById('game-container');
        this.outputArea = document.getElementById('output-area');
        this.playerInput = document.getElementById('player-input');
        this.submitButton = document.getElementById('submit-button');
        this.actionButtonsContainer = document.getElementById('action-buttons');
        this.mainContentArea = document.getElementById('main-content');
        this.combatUiContainer = document.getElementById('combat-ui-container');

        // Intro
        this.introOverlay = document.getElementById('intro-overlay');
        this.introTextLine1 = document.getElementById('intro-text-line1');
        this.introTextLine2 = document.getElementById('intro-text-line2');
        this.skipIntroButton = document.getElementById('skip-intro-button');

        // Sidebar Elements... (rest of constructor is the same)
        this.playerNameDisplay = document.getElementById('player-name-display');
        this.playerLevel = document.getElementById('player-level');
        this.playerXp = document.getElementById('player-xp');
        this.playerXpNext = document.getElementById('player-xp-next');
        this.playerSp = document.getElementById('player-sp');
        this.playerGold = document.getElementById('player-gold');
        this.playerHp = document.getElementById('player-hp');
        this.playerMaxHp = document.getElementById('player-max-hp');
        this.playerMp = document.getElementById('player-mp');
        this.playerMaxMp = document.getElementById('player-max-mp');
        this.attributePointsAvail = document.getElementById('attribute-points-avail');
        this.playerAttributesList = document.getElementById('player-attributes');
        this.playerEquipmentSummary = document.getElementById('player-equipment-summary');
        this.playerSkillsSummary = document.getElementById('player-skills-summary');
        this.partyInfoSidebar = document.getElementById('party-info-sidebar');
        this.partyMembersSummary = document.getElementById('party-members-summary');
        this.currentLocationName = document.getElementById('current-location-name');
        this.locationExits = document.getElementById('location-exits');
        this.locationNotes = document.getElementById('location-notes');
        this.inventoryCount = document.getElementById('inventory-count');
        this.inventoryMax = document.getElementById('inventory-max');
        this.inventoryList = document.getElementById('inventory-list');
        this.questLog = document.getElementById('quest-log');

        document.getElementById('open-alloc-modal-button').addEventListener('click', () => this.showAttributeAllocationModal());
        document.getElementById('open-equip-modal-button').addEventListener('click', () => this.showEquipmentModal());
        document.getElementById('open-skilltree-modal-button').addEventListener('click', () => this.showSkillTreeModal());
        document.getElementById('open-inventory-modal-button').addEventListener('click', () => this.showInventoryModal());

        // Combat UI
        this.enemyPartyDisplay = document.getElementById('enemy-party-display');
        this.playerPartyDisplayCombat = document.getElementById('player-party-display-combat');
        this.combatActionButtons = document.getElementById('combat-action-buttons');
        this.targetSelectionPrompt = document.getElementById('target-selection-prompt');

        // Modal
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modalContent = document.getElementById('modal-content');

        this.isTyping = false;
        this.messageQueue = [];
        this.introTimeout = null;

        this.bindEvents();
    }

    bindEvents() {
        eventBus.subscribe('playerDataUpdated', (data) => this.refreshAllUI(data));
        eventBus.subscribe('locationChanged', ({ newLocationId }) => this.displayLocation(newLocationId));
        eventBus.subscribe('forceLocationUpdate', () => this.displayLocation(playerManager.gameState.currentLocationId, true));
        eventBus.subscribe('uiNotification', ({ message, type }) => this.addMessage(message, type || 'system-message'));
        eventBus.subscribe('addMessage', ({ text, type, useTyping, charDelay }) => this.addMessage(text, type, useTyping, charDelay));
        eventBus.subscribe('clearOutput', () => this.clearOutput());
        eventBus.subscribe('showActionButtons', (buttons) => this.renderActionButtons(buttons));
        eventBus.subscribe('playerLeveledUp', (data) => this.handleLevelUpUI(data));
        eventBus.subscribe('requestNewGame', () => this.startNewGameSequence());
        eventBus.subscribe('gameLoaded', () => { this.clearOutput(); this.refreshAllUI(playerManager.getPublicData()); });
        eventBus.subscribe('gachaResult', (data) => this.showGachaResultModal(data));
        eventBus.subscribe('showModal', (modalData) => this.showGenericModal(modalData.title, modalData.content, modalData.actions, modalData.modalClass, modalData.preventOverlayClose));
        eventBus.subscribe('hideModal', () => this.hideModal());
        eventBus.subscribe('gameOver', (data) => this.showGameOver(data.reason));

        eventBus.subscribe('combatStarted', (combatState) => this.setupCombatUI(combatState));
        eventBus.subscribe('combatEnded', (result) => this.teardownCombatUI(result));
        eventBus.subscribe('combatUiUpdate', (combatState) => this.updateCombatantsUI(combatState));
        eventBus.subscribe('combatTurnAdvanced', ({ currentTurnActor, combatState }) => this.highlightCurrentTurnActor(currentTurnActor, combatState));
        eventBus.subscribe('playerTurnStarted', ({combatState, retry}) => this.showPlayerCombatActions(combatState, retry));
        eventBus.subscribe('combatRequestTarget', (data) => this.promptForTarget(data.targetableEntities, data.actionMessage));
        eventBus.subscribe('combatLog', (logEntry) => this.addCombatLogMessage(logEntry));

        eventBus.subscribe('sansanProposalAttempt', () => this.showSansanProposalModal());

        this.submitButton.addEventListener('click', () => this.processInput());
        this.playerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.processInput(); });
        this.skipIntroButton.addEventListener('click', () => this.finishIntro(true)); // Pass true if skipped by button
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay && !this.modalContent.classList.contains('prevent-overlay-close')) {
                this.hideModal();
            }
        });
    }
    
    startNewGameSequence() {
        this.clearOutput();
        this.startAnimatedIntro();
    }

    async startAnimatedIntro() {
        this.introOverlay.classList.remove('hidden');
        this.skipIntroButton.classList.add('hidden'); // Hide initially
        
        // Reset text content for CSS animation
        this.introTextLine1.textContent = "The Twin Stars, Sansan and Teyang...";
        this.introTextLine2.textContent = "Shattered Vyraknos' Obsidian Throne.";

        // Ensure CSS animations are reset if this intro is replayed
        this.introTextLine1.style.animation = 'none';
        this.introTextLine2.style.animation = 'none';
        this.skipIntroButton.style.animation = 'none';

        // Trigger reflow to restart animation
        this.introTextLine1.offsetHeight; 
        this.introTextLine2.offsetHeight;
        this.skipIntroButton.offsetHeight;

        this.introTextLine1.style.animation = ''; // Re-apply default animation from CSS
        this.introTextLine2.style.animation = '';
        this.skipIntroButton.style.animation = '';


        // Show skip button after a delay (e.g., after line 1 animation starts)
        setTimeout(() => {
            this.skipIntroButton.classList.remove('hidden');
        }, 1600); // Delay matching roughly the end of line 1 animation + a bit

        // Timeout to auto-skip if player doesn't interact
        this.introTimeout = setTimeout(() => this.finishIntro(false), 9000); // Longer intro duration
    }

    finishIntro(skippedByUser = false) {
        if (this.introTimeout) {
            clearTimeout(this.introTimeout);
            this.introTimeout = null; 
        }
        this.introOverlay.classList.add('hidden');
        
        // Only show char creation if game isn't already loaded (e.g. player skipped intro but has a save)
        if (!playerManager.gameState.classId) { 
            this.showInitialTutorial();
            this.showCharacterCreationModal();
        } else if (skippedByUser) {
            // If skipped but game was already loaded/character exists, just ensure UI is correct
            this.refreshAllUI(playerManager.getPublicData());
            this.displayLocation(playerManager.gameState.currentLocationId, true);
        }
    }
    
    showInitialTutorial() {
        this.addMessage("<strong>Welcome to Lumina Alteyn!</strong>", "system-message highlight-color", false);
        this.addMessage("Use commands like '<strong>go north</strong>' (or '<strong>n</strong>'), '<strong>look</strong>' (or '<strong>l</strong>'), '<strong>interact [target]</strong>'.", "system-message", false);
        this.addMessage("Type '<strong>help</strong>' at any time for a list of commands.", "system-message", false);
        this.addMessage("Your adventure begins...", "lore-message", true, utils.CONFIG.DEFAULT_TEXT_SPEED);
    }

    processInput() {
        const commandText = this.playerInput.value.trim();
        if (commandText) {
            this.addMessage(`> ${commandText}`, 'player-command');
            eventBus.publish('parseInput', commandText);
            this.playerInput.value = '';
        }
    }
    
    async processMessageQueue() {
        if (this.isTyping || this.messageQueue.length === 0) return;
        this.isTyping = true;
        const { text, type, useTyping, charDelay } = this.messageQueue.shift();
        
        const messageElement = document.createElement('p');
        if (type) messageElement.classList.add(...type.split(' '));

        if (useTyping && text) { // Added null/undefined check for text
            messageElement.classList.add('typing-effect');
            this.outputArea.appendChild(messageElement);
            this.outputArea.scrollTop = this.outputArea.scrollHeight;
            await utils.typeEffect(messageElement, text, charDelay || utils.CONFIG.DEFAULT_TEXT_SPEED, false); 
        } else if (text) { // Added null/undefined check for text
            messageElement.innerHTML = text;
            this.outputArea.appendChild(messageElement);
        } else {
            // If text is empty/null, don't append empty p tag.
            this.isTyping = false; // Still need to reset this
            if (this.messageQueue.length > 0) {
                 await utils.delay(10); 
                 this.processMessageQueue();
            }
            return;
        }
        this.outputArea.scrollTop = this.outputArea.scrollHeight;
        this.isTyping = false;
        if (this.messageQueue.length > 0) {
            await utils.delay(10); 
            this.processMessageQueue();
        }
    }

    addMessage(text, type = '', useTyping = false, charDelay = utils.CONFIG.DEFAULT_TEXT_SPEED) {
        this.messageQueue.push({ text, type, useTyping, charDelay });
        if (!this.isTyping) {
            this.processMessageQueue();
        }
    }

    // ... rest of uiManager.js remains the same
    addCombatLogMessage(logEntry) {
        const p = document.createElement('p');
        p.classList.add('combat-text');
        if (logEntry.type) p.classList.add(...logEntry.type.split(' '));
        p.innerHTML = logEntry.text;
        this.outputArea.appendChild(p);
        this.outputArea.scrollTop = this.outputArea.scrollHeight;

        if (logEntry.targetId && (typeof logEntry.value !== 'undefined' || logEntry.statusName)) {
            const targetCard = document.querySelector(`.combatant-card[data-instanceid="${logEntry.targetId}"]`);
            if (targetCard) {
                const floatText = document.createElement('div');
                floatText.classList.add('floating-combat-text');
                if (logEntry.value && logEntry.value < 0) floatText.classList.add('damage');
                else if (logEntry.value && logEntry.value > 0) floatText.classList.add('heal');
                else if (logEntry.valueMp) floatText.classList.add('mp-restore');
                else if (logEntry.statusName) floatText.classList.add('status');
                
                floatText.textContent = logEntry.statusName || (logEntry.valueMp ? `${logEntry.valueMp > 0 ? '+' : ''}${logEntry.valueMp} MP` : (logEntry.value > 0 ? `+${logEntry.value}`: logEntry.value));
                
                targetCard.appendChild(floatText);
                setTimeout(() => floatText.remove(), 1500);
            }
        }
    }

    clearOutput() {
        this.outputArea.innerHTML = '';
        this.messageQueue = []; // Clear the queue
        this.isTyping = false; // Reset typing flag
    }

    refreshAllUI(playerData) {
        if (!playerData || !playerData.attributes) {
            console.warn("refreshAllUI called with invalid playerData:", playerData);
            return;
        }

        this.playerNameDisplay.textContent = playerData.name;
        this.playerLevel.textContent = playerData.level;
        this.playerXp.textContent = playerData.xp;
        this.playerXpNext.textContent = playerData.xpForNextLevel === Infinity ? "MAX" : playerData.xpForNextLevel;
        this.playerSp.textContent = playerData.sp;
        this.playerGold.textContent = playerData.gold;

        this.playerHp.textContent = playerData.derivedStats.currentHp;
        this.playerMaxHp.textContent = playerData.derivedStats.maxHp;
        this.playerMp.textContent = playerData.derivedStats.currentMp;
        this.playerMaxMp.textContent = playerData.derivedStats.maxMp;

        this.attributePointsAvail.textContent = playerData.attributePoints;
        document.getElementById('open-alloc-modal-button').classList.toggle('hidden', playerData.attributePoints <= 0);

        this.playerAttributesList.innerHTML = '';
        ATTRIBUTES.forEach(attr => {
            const attrData = playerData.attributes[attr];
            const li = document.createElement('li');
            li.innerHTML = `${utils.capitalize(attr)}: <strong>${attrData.current}</strong> <small>(B:${attrData.base}+A:${attrData.allocated}+Gear:${attrData.bonus})</small>`;
            this.playerAttributesList.appendChild(li);
        });

        this.playerEquipmentSummary.innerHTML = '';
        const playerSlots = EQUIPMENT_SLOTS.player || Object.keys(playerData.equipment);
        playerSlots.forEach(slot => {
            const item = playerData.equipment[slot];
            const li = document.createElement('li');
            li.innerHTML = `${utils.capitalize(slot.replace(/([A-Z])/g, ' $1'))}: <span class="item-${item?.rarity || 'common'}">${item ? (item.icon ? item.icon + ' ' : '') + item.name : 'Empty'}</span>`;
            this.playerEquipmentSummary.appendChild(li);
        });


        this.playerSkillsSummary.innerHTML = '';
        playerData.skills.slice(0, 5).forEach(skill => {
            const li = document.createElement('li');
            li.textContent = skill.name;
            this.playerSkillsSummary.appendChild(li);
        });
        if (playerData.skills.length > 5) this.playerSkillsSummary.innerHTML += `<li>...and ${playerData.skills.length - 5} more.</li>`;
        if (playerData.skills.length === 0) this.playerSkillsSummary.innerHTML = `<li>No skills learned.</li>`;

        this.inventoryCount.textContent = playerData.inventory.length;
        this.inventoryMax.textContent = playerData.maxInventorySlots;
        this.inventoryList.innerHTML = '';
        playerData.inventory.slice(0, 5).forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="item-${item.rarity || 'common'}">${item.icon || ''} ${item.name}</span> (x${item.quantity})`;
            this.inventoryList.appendChild(li);
        });
        if (playerData.inventory.length > 5) this.inventoryList.innerHTML += `<li>...and ${playerData.inventory.length - 5} more.</li>`;
        if (playerData.inventory.length === 0) this.inventoryList.innerHTML = `<li>Inventory is empty.</li>`;

        this.questLog.innerHTML = '';
        let activeQuestCount = 0;
        for (const questId in playerData.quests) {
            const questProgress = playerData.quests[questId];
            const questData = QUESTS_DATA[questId]; 
            if (questData && !questProgress.completed) {
                activeQuestCount++;
                const li = document.createElement('li');
                const stageDesc = questManager.getFormattedLogText(questData, questProgress.stage);
                li.innerHTML = `<strong>${questData.name}</strong>: ${stageDesc.length > 40 ? stageDesc.substring(0, 37) + "..." : stageDesc}`;
                li.title = stageDesc;
                this.questLog.appendChild(li);
            }
        }
        if (activeQuestCount === 0) this.questLog.innerHTML = '<li>No active quests.</li>';
        
        if (playerData.allies && playerData.allies.length > 0) {
            this.partyInfoSidebar.classList.remove('hidden');
            this.partyMembersSummary.innerHTML = '';
            playerData.allies.forEach(ally => {
                const li = document.createElement('li');
                li.innerHTML = `${ally.name} (Lvl ${ally.level}) - HP: ${ally.derivedStats.currentHp}/${ally.derivedStats.maxHp}`;
                this.partyMembersSummary.appendChild(li);
            });
        } else {
            this.partyInfoSidebar.classList.add('hidden');
        }
    }

    displayLocation(locationId, forceRedisplay = false) {
        const location = worldManager.getLocationData(locationId);
        if (!location) {
            this.addMessage("Error: Unknown location.", "error-message"); return;
        }

        if (!forceRedisplay) {
            this.clearOutput();
            this.addMessage(`<strong>${location.name}</strong>`, 'location-title', false);
            this.addMessage(location.description, 'location-description', true, utils.CONFIG.DEFAULT_TEXT_SPEED - 10); 
        }
        
        this.currentLocationName.textContent = location.name;
        this.locationExits.textContent = Object.keys(location.exits || {}).map(dir => utils.capitalize(dir)).join(', ') || 'None';
        
        this.locationNotes.textContent = location.notes ? location.notes(playerManager) : "";


        const interactionButtons = [];
        if (location.interactions) {
            location.interactions.forEach(interact => {
                if (interact.condition && !interact.condition(playerManager)) return;
                interactionButtons.push({
                    text: interact.name,
                    command: `${interact.action || 'interact'} ${interact.id}`
                });
            });
        }
        this.renderActionButtons(interactionButtons);
    }

    renderActionButtons(buttons) {
        this.actionButtonsContainer.innerHTML = '';
        if (!buttons || buttons.length === 0) return;
        buttons.forEach(buttonInfo => {
            const button = document.createElement('button');
            button.textContent = buttonInfo.text;
            button.addEventListener('click', () => {
                this.addMessage(`> ${buttonInfo.text}`, 'player-command');
                eventBus.publish('parseInput', buttonInfo.command);
            });
            this.actionButtonsContainer.appendChild(button);
        });
    }

    showGenericModal(title, contentHTML, actionsArray = [], modalClass = '', preventOverlayClose = false) {
        this.modalContent.innerHTML = `<h2>${title}</h2><div class="modal-body-content">${contentHTML}</div>`;
        
        if (preventOverlayClose) this.modalContent.classList.add('prevent-overlay-close');
        else this.modalContent.classList.remove('prevent-overlay-close');

        this.modalContent.className = 'modal-content-body'; 
        if (modalClass) this.modalContent.classList.add(...modalClass.split(' '));


        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'modal-actions';
        
        if (actionsArray.length === 0 && !preventOverlayClose) {
            actionsArray.push({ text: "Close", callback: () => this.hideModal() });
        }

        actionsArray.forEach(actionInfo => {
            const button = document.createElement('button');
            button.textContent = actionInfo.text;
            if (actionInfo.className) button.classList.add(...actionInfo.className.split(' '));
            button.addEventListener('click', () => {
                if (actionInfo.callback) actionInfo.callback();
            });
            actionsContainer.appendChild(button);
        });
        this.modalContent.appendChild(actionsContainer);
        this.modalOverlay.classList.remove('hidden');
    }

    hideModal() {
        this.modalOverlay.classList.add('hidden');
        this.modalContent.innerHTML = '';
        this.modalContent.className = 'modal-content-body';
    }

    async showCharacterCreationModal() {
        let partnerNameTemp = "Teyang";
        const updatePartnerPreview = (gender) => {
            partnerNameTemp = gender === 'male' ? 'Teyang' : 'Sansan';
            const previewEl = document.getElementById('partner-name-preview');
            if (previewEl) previewEl.textContent = partnerNameTemp;
        };
        
        let html = `<p id="char-create-intro">A voice, ancient and resonant, echoes in your mind, 'Child of Stars, your other half <strong id="partner-name-preview">${partnerNameTemp}</strong> awaits. The path is long, your memories fractured. Seek the threads of fate, lest the shadows consume all that was won.'</p>`;
        html += `<label for="char-name">Your Name:</label><input type="text" id="char-name" value="Lyra" placeholder="Enter your name">`;
        html += `<label for="char-gender">Your Gender:</label><select id="char-gender"><option value="female">Female</option><option value="male">Male</option></select>`;
        html += `<label for="char-class">Choose your Path:</label><select id="char-class">`;
        for (const classId in PLAYER_CLASSES) {
            if (PLAYER_CLASSES[classId].isAllyOnly) continue;
            html += `<option value="${classId}">${PLAYER_CLASSES[classId].name} - ${PLAYER_CLASSES[classId].description}</option>`;
        }
        html += `</select>`;
        html += `<p style="margin-top:15px;">You will begin with <strong>${INITIAL_ATTRIBUTE_POINTS}</strong> attribute points to allocate.</p>`;
        
        const actions = [{ text: "Begin Your Journey", className: "primary", callback: () => {
            const name = document.getElementById('char-name').value.trim() || "Adventurer";
            const gender = document.getElementById('char-gender').value;
            const classId = document.getElementById('char-class').value;
            
            playerManager.setupNewCharacter(name, gender, classId);
            this.hideModal();
            this.addMessage(`Welcome, ${name} the ${PLAYER_CLASSES[classId].name}. Your quest to find ${playerManager.gameState.partnerName} begins.`, "system-message highlight-color");
            eventBus.publish('parseInput', `quest start main001_find_partner`);
        }}];

        this.showGenericModal("Create Your Character", html, actions, 'character-creation-modal', true);

        const genderSelect = document.getElementById('char-gender');
        if (genderSelect) genderSelect.addEventListener('change', (e) => updatePartnerPreview(e.target.value));
        
        const charNameInput = document.getElementById('char-name');
        if (charNameInput) charNameInput.focus();
    }

    handleLevelUpUI(levelUpData) {
        this.addMessage(`<strong>LEVEL UP! You are now Level ${levelUpData.newLevel}!</strong>`, "success-message highlight-color");
        this.refreshAllUI(playerManager.getPublicData());

        if (levelUpData.attributePointsAvailable > 0) {
            this.showAttributeAllocationModal();
        }
        if (levelUpData.skillPointsAvailable > 0) {
            this.addMessage(`You gained ${levelUpData.skillPointsAvailable} skill point(s)! Use 'skills' or the sidebar button to spend them.`, "system-message");
        }
    }

    showAttributeAllocationModal() {
        const playerData = playerManager.getPublicData();
        if (playerData.attributePoints <= 0) {
            this.addMessage("No attribute points to allocate.", "system-message");
            return;
        }

        let html = `<p>You have <strong>${playerData.attributePoints}</strong> point(s) to allocate.</p><div class="attribute-allocation-grid">`;
        ATTRIBUTES.forEach(attr => {
            html += `<div>
                        <span>${utils.capitalize(attr)}: <strong>${playerData.attributes[attr].current}</strong></span>
                        <button class="alloc-btn" data-attr="${attr}" ${playerData.attributePoints === 0 ? 'disabled' : ''}>+1</button>
                     </div>`;
        });
        html += `</div>`;
        const actions = [{ text: "Done", callback: () => this.hideModal() }];
        this.showGenericModal("Allocate Attribute Points", html, actions, "attribute-modal");

        document.querySelectorAll('.alloc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (playerManager.allocateAttributePoint(e.target.dataset.attr)) {
                    this.showAttributeAllocationModal(); 
                }
            });
        });
    }

    showSkillTreeModal() {
        const playerData = playerManager.getPublicData();
        const playerClass = PLAYER_CLASSES[playerData.classId];
        if (!playerClass || !playerClass.skillTree) {
            this.addMessage("No skill tree available for your class.", "error-message"); return;
        }

        let html = `<h2>Skill Tree - ${playerClass.name}</h2>`;
        html += `<p>Available Skill Points: <strong>${playerData.skillPoints}</strong></p><hr>`;

        playerClass.skillTree.forEach(treeId => {
            const treeMeta = SKILL_TREES_META[treeId];
            if (!treeMeta) return;
            html += `<h3>${treeMeta.name}</h3><div class="skill-tree-branch">`;
            treeMeta.skills.forEach(skillId => {
                const skill = SKILLS_DATA[skillId];
                if (!skill) return;
                const known = playerData.skills.some(s => s.id === skillId);
                const canLearn = playerManager.gameState.skillPoints >= (skill.cost || 1) &&
                                 playerData.level >= (skill.levelRequirement || 1) &&
                                 (skill.prerequisites ? skill.prerequisites.every(pr => playerData.skills.some(s => s.id === pr)) : true);
                
                html += `<div class="skill-choice ${known ? 'known' : (canLearn ? 'learnable' : 'locked')}">
                            <h4>${skill.name} ${known ? '(Known)' : ''}</h4>
                            <p>${skill.description}</p>
                            <p><small>MP: ${skill.mpCost || 0} | Lvl Req: ${skill.levelRequirement || 1} | Cost: ${skill.cost || 1} SPP</small></p>`;
                if (skill.prerequisites) {
                    html += `<p class="skill-prereq"><small>Requires: ${skill.prerequisites.map(pr => SKILLS_DATA[pr]?.name).join(', ')}</small></p>`;
                }
                if (!known && canLearn) {
                    html += `<button class="learn-skill-btn" data-skillid="${skill.id}">Learn (${skill.cost || 1} SPP)</button>`;
                } else if (!known && !canLearn) {
                     html += `<button disabled>Cannot Learn Yet</button>`;
                }
                html += `</div>`;
            });
            html += `</div><hr>`;
        });
        
        const actions = [{ text: "Close", callback: () => this.hideModal() }];
        this.showGenericModal("Skill Tree", html, actions, "skill-tree-modal wide-modal");

        document.querySelectorAll('.learn-skill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (playerManager.learnSkill(e.target.dataset.skillid)) {
                    this.showSkillTreeModal();
                }
            });
        });
    }

    showInventoryModal() {
        const playerData = playerManager.getPublicData();
        let html = `<h2>Inventory (${playerData.inventory.length}/${playerData.maxInventorySlots})</h2>`;
        if (playerData.inventory.length === 0) {
            html += "<p>Your inventory is empty.</p>";
        } else {
            html += `<ul class="inventory-modal-list">`;
            playerData.inventory.forEach(item => { 
                html += `<li class="item-modal-entry">
                            <strong class="item-${item.rarity || 'common'}">${item.icon || ''} ${item.name}</strong> (x${item.quantity}) - <small>${item.type}</small>
                            <p>${item.description}</p>`;
                if (item.type === 'consumable' || (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory')) {
                     html += `<div class="item-actions">`;
                    if (item.type === 'consumable' && item.use_effect) html += `<button class="use-item-btn" data-iteminstanceid="${item.instanceId}">Use</button>`;
                    if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
                         const isEquipped = Object.values(playerData.equipment).some(eq => eq && eq.instanceId === item.instanceId);
                         if (isEquipped) {
                             html += `<button class="unequip-item-btn" data-slot="${Object.keys(playerData.equipment).find(slot => playerData.equipment[slot]?.instanceId === item.instanceId)}">Unequip</button>`;
                         } else {
                             html += `<button class="equip-item-btn" data-iteminstanceid="${item.instanceId}">Equip</button>`;
                         }
                    }
                     html += `<button class="drop-item-btn" data-iteminstanceid="${item.instanceId}" data-itemname="${item.name}">Drop</button>
                              </div>`;
                }
                html += `</li>`;
            });
            html += `</ul>`;
        }
        const actions = [{ text: "Close", callback: () => this.hideModal() }];
        this.showGenericModal("Inventory", html, actions, "inventory-modal wide-modal");

        document.querySelectorAll('.use-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemInstanceId = e.target.dataset.iteminstanceid;
                eventBus.publish('parseInput', `use ${itemInstanceId}`); 
                this.showInventoryModal(); 
            });
        });
        document.querySelectorAll('.equip-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                playerManager.equipItem(e.target.dataset.iteminstanceid);
                this.showInventoryModal(); 
            });
        });
        document.querySelectorAll('.unequip-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                playerManager.unequipItem(e.target.dataset.slot);
                this.showInventoryModal(); 
            });
        });
         document.querySelectorAll('.drop-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemName = e.target.dataset.itemname;
                this.showGenericModal("Confirm Drop", `<p>Are you sure you want to drop ${itemName}?</p>`, [
                    {text: "Yes, Drop", className: "danger", callback: () => {
                        playerManager.removeItem(e.target.dataset.iteminstanceid);
                        this.hideModal(); 
                        this.showInventoryModal(); 
                    }},
                    {text: "Cancel", callback: () => this.hideModal()}
                ]);
            });
        });
    }
    
    showEquipmentModal(intentToEquipItemId = null) {
        const playerData = playerManager.getPublicData();
        let html = `<h2>Equipment</h2><div class="equipment-grid">`;

        const playerSlots = EQUIPMENT_SLOTS.player || [];
        playerSlots.forEach(slot => {
            const equippedItem = playerData.equipment[slot];
            html += `<div class="equipment-slot-entry">
                        <h4>${utils.capitalize(slot.replace(/([A-Z])/g, ' $1'))}</h4>`;
            if (equippedItem) {
                html += `<p><span class="item-${equippedItem.rarity || 'common'}">${equippedItem.icon || ''} ${equippedItem.name}</span></p>
                         <p><small>${equippedItem.description}</small></p>
                         <button class="unequip-from-slot-btn" data-slot="${slot}">Unequip</button>`;
            } else {
                html += `<p><em>Empty</em></p>
                         <button class="equip-to-slot-btn" data-slot="${slot}">Equip Item</button>`;
            }
            html += `</div>`;
        });
        html += `</div>`;

        if (intentToEquipItemId) { 
            const itemToEquip = playerData.inventory.find(i => i.instanceId === intentToEquipItemId || i.itemId === intentToEquipItemId);
            if(itemToEquip) {
                html += `<hr><h3>Equipping: ${itemToEquip.name}</h3>`;
                html += `<p>Select a compatible slot above or click "Equip Best Slot".</p>`;
            }
        }

        const actions = [{ text: "Close", callback: () => this.hideModal() }];
        this.showGenericModal("Equipment", html, actions, "equipment-modal wide-modal");

        document.querySelectorAll('.unequip-from-slot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                playerManager.unequipItem(e.target.dataset.slot);
                this.showEquipmentModal(); 
            });
        });
        document.querySelectorAll('.equip-to-slot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotToFill = e.target.dataset.slot;
                this.showInventoryForEquipSlot(slotToFill);
            });
        });
    }

    showInventoryForEquipSlot(slotId) {
        const playerData = playerManager.getPublicData();
        const compatibleItems = playerData.inventory.filter(item => {
            const itemData = ITEMS_DATA[item.itemId]; 
            if (!itemData) return false;
            if (itemData.slot === slotId) return true;
            if (slotId === "weapon" && itemData.slot === "twoHand") return true;
            if (slotId === "offHand" && itemData.slot === "shield") return true; 
            if (slotId.startsWith("accessory") && itemData.slot === "accessory") return true;
            return false;
        });

        let html = `<h3>Select item for ${utils.capitalize(slotId.replace(/([A-Z])/g, ' $1'))}</h3>`;
        if (compatibleItems.length === 0) {
            html += "<p>No compatible items in inventory.</p>";
        } else {
            html += `<ul class="inventory-modal-list">`;
            compatibleItems.forEach(item => {
                 html += `<li class="item-modal-entry">
                            <strong class="item-${item.rarity || 'common'}">${item.icon || ''} ${item.name}</strong> (x${item.quantity})
                            <p>${item.description}</p>
                            <button class="equip-this-item-btn" data-iteminstanceid="${item.instanceId}" data-intendedslot="${slotId}">Equip to ${utils.capitalize(slotId)}</button>
                          </li>`;
            });
            html += `</ul>`;
        }
        const currentModalBody = this.modalContent.querySelector('.modal-body-content');
        if (currentModalBody) {
            currentModalBody.innerHTML = html; 

            document.querySelectorAll('.equip-this-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    playerManager.equipItem(e.target.dataset.iteminstanceid); 
                    this.showEquipmentModal(); 
                });
            });
        }
    }


    showCharacterSheetModal() {
        const playerData = playerManager.getPublicData();
        let html = `<h2>${playerData.name} - Level ${playerData.level} ${PLAYER_CLASSES[playerData.classId]?.name}</h2>`;
        html += `<p>XP: ${playerData.xp} / ${playerData.xpForNextLevel === Infinity ? "MAX" : playerData.xpForNextLevel}</p>`;
        html += `<p>SP: ${playerData.sp} | Gold: ${playerData.gold}</p><hr>`;

        html += `<h3>Attributes (${playerData.attributePoints} points available)</h3><div class="char-sheet-section">`;
        ATTRIBUTES.forEach(attr => {
            const attrData = playerData.attributes[attr];
            html += `<p>${utils.capitalize(attr)}: <strong>${attrData.current}</strong> (Base: ${attrData.base}, Allocated: ${attrData.allocated}, Gear: ${attrData.bonus})</p>`;
        });
        if (playerData.attributePoints > 0) html += `<button id="cs-alloc-attr">Allocate Points</button>`;
        html += `</div><hr>`;

        html += `<h3>Derived Stats</h3><div class="char-sheet-section derived-stats-grid">`;
        for (const stat in playerData.derivedStats) {
            if (DERIVED_STATS_PLAYER.includes(stat) && !stat.startsWith('current')) { 
                 html += `<p>${stat.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: <strong>${playerData.derivedStats[stat]}</strong></p>`;
            }
        }
        html += `</div><hr>`;

        html += `<h3>Equipment</h3><div class="char-sheet-section">`;
        const playerSlots = EQUIPMENT_SLOTS.player || [];
        playerSlots.forEach(slot => {
            const item = playerData.equipment[slot];
            html += `<p>${utils.capitalize(slot.replace(/([A-Z])/g, ' $1'))}: <span class="item-${item?.rarity || 'common'}">${item ? (item.icon || '') + item.name : '<em>Empty</em>'}</span></p>`;
        });

        html += `<button id="cs-manage-equip">Manage Equipment</button>`;
        html += `</div>`;
        
        const actions = [{ text: "Close", callback: () => this.hideModal() }];
        this.showGenericModal("Character Sheet", html, actions, "character-sheet-modal wide-modal");

        document.getElementById('cs-alloc-attr')?.addEventListener('click', () => { this.hideModal(); this.showAttributeAllocationModal(); });
        document.getElementById('cs-manage-equip')?.addEventListener('click', () => { this.hideModal(); this.showEquipmentModal(); });
    }


    async showGachaResultModal(gachaData) {
        let html = `<p>${gachaData.message}</p>`;
        if (gachaData.rewards && gachaData.rewards.length > 0) {
            html += `<p>You received:</p><ul>`;
            gachaData.rewards.forEach(item => {
                html += `<li><strong class="item-${item.rarity || 'common'}">${item.icon || ''} ${item.name}</strong> (x${item.quantityPulled})</li>`;
            });
            html += `</ul>`;
        } else {
            html += `<p>Unfortunately, you received nothing this time.</p>`;
        }
        html += `<br><p><em>"${gachaData.quote}"</em></p>`;
        
        this.showGenericModal("Study Device Results", "<p style='text-align:center; font-size: 1.5em; animation: pulse 1.5s infinite;'>Analyzing Results...</p>", [], "gacha-result-modal");
        await utils.delay(1800);

        const actions = [{ text: "Awesome!", callback: () => this.hideModal() }];
        this.showGenericModal("Study Device Results", html, actions, "gacha-result-modal");
    }
    
    showSansanProposalModal() {
        const playerData = playerManager.getPublicData();
        if (playerData.name !== "Cutiepatotie") return;

        let html = `<div class="text-center">
                        <p>Sansan gets down on one knee, his large dino eyes sparkling with emotion. He holds out a small, intricately carved box. Inside, a beautiful ring glows with a soft, warm light.</p>
                        <p>"Cutiepatotie... my love, my life... Will you be my forever?"</p>
                        <img src="placeholder_dino_proposal.png" alt="Sansan Proposing" style="max-width:200px; margin:15px auto; display:block; border-radius: var(--border-radius);">
                        <p><small>(Warning: Accepting this ring will permanently bind it to you.)</small></p>
                    </div>`;
        const actions = [
            { text: "Yes, Sansan! A thousand times yes!", className:"primary", callback: () => {
                playerManager.addItem("r002_engagement_ring_sansan", 1);
                const ringInstance = playerManager.gameState.inventory.find(i => i.itemId === "r002_engagement_ring_sansan");
                if (ringInstance) playerManager.equipItem(ringInstance.instanceId);
                playerManager.gameState.sansanDialogue.proposalStage = 3;
                playerManager.gameState.sansanDialogue.promptActive = null;
                eventBus.publish('addMessage', {text: "Sansan roars with joy, a surprisingly gentle sound. He carefully slips the ring onto your finger. It fits perfectly.", type: "sansan-chat highlight-color"});
                this.hideModal();
            }},
            { text: "I... I can't right now, Sansan.", callback: () => {
                playerManager.gameState.sansanDialogue.proposalStage = -1;
                playerManager.gameState.sansanDialogue.promptActive = null;
                eventBus.publish('addMessage', {text: "Sansan's eyes dim, his posture slumping. 'I... understand.' He slowly gets up, the light from the ring fading slightly.", type: "sansan-chat"});
                this.hideModal();
            }}
        ];
        this.showGenericModal("A Dino's Proposal", html, actions, "proposal-modal", true);
    }

    // --- COMBAT UI ---
    setupCombatUI(combatState) {
        this.mainContentArea.classList.add('hidden');
        this.combatUiContainer.classList.remove('hidden');
        this.clearOutput(); 
        this.addMessage("<strong>Combat Started!</strong>", "system-message highlight-color");
        this.updateCombatantsUI(combatState);
    }

    teardownCombatUI(result) {
        this.mainContentArea.classList.remove('hidden');
        this.combatUiContainer.classList.add('hidden');
        this.targetSelectionPrompt.classList.add('hidden');
        this.combatActionButtons.innerHTML = '';

        if (result.won) {
            this.addMessage("<strong>Victory!</strong>", "success-message highlight-color");
            if (result.xpGained > 0) this.addMessage(`Gained ${result.xpGained} XP.`, "system-message");
            if (result.goldGained > 0) this.addMessage(`Found ${result.goldGained} Gold.`, "system-message");
            if (result.itemsDropped && result.itemsDropped.length > 0) {
                let itemText = "Looted: ";
                result.itemsDropped.forEach(item => itemText += `${item.name} (x${item.quantityObtained}), `);
                this.addMessage(itemText.slice(0, -2) + ".", "system-message");
            }
        } else if (result.fled) {
            this.addMessage("You managed to escape.", "system-message");
        }
        this.refreshAllUI(playerManager.getPublicData());
        this.displayLocation(playerManager.gameState.currentLocationId, true);
    }

    updateCombatantsUI(combatState) {
        this.enemyPartyDisplay.innerHTML = '';
        combatState.enemyParty.forEach(enemy => {
            if (enemy.stats.currentHp > 0) this.enemyPartyDisplay.appendChild(this.createCombatantCard(enemy, false, combatState.currentActorInstanceId === enemy.instanceId));
        });

        this.playerPartyDisplayCombat.innerHTML = '';
        combatState.playerParty.forEach(member => {
            if (member.stats.currentHp > 0) this.playerPartyDisplayCombat.appendChild(this.createCombatantCard(member, true, combatState.currentActorInstanceId === member.instanceId));
        });
        
        // This refreshAllUI might be redundant if combat state doesn't directly affect non-combat sidebar much,
        // but good for keeping HP/MP up-to-date if they were separate.
        // For now, playerManager.getPublicData() gets fresh data anyway.
        this.refreshAllUI(playerManager.getPublicData()); 
    }

    createCombatantCard(combatant, isPlayerSide, isCurrentTurn) {
        const card = document.createElement('div');
        card.className = 'combatant-card';
        card.dataset.instanceid = combatant.instanceId;
        if (combatant.isPlayer) card.classList.add('player');
        else if (combatant.isAlly) card.classList.add('ally');
        else card.classList.add('enemy');

        if(isCurrentTurn) card.classList.add('current-turn');

        card.innerHTML = `
            <h4>${combatant.name} (L${combatant.level || playerManager.gameState.level})</h4>
            <div class="hp-bar"><div class="hp-bar-inner" style="width: ${Math.max(0,(combatant.stats.currentHp / combatant.maxStats.maxHp) * 100)}%;"></div></div>
            <p><small>HP: ${combatant.stats.currentHp}/${combatant.maxStats.maxHp}</small></p>
            ${(combatant.isPlayer || combatant.isAlly) ? `<p><small>MP: ${combatant.stats.currentMp}/${combatant.maxStats.maxMp}</small></p>` : ''}
            <div class="status-effects-display"></div>
        `;
        const statusDisplay = card.querySelector('.status-effects-display');
        combatant.statusEffects?.forEach(seInstance => {
            const seData = STATUS_EFFECTS_DATA[seInstance.statusId];
            if (seData) {
                const seSpan = document.createElement('span');
                seSpan.className = `status-icon ${seData.type === 'buff' ? 'buff' : 'debuff'}`;
                seSpan.title = `${seData.name} (${seInstance.duration} turns left)`;
                seSpan.textContent = seData.name.substring(0,3).toUpperCase();
                statusDisplay.appendChild(seSpan);
            }
        });

        if (combatManager.pendingPlayerAction) {
            let canTargetThis = false;
            const actionType = combatManager.pendingPlayerAction.type;
            const detailId = combatManager.pendingPlayerAction.detailId;

            if (actionType === 'attack') {
                if (!isPlayerSide) canTargetThis = true; // Can attack enemies
            } else if (actionType === 'skill') {
                const skillData = SKILLS_DATA[detailId];
                if (skillData) {
                    if (skillData.target.includes('enemy') && !isPlayerSide) canTargetThis = true;
                    if ((skillData.target.includes('ally') || skillData.target === 'self' || skillData.target === 'party' || skillData.target === 'ally_leader') && isPlayerSide) canTargetThis = true;
                }
            } else if (actionType === 'item') {
                const itemRef = playerManager.gameState.inventory.find(i => i.instanceId === detailId);
                const itemData = itemRef ? ITEMS_DATA[itemRef.itemId] : null;
                if (itemData && itemData.use_effect) {
                    const effectTarget = itemData.use_effect.target;
                    if (effectTarget === 'enemy_single' && !isPlayerSide) canTargetThis = true;
                    if ((effectTarget === 'ally_single' || effectTarget === 'self_or_ally' || effectTarget === 'self') && isPlayerSide) canTargetThis = true;
                }
            }
            
            if (canTargetThis) {
                card.classList.add('targetable');
                card.addEventListener('click', () => {
                    // combatManager.playerSelectsTarget(combatant.instanceId); // Directly call here
                    eventBus.publish('playerSelectedCombatTarget', combatant.instanceId);
                });
            }
        }
        return card;
    }

    highlightCurrentTurnActor(actor, combatState) {
        this.updateCombatantsUI(combatState); 
    }

    showPlayerCombatActions(combatState, retry = false) {
        this.targetSelectionPrompt.classList.add('hidden');
        this.combatActionButtons.innerHTML = '';
        const player = combatState.playerParty.find(p => p.isPlayer);
        if (!player || player.stats.currentHp <= 0) return;

        if (retry) this.addMessage("Action failed or canceled. Please choose another action.", "warning-message");

        const actions = [
            { text: "Attack", commandType: 'attack', detailId: null },
            { text: "Skills", commandType: 'show_skills', detailId: null },
            { text: "Items", commandType: 'show_items', detailId: null },
            { text: "Flee", commandType: 'flee', detailId: null },
            { text: "Pass", commandType: 'pass', detailId: null },
        ];

        actions.forEach(actionInfo => {
            const button = document.createElement('button');
            button.textContent = actionInfo.text;
            button.addEventListener('click', () => {
                if (actionInfo.commandType === 'show_skills') {
                    this.showPlayerCombatSkillSelection(player, combatState);
                } else if (actionInfo.commandType === 'show_items') {
                    this.showPlayerCombatItemSelection(player, combatState);
                } else {
                    // For attack, item, skill (if directly chosen without sub-menu),
                    // combatManager.playerInitiatesTargetedAction handles target prompting.
                    // For flee/pass, directly publish combatAction.
                    if (actionInfo.commandType === 'attack' || actionInfo.commandType === 'skill' || actionInfo.commandType === 'item') {
                        combatManager.playerInitiatesTargetedAction(actionInfo.commandType, actionInfo.detailId);
                    } else {
                        eventBus.publish('combatAction', { type: actionInfo.commandType, casterId: player.instanceId });
                    }
                }
            });
            this.combatActionButtons.appendChild(button);
        });
    }

    showPlayerCombatSkillSelection(player, combatState) {
        this.combatActionButtons.innerHTML = '';
        const availableSkills = playerManager.getPublicData().skills;

        if (availableSkills.length === 0) {
            this.addMessage("You have no skills to use!", "warning-message");
            this.showPlayerCombatActions(combatState, true);
            return;
        }
        
        availableSkills.forEach(skill => { 
            const skillData = SKILLS_DATA[skill.id]; 
            if (!skillData) return;
            const button = document.createElement('button');
            button.textContent = `${skillData.name} (MP: ${skillData.mpCost || 0})`;
            if (player.stats.currentMp < (skillData.mpCost || 0)) {
                button.disabled = true;
                button.title = "Not enough MP";
            }
            button.addEventListener('click', () => {
                this.combatActionButtons.innerHTML = '';
                combatManager.playerInitiatesTargetedAction('skill', skillData.id);
            });
            this.combatActionButtons.appendChild(button);
        });

        const backButton = document.createElement('button');
        backButton.textContent = "Back to Actions";
        backButton.classList.add("secondary");
        backButton.addEventListener('click', () => this.showPlayerCombatActions(combatState));
        this.combatActionButtons.appendChild(backButton);
    }

    showPlayerCombatItemSelection(player, combatState) {
        this.combatActionButtons.innerHTML = '';
        const usableItems = playerManager.getPublicData().inventory.filter(item => {
            return item.use_effect && (item.use_effect.target !== 'non_combat' && item.use_effect.type !== 'grant_sp');
        });

        if (usableItems.length === 0) {
            this.addMessage("No usable items in combat.", "warning-message");
            this.showPlayerCombatActions(combatState, true);
            return;
        }

        usableItems.forEach(item => {
            const button = document.createElement('button');
            button.textContent = `${item.name} (x${item.quantity})`;
            button.addEventListener('click', () => {
                this.combatActionButtons.innerHTML = '';
                combatManager.playerInitiatesTargetedAction('item', item.instanceId);
            });
            this.combatActionButtons.appendChild(button);
        });
        const backButton = document.createElement('button');
        backButton.textContent = "Back to Actions";
        backButton.classList.add("secondary");
        backButton.addEventListener('click', () => this.showPlayerCombatActions(combatState));
        this.combatActionButtons.appendChild(backButton);
    }

    promptForTarget(targetableEntities, actionMessage) {
        this.combatActionButtons.innerHTML = ''; // Clear previous action buttons
        this.targetSelectionPrompt.textContent = actionMessage || "Select target:";
        this.targetSelectionPrompt.classList.remove('hidden');
        
        // Re-render combatants to make them clickable if they are targetable
        this.updateCombatantsUI(combatManager.getCombatState()); // This will make cards targetable

        const cancelButton = document.createElement('button');
        cancelButton.textContent = "Cancel Target";
        cancelButton.classList.add("danger");
        cancelButton.addEventListener('click', () => {
            this.targetSelectionPrompt.classList.add('hidden');
            combatManager.cancelPlayerTargetSelection();
        });
        this.combatActionButtons.appendChild(cancelButton); // Add cancel to the main action button area
    }


    showGameOver(reason) {
        this.hideModal();
        let html = `<p>${reason}</p><p>Your journey ends here... for now.</p>`;
        const actions = [
            { text: "Try Again (Load Last Save)", callback: () => {
                this.hideModal();
                eventBus.publish('parseInput', `load`);
            }},
            { text: "Start New Game", className:"danger", callback: () => {
                this.hideModal();
                 eventBus.publish('requestNewGame');
            }}
        ];
        this.showGenericModal("Game Over", html, "game-over-modal", true);
    }
}
export const uiManager = new UIManager();
