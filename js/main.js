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
import { encounterManager } from './encounterManager.js'; 
import { CONFIG } from './utils.js';

class Game {
    constructor() {
        console.log("Lumina Alteyn V0.5 Initializing...");
        this.setupGlobalErrorHandling();
        
        eventBus.subscribe('requestNewGame', () => this.initiateNewGame());
        
        saveManager.checkForAutoLoad(); 
        
        console.log("Game Initialized. Waiting for player setup or load.");
    }

    initiateNewGame() {
        playerManager.resetGameState(); 
        uiManager.startAnimatedIntro(); 
    }

    setupGlobalErrorHandling() {
        window.onerror = (message, source, lineno, colno, error) => {
            console.error("Unhandled Global Error:", { message, source, lineno, colno, error });
            const errorMsg = `An unexpected error occurred: ${message}. Source: ${source}:${lineno}.`;
            // Check if uiManager is available and has addMessage
            if (uiManager && typeof uiManager.addMessage === 'function') {
                uiManager.addMessage(errorMsg, 'error-message');
            }
            return true; 
        };

        window.onunhandledrejection = (event) => {
            console.error("Unhandled Promise Rejection:", event.reason);
            const reasonMsg = event.reason?.message || JSON.stringify(event.reason);
            if (uiManager && typeof uiManager.addMessage === 'function') {
                uiManager.addMessage(`An unhandled promise rejection occurred: ${reasonMsg}.`, 'error-message');
            }
        };
    }
}

const luminaAlteyn = new Game();
