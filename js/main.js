// js/main.js
import { eventBus } from './eventManager.js';
import { uiManager } from './uiManager.js';
import { playerManager } from './playerManager.js';
import { worldManager } from './worldManager.js';
import { inputParser } from './inputParser.js';
import { saveManager } from './saveManager.js';
import { combatManager } from './combatManager.js';
import { questManager } from './questManager.js';
import { aiManager } from './aiManager.js';
import { encounterManager } from './encounterManager.js'; // Initialize
import { CONFIG } from './utils.js';

class Game {
    constructor() {
        console.log("Lumina Alteyn V0.5 Initializing...");
        this.setupGlobalErrorHandling();
        
        // Listen for request to start a new game (e.g., from SaveManager or initial load)
        eventBus.subscribe('requestNewGame', () => this.initiateNewGame());
        
        // Attempt to autoload game or start the new game sequence
        saveManager.checkForAutoLoad(); // This will either load or trigger 'requestNewGame'
        
        console.log("Game Initialized. Waiting for player setup or load.");
    }

    initiateNewGame() {
        playerManager.resetGameState(); // Ensure state is clean before new character
        uiManager.startAnimatedIntro(); // This will lead to character creation modal
    }

    setupGlobalErrorHandling() {
        window.onerror = (message, source, lineno, colno, error) => {
            console.error("Unhandled Global Error:", { message, source, lineno, colno, error });
            const errorMsg = `An unexpected error occurred: ${message}. Source: ${source}:${lineno}.`;
            uiManager.addMessage(errorMsg, 'error-message');
            // Consider adding a "Report Error" button or more robust logging here
            // Optionally, attempt an emergency save
            // saveManager.saveGame('emergency_autosave');
            return true; // Suppress default browser error handling
        };

        window.onunhandledrejection = (event) => {
            console.error("Unhandled Promise Rejection:", event.reason);
            const reasonMsg = event.reason?.message || JSON.stringify(event.reason);
            uiManager.addMessage(`An unhandled promise rejection occurred: ${reasonMsg}.`, 'error-message');
        };
    }
}

// Initialize the game
const luminaAlteyn = new Game();
