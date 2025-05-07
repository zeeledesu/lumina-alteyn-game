// js/uiManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { worldManager } from './worldManager.js';
import { PLAYER_CLASSES, ATTRIBUTES } from './data/classes.js';
import { SKILLS_DATA } from './data/skills.js';
import * as utils from './utils.js';

class UIManager {
    constructor() {
        this.outputArea = document.getElementById('output-area');
        this.playerInput = document.getElementById('player-input');
        this.submitButton = document.getElementById('submit-button');
        this.actionButtonsContainer = document.getElementById('action-buttons');

        // Sidebar elements
        this.playerNameDisplay = document.getElementById('player-name-display');
        this.playerLevel = document.getElementById('player-level');
        this.playerXp = document.getElementById('player-xp');
        this.playerXpNext = document.getElementById('player-xp-next');
        this.playerSp = document.getElementById('player-sp');
        this.playerHp = document.getElementById('player-hp');
        this.playerMaxHp = document.getElementById('player-max-hp');
        this.playerMp = document.getElementById('player-mp');
        this.playerMaxMp = document.getElementById('player-max-mp');
        this.playerAttributesList = document.getElementById('player-attributes');
        this.playerSkillsSummary = document.getElementById('player-skills-summary');

        this.currentLocationName = document.getElementById('current-location-name');
        this.locationExits = document.getElementById('location-exits');
        
        this.inventoryCount = document.getElementById('inventory-count');
        this.inventoryMax = document.getElementById('inventory-max');
        this.inventoryList = document.getElementById('inventory-list');

        this.questLog = document.getElementById('quest-log');

        // Modal elements
        this.modalOverlay = document.getElementById('modal-overlay');
        this.modalContent = document.getElementById('modal-content');

        this.isTyping = false; // To prevent overlapping type effects

        this.bindEvents();
        this.refreshAllUI(playerManager.getPublicData()); // Initial UI setup
    }

    bindEvents() {
        eventBus.subscribe('playerDataUpdated', (data) => this.refreshAllUI(data));
        eventBus.subscribe('locationChanged', ({ newLocationId }) => this.displayLocation(newLocationId));
        eventBus.subscribe('uiNotification', ({ message, type }) => this.addMessage(message, type));
        eventBus.subscribe('clearOutput', () => this.clearOutput());
        eventBus.subscribe('addMessage', ({ text, type }) => this.addMessage(text, type));
        eventBus.subscribe('showActionButtons', (buttons) => this.renderActionButtons(buttons));
        eventBus.subscribe('playerLeveledUp', (data) => this.handleLevelUpUI(data));
        eventBus.subscribe('newCharacterCreated', () => this.clearOutput()); // Clear output on new char
        eventBus.subscribe('gameLoaded', () => this.clearOutput()); // Clear output on load
        eventBus.subscribe('gachaResult', (data) => this.showGachaResult(data));
        eventBus.subscribe('startCharacterCreation', () => this.showCharacterCreationModal());

        this.submitButton.addEventListener('click', () => this.processInput());
        this.playerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.processInput();
        });
    }

    processInput() {
        const commandText = this.playerInput.value.trim();
        if (commandText) {
            this.addMessage(`> ${commandText}`, 'player-command'); // Echo command
            eventBus.publish('parseInput', commandText);
            this.playerInput.value = '';
        }
    }
    
    async addMessage(text, type = '', useTyping = false, charDelay = 30) {
        if (this.isTyping && useTyping) {
            // If already typing, queue or wait. For simplicity, just add non-typed.
            useTyping = false; 
        }

        const messageElement = document.createElement('p');
        if (type) messageElement.classList.add(type);

        if (useTyping) {
            this.isTyping = true;
            messageElement.classList.add('typing-effect'); // For CSS to target
            this.outputArea.appendChild(messageElement);
            await utils.typeEffect(messageElement, text, charDelay);
            this.isTyping = false;
        } else {
            messageElement.innerHTML = text; // Use innerHTML to support basic formatting
            this.outputArea.appendChild(messageElement);
        }
        this.outputArea.scrollTop = this.outputArea.scrollHeight;
    }

    clearOutput() {
        this.outputArea.innerHTML = '';
    }

    refreshAllUI(playerData) {
        if (!playerData || !playerData.attributes) return; // Guard against incomplete data

        this.playerNameDisplay.textContent = playerData.name;
        this.playerLevel.textContent = playerData.level;
        this.playerXp.textContent = playerData.xp;
        this.playerXpNext.textContent = playerData.xpForNextLevel;
        this.playerSp.textContent = playerData.sp;

        this.playerHp.textContent = playerData.derivedStats.currentHp;
        this.playerMaxHp.textContent = playerData.derivedStats.maxHp;
        this.playerMp.textContent = playerData.derivedStats.currentMp;
        this.playerMaxMp.textContent = playerData.derivedStats.maxMp;

        this.playerAttributesList.innerHTML = '';
        ATTRIBUTES.forEach(attr => {
            const currentVal = playerData.attributes[attr]?.current || 0;
            const li = document.createElement('li');
            li.textContent = `${utils.capitalize(attr)}: ${currentVal}`;
            this.playerAttributesList.appendChild(li);
        });
        if (playerData.unallocatedPoints > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Points to allocate: ${playerData.unallocatedPoints}</strong>`;
            this.playerAttributesList.appendChild(li);
        }


        this.playerSkillsSummary.innerHTML = '';
        playerData.skills.forEach(skill => {
            const li = document.createElement('li');
            li.textContent = skill.name;
            this.playerSkillsSummary.appendChild(li);
        });


        this.inventoryCount.textContent = playerData.inventory.length;
        this.inventoryMax.textContent = playerData.maxInventorySlots;
        this.inventoryList.innerHTML = '';
        playerData.inventory.forEach(item => {
            const li = document.createElement('li');
            const itemData = item; // Already merged in PlayerManager.getPublicData
            li.innerHTML = `<span class="item-${itemData.rarity || 'common'}">${itemData.name}</span> (x${item.quantity})`;
            // Add click handler for item details/use later
            this.inventoryList.appendChild(li);
        });
        
        // Update quests (basic)
        this.questLog.innerHTML = '';
        for (const questId in playerData.quests) {
            const quest = playerData.quests[questId];
            if (!quest.completed) { // Only show active quests
                const li = document.createElement('li');
                // TODO: Get quest name and stage description from a QuestData object
                li.textContent = `${questId} - Stage ${quest.stage}`;
                this.questLog.appendChild(li);
            }
        }

        // Location info is updated by displayLocation
    }

    displayLocation(locationId) {
        const location = worldManager.getLocationData(locationId);
        if (!location) {
            this.addMessage("Error: Unknown location.", "error-message");
            return;
        }

        this.currentLocationName.textContent = location.name;
        this.locationExits.textContent = Object.keys(location.exits).join(', ') || 'None';

        this.addMessage(`<strong>${location.name}</strong>`, 'location-title');
        this.addMessage(location.description, 'location-description', true, 20); // Typing effect for description

        // Display available interactions as buttons
        const interactionButtons = [];
        if (location.interactions) {
            location.interactions.forEach(interact => {
                // Check condition for interaction
                if (interact.condition && !interact.condition(playerManager)) {
                    return; // Skip this interaction
                }
                interactionButtons.push({
                    text: interact.name,
                    command: `${interact.action || 'interact'} ${interact.id}` // e.g., "interact search_flowers"
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

    showModal(htmlContent) {
        this.modalContent.innerHTML = htmlContent;
        this.modalOverlay.classList.remove('hidden');
    }

    hideModal() {
        this.modalOverlay.classList.add('hidden');
        this.modalContent.innerHTML = ''; // Clear content
    }

    async showCharacterCreationModal() {
        this.clearOutput();
        await this.addMessage("The world remembers Sansan and Teyang, the Twin Stars who shattered the Obsidian Throne of Vyraknos, the Dragon God. Their light brought an age of fragile peace. But peace is a fleeting dream.", "lore-message", true, 40);
        await this.addMessage("You awaken in a field of Lumina Flowers, their petals glowing softly. Your head aches. Memories flicker like dying embers... a promise... a name... but their face is a blur.", "lore-message", true, 40);
        
        let partnerNameTemp = "Teyang"; // Default
        const genderChanged = (selectedGender) => {
            partnerNameTemp = selectedGender === 'male' ? 'Teyang' : 'Sansan';
            document.getElementById('partner-name-preview').textContent = partnerNameTemp;
        };
        
        let html = `<h2>Create Your Character</h2>`;
        html += `<p id="char-create-intro">A voice, ancient and resonant, echoes in your mind, 'Child of Stars, your other half <strong id="partner-name-preview">${partnerNameTemp}</strong> awaits. The path is long, your memories fractured. Seek the threads of fate, lest the shadows consume all that was won.'</p>`;
        html += `<label for="char-name">Your Name:</label>`;
        html += `<input type="text" id="char-name" value="Lyra">`;
        html += `<label for="char-gender">Your Gender:</label>`;
        html += `<select id="char-gender">
                    <option value="female" selected>Female</option>
                    <option value="male">Male</option>
                 </select>`;
        html += `<label for="char-class">Choose your Path:</label>`;
        html += `<select id="char-class">`;
        for (const classId in PLAYER_CLASSES) {
            html += `<option value="${classId}">${PLAYER_CLASSES[classId].name} - ${PLAYER_CLASSES[classId].description}</option>`;
        }
        html += `</select>`;
        // Basic attribute point allocation preview (full allocation after creation for V0.1)
        html += `<p>You will have <strong>${playerManager.getUnallocatedPoints()}</strong> attribute points to allocate after creation.</p>`
        html += `<div class="modal-actions">
                    <button id="confirm-creation">Begin Your Journey</button>
                 </div>`;
        this.showModal(html);

        document.getElementById('char-gender').addEventListener('change', (e) => genderChanged(e.target.value));

        document.getElementById('confirm-creation').addEventListener('click', () => {
            const name = document.getElementById('char-name').value.trim() || "Adventurer";
            const gender = document.getElementById('char-gender').value;
            const classId = document.getElementById('char-class').value;
            
            playerManager.setupNewCharacter(name, gender, classId);
            this.hideModal();
            this.addMessage(`Welcome, ${name} the ${PLAYER_CLASSES[classId].name}. Your quest to find ${playerManager.gameState.partnerName} begins.`, "system-message");
            // Trigger first quest
            eventBus.publish('parseInput', `quest start main001_find_partner`);
        });
    }

    handleLevelUpUI(levelUpData) {
        this.addMessage(`LEVEL UP! You are now Level ${levelUpData.newLevel}!`, "success-message");
        this.refreshAllUI(playerManager.getPublicData()); // Refresh sidebar for HP/MP restore

        if (levelUpData.attributePointsGained > 0) {
            this.addMessage(`You gained ${levelUpData.attributePointsGained} attribute point(s) to allocate! Use 'alloc <attr>'.`, "system-message");
            this.showAttributeAllocationModal();
        }

        if (levelUpData.skillChoices && levelUpData.skillChoices.length > 0) {
            this.showSkillSelectionModal(levelUpData.skillChoices);
        }
    }

    showAttributeAllocationModal() {
        const playerData = playerManager.getPublicData();
        if (playerData.unallocatedPoints <= 0) return;

        let html = `<h2>Allocate Attribute Points (${playerData.unallocatedPoints} available)</h2>`;
        ATTRIBUTES.forEach(attr => {
            html += `<p>${utils.capitalize(attr)}: ${playerData.attributes[attr].current} 
                     <button class="alloc-btn" data-attr="${attr}">+1</button></p>`;
        });
        html += `<div class="modal-actions"><button id="done-alloc">Done</button></div>`;
        this.showModal(html);

        document.querySelectorAll('.alloc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const attrId = e.target.dataset.attr;
                if (playerManager.allocateAttributePoint(attrId)) {
                    this.showAttributeAllocationModal(); // Re-render modal with updated values
                }
            });
        });
        document.getElementById('done-alloc').addEventListener('click', () => this.hideModal());
    }


    showSkillSelectionModal(skillChoices) {
        let html = `<h2>Choose a New Skill</h2>`;
        skillChoices.forEach(skill => {
            html += `<div class="skill-choice">
                        <h3>${skill.name}</h3>
                        <p>${skill.description}</p>
                        <p>MP Cost: ${skill.mpCost || 0}</p>
                        <button class="learn-skill-btn" data-skillid="${skill.id}">Learn ${skill.name}</button>
                     </div>`;
        });
        if (skillChoices.length === 0) {
            html += "<p>No new skills available at this level for your class.</p>";
        }
        html += `<div class="modal-actions"><button id="skip-skill">Decide Later</button></div>`;
        this.showModal(html);

        document.querySelectorAll('.learn-skill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                playerManager.learnSkill(e.target.dataset.skillid);
                this.hideModal();
            });
        });
        document.getElementById('skip-skill').addEventListener('click', () => this.hideModal());
    }
    
    async showGachaResult(data) {
        // Simple animation: clear modal, show "Pulling...", then result
        let html = `<h2>Study Device Results</h2>`;
        html += `<p style="text-align:center; font-size: 1.2em; animation: pulse 1s infinite;">Pulling...</p>`;
        this.showModal(html);
        
        await utils.delay(1500); // Simulate animation time

        html = `<h2>Study Device Results</h2>`;
        html += `<p>${data.message}</p>`;
        html += `<p>You received: <strong class="item-${data.rarity || 'common'}">${data.itemName}</strong></p>`;
        html += `<div class="modal-actions"><button id="close-gacha-modal">Close</button></div>`;
        this.showModal(html);

        document.getElementById('close-gacha-modal').addEventListener('click', () => this.hideModal());
    }

}
export const uiManager = new UIManager(); // Auto-initialize