// js/playerManager.js
import { eventBus } from './eventManager.js';
import { PLAYER_CLASSES, ATTRIBUTES, DERIVED_STATS_PLAYER, INITIAL_ATTRIBUTE_POINTS, ATTRIBUTE_POINTS_PER_LEVEL_INTERVAL, ATTRIBUTE_POINTS_GAIN } from './data/classes.js';
import { SKILLS_DATA, SKILL_TREES_META, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ITEMS_DATA, STARTING_ITEMS, EQUIPMENT_SLOTS } from './data/items.js';
import { ALLY_DATA, ALLY_CLASSES } from './data/allies.js'; // For Sansan
import { GACHA_POOLS } from './data/gachaPools.js';
import * as utils from './utils.js';

const MAX_INVENTORY_SLOTS = 20; // Increased
const XP_BASE = 100;
const XP_FACTOR = 1.35; // Slightly adjusted curve

class PlayerManager {
    constructor() {
        this.utils = utils;
        this.resetGameState(); // Initialize with default structure
        // No auto-initialize here, main.js will call setup or load
    }

    resetGameState() {
        this.gameState = {
            name: "Player",
            gender: "female", // Default for Cutiepatotie if no choice
            partnerName: "Sansan",
            classId: null,
            level: 1,
            xp: 0,
            sp: 0,
            gold: 0,
            attributePoints: INITIAL_ATTRIBUTE_POINTS, // Start with initial points
            attributes: {}, // { str: { base: 0, allocated: 0, bonus: 0, current: 0 } ... } bonus from gear/status
            derivedStats: {},
            inventory: [], // [{ itemId, quantity, instanceId (for non-stackable) }]
            equipment: {}, // { slotId: itemInstanceId or null }
            skills: [], // array of learned skill IDs
            skillPoints: 0, // For skill tree
            currentLocationId: "lumina_field",
            flags: new Map(),
            quests: {}, // { questId: { stage: 0, completed: false, objectives: {} } }
            allies: [], // [{ allyId, instanceId, level, xp, equipment: {}, skills: [], stats: {}, statusEffects: [] }]
            inCombat: false,
            sansanDialogue: { // For Cutiepatotie's feature
                promptActive: null, // e.g., "missYouPrompt_reply"
                negativeStrikeCount: 0,
                gameOverTriggered: false,
                proposalStage: 0 // 0: none, 1: "kita lang", 2: "forever?", 3: accepted/declined
            },
            gameTime: { day: 1, hour: 8, minute: 0 } // Conceptual game time
        };
        DERIVED_STATS_PLAYER.forEach(stat => this.gameState.derivedStats[stat] = 0);
        Object.values(EQUIPMENT_SLOTS.player).forEach(slot => this.gameState.equipment[slot] = null);
    }

    setupNewCharacter(name, gender, classId) {
        this.resetGameState(); // Start fresh
        this.gameState.name = name;
        this.gameState.gender = gender;
        this.gameState.partnerName = gender === 'male' ? 'Teyang' : 'Sansan';
        this.gameState.classId = classId;
        this.gameState.gold = 25; // Starting gold

        const pClass = PLAYER_CLASSES[classId];
        if (!pClass) {
            console.error("Invalid class ID:", classId); return;
        }

        ATTRIBUTES.forEach(attr => {
            this.gameState.attributes[attr] = {
                base: pClass.baseStats[attr] || 0,
                allocated: 0, bonus: 0, current: 0
            };
        });
        this.gameState.derivedStats.maxHp = pClass.baseStats.hp;
        this.gameState.derivedStats.currentHp = pClass.baseStats.hp;
        this.gameState.derivedStats.maxMp = pClass.baseStats.mp;
        this.gameState.derivedStats.currentMp = pClass.baseStats.mp;
        this.gameState.derivedStats.mpRegen = pClass.baseStats.mpRegen;

        const startingItems = STARTING_ITEMS[classId] || [];
        startingItems.forEach(itemRef => this.addItem(itemRef.itemId, itemRef.quantity));
        
        // Initial skill(s) if any (e.g., a basic attack equivalent)
        // For now, skills are learned via tree or level up choices.

        // --- OWNER/SPECIAL CHARACTER SETUP ---
        if (name === "Sansanite" && gender === "male") {
            this.grantSansaniteBonus();
        }
        if (name === "Cutiepatotie" && gender === "female") {
            this.addSansanAlly();
        }

        this.updateAllStats(); // Calculates all derived stats based on base, allocated, equipment, etc.
        this.gameState.currentLocationId = "lumina_field";
        eventBus.publish('newCharacterCreated', this.getPublicData());
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('locationChanged', { newLocationId: this.gameState.currentLocationId, oldLocationId: null });
    }

    grantSansaniteBonus() {
        this.addGold(1000000);
        this.addSp(10000);
        this.gameState.level = 10; // Start at a higher level for testing
        this.gameState.attributePoints += 10; // More points
        this.gameState.skillPoints += 5;

        // Grant a selection of items, respecting inventory limits or giving "vouchers"
        let itemsGranted = 0;
        for (const itemId in ITEMS_DATA) {
            if (itemsGranted >= MAX_INVENTORY_SLOTS - 5) break; // Leave some space
            const itemData = ITEMS_DATA[itemId];
            if (!itemData.isUnique && !itemData.forAllyOnly && !itemData.forPlayerOnly) { // Avoid special unique items initially
                this.addItem(itemId, itemData.stackable ? 5 : 1);
                itemsGranted++;
            }
        }
        eventBus.publish('uiNotification', { message: "Sansanite's Divine Blessing received! Max resources and items granted for testing.", type: "success-message" });
    }

    addSansanAlly() {
        const sansanBase = ALLY_DATA.sansan_dino;
        if (!sansanBase) return;

        const sansanAlly = {
            allyId: sansanBase.id,
            instanceId: utils.generateId('ally_sansan_'),
            name: sansanBase.name,
            classId: sansanBase.classId,
            level: sansanBase.level,
            xp: 0, // XP to next level for ally
            equipment: {}, // { slotId: itemInstanceId }
            skills: [...sansanBase.skills], // Copy starting skills
            attributes: {}, // Similar to player: { base, bonus, current }
            derivedStats: {}, // Similar to player
            statusEffects: [],
            aiProfile: sansanBase.aiProfile,
            isPlayerControlled: false, // For now, AI controlled
            dialogueTriggers: sansanBase.dialogueTriggers // For AI manager
        };

        // Initialize Sansan's equipment slots based on his class or definition
        const sansanSlots = EQUIPMENT_SLOTS[sansanBase.id] || EQUIPMENT_SLOTS.player; // Fallback
        sansanSlots.forEach(slot => sansanAlly.equipment[slot] = null);


        // Set Sansan's base attributes from his class or specific definition
        const allyClassData = ALLY_CLASSES[sansanAlly.classId] || PLAYER_CLASSES[sansanAlly.classId]; // Check both
        ATTRIBUTES.forEach(attr => {
            sansanAlly.attributes[attr] = {
                base: (sansanBase.baseStats && sansanBase.baseStats[attr] !== undefined) ? sansanBase.baseStats[attr] : (allyClassData?.baseStats[attr] || 8),
                bonus: 0, current: 0 // Bonus from his gear, current calculated
            };
        });
        // Initial derived stats for Sansan (will be refined by updateAllStats)
        sansanAlly.derivedStats.maxHp = (sansanBase.baseStats && sansanBase.baseStats.hp) || (allyClassData?.baseStats.hp || 100);
        sansanAlly.derivedStats.currentHp = sansanAlly.derivedStats.maxHp;
        sansanAlly.derivedStats.maxMp = (sansanBase.baseStats && sansanBase.baseStats.mp) || (allyClassData?.baseStats.mp || 30);
        sansanAlly.derivedStats.currentMp = sansanAlly.derivedStats.maxMp;
        sansanAlly.derivedStats.mpRegen = (sansanBase.baseStats && sansanBase.baseStats.mpRegen) || (allyClassData?.baseStats.mpRegen || 0.5);


        // Equip Sansan's starting gear
        if (sansanBase.equipment) {
            for (const slot in sansanBase.equipment) {
                const itemIdToEquip = sansanBase.equipment[slot];
                const itemData = ITEMS_DATA[itemIdToEquip];
                if (itemData && (itemData.slot === slot || (itemData.slot === "weapon" && slot === "weapon"))) { // Basic slot check
                    // Allies don't use player's inventory for their gear
                    // We create an "instance" of the item for the ally
                    const itemInstance = { ...itemData, instanceId: utils.generateId('item_') };
                    sansanAlly.equipment[slot] = itemInstance; // Directly assign item object to slot
                }
            }
        }


        this.gameState.allies.push(sansanAlly);
        this.updateAllyStats(sansanAlly.instanceId); // Calculate his stats with gear
        eventBus.publish('uiNotification', { message: `${sansanAlly.name} the Dino Guardian has joined your party!`, type: "success-message" });
    }
    
    isPlayerCharacter(nameToCheck) {
        return this.gameState.name === nameToCheck;
    }
    hasAlly(allyIdToCheck) {
        return this.gameState.allies.some(ally => ally.allyId === allyIdToCheck && ally.derivedStats.currentHp > 0);
    }
    removeAlly(allyIdToRemove) {
        this.gameState.allies = this.gameState.allies.filter(ally => ally.allyId !== allyIdToRemove);
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('uiNotification', { message: `${ALLY_DATA[allyIdToRemove]?.name || 'Ally'} has left the party.`, type: "warning-message" });
    }


    // --- STATS & PROGRESSION ---
    allocateAttributePoint(attributeId) {
        if (this.gameState.attributePoints <= 0) {
            eventBus.publish('uiNotification', { message: "No attribute points available.", type: 'error' });
            return false;
        }
        if (this.gameState.attributes[attributeId]) {
            this.gameState.attributes[attributeId].allocated++;
            this.gameState.attributePoints--;
            this.updateAllStats();
            eventBus.publish('playerDataUpdated', this.getPublicData());
            eventBus.publish('uiNotification', { message: `${utils.capitalize(attributeId)} increased by 1. (${this.gameState.attributePoints} points remaining)`, type: 'success' });
            return true;
        }
        eventBus.publish('uiNotification', { message: `Invalid attribute: ${attributeId}.`, type: 'error' });
        return false;
    }

    updateCharacterBaseStats(character) { // For player or ally
        const classData = PLAYER_CLASSES[character.classId] || ALLY_CLASSES[character.classId];
        if (!classData) return;

        ATTRIBUTES.forEach(attr => {
            character.attributes[attr].current =
                (character.attributes[attr].base || 0) +
                (character.attributes[attr].allocated || 0) + // Allocated only for player
                (character.attributes[attr].bonus || 0); // Bonus from gear/status
        });

        // Base HP/MP from class + CON/INT contribution + Level contribution
        character.derivedStats.maxHp = (classData.baseStats.hp || 0) +
                                     (character.attributes.con.current * (character.isPlayer ? 7 : 10)) + // Allies might get more HP from CON
                                     (character.level * (character.isPlayer ? 5 : 8));
        character.derivedStats.maxMp = (classData.baseStats.mp || 0) +
                                     (character.attributes.int.current * (character.isPlayer ? 4 : 5)) +
                                     (character.level * (character.isPlayer ? 3 : 4));
        character.derivedStats.mpRegen = (classData.baseStats.mpRegen || 0) + (character.attributes.wis.current * 0.15);

        // Combat stats
        character.derivedStats.attack = Math.floor(
            (character.attributes.str.current * (classData.name === "Mage" ? 0.5 : 1.5)) +
            (character.attributes.dex.current * (classData.name === "Rogue" ? 1.5 : 0.8)) +
            (character.attributes.int.current * (classData.name === "Mage" ? 1.8 : 0.2))
        );
        character.derivedStats.defense = Math.floor(
            (character.attributes.con.current * 1.2) +
            (character.attributes.dex.current * 0.5)
        );
        character.derivedStats.accuracy = 75 + character.attributes.dex.current + Math.floor(character.attributes.wis.current / 2);
        character.derivedStats.evasion = 10 + Math.floor(character.attributes.dex.current * 1.5) + Math.floor(character.attributes.wis.current / 3);
        character.derivedStats.critChance = 5 + Math.floor(character.attributes.dex.current / 2) + Math.floor(character.attributes.int.current / 4); // Int for mages
        character.derivedStats.speed = 10 + character.attributes.dex.current - Math.floor((character.equipment?.body?.weight || 0) / 2); // Conceptual weight

        // Apply stat bonuses from equipment
        for (const slot in character.equipment) {
            const equippedItemInstance = character.equipment[slot]; // This is now the item object itself for allies, or item instanceId for player
            let itemData = null;
            if (character.isPlayer && equippedItemInstance) { // Player equipment stores instanceId
                const invItem = this.gameState.inventory.find(i => i.instanceId === equippedItemInstance);
                itemData = invItem ? ITEMS_DATA[invItem.itemId] : null;
            } else if (!character.isPlayer && equippedItemInstance) { // Ally equipment stores the item object
                itemData = equippedItemInstance; // The equippedItemInstance IS the itemData for allies
            }

            if (itemData && itemData.stats) {
                for (const stat in itemData.stats) {
                    if (ATTRIBUTES.includes(stat)) {
                        character.attributes[stat].current += itemData.stats[stat];
                    } else if (character.derivedStats.hasOwnProperty(stat)) {
                        character.derivedStats[stat] += itemData.stats[stat];
                    } else if (stat === "maxHp" || stat === "maxMp") { // Direct bonus to max HP/MP
                         character.derivedStats[stat] += itemData.stats[stat];
                    }
                }
            }
            // Handle scaling stats for special items like Sansan's ring
            if (itemData && itemData.scalingStats && character.isPlayer) { // Only player for Sansan's ring
                const playerLevel = this.gameState.level;
                const intervals = Math.floor(playerLevel / itemData.scalingStats.levelFactor);
                for (const stat in itemData.scalingStats.statsPerInterval) {
                    const bonusAmount = intervals * itemData.scalingStats.statsPerInterval[stat];
                    if (ATTRIBUTES.includes(stat)) {
                        character.attributes[stat].current += bonusAmount;
                    } else if (character.derivedStats.hasOwnProperty(stat)) {
                        character.derivedStats[stat] += bonusAmount;
                    }
                }
            }
        }
        
        // Apply status effect stat changes (simplified: direct modification, real system is more complex)
        // This should ideally be done by combatManager or a dedicated status effect manager
        character.statusEffects?.forEach(effectInstance => {
            const effectData = STATUS_EFFECTS_DATA[effectInstance.statusId];
            if (effectData && effectData.statChanges) {
                for (const statKey in effectData.statChanges) {
                    const change = effectData.statChanges[statKey];
                    if (character.derivedStats.hasOwnProperty(statKey)) {
                         if (change.multiplier) character.derivedStats[statKey] = Math.floor(character.derivedStats[statKey] * change.multiplier);
                         if (change.flat) character.derivedStats[statKey] += change.flat;
                    } else if (ATTRIBUTES.includes(statKey) && character.attributes[statKey]) {
                         if (change.multiplier) character.attributes[statKey].current = Math.floor(character.attributes[statKey].current * change.multiplier);
                         if (change.flat) character.attributes[statKey].current += change.flat;
                    }
                }
            }
        });


        // Ensure current HP/MP don't exceed max and are not negative
        character.derivedStats.currentHp = Math.max(0, Math.min(character.derivedStats.currentHp, character.derivedStats.maxHp));
        character.derivedStats.currentMp = Math.max(0, Math.min(character.derivedStats.currentMp, character.derivedStats.maxMp));
    }

    updateAllStats() { // Updates player and all allies
        const playerObjectForStats = { ...this.gameState, isPlayer: true }; // Pass a context
        this.updateCharacterBaseStats(playerObjectForStats);
        // Apply changes back to gameState (since playerObjectForStats was a shallow copy for derived/attributes)
        this.gameState.attributes = playerObjectForStats.attributes;
        this.gameState.derivedStats = playerObjectForStats.derivedStats;


        this.gameState.allies.forEach(ally => {
            this.updateAllyStats(ally.instanceId);
        });
    }

    updateAllyStats(allyInstanceId) {
        const ally = this.gameState.allies.find(a => a.instanceId === allyInstanceId);
        if (!ally) return;
        
        const allyObjectForStats = { ...ally, isPlayer: false }; // Pass context
        this.updateCharacterBaseStats(allyObjectForStats);
        // Apply changes back to the ally object in gameState.allies
        const originalAllyIndex = this.gameState.allies.findIndex(a => a.instanceId === allyInstanceId);
        if (originalAllyIndex !== -1) {
            this.gameState.allies[originalAllyIndex].attributes = allyObjectForStats.attributes;
            this.gameState.allies[originalAllyIndex].derivedStats = allyObjectForStats.derivedStats;
        }
    }


    addXp(amount) {
        if (this.gameState.level >= 99) return;
        this.gameState.xp += amount;
        eventBus.publish('uiNotification', { message: `Gained ${amount} XP!`, type: 'success' });

        let xpForNextLevel = this.getXpForNextLevel(this.gameState.level);
        while (this.gameState.xp >= xpForNextLevel && this.gameState.level < 99) {
            this.levelUp();
            xpForNextLevel = this.getXpForNextLevel(this.gameState.level);
        }

        // Distribute XP to allies (e.g., 75%)
        this.gameState.allies.forEach(ally => {
            if (ally.derivedStats.currentHp > 0) { // Only if alive
                this.addXpToAlly(ally.instanceId, Math.floor(amount * 0.75));
            }
        });
        eventBus.publish('playerDataUpdated', this.getPublicData());
    }
    
    addXpToAlly(allyInstanceId, amount) {
        const ally = this.gameState.allies.find(a => a.instanceId === allyInstanceId);
        if (!ally || ally.level >= 99) return;

        ally.xp += amount;
        let xpForNextAllyLevel = this.getXpForNextLevel(ally.level); // Use same XP curve for simplicity
        while (ally.xp >= xpForNextAllyLevel && ally.level < 99) {
            ally.level++;
            ally.xp -= xpForNextAllyLevel; // Subtract only the amount for that level
            // Ally stat increases on level up (simpler than player for now)
            // Could also grant them new skills based on their class progression
            const allyClass = ALLY_CLASSES[ally.classId] || PLAYER_CLASSES[ally.classId];
            if (allyClass && allyClass.skillProgression && allyClass.skillProgression[ally.level]) {
                allyClass.skillProgression[ally.level].forEach(skillId => {
                    if (!ally.skills.includes(skillId)) {
                        ally.skills.push(skillId);
                         eventBus.publish('uiNotification', { message: `${ally.name} learned ${SKILLS_DATA[skillId]?.name}!`, type: 'system' });
                    }
                });
            }
            this.updateAllyStats(ally.instanceId); // Recalculate stats
            ally.derivedStats.currentHp = ally.derivedStats.maxHp; // Full heal for ally
            ally.derivedStats.currentMp = ally.derivedStats.maxMp;
             eventBus.publish('uiNotification', { message: `${ally.name} reached Level ${ally.level}!`, type: 'system' });
            xpForNextAllyLevel = this.getXpForNextLevel(ally.level);
        }
    }


    getXpForNextLevel(level) {
        if (level >= 99) return Infinity;
        return Math.floor(XP_BASE * Math.pow(XP_FACTOR, level - 1));
    }

    levelUp() {
        this.gameState.level++;
        this.gameState.xp = 0; 
        
        this.gameState.attributePoints += ATTRIBUTE_POINTS_GAIN; // Gain points based on const
        this.gameState.skillPoints += 1; // Gain 1 skill point for tree

        this.updateAllStats(); // Recalculate stats
        this.gameState.derivedStats.currentHp = this.gameState.derivedStats.maxHp; // Full heal
        this.gameState.derivedStats.currentMp = this.gameState.derivedStats.maxMp;

        eventBus.publish('playerLeveledUp', {
            newLevel: this.gameState.level,
            attributePointsAvailable: this.gameState.attributePoints,
            skillPointsAvailable: this.gameState.skillPoints
        });
        eventBus.publish('uiNotification', { message: `LEVEL UP! You reached Level ${this.gameState.level}! You have ${this.gameState.attributePoints} attribute points and ${this.gameState.skillPoints} skill point(s).`, type: 'system highlight-color' });
    }
    
    learnSkill(skillId) { // From skill tree
        const skillData = SKILLS_DATA[skillId];
        if (!skillData) {
             eventBus.publish('uiNotification', { message: `Unknown skill: ${skillId}.`, type: 'error' }); return false;
        }
        if (this.hasSkill(skillId)) {
            eventBus.publish('uiNotification', { message: `You already know ${skillData.name}.`, type: 'error' }); return false;
        }
        if (this.gameState.skillPoints < (skillData.cost || 1)) { // Assume cost 1 if not specified
            eventBus.publish('uiNotification', { message: `Not enough skill points to learn ${skillData.name}.`, type: 'error' }); return false;
        }
        if (skillData.levelRequirement && this.gameState.level < skillData.levelRequirement) {
            eventBus.publish('uiNotification', { message: `You need to be level ${skillData.levelRequirement} to learn ${skillData.name}.`, type: 'error' }); return false;
        }
        if (skillData.prerequisites) {
            for (const prereqId of skillData.prerequisites) {
                if (!this.hasSkill(prereqId)) {
                    eventBus.publish('uiNotification', { message: `Requires skill: ${SKILLS_DATA[prereqId]?.name || prereqId}.`, type: 'error' }); return false;
                }
            }
        }

        this.gameState.skillPoints -= (skillData.cost || 1);
        this.gameState.skills.push(skillId);
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('uiNotification', { message: `Learned ${skillData.name}!`, type: 'success' });
        return true;
    }

    hasSkill(skillId) {
        return this.gameState.skills.includes(skillId);
    }

    // --- CURRENCY & ITEMS ---
    addSp(amount) { this.gameState.sp += amount; eventBus.publish('playerDataUpdated', this.getPublicData()); }
    spendSp(amount) {
        if (this.gameState.sp >= amount) { this.gameState.sp -= amount; eventBus.publish('playerDataUpdated', this.getPublicData()); return true; }
        eventBus.publish('uiNotification', { message: "Not enough SP.", type: 'error' }); return false;
    }
    addGold(amount) { this.gameState.gold += amount; eventBus.publish('playerDataUpdated', this.getPublicData()); }
    spendGold(amount) {
        if (this.gameState.gold >= amount) { this.gameState.gold -= amount; eventBus.publish('playerDataUpdated', this.getPublicData()); return true; }
        eventBus.publish('uiNotification', { message: "Not enough Gold.", type: 'error' }); return false;
    }

    addItem(itemId, quantity = 1) {
        const itemData = ITEMS_DATA[itemId];
        if (!itemData) { console.error("Unknown item ID:", itemId); return false; }

        if (itemData.stackable) {
            const existingItem = this.gameState.inventory.find(i => i.itemId === itemId);
            const maxStack = itemData.maxStack || 99;
            if (existingItem) {
                existingItem.quantity = Math.min(existingItem.quantity + quantity, maxStack);
            } else {
                if (this.gameState.inventory.length >= MAX_INVENTORY_SLOTS) {
                    eventBus.publish('uiNotification', { message: "Inventory full!", type: 'error' }); return false;
                }
                this.gameState.inventory.push({ itemId, quantity: Math.min(quantity, maxStack), instanceId: utils.generateId('item_stack_') });
            }
        } else { // Non-stackable, add individual instances
            for (let i = 0; i < quantity; i++) {
                if (this.gameState.inventory.length >= MAX_INVENTORY_SLOTS) {
                    eventBus.publish('uiNotification', { message: "Inventory full!", type: 'error' }); return false; // Stop if full
                }
                this.gameState.inventory.push({ itemId, quantity: 1, instanceId: utils.generateId('item_') });
            }
        }
        eventBus.publish('uiNotification', { message: `Added ${itemData.name} (x${quantity}) to inventory.`, type: 'system' });
        eventBus.publish('playerDataUpdated', this.getPublicData());
        return true;
    }

    removeItem(itemInstanceId, quantity = 1) { // For non-stackable, instanceId is key. For stackable, could be itemId.
        const itemIndex = this.gameState.inventory.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIndex === -1) {
            // Try finding by itemId for stackable if instanceId method fails (though instanceId should always be used for removal)
            const stackableItemIndex = this.gameState.inventory.findIndex(i => i.itemId === itemInstanceId && ITEMS_DATA[i.itemId]?.stackable);
             if (stackableItemIndex !== -1) {
                const item = this.gameState.inventory[stackableItemIndex];
                item.quantity -= quantity;
                if (item.quantity <= 0) {
                    this.gameState.inventory.splice(stackableItemIndex, 1);
                }
                eventBus.publish('playerDataUpdated', this.getPublicData());
                return true;
            }
            eventBus.publish('uiNotification', { message: "Item not found in inventory.", type: 'error' });
            return false;
        }

        const item = this.gameState.inventory[itemIndex];
        const itemData = ITEMS_DATA[item.itemId];

        if (itemData.stackable) {
            item.quantity -= quantity;
            if (item.quantity <= 0) {
                this.gameState.inventory.splice(itemIndex, 1);
            }
        } else { // Non-stackable, remove the instance
            this.gameState.inventory.splice(itemIndex, 1);
        }
        eventBus.publish('uiNotification', { message: `Removed ${itemData.name}.`, type: 'system' });
        eventBus.publish('playerDataUpdated', this.getPublicData());
        return true;
    }

    hasItem(itemId, quantity = 1) {
        let count = 0;
        this.gameState.inventory.forEach(item => {
            if (item.itemId === itemId) {
                count += item.quantity;
            }
        });
        return count >= quantity;
    }

    equipItem(itemInstanceId) {
        const itemIndex = this.gameState.inventory.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIndex === -1) {
            eventBus.publish('uiNotification', { message: "Item not found to equip.", type: 'error' }); return;
        }
        const itemToEquip = this.gameState.inventory[itemIndex];
        const itemData = ITEMS_DATA[itemToEquip.itemId];

        if (!itemData.slot) {
            eventBus.publish('uiNotification', { message: `${itemData.name} is not equippable.`, type: 'error' }); return;
        }
        
        // Check for player-specific items (Cutiepatotie's ring)
        if (itemData.forPlayerOnly && itemData.forPlayerOnly !== this.gameState.name) {
            eventBus.publish('uiNotification', { message: `${itemData.name} cannot be equipped by you.`, type: 'error' }); return;
        }


        let targetSlot = itemData.slot;
        if (itemData.slot === "accessory") { // Handle accessory1 and accessory2
            targetSlot = this.gameState.equipment.accessory1 ? "accessory2" : "accessory1";
        }

        // Unequip item currently in targetSlot (if any)
        if (this.gameState.equipment[targetSlot]) {
            this.unequipItem(targetSlot, false); // false to prevent immediate stat update, will do it once after equipping
        }
        // If equipping a 2H weapon, unequip offHand
        if (itemData.slot === "twoHand" && this.gameState.equipment.offHand) {
            this.unequipItem("offHand", false);
        }
        // If equipping an offHand/shield, unequip 2H weapon
        if (itemData.slot === "offHand" && this.gameState.equipment.weapon) {
            const currentWeaponInstance = this.gameState.inventory.find(i => i.instanceId === this.gameState.equipment.weapon);
            if (currentWeaponInstance && ITEMS_DATA[currentWeaponInstance.itemId]?.slot === "twoHand") {
                this.unequipItem("weapon", false);
            }
        }


        this.gameState.equipment[targetSlot] = itemToEquip.instanceId; // Store instanceId
        // itemToEquip.equipped = true; // Mark in inventory (optional, equipment object is source of truth)

        this.updateAllStats();
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('uiNotification', { message: `Equipped ${itemData.name}.`, type: 'success' });
        if (itemData.onEquipMessage) {
             eventBus.publish('uiNotification', { message: itemData.onEquipMessage, type: 'system' });
        }
    }

    unequipItem(slotId, updateStats = true) {
        const equippedItemInstanceId = this.gameState.equipment[slotId];
        if (!equippedItemInstanceId) {
            eventBus.publish('uiNotification', { message: `Nothing equipped in ${slotId}.`, type: 'error' }); return;
        }
        
        const itemInInventory = this.gameState.inventory.find(i => i.instanceId === equippedItemInstanceId);
        if (!itemInInventory) {
             console.error(`Unequip error: Item ${equippedItemInstanceId} in slot ${slotId} not found in inventory.`);
             this.gameState.equipment[slotId] = null; // Clear slot anyway
             if(updateStats) this.updateAllStats();
             eventBus.publish('playerDataUpdated', this.getPublicData());
             return;
        }
        const itemData = ITEMS_DATA[itemInInventory.itemId];

        if (itemData.isUnremovable) {
            const msg = itemData.onAttemptRemoveMessage || `${itemData.name} cannot be unequipped.`;
            eventBus.publish('uiNotification', { message: msg, type: 'warning-message' });
            return;
        }

        // itemInInventory.equipped = false; // Optional
        this.gameState.equipment[slotId] = null;

        if (updateStats) this.updateAllStats();
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('uiNotification', { message: `Unequipped ${itemData.name}.`, type: 'system' });
    }

    // --- GACHA ---
    gachaPull(poolId = "standard_study_rewards") {
        const poolData = GACHA_POOLS[poolId];
        if (!poolData) {
            eventBus.publish('uiNotification', { message: "Gacha pool not found.", type: 'error' }); return;
        }
        if (!this.spendSp(poolData.cost)) return;

        const rewards = [];
        poolData.pulls.forEach(pullSlot => {
            let totalWeight = pullSlot.items.reduce((sum, item) => sum + item.weight, 0);
            let randomNum = utils.getRandomInt(1, totalWeight);
            let chosenItemEntry = null;

            for (const itemEntry of pullSlot.items) {
                if (randomNum <= itemEntry.weight) {
                    chosenItemEntry = itemEntry;
                    break;
                }
                randomNum -= itemEntry.weight;
            }

            if (chosenItemEntry) {
                const quantity = chosenItemEntry.quantity ? (typeof chosenItemEntry.quantity === 'object' ? utils.getRandomInt(chosenItemEntry.quantity.min, chosenItemEntry.quantity.max) : chosenItemEntry.quantity) : 1;
                this.addItem(chosenItemEntry.itemId, quantity);
                rewards.push({ ...ITEMS_DATA[chosenItemEntry.itemId], quantityPulled: quantity });
            }
        });
        
        const quote = poolData.displayQuotes[utils.getRandomInt(0, poolData.displayQuotes.length - 1)];
        eventBus.publish('gachaResult', {
            rewards: rewards,
            quote: quote,
            message: `The device whirs and dispenses...`
        });
    }
    
    // --- COMBAT RELATED MODIFIERS (called by CombatManager) ---
    takeDamage(amount, characterInstanceId = this.gameState.instanceId /* for player */ ) {
        let targetCharacter = null;
        if (characterInstanceId === this.gameState.instanceId || !characterInstanceId) { // Player
            targetCharacter = this.gameState.derivedStats;
        } else { // Ally
            const ally = this.gameState.allies.find(a => a.instanceId === characterInstanceId);
            if (ally) targetCharacter = ally.derivedStats;
        }

        if (targetCharacter) {
            targetCharacter.currentHp -= amount;
            if (targetCharacter.currentHp < 0) targetCharacter.currentHp = 0;
            this.updateAllStats(); // To reflect changes immediately in derived stats if needed
            eventBus.publish('playerDataUpdated', this.getPublicData()); // For UI
            if (targetCharacter.currentHp === 0) {
                // Death event handled by CombatManager
            }
        }
    }

    heal(amount, characterInstanceId = this.gameState.instanceId) {
         let targetCharacter = null;
        if (characterInstanceId === this.gameState.instanceId || !characterInstanceId) {
            targetCharacter = this.gameState.derivedStats;
        } else {
            const ally = this.gameState.allies.find(a => a.instanceId === characterInstanceId);
            if (ally) targetCharacter = ally.derivedStats;
        }
        if (targetCharacter) {
            targetCharacter.currentHp = Math.min(targetCharacter.currentHp + amount, targetCharacter.maxHp);
            this.updateAllStats();
            eventBus.publish('playerDataUpdated', this.getPublicData());
        }
    }
    
    restoreMp(amount, characterInstanceId = this.gameState.instanceId) {
        let targetCharacter = null;
        if (characterInstanceId === this.gameState.instanceId || !characterInstanceId) {
            targetCharacter = this.gameState.derivedStats;
        } else {
            const ally = this.gameState.allies.find(a => a.instanceId === characterInstanceId);
            if (ally) targetCharacter = ally.derivedStats;
        }
        if (targetCharacter) {
            targetCharacter.currentMp = Math.min(targetCharacter.currentMp + amount, targetCharacter.maxMp);
            this.updateAllStats();
            eventBus.publish('playerDataUpdated', this.getPublicData());
        }
    }
    
    spendMp(amount, characterInstanceId = this.gameState.instanceId) {
        let targetCharacter = null;
        if (characterInstanceId === this.gameState.instanceId || !characterInstanceId) {
            targetCharacter = this.gameState.derivedStats;
        } else {
            const ally = this.gameState.allies.find(a => a.instanceId === characterInstanceId);
            if (ally) targetCharacter = ally.derivedStats;
        }

        if (targetCharacter && targetCharacter.currentMp >= amount) {
            targetCharacter.currentMp -= amount;
            this.updateAllStats();
            eventBus.publish('playerDataUpdated', this.getPublicData());
            return true;
        }
        return false; // Not enough MP
    }


    // --- DATA & STATE ---
    getPublicData() {
        // Ensure deep copies where necessary to prevent direct mutation from UI or other modules
        return {
            name: this.gameState.name,
            classId: this.gameState.classId,
            level: this.gameState.level,
            xp: this.gameState.xp,
            xpForNextLevel: this.getXpForNextLevel(this.gameState.level),
            sp: this.gameState.sp,
            gold: this.gameState.gold,
            attributePoints: this.gameState.attributePoints,
            skillPoints: this.gameState.skillPoints,
            attributes: JSON.parse(JSON.stringify(this.gameState.attributes)),
            derivedStats: { ...this.gameState.derivedStats },
            inventory: this.gameState.inventory.map(item => ({
                ...item, // instanceId, quantity
                ...ITEMS_DATA[item.itemId] // Merge with base item data
            })),
            maxInventorySlots: MAX_INVENTORY_SLOTS,
            equipment: this.getEquippedItemsData(), // Get full data for equipped items
            skills: this.gameState.skills.map(skillId => ({...SKILLS_DATA[skillId]})),
            currentLocationId: this.gameState.currentLocationId,
            partnerName: this.gameState.partnerName,
            flags: new Map(this.gameState.flags), // Return a copy of the map
            quests: JSON.parse(JSON.stringify(this.gameState.quests)),
            allies: this.gameState.allies.map(ally => ({
                ...ally, // instanceId, level, xp, skills etc.
                allyBaseData: ALLY_DATA[ally.allyId], // Include base definition
                derivedStats: {...ally.derivedStats}, // Ensure derived stats are copied
                equipment: this.getAllyEquippedItemsData(ally.instanceId)
            })),
            inCombat: this.gameState.inCombat,
            sansanDialogue: {...this.gameState.sansanDialogue},
            instanceId: this.gameState.instanceId || "player_0" // Player's own instance ID for combat
        };
    }
    
    getEquippedItemsData() {
        const equipped = {};
        for (const slot in this.gameState.equipment) {
            const itemInstanceId = this.gameState.equipment[slot];
            if (itemInstanceId) {
                const inventoryItem = this.gameState.inventory.find(i => i.instanceId === itemInstanceId);
                if (inventoryItem) {
                    equipped[slot] = { ...inventoryItem, ...ITEMS_DATA[inventoryItem.itemId] };
                } else {
                     equipped[slot] = null; // Should not happen if data is consistent
                }
            } else {
                equipped[slot] = null;
            }
        }
        return equipped;
    }

    getAllyEquippedItemsData(allyInstanceId) {
        const ally = this.gameState.allies.find(a => a.instanceId === allyInstanceId);
        if (!ally) return {};
        const equipped = {};
         for (const slot in ally.equipment) {
            const itemObject = ally.equipment[slot]; // For allies, this is the item object itself
            if (itemObject) {
                equipped[slot] = { ...itemObject }; // Item object already has all data
            } else {
                equipped[slot] = null;
            }
        }
        return equipped;
    }


    loadState(savedState) {
        this.resetGameState(); // Clear current state first

        // Deep merge savedState into this.gameState carefully
        // This is a simplified merge; a robust one would iterate keys and handle nested objects/arrays.
        for (const key in this.gameState) {
            if (savedState.hasOwnProperty(key)) {
                if (key === 'flags' && (Array.isArray(savedState.flags) || typeof savedState.flags === 'object')) {
                    this.gameState.flags = new Map(savedState.flags); // Assumes flags are saved as [key,value] array or plain object
                } else if (key === 'allies' && Array.isArray(savedState.allies)) {
                    // Need to re-instance methods or ensure prototype chain if allies have methods
                    this.gameState.allies = JSON.parse(JSON.stringify(savedState.allies));
                }
                 else if (typeof this.gameState[key] === 'object' && this.gameState[key] !== null && !Array.isArray(this.gameState[key]) && !(this.gameState[key] instanceof Map) ) {
                    this.gameState[key] = {...this.gameState[key], ...savedState[key]}; // Shallow merge for top-level objects
                }
                else {
                    this.gameState[key] = savedState[key];
                }
            }
        }
        
        // Ensure critical sub-objects are present if missing from save
        this.gameState.sansanDialogue = this.gameState.sansanDialogue || { promptActive: null, negativeStrikeCount: 0, gameOverTriggered: false, proposalStage: 0 };
        this.gameState.attributePoints = this.gameState.attributePoints ?? INITIAL_ATTRIBUTE_POINTS;
        this.gameState.skillPoints = this.gameState.skillPoints ?? 0;


        if (!this.gameState.instanceId) this.gameState.instanceId = "player_0"; // Assign if missing from old save

        this.updateAllStats(); // Crucial to recalculate everything after load
        eventBus.publish('gameLoaded', this.getPublicData());
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('locationChanged', { newLocationId: this.gameState.currentLocationId, oldLocationId: null });
    }

    getState() {
        const stateToSave = JSON.parse(JSON.stringify(this.gameState)); // Deep clone
        if (stateToSave.flags instanceof Map) { // Convert Map to array for JSON
            stateToSave.flags = Array.from(stateToSave.flags.entries());
        }
        return stateToSave;
    }
}

export const playerManager = new PlayerManager();
