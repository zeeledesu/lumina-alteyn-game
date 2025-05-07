// js/playerManager.js
import { eventBus } from './eventManager.js';
import { PLAYER_CLASSES, ATTRIBUTES } from './data/classes.js';
import { SKILLS_DATA } from './data/skills.js';
import { ITEMS_DATA, STARTING_ITEMS } from './data/items.js';
import * as utils from './utils.js'; // Import all exports from utils

const MAX_INVENTORY_SLOTS = 10; // For V0.1
const XP_BASE = 100;
const XP_FACTOR = 1.5;

class PlayerManager {
    constructor() {
        this.utils = utils; // Make utils accessible
        this.gameState = {
            name: "Player",
            gender: "male", // or "female"
            partnerName: "Teyang", // or "Sansan"
            classId: null,
            level: 1,
            xp: 0,
            sp: 0, // Study Points
            attributes: {}, // e.g., { str: { base: 0, allocated: 0, current: 0 } ... }
            derivedStats: {
                maxHp: 0, currentHp: 0,
                maxMp: 0, currentMp: 0,
                mpRegen: 0,
                attack: 0, defense: 0,
                accuracy: 0, critChance: 0, speed: 0,
            },
            inventory: [], // [{ itemId, quantity, equipped: false }]
            equipment: { // slotId: itemId or null
                weapon: null, offHand: null, head: null, body: null,
                accessory1: null, accessory2: null
            },
            skills: [], // array of skill IDs
            currentLocationId: "lumina_field",
            gold: 0,
            flags: new Map(), // For game progression, e.g. 'study_hub_unlocked'
            quests: {} // { questId: { stage: 0, completed: false } }
        };
        this.initialize();
    }

    initialize() {
        // This might be called on new game or load
        this.updateDerivedStats();
        eventBus.publish('playerDataUpdated', this.getPublicData());
    }

    setupNewCharacter(name, gender, classId) {
        this.gameState.name = name;
        this.gameState.gender = gender;
        this.gameState.partnerName = gender === 'male' ? 'Teyang' : 'Sansan';
        this.gameState.classId = classId;
        this.gameState.level = 1;
        this.gameState.xp = 0;
        this.gameState.sp = 0; // Start with 0 SP
        this.gameState.gold = 10; // Starting gold
        this.gameState.inventory = [];
        this.gameState.skills = [];
        this.gameState.flags = new Map();
        this.gameState.quests = {};

        const pClass = PLAYER_CLASSES[classId];
        if (!pClass) {
            console.error("Invalid class ID:", classId);
            return;
        }

        ATTRIBUTES.forEach(attr => {
            this.gameState.attributes[attr] = {
                base: pClass.baseStats[attr] || 0,
                allocated: 0,
                current: 0 // Will be calculated
            };
        });
        this.gameState.derivedStats.maxHp = pClass.baseStats.hp;
        this.gameState.derivedStats.currentHp = pClass.baseStats.hp;
        this.gameState.derivedStats.maxMp = pClass.baseStats.mp;
        this.gameState.derivedStats.currentMp = pClass.baseStats.mp;
        this.gameState.derivedStats.mpRegen = pClass.baseStats.mpRegen;

        // Add starting items
        const startingItems = STARTING_ITEMS[classId] || [];
        startingItems.forEach(itemRef => {
            this.addItem(itemRef.itemId, itemRef.quantity);
        });
        
        // Add starting skills based on class (if any are default)
        // For now, skills are learned on level up.

        this.updateDerivedStats();
        this.gameState.currentLocationId = "lumina_field"; // Starting location
        eventBus.publish('newCharacterCreated', this.getPublicData());
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('locationChanged', { newLocationId: this.gameState.currentLocationId, oldLocationId: null });
    }

    allocateAttributePoint(attributeId) {
        if (this.gameState.attributes[attributeId] && this.getUnallocatedPoints() > 0) {
            this.gameState.attributes[attributeId].allocated++;
            this.updateDerivedStats();
            eventBus.publish('playerDataUpdated', this.getPublicData());
            eventBus.publish('uiNotification', { message: `${utils.capitalize(attributeId)} increased!`, type: 'success' });
            return true;
        }
        eventBus.publish('uiNotification', { message: `Cannot allocate to ${attributeId}. No points or invalid attribute.`, type: 'error' });
        return false;
    }

    getUnallocatedPoints() {
        // Example: 1 point every 2 levels + initial points
        const initialPoints = 5; // From character creation
        const pointsFromLevels = Math.floor((this.gameState.level -1) / 2);
        let totalPointsToAllocate = initialPoints + pointsFromLevels;
        
        let spentPoints = 0;
        ATTRIBUTES.forEach(attr => {
            spentPoints += this.gameState.attributes[attr]?.allocated || 0;
        });
        return totalPointsToAllocate - spentPoints;
    }


    updateDerivedStats() {
        const gs = this.gameState;
        const pClass = PLAYER_CLASSES[gs.classId];
        if (!pClass) return;

        ATTRIBUTES.forEach(attr => {
            gs.attributes[attr].current = (gs.attributes[attr].base || 0) + (gs.attributes[attr].allocated || 0);
            // Add equipment bonuses here later
        });

        gs.derivedStats.maxHp = pClass.baseStats.hp + (gs.attributes.con.current * 5) + (gs.level * 3);
        gs.derivedStats.maxMp = pClass.baseStats.mp + (gs.attributes.int.current * 3) + (gs.level * 2);
        gs.derivedStats.mpRegen = pClass.baseStats.mpRegen + (gs.attributes.wis.current * 0.1);

        gs.derivedStats.attack = (gs.attributes.str.current * 2) + (gs.attributes.dex.current * 1); // Simplistic
        gs.derivedStats.defense = (gs.attributes.con.current * 1) + (gs.attributes.dex.current * 0.5);

        // Ensure current HP/MP don't exceed max
        gs.derivedStats.currentHp = Math.min(gs.derivedStats.currentHp, gs.derivedStats.maxHp);
        gs.derivedStats.currentMp = Math.min(gs.derivedStats.currentMp, gs.derivedStats.maxMp);

        // Other stats like accuracy, critChance, speed can be calculated here
        gs.derivedStats.accuracy = 70 + gs.attributes.dex.current;
        gs.derivedStats.critChance = 5 + Math.floor(gs.attributes.dex.current / 2);
        gs.derivedStats.speed = 10 + gs.attributes.dex.current;
    }

    addXp(amount) {
        if (this.gameState.level >= 99) return; // Max level
        this.gameState.xp += amount;
        eventBus.publish('uiNotification', { message: `Gained ${amount} XP!`, type: 'success' });

        let xpForNextLevel = this.getXpForNextLevel();
        while (this.gameState.xp >= xpForNextLevel && this.gameState.level < 99) {
            this.levelUp();
            xpForNextLevel = this.getXpForNextLevel();
        }
        eventBus.publish('playerDataUpdated', this.getPublicData());
    }

    getXpForNextLevel() {
        if (this.gameState.level >= 99) return Infinity;
        return Math.floor(XP_BASE * Math.pow(XP_FACTOR, this.gameState.level - 1));
    }

    levelUp() {
        this.gameState.level++;
        this.gameState.xp = 0; // Reset XP for new level, or subtract xpForNextLevel if overflow matters
        
        // Full heal on level up
        this.gameState.derivedStats.currentHp = this.gameState.derivedStats.maxHp;
        this.gameState.derivedStats.currentMp = this.gameState.derivedStats.maxMp;

        this.updateDerivedStats(); // Recalculate stats based on new level

        eventBus.publish('playerLeveledUp', {
            newLevel: this.gameState.level,
            attributePointsGained: (this.gameState.level % 2 === 0) ? 1 : 0, // Example: 1 point every 2 levels
            skillChoices: this.getAvailableSkillChoices()
        });
        eventBus.publish('uiNotification', { message: `Congratulations! You reached Level ${this.gameState.level}!`, type: 'system' });
    }
    
    getAvailableSkillChoices() {
        const available = [];
        const pClass = PLAYER_CLASSES[this.gameState.classId];
        if (!pClass || !pClass.availableSkills) return [];

        for (const skillId of pClass.availableSkills) {
            const skillData = SKILLS_DATA[skillId];
            if (skillData && skillData.levelRequirement <= this.gameState.level && !this.hasSkill(skillId)) {
                available.push(skillData);
            }
        }
        // For V0.1, let's just offer up to 2-3 skills not yet learned
        return available.slice(0, pClass.skillSlotsOnLevelUp || 1);
    }

    learnSkill(skillId) {
        if (SKILLS_DATA[skillId] && !this.hasSkill(skillId)) {
            this.gameState.skills.push(skillId);
            eventBus.publish('playerDataUpdated', this.getPublicData());
            eventBus.publish('uiNotification', { message: `Learned ${SKILLS_DATA[skillId].name}!`, type: 'success' });
            return true;
        }
        eventBus.publish('uiNotification', { message: `Cannot learn ${skillId}.`, type: 'error' });
        return false;
    }

    hasSkill(skillId) {
        return this.gameState.skills.includes(skillId);
    }

    addSp(amount) {
        this.gameState.sp += amount;
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('uiNotification', { message: `Gained ${amount} SP!`, type: 'success' });
    }

    spendSp(amount) {
        if (this.gameState.sp >= amount) {
            this.gameState.sp -= amount;
            eventBus.publish('playerDataUpdated', this.getPublicData());
            return true;
        }
        eventBus.publish('uiNotification', { message: "Not enough SP.", type: 'error' });
        return false;
    }
    
    addGold(amount) {
        this.gameState.gold += amount;
        eventBus.publish('playerDataUpdated', this.getPublicData());
        // eventBus.publish('uiNotification', { message: `Gained ${amount} gold.`, type: 'success' }); // Can be too spammy
    }

    addItem(itemId, quantity = 1) {
        const itemData = ITEMS_DATA[itemId];
        if (!itemData) {
            console.error("Unknown item ID:", itemId);
            return false;
        }

        if (itemData.stackable) {
            const existingItem = this.gameState.inventory.find(i => i.itemId === itemId);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                if (this.gameState.inventory.length >= MAX_INVENTORY_SLOTS) {
                    eventBus.publish('uiNotification', { message: "Inventory full!", type: 'error' });
                    return false;
                }
                this.gameState.inventory.push({ itemId, quantity });
            }
        } else {
            if (this.gameState.inventory.length + quantity > MAX_INVENTORY_SLOTS) {
                eventBus.publish('uiNotification', { message: "Inventory full!", type: 'error' });
                return false;
            }
            for (let i = 0; i < quantity; i++) {
                this.gameState.inventory.push({ itemId, quantity: 1 });
            }
        }
        eventBus.publish('uiNotification', { message: `Added ${itemData.name} (x${quantity}) to inventory.`, type: 'system' });
        eventBus.publish('playerDataUpdated', this.getPublicData());
        return true;
    }
    
    // Basic Gacha Pull for V0.1
    gachaPull() {
        if (!this.spendSp(10)) return; // Cost 10 SP

        // Simple loot table for now
        const gachaPool = [
            { itemId: "c001", weight: 50 }, // Minor Healing Draught
            { itemId: "i001", weight: 30 }, // Old Coin (as a booby prize)
            { itemId: "sp_orb_small", weight: 15 }, // Small SP Orb
            { itemId: "w001", weight: 5 } // Rusty Shortsword (rare from gacha)
        ];

        let totalWeight = gachaPool.reduce((sum, item) => sum + item.weight, 0);
        let randomNum = utils.getRandomInt(1, totalWeight);
        let rewardItemId = null;

        for (const item of gachaPool) {
            if (randomNum <= item.weight) {
                rewardItemId = item.itemId;
                break;
            }
            randomNum -= item.weight;
        }

        if (rewardItemId) {
            this.addItem(rewardItemId, 1);
            const rewardItemData = ITEMS_DATA[rewardItemId];
            // Simple animation placeholder
            eventBus.publish('gachaResult', { 
                itemName: rewardItemData.name, 
                rarity: rewardItemData.rarity,
                message: `The device whirs and dispenses... ${rewardItemData.name}!`
            });
        } else {
            eventBus.publish('uiNotification', { message: "The device sputters, nothing happens.", type: 'error' });
        }
    }


    getPublicData() {
        // Return a copy or a structured object of necessary player data for UI updates
        return {
            name: this.gameState.name,
            level: this.gameState.level,
            xp: this.gameState.xp,
            xpForNextLevel: this.getXpForNextLevel(),
            sp: this.gameState.sp,
            gold: this.gameState.gold,
            attributes: JSON.parse(JSON.stringify(this.gameState.attributes)), // Deep copy
            derivedStats: { ...this.gameState.derivedStats },
            inventory: JSON.parse(JSON.stringify(this.gameState.inventory.map(item => ({...item, ...ITEMS_DATA[item.itemId]})))),
            maxInventorySlots: MAX_INVENTORY_SLOTS,
            skills: this.gameState.skills.map(skillId => SKILLS_DATA[skillId]),
            currentLocationId: this.gameState.currentLocationId,
            partnerName: this.gameState.partnerName,
            unallocatedPoints: this.getUnallocatedPoints(),
            flags: this.gameState.flags, // Be careful with direct map exposure if modification is an issue
            quests: this.gameState.quests // Same as flags
        };
    }

    loadState(savedState) {
        // More robust validation needed in a real game
        this.gameState = JSON.parse(JSON.stringify(savedState)); // Deep clone
        // Convert flags Map back from array if it was stringified
        if (Array.isArray(this.gameState.flags)) {
            this.gameState.flags = new Map(this.gameState.flags);
        } else if (typeof this.gameState.flags === 'object' && this.gameState.flags !== null) {
             this.gameState.flags = new Map(Object.entries(this.gameState.flags)); // If saved as plain object
        } else {
            this.gameState.flags = new Map(); // Default to empty map
        }

        this.updateDerivedStats(); // Ensure stats are correct after loading
        eventBus.publish('gameLoaded', this.getPublicData());
        eventBus.publish('playerDataUpdated', this.getPublicData());
        eventBus.publish('locationChanged', { newLocationId: this.gameState.currentLocationId, oldLocationId: null });

    }

    getState() {
        // Prepare state for saving. Convert Map to array for JSON.stringify
        const stateToSave = JSON.parse(JSON.stringify(this.gameState));
        if (stateToSave.flags instanceof Map) {
            stateToSave.flags = Array.from(stateToSave.flags.entries());
        }
        return stateToSave;
    }
}

export const playerManager = new PlayerManager();