// js/saveManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { CONFIG } from './utils.js'; 

const SAVE_KEY_PREFIX = "luminaAlteyn_v0.5_save_"; 

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
        // If already in combat, don't allow new game start easily
        if (playerManager.gameState.inCombat) {
            eventBus.publish('uiNotification', {message: "Cannot start a new game during combat.", type: "error"});
            return;
        }
        eventBus.publish('showModal', {
            title: "New Game Confirmation",
            content: "<p>Are you sure you want to start a new game? Any unsaved progress will be lost.</p>",
            actions: [
                { text: "Yes, Start New Game", callback: () => {
                    localStorage.removeItem(SAVE_KEY_PREFIX + "default");
                    eventBus.publish('hideModal');
                    eventBus.publish('requestNewGame'); 
                }, className: "danger" },
                { text: "No, Cancel", callback: () => eventBus.publish('hideModal') }
            ]
        });
    }

    saveGame(slotName = "default") {
        try {
            if (playerManager.gameState.inCombat) {
                eventBus.publish('uiNotification', { message: "Cannot save during combat.", type: 'error' });
                return;
            }
            const gameState = playerManager.getState(); 
            localStorage.setItem(SAVE_KEY_PREFIX + slotName, JSON.stringify(gameState));
            eventBus.publish('uiNotification', { message: `Game saved to slot '${slotName}'.`, type: 'success' });
        } catch (error) {
            console.error("Error saving game:", error);
            eventBus.publish('uiNotification', { message: "Failed to save game. " + error.message, type: 'error' });
        }
    }

    loadGame(slotName = "default") {
        try {
             if (playerManager.gameState.inCombat) {
                eventBus.publish('uiNotification', { message: "Cannot load game during combat.", type: 'error' });
                return;
            }
            const savedDataString = localStorage.getItem(SAVE_KEY_PREFIX + slotName);
            if (savedDataString) {
                const savedState = JSON.parse(savedDataString);
                playerManager.loadState(savedState); 
                eventBus.publish('uiNotification', { message: `Game loaded from slot '${slotName}'.`, type: 'success' });
            } else {
                eventBus.publish('uiNotification', { message: `No save data found in slot '${slotName}'. Starting new game.`, type: 'system' });
                eventBus.publish('requestNewGame');
            }
        } catch (error) {
            console.error("Error loading game:", error);
            eventBus.publish('uiNotification', { message: "Failed to load game data. It might be corrupted. " + error.message, type: 'error' });
            eventBus.publish('requestNewGame'); 
        }
    }

    checkForAutoLoad(slotName = "default") {
        const savedDataString = localStorage.getItem(SAVE_KEY_PREFIX + slotName);
        if (savedDataString) {
             eventBus.publish('showModal', {
                title: "Welcome Back!",
                content: "<p>Saved data found. Would you like to continue your adventure or start anew?</p>",
                actions: [
                    { text: "Continue Game", callback: () => {
                         eventBus.publish('hideModal');
                         this.loadGame(slotName); // This loads the game and should NOT play the animated intro
                    }, className: "primary button-glow-continue" },
                    { text: "Start New Game", callback: () => {
                        localStorage.removeItem(SAVE_KEY_PREFIX + slotName); 
                        eventBus.publish('hideModal');
                        eventBus.publish('requestNewGame'); // This will trigger the animated intro
                    }, className: "button-glow-new" }
                ],
                preventOverlayClose: true // Prevent closing by clicking outside
            });
        } else {
            eventBus.publish('requestNewGame'); 
        }
    }
}

export const saveManager = new SaveManager();
