// js/playerManager.js
import { eventBus } from './eventManager.js';
import { PLAYER_CLASSES, ATTRIBUTES, DERIVED_STATS_PLAYER, INITIAL_ATTRIBUTE_POINTS, ATTRIBUTE_POINTS_PER_LEVEL_INTERVAL, ATTRIBUTE_POINTS_GAIN } from './data/classes.js';
import { SKILLS_DATA, SKILL_TREES_META, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ITEMS_DATA, STARTING_ITEMS, EQUIPMENT_SLOTS } from './data/items.js';
import { ALLY_DATA, ALLY_CLASSES } from './data/allies.js'; 
import { GACHA_POOLS } from './data/gachaPools.js';
import * as utils from './utils.js';

const MAX_INVENTORY_SLOTS = 20; 
const XP_BASE = 100;
const XP_FACTOR = 1.35; 

class PlayerManager {
    constructor() {
        this.utils = utils;
        this.resetGameState(); 
    }

    resetGameState() {
        this.gameState = {
            instanceId: null, // Will be set in setupNewCharacter or loadState
            name: "Player",
            gender: "female", 
            partnerName: "Sansan",
            classId: null,
            level: 1,
            xp: 0,
            sp: 0,
            gold: 0,
            attributePoints: INITIAL_ATTRIBUTE_POINTS, 
            attributes: {}, 
            derivedStats: {},
            inventory: [], 
            equipment: {}, 
            skills: [], 
            skillPoints: 0, 
            currentLocationId: "lumina_field",
            flags: new Map(),
            quests: {}, 
            allies: [], 
            inCombat: false,
            sansanDialogue: { 
                promptActive: null, 
                negativeStrikeCount: 0,
                gameOverTriggered: false,
                proposalStage: 0 
            },
            gameTime: { day: 1, hour: 8, minute: 0 } 
        };
        DERIVED_STATS_PLAYER.forEach(stat => this.gameState.derivedStats[stat] = 0);
        Object.values(EQUIPMENT_SLOTS.player).forEach(slot => this.gameState.equipment[slot] = null);
    }

    setupNewCharacter(name, gender, classId) {
        this.resetGameState(); 
        this.gameState.name = name;
        this.gameState.gender = gender;
        this.gameState.partnerName = gender === 'male' ? 'Teyang' : 'Sansan';
        this.gameState.classId = classId;
        this.gameState.gold = 25; 
        this.gameState.instanceId = utils.generateId('player_'); // Assign unique ID

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
        
        if (name === "Sansanite" && gender === "male") {
            this.grantSansaniteBonus();
        }
        if (name === "Cutiepatotie" && gender === "female") {
            this.addSansanAlly();
        }

        this.updateAllStats(); 
        this.gameState.currentLocationId = "lumina_field";
        
        eventBus.publish('newCharacterCreated', this.getPublicData());
        eventBus.publish('locationChanged', { newLocationId: this.gameState.currentLocationId, oldLocationId: null });

        if (this.isPlayerCharacter("Cutiepatotie") && this.gameState.gender === "female") {
            eventBus.publish('specialIntroCutiepatotie', { partnerName: this.gameState.partnerName });
        }
    }

    grantSansaniteBonus() {
        this.addGold(1000000);
        this.addSp(10000);
        this.gameState.level = 10; 
        this.gameState.attributePoints += 10; 
        this.gameState.skillPoints += 5;

        let itemsGranted = 0;
        for (const itemId in ITEMS_DATA) {
            if (itemsGranted >= MAX_INVENTORY_SLOTS - 5) break; 
            const itemData = ITEMS_DATA[itemId];
            if (!itemData.isUnique && !itemData.forAllyOnly && !itemData.forPlayerOnly) { 
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
            xp: 0, 
            equipment: {}, 
            skills: [...sansanBase.skills], 
            attributes: {}, 
            derivedStats: {}, 
            statusEffects: [],
            aiProfile: sansanBase.aiProfile,
            isPlayerControlled: (this.gameState.name === "Cutiepatotie" && this.gameState.gender === "female"), // Player controlled if Cutiepatotie
            dialogueTriggers: sansanBase.dialogueTriggers 
        };

        const sansanSlots = EQUIPMENT_SLOTS[sansanBase.id] || EQUIPMENT_SLOTS.player; 
        sansanSlots.forEach(slot => sansanAlly.equipment[slot] = null);

        const allyClassData = ALLY_CLASSES[sansanAlly.classId] || PLAYER_CLASSES[sansanAlly.classId]; 
        ATTRIBUTES.forEach(attr => {
            sansanAlly.attributes[attr] = {
                base: (sansanBase.baseStats && sansanBase.baseStats[attr] !== undefined) ? sansanBase.baseStats[attr] : (allyClassData?.baseStats[attr] || 8),
                bonus: 0, current: 0 
            };
        });
        sansanAlly.derivedStats.maxHp = (sansanBase.baseStats && sansanBase.baseStats.hp) || (allyClassData?.baseStats.hp || 100);
        sansanAlly.derivedStats.currentHp = sansanAlly.derivedStats.maxHp;
        sansanAlly.derivedStats.maxMp = (sansanBase.baseStats && sansanBase.baseStats.mp) || (allyClassData?.baseStats.mp || 30);
        sansanAlly.derivedStats.currentMp = sansanAlly.derivedStats.maxMp;
        sansanAlly.derivedStats.mpRegen = (sansanBase.baseStats && sansanBase.baseStats.mpRegen) || (allyClassData?.baseStats.mpRegen || 0.5);

        if (sansanBase.equipment) {
            for (const slot in sansanBase.equipment) {
                const itemIdToEquip = sansanBase.equipment[slot];
                const itemData = ITEMS_DATA[itemIdToEquip];
                if (itemData && (itemData.slot === slot || (itemData.slot === "weapon" && slot === "weapon"))) { 
                    const itemInstance = { ...itemData, instanceId: utils.generateId('item_') };
                    sansanAlly.equipment[slot] = itemInstance; 
                }
            }
        }

        this.gameState.allies.push(sansanAlly);
        this.updateAllyStats(sansanAlly.instanceId); 
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

    updateCharacterBaseStats(character) { 
        const classData = PLAYER_CLASSES[character.classId] || ALLY_CLASSES[character.classId];
        if (!classData) return;

        // Ensure attributes object exists and initialize if necessary (especially for enemies in combatManager context if they don't have allocated/bonus)
        ATTRIBUTES.forEach(attr => {
            if (!character.attributes[attr]) { // Ensure each attribute object exists
                character.attributes[attr] = { base: 0, allocated: 0, bonus: 0, current: 0 };
            }
            character.attributes[attr].current =
                (character.attributes[attr].base || 0) +
                (character.attributes[attr].allocated || 0) + 
                (character.attributes[attr].bonus || 0); 
        });


        character.derivedStats.maxHp = (classData.baseStats.hp || 0) +
                                     ((character.attributes.con?.current || 0) * (character.isPlayer ? 7 : 10)) + 
                                     ((character.level || 1) * (character.isPlayer ? 5 : 8)); // Use level 1 as fallback
        character.derivedStats.maxMp = (classData.baseStats.mp || 0) +
                                     ((character.attributes.int?.current || 0) * (character.isPlayer ? 4 : 5)) +
                                     ((character.level || 1) * (character.isPlayer ? 3 : 4));
        character.derivedStats.mpRegen = (classData.baseStats.mpRegen || 0) + ((character.attributes.wis?.current || 0) * 0.15);

        character.derivedStats.attack = Math.floor(
            ((character.attributes.str?.current || 0) * (classData.name === "Mage" ? 0.5 : 1.5)) +
            ((character.attributes.dex?.current || 0) * (classData.name === "Rogue" ? 1.5 : 0.8)) +
            ((character.attributes.int?.current || 0) * (classData.name === "Mage" ? 1.8 : 0.2))
        );
        character.derivedStats.defense = Math.floor(
            ((character.attributes.con?.current || 0) * 1.2) +
            ((character.attributes.dex?.current || 0) * 0.5)
        );
        character.derivedStats.accuracy = 75 + (character.attributes.dex?.current || 0) + Math.floor((character.attributes.wis?.current || 0) / 2);
        character.derivedStats.evasion = 10 + Math.floor((character.attributes.dex?.current || 0) * 1.5) + Math.floor((character.attributes.wis?.current || 0) / 3);
        character.derivedStats.critChance = 5 + Math.floor((character.attributes.dex?.current || 0) / 2) + Math.floor((character.attributes.int?.current || 0) / 4); 
        character.derivedStats.speed = 10 + (character.attributes.dex?.current || 0); // Removed weight for now for simplicity


        // Apply stat bonuses from equipment
        const equipmentSource = character.isPlayer ? this.getEquippedItemsData() : character.equipment; // Use already processed data for player
        for (const slot in equipmentSource) {
            const itemData = equipmentSource[slot]; // For player, this is full item data; for ally, it's the item object itself

            if (itemData && itemData.stats) {
                for (const stat in itemData.stats) {
                    if (ATTRIBUTES.includes(stat) && character.attributes[stat]) { // Check if character.attributes[stat] exists
                        character.attributes[stat].current += itemData.stats[stat];
                        character.attributes[stat].bonus = (character.attributes[stat].bonus || 0) + itemData.stats[stat]; // Track bonus separately
                    } else if (character.derivedStats.hasOwnProperty(stat)) {
                        character.derivedStats[stat] += itemData.stats[stat];
                    } else if (stat === "maxHp" || stat === "maxMp") { 
                         character.derivedStats[stat] += itemData.stats[stat];
                    }
                }
            }
            if (itemData && itemData.scalingStats && character.isPlayer) { 
                const playerLevel = this.gameState.level;
                const intervals = Math.floor(playerLevel / itemData.scalingStats.levelFactor);
                for (const stat in itemData.scalingStats.statsPerInterval) {
                    const bonusAmount = intervals * itemData.scalingStats.statsPerInterval[stat];
                    if (ATTRIBUTES.includes(stat) && character.attributes[stat]) {
                        character.attributes[stat].current += bonusAmount;
                         character.attributes[stat].bonus = (character.attributes[stat].bonus || 0) + bonusAmount;
                    } else if (character.derivedStats.hasOwnProperty(stat)) {
                        character.derivedStats[stat] += bonusAmount;
                    }
                }
            }
        }
        
        // Re-calculate current values after bonuses applied to base/allocated
        ATTRIBUTES.forEach(attr => {
            if (character.attributes[attr]) { // Check again as bonus was just added
                character.attributes[attr].current =
                    (character.attributes[attr].base || 0) +
                    (character.attributes[attr].allocated || 0) +
                    (character.attributes[attr].bonus || 0);
            }
        });
        
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

        character.derivedStats.currentHp = Math.max(0, Math.min(character.derivedStats.currentHp ?? character.derivedStats.maxHp, character.derivedStats.maxHp));
        character.derivedStats.currentMp = Math.max(0, Math.min(character.derivedStats.currentMp ?? character.derivedStats.maxMp, character.derivedStats.maxMp));
    }

    updateAllStats() { 
        // Reset bonuses before recalculating for player
        ATTRIBUTES.forEach(attr => {
            if (this.gameState.attributes[attr]) this.gameState.attributes[attr].bonus = 0;
        });
        const playerObjectForStats = { ...this.gameState, isPlayer: true }; 
        this.updateCharacterBaseStats(playerObjectForStats);
        this.gameState.attributes = playerObjectForStats.attributes;
        this.gameState.derivedStats = playerObjectForStats.derivedStats;

        this.gameState.allies.forEach(ally => {
            this.updateAllyStats(ally.instanceId);
        });
    }

    updateAllyStats(allyInstanceId) {
        const ally = this.gameState.allies.find(a => a.instanceId === allyInstanceId);
        if (!ally) return;
        
        // Reset bonuses before recalculating for ally
        ATTRIBUTES.forEach(attr => {
            if (ally.attributes[attr]) ally.attributes[attr].bonus = 0;
        });
        const allyObjectForStats = { ...ally, isPlayer: false }; 
        this.updateCharacterBaseStats(allyObjectForStats);
        
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

        this.gameState.allies.forEach(ally => {
            if (ally.derivedStats.currentHp > 0) { 
                this.addXpToAlly(ally.instanceId, Math.floor(amount * 0.75));
            }
        });
        eventBus.publish('playerDataUpdated', this.getPublicData());
    }
    
    addXpToAlly(allyInstanceId, amount) {
        const ally = this.gameState.allies.find(a => a.instanceId === allyInstanceId);
        if (!ally || ally.level >= 99) return;

        ally.xp += amount;
        let xpForNextAllyLevel = this.getXpForNextLevel(ally.level); 
        while (ally.xp >= xpForNextAllyLevel && ally.level < 99) {
            ally.level++;
            ally.xp -= xpForNextAllyLevel; 
            
            const allyClass = ALLY_CLASSES[ally.classId] || PLAYER_CLASSES[ally.classId];
            if (allyClass && allyClass.skillProgression && allyClass.skillProgression[ally.level]) {
                allyClass.skillProgression[ally.level].forEach(skillId => {
                    if (!ally.skills.includes(skillId)) {
                        ally.skills.push(skillId);
                         eventBus.publish('uiNotification', { message: `${ally.name} learned ${SKILLS_DATA[skillId]?.name}!`, type: 'system' });
                    }
                });
            }
            this.updateAllyStats(ally.instanceId); 
            ally.derivedStats.currentHp = ally.derivedStats.maxHp; 
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
        
        this.gameState.attributePoints += ATTRIBUTE_POINTS_GAIN; 
        this.gameState.skillPoints += 1; 

        this.updateAllStats(); 
        this.gameState.derivedStats.currentHp = this.gameState.derivedStats.maxHp; 
        this.gameState.derivedStats.currentMp = this.gameState.derivedStats.maxMp;

        eventBus.publish('playerLeveledUp', {
            newLevel: this.gameState.level,
            attributePointsAvailable: this.gameState.attributePoints,
            skillPointsAvailable: this.gameState.skillPoints
        });
        eventBus.publish('uiNotification', { message: `LEVEL UP! You reached Level ${this.gameState.level}! You have ${this.gameState.attributePoints} attribute points and ${this.gameState.skillPoints} skill point(s).`, type: 'system highlight-color' });
    }
    
    learnSkill(skillId) { 
        const skillData = SKILLS_DATA[skillId];
        if (!skillData) {
             eventBus.publish('uiNotification', { message: `Unknown skill: ${skillId}.`, type: 'error' }); return false;
        }
        if (this.hasSkill(skillId)) {
            eventBus.publish('uiNotification', { message: `You already know ${skillData.name}.`, type: 'error' }); return false;
        }
        if (this.gameState.skillPoints < (skillData.cost || 1)) { 
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
        } else { 
            for (let i = 0; i < quantity; i++) {
                if (this.gameState.inventory.length >= MAX_INVENTORY_SLOTS) {
                    eventBus.publish('uiNotification', { message: "Inventory full!", type: 'error' }); return false; 
                }
                this.gameState.inventory.push({ itemId, quantity: 1, instanceId: utils.generateId('item_') });
            }
        }
        eventBus.publish('uiNotification', { message: `Added ${itemData.name} (x${quantity}) to inventory.`, type: 'system' });
        eventBus.publish('playerDataUpdated', this.getPublicData());
        return true;
    }

    removeItem(itemInstanceId, quantity = 1) { 
        const itemIndex = this.gameState.inventory.findIndex(i => i.instanceId === itemInstanceId);
        if (itemIndex === -1) {
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
        } else { 
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
        
        if (itemData.forPlayerOnly && itemData.forPlayerOnly !== this.gameState.name) {
            eventBus.publish('uiNotification', { message: `${itemData.name} cannot be equipped by you.`, type: 'error' }); return;
        }

        let targetSlot = itemData.slot;
        if (itemData.slot === "accessory") { 
            targetSlot = this.gameState.equipment.accessory1 ? "accessory2" : "accessory1";
        }

        if (this.gameState.equipment[targetSlot]) {
            this.unequipItem(targetSlot, false); 
        }
        if (itemData.slot === "twoHand" || itemData.slot === "weapon" && ITEMS_DATA[itemToEquip.itemId]?.slot === "twoHand") { // If equipping a 2H weapon
            if (this.gameState.equipment.offHand) this.unequipItem("offHand", false);
             if (itemData.slot === "twoHand") targetSlot = "weapon"; // Always equip 2H to main weapon slot
        }
        if (itemData.slot === "offHand" && this.gameState.equipment.weapon) {
            const currentWeaponInstanceId = this.gameState.equipment.weapon;
            const currentWeaponInvItem = this.gameState.inventory.find(i => i.instanceId === currentWeaponInstanceId);
            if (currentWeaponInvItem && ITEMS_DATA[currentWeaponInvItem.itemId]?.slot === "twoHand") {
                this.unequipItem("weapon", false);
            }
        }


        this.gameState.equipment[targetSlot] = itemToEquip.instanceId; 
        if (itemData.slot === "twoHand") { // Also occupy offHand slot visually if it's a two-handed weapon
            this.gameState.equipment.offHand = itemToEquip.instanceId; // Or a special marker
        }


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
             this.gameState.equipment[slotId] = null; 
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

        this.gameState.equipment[slotId] = null;
        // If it was a two-handed weapon, clear both weapon and offHand slots that it was occupying
        if (itemData.slot === "twoHand") {
            if (this.gameState.equipment.weapon === equippedItemInstanceId) this.gameState.equipment.weapon = null;
            if (this.gameState.equipment.offHand === equippedItemInstanceId) this.gameState.equipment.offHand = null;
        }


        if (updateStats) this.updateAllStats();
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('uiNotification', { message: `Unequipped ${itemData.name}.`, type: 'system' });
    }

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
    
    syncCharacterCombatStatsToGameState(characterInstanceId, currentHp, currentMp) {
        let targetCharacterState = null;
        if (characterInstanceId === this.gameState.instanceId) { // Player
            targetCharacterState = this.gameState.derivedStats;
        } else { // Ally
            const ally = this.gameState.allies.find(a => a.instanceId === characterInstanceId);
            if (ally) targetCharacterState = ally.derivedStats;
        }

        if (targetCharacterState) {
            targetCharacterState.currentHp = Math.max(0, currentHp);
            targetCharacterState.currentMp = Math.max(0, currentMp);
            // Max HP/MP should already be correct from updateAllStats
        }
    }
    
    spendMp(amount, characterInstanceId = this.gameState.instanceId) {
        let targetCharacter = null;
        if (characterInstanceId === this.gameState.instanceId) { // Player
            targetCharacter = this.gameState.derivedStats;
        } else { // Ally
            const ally = this.gameState.allies.find(a => a.instanceId === characterInstanceId);
            if (ally) targetCharacter = ally.derivedStats;
        }

        if (targetCharacter && targetCharacter.currentMp >= amount) {
            targetCharacter.currentMp -= amount;
            // updateAllStats is not called here to avoid full recalc during combat turns
            // CombatManager's copy of stats handles turn-by-turn changes.
            // This updates the gameState copy directly.
            eventBus.publish('playerDataUpdated', this.getPublicData()); // For UI reflecting MP spend
            return true;
        }
        return false; 
    }


    getPublicData() {
        return {
            instanceId: this.gameState.instanceId,
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
                ...item, 
                ...ITEMS_DATA[item.itemId] 
            })),
            maxInventorySlots: MAX_INVENTORY_SLOTS,
            equipment: this.getEquippedItemsData(), 
            skills: this.gameState.skills.map(skillId => ({...SKILLS_DATA[skillId]})),
            currentLocationId: this.gameState.currentLocationId,
            partnerName: this.gameState.partnerName,
            flags: new Map(this.gameState.flags), 
            quests: JSON.parse(JSON.stringify(this.gameState.quests)),
            allies: this.gameState.allies.map(ally => ({
                ...ally, 
                allyBaseData: ALLY_DATA[ally.allyId], 
                derivedStats: {...ally.derivedStats}, 
                equipment: this.getAllyEquippedItemsData(ally.instanceId),
                skills: ally.skills.map(skillId => ({...SKILLS_DATA[skillId]})), // Send full skill data for allies too
                isPlayerControlled: ally.isPlayerControlled // Pass this crucial flag
            })),
            inCombat: this.gameState.inCombat,
            sansanDialogue: {...this.gameState.sansanDialogue},
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
                     equipped[slot] = null; 
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
            const itemObject = ally.equipment[slot]; 
            if (itemObject) {
                equipped[slot] = { ...itemObject }; 
            } else {
                equipped[slot] = null;
            }
        }
        return equipped;
    }


    loadState(savedState) {
        this.resetGameState(); 

        for (const key in this.gameState) {
            if (savedState.hasOwnProperty(key)) {
                if (key === 'flags' && (Array.isArray(savedState.flags) || typeof savedState.flags === 'object')) {
                    this.gameState.flags = new Map(savedState.flags); 
                } else if (key === 'allies' && Array.isArray(savedState.allies)) {
                    this.gameState.allies = JSON.parse(JSON.stringify(savedState.allies));
                }
                 else if (typeof this.gameState[key] === 'object' && this.gameState[key] !== null && !Array.isArray(this.gameState[key]) && !(this.gameState[key] instanceof Map) ) {
                    this.gameState[key] = {...this.gameState[key], ...JSON.parse(JSON.stringify(savedState[key]))}; // Deep clone for nested objects
                }
                else {
                    this.gameState[key] = savedState[key];
                }
            }
        }
        
        this.gameState.sansanDialogue = this.gameState.sansanDialogue || { promptActive: null, negativeStrikeCount: 0, gameOverTriggered: false, proposalStage: 0 };
        this.gameState.attributePoints = this.gameState.attributePoints ?? INITIAL_ATTRIBUTE_POINTS;
        this.gameState.skillPoints = this.gameState.skillPoints ?? 0;
        this.gameState.instanceId = savedState.instanceId || utils.generateId('player_');


        this.updateAllStats(); 
        eventBus.publish('gameLoaded', this.getPublicData());
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('locationChanged', { newLocationId: this.gameState.currentLocationId, oldLocationId: null });
    }

    getState() {
        const stateToSave = JSON.parse(JSON.stringify(this.gameState)); 
        if (stateToSave.flags instanceof Map) { 
            stateToSave.flags = Array.from(stateToSave.flags.entries());
        }
        return stateToSave;
    }
}

export const playerManager = new PlayerManager();
