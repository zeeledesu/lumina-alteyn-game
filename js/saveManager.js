// js/saveManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { CONFIG } from './utils.js'; // For game over delay

const SAVE_KEY_PREFIX = "luminaAlteyn_v0.5_save_"; // Updated key for new version

class SaveManager {
    constructor() {
        this.bindMenuButtons();
    }

    bindMenuButtons() {
        document.getElementById('save-button')?.addEventListener('click', () => this.saveGame());
        document.getElementById('load-button')?.addEventListener('click', () => this.loadGame());
        document.getElementById('new-game-button')?.addEventListener('click', () => this.confirmNewGame());
        document.getElementById('help-button')?.addEventListener('click', () => eventBus.publish('parseInput', 'help'));
    }
    
    confirmNewGame() {
        eventBus.publish('showModal', {
            title: "New Game Confirmation",
            content: "<p>Are you sure you want to start a new game? Any unsaved progress will be lost.</p>",
            actions: [
                { text: "Yes, Start New Game", callback: () => {
                    localStorage.removeItem(SAVE_KEY_PREFIX + "default");
                    eventBus.publish('hideModal');
                    eventBus.publish('requestNewGame'); // main.js will listen and reset/start creation
                }, className: "danger" },
                { text: "No, Cancel", callback: () => eventBus.publish('hideModal') }
            ]
        });
    }

    saveGame(slotName = "default") {
        try {
            // Ensure player is not in combat before saving critical state
            if (playerManager.gameState.inCombat) {
                eventBus.publish('uiNotification', { message: "Cannot save during combat.", type: 'error' });
                return;
            }
            const gameState = playerManager.getState(); // playerManager now handles Map to Array conversion
            localStorage.setItem(SAVE_KEY_PREFIX + slotName, JSON.stringify(gameState));
            eventBus.publish('uiNotification', { message: `Game saved to slot '${slotName}'.`, type: 'success' });
        } catch (error) {
            console.error("Error saving game:", error);
            eventBus.publish('uiNotification', { message: "Failed to save game. " + error.message, type: 'error' });
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
                eventBus.publish('uiNotification', { message: `No save data found in slot '${slotName}'. Starting new game.`, type: 'system' });
                eventBus.publish('requestNewGame');
            }
        } catch (error) {
            console.error("Error loading game:", error);
            eventBus.publish('uiNotification', { message: "Failed to load game data. It might be corrupted. " + error.message, type: 'error' });
            // localStorage.removeItem(SAVE_KEY_PREFIX + slotName); // Optionally remove corrupted data
            eventBus.publish('requestNewGame'); // Fallback to new game
        }
    }

    checkForAutoLoad(slotName = "default") {
        const savedDataString = localStorage.getItem(SAVE_KEY_PREFIX + slotName);
        if (savedDataString) {
            // Ask user if they want to continue or start new
             eventBus.publish('showModal', {
                title: "Continue Game?",
                content: "<p>Saved data found. Would you like to continue your previous game or start a new one?</p>",
                actions: [
                    { text: "Continue Game", callback: () => {
                         eventBus.publish('hideModal');
                         this.loadGame(slotName);
                    }, className: "primary" },
                    { text: "Start New Game", callback: () => {
                        localStorage.removeItem(SAVE_KEY_PREFIX + slotName); // Clear if starting new
                        eventBus.publish('hideModal');
                        eventBus.publish('requestNewGame');
                    } }
                ]
            });
        } else {
            eventBus.publish('requestNewGame'); // No save data, start new game process
        }
    }
}

export const saveManager = new SaveManager();
