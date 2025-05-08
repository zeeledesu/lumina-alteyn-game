// js/worldManager.js
import { eventBus } from './eventManager.js';
import { LOCATIONS_DATA } from './data/locations.js';
import { playerManager } from './playerManager.js';

class WorldManager {
    constructor() {
        this.locations = LOCATIONS_DATA;
    }

    getCurrentLocation() {
        const currentLocationId = playerManager.gameState.currentLocationId;
        return this.locations[currentLocationId];
    }

    move(direction) {
        if (playerManager.gameState.inCombat) {
            eventBus.publish('uiNotification', { message: "Cannot move while in combat!", type: 'error' });
            return false;
        }

        const currentLocation = this.getCurrentLocation();
        if (!currentLocation) return false;

        const nextLocationId = currentLocation.exits[direction.toLowerCase()];
        if (nextLocationId && this.locations[nextLocationId]) {
            const nextLocation = this.locations[nextLocationId];
            
            // Check conditions before moving
            if (nextLocation.condition && !nextLocation.condition(playerManager)) {
                // Use conditionFailMessage if available, otherwise a default
                const message = nextLocation.conditionFailMessage || nextLocation.onEnterMessage || `You cannot go ${direction} right now.`;
                eventBus.publish('uiNotification', { message: message, type: 'error' });
                
                // Optional: Still trigger onEnter if it has specific messages for blocked entry
                if (typeof nextLocation.onEnter === 'function' && nextLocation.onEnterMessage) {
                    nextLocation.onEnter({ addMessage: (text, type) => eventBus.publish('addMessage', {text, type}) }, playerManager);
                }
                return false;
            }

            const oldLocationId = playerManager.gameState.currentLocationId;
            playerManager.gameState.currentLocationId = nextLocationId;
            
            // Publish locationChanged - EncounterManager will check for encounters based on this
            eventBus.publish('locationChanged', { newLocationId: nextLocationId, oldLocationId }); 

            // UIManager will display the location AFTER encounters are resolved (or not triggered)
            // Call onEnter logic for the new location
            if (typeof nextLocation.onEnter === 'function') {
                nextLocation.onEnter({ addMessage: (text, type) => eventBus.publish('addMessage', {text, type}) }, playerManager);
            }
            // Display first visit message if applicable
            if (nextLocation.firstVisitMessage && !playerManager.gameState.flags.get(`visited_${nextLocationId}`)) {
                eventBus.publish('addMessage', {text: nextLocation.firstVisitMessage, type: 'lore-message'});
                playerManager.gameState.flags.set(`visited_${nextLocationId}`, true);
            }

            return true;
        }
        eventBus.publish('uiNotification', { message: "You can't go that way.", type: 'error' });
        return false;
    }

    getLocationData(locationId) {
        return this.locations[locationId];
    }

    // Helper for interactions that might need world context (e.g., searching)
    triggerLocationInteraction(interactionId) {
        const location = this.getCurrentLocation();
        if (!location || !location.interactions) return;
        const interaction = location.interactions.find(i => i.id === interactionId);
        if (interaction && interaction.execute) {
             // Pass a simplified UI for messages, not the whole UIManager
            interaction.execute(playerManager, { addMessage: (text, type) => eventBus.publish('addMessage', {text, type}), renderActionButtons: (btns) => eventBus.publish('showActionButtons', btns) });
        }
    }
}

export const worldManager = new WorldManager();
