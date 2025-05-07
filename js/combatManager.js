// js/combatManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
// import { ENEMIES_DATA } from './data/enemies.js'; // For later

class CombatManager {
    constructor() {
        this.inCombat = false;
        this.currentEnemies = [];
        // eventBus.subscribe('startCombat', (enemyGroup) => this.startCombat(enemyGroup));
    }

    startCombat(enemyGroupData) {
        // This is where you'd initialize enemies based on enemyGroupData
        // For V0.1, combat is not implemented.
        eventBus.publish('uiNotification', { message: "Combat system not yet implemented.", type: 'system' });
    }

    // Player actions (attack, skill, item, flee) would go here
    // Enemy turn logic
    // Victory/Defeat conditions
}

export const combatManager = new CombatManager();