// js/saveManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';

const SAVE_KEY_PREFIX = "luminaAlteyn_save_";

class SaveManager {
    constructor() {
        this.bindMenuButtons();
    }

    bindMenuButtons() {
        document.getElementById('save-button')?.addEventListener('click', () => this.saveGame());
        document.getElementById('load-button')?.addEventListener('click', () => this.loadGame());
        document.getElementById('new-game-button')?.addEventListener('click', () => this.confirmNewGame());
    }
    
    confirmNewGame() {
        // In a real game, use a modal for confirmation
        if (confirm("Are you sure you want to start a new game? Any unsaved progress will be lost.")) {
            localStorage.removeItem(SAVE_KEY_PREFIX + "default"); // Clear default save
            eventBus.publish('startCharacterCreation');
        }
    }

    saveGame(slotName = "default") {
        try {
            const gameState = playerManager.getState();
            localStorage.setItem(SAVE_KEY_PREFIX + slotName, JSON.stringify(gameState));
            eventBus.publish('uiNotification', { message: `Game saved to slot '${slotName}'.`, type: 'success' });
        } catch (error) {
            console.error("Error saving game:", error);
            eventBus.publish('uiNotification', { message: "Failed to save game.", type: 'error' });
        }
    }

    loadGame(slotName = "default") {
        try {
            const savedDataString = localStorage.getItem(SAVE_KEY_PREFIX + slotName);
            if (savedDataString) {
                const savedState = JSON.parse(savedDataString);
                playerManager.loadState(savedState); // PlayerManager handles updating itself and publishing events
                eventBus.publish('uiNotification', { message: `Game loaded from slot '${slotName}'.`, type: 'success' });
            } else {
                eventBus.publish('uiNotification', { message: `No save data found in slot '${slotName}'. Starting new game.`, type: 'error' });
                eventBus.publish('startCharacterCreation'); // Or handle differently
            }
        } catch (error) {
            console.error("Error loading game:", error);
            eventBus.publish('uiNotification', { message: "Failed to load game data. It might be corrupted.", type: 'error' });
            localStorage.removeItem(SAVE_KEY_PREFIX + slotName); // Remove corrupted data
            eventBus.publish('startCharacterCreation'); // Fallback to new game
        }
    }

    checkForAutoLoad(slotName = "default") {
        const savedDataString = localStorage.getItem(SAVE_KEY_PREFIX + slotName);
        if (savedDataString) {
            this.loadGame(slotName);
        } else {
            // No save data, start character creation process
            eventBus.publish('startCharacterCreation');
        }
    }
}

export const saveManager = new SaveManager();