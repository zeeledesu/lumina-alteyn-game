// js/main.js
import { eventBus } from './eventManager.js';
import { uiManager } from './uiManager.js'; // Initializes itself
import { playerManager } from './playerManager.js'; // Initializes itself
import { worldManager } from './worldManager.js'; // Initializes itself
import { inputParser } from './inputParser.js'; // Initializes itself
import { saveManager } from './saveManager.js'; // Initializes itself and binds menu buttons
import { combatManager } from './combatManager.js'; // Initializes itself
import { questManager } from './questManager.js'; // Initializes itself

class Game {
    constructor() {
        console.log("Lumina Alteyn V0.1 Initializing...");
        this.setupGlobalErrorHandling();
        // Attempt to autoload game or start character creation
        saveManager.checkForAutoLoad();
        console.log("Game Initialized.");
    }

    setupGlobalErrorHandling() {
        window.onerror = function(message, source, lineno, colno, error) {
            console.error("Global error caught:", message, source, lineno, colno, error);
            uiManager.addMessage(`An unexpected error occurred: ${message}. Please try reloading or starting a new game if issues persist.`, 'error-message');
            // Optionally, try to save game state or offer to.
            // saveManager.saveGame('error_autosave');
            return true; // Prevents default browser error handling
        };
        window.onunhandledrejection = function(event) {
            console.error("Unhandled promise rejection:", event.reason);
            uiManager.addMessage(`An unhandled promise rejection occurred: ${event.reason?.message || event.reason}.`, 'error-message');
        };
    }
}

// Initialize the game
const luminaAlteyn = new Game();