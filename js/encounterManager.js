// js/encounterManager.js
import { eventBus } from './eventManager.js';
import { worldManager } from './worldManager.js';
import { playerManager } from './playerManager.js';
import { ENEMIES_DATA, ENEMY_GROUPS } from './data/enemies.js';
import { rollPercentage, getRandomInt } from './utils.js';

class EncounterManager {
    constructor() {
        eventBus.subscribe('locationChanged', ({ newLocationId }) => this.checkForEncounters(newLocationId));
    }

    checkForEncounters(locationId) {
        if (playerManager.gameState.inCombat) return; // Don't trigger new encounters if already in combat

        const locationData = worldManager.getLocationData(locationId);
        if (!locationData) return;

        // Check for fixed encounters first (e.g., boss fight on entering a room for a quest)
        if (locationData.encounterTableFixed && !playerManager.gameState.flags.get(`${locationId}_fixed_encounter_cleared`)) {
            // Add quest conditions or other flags here if needed
            // For MQ002 boss example:
            if (locationId === "ruined_outpost_interior" && playerManager.gameState.quests["main002_scholars_plea"]?.stage === 0) {
                 const enemyGroup = this.buildEnemyParty(locationData.encounterTableFixed); // Should be an array of enemy IDs
                 if (enemyGroup.length > 0) {
                    eventBus.publish('uiNotification', { message: "Ambush! Goblins attack!", type: 'warning-message' });
                    eventBus.publish('startCombat', { enemies: enemyGroup, fixedEncounterId: `${locationId}_fixed_encounter` });
                    return; // Stop further checks if fixed encounter started
                 }
            }
        }


        // Check for random encounters based on location's table
        if (locationData.encounterTable && locationData.encounterTable.length > 0) {
            for (const encounterEntry of locationData.encounterTable) {
                if (rollPercentage(encounterEntry.chance)) {
                    const enemyGroup = this.buildEnemyPartyFromGroup(encounterEntry.enemyGroupId);
                    if (enemyGroup.length > 0) {
                        eventBus.publish('uiNotification', { message: "You've encountered hostiles!", type: 'warning-message' });
                        eventBus.publish('startCombat', { enemies: enemyGroup });
                        break; // Stop after one encounter triggers
                    }
                }
            }
        }
    }

    buildEnemyPartyFromGroup(groupId) {
        const groupData = ENEMY_GROUPS[groupId];
        if (!groupData) {
            console.error(`EncounterManager: Enemy group ${groupId} not found.`);
            return [];
        }
        return this.buildEnemyParty(groupData.enemies);
    }
    
    buildEnemyParty(enemyIdArray) {
         const enemyParty = [];
        enemyIdArray.forEach(enemyId => {
            const enemyBase = ENEMIES_DATA[enemyId];
            if (enemyBase) {
                // Create a unique instance for combat
                const enemyInstance = JSON.parse(JSON.stringify(enemyBase)); // Deep clone
                enemyInstance.instanceId = `enemy_${enemyId}_${Date.now()}_${getRandomInt(1000,9999)}`;
                enemyInstance.stats.currentHp = enemyInstance.stats.maxHp; // Ensure full health
                enemyInstance.stats.currentMp = enemyInstance.stats.maxMp || 0; // Ensure MP full or 0
                enemyInstance.statusEffects = []; // Initialize status effects array
                enemyParty.push(enemyInstance);
            } else {
                console.warn(`EncounterManager: Enemy ID ${enemyId} not found in ENEMIES_DATA.`);
            }
        });
        return enemyParty;
    }

    // Call this when a fixed encounter is won
    markFixedEncounterAsCleared(fixedEncounterId) {
        playerManager.gameState.flags.set(`${fixedEncounterId}_cleared`, true);
         // Also, if the fixed encounter was tied to a location ID (e.g. "ruined_outpost_interior_fixed_encounter")
        // We might want a more generic flag like "locationId_fixed_encounter_cleared"
        const locationPart = fixedEncounterId.split('_fixed_encounter')[0];
        if (locationPart) {
            playerManager.gameState.flags.set(`${locationPart}_fixed_encounter_cleared`, true);
        }
    }
}

export const encounterManager = new EncounterManager();
