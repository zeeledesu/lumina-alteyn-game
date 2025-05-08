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
            
            if (nextLocation.condition && !nextLocation.condition(playerManager)) {
                const message = nextLocation.onEnterMessage || "You cannot go that way right now.";
                eventBus.publish('uiNotification', { message: message, type: 'error' });
                // Call onEnter even if blocked, if it's defined, as it might have its own message
                if (typeof nextLocation.onEnter === 'function') {
                    nextLocation.onEnter(eventBus.publish.bind(eventBus, 'addMessage'), playerManager); // Pass a simplified UIMessage function
                }
                return false;
            }

            const oldLocationId = playerManager.gameState.currentLocationId;
            playerManager.gameState.currentLocationId = nextLocationId;
            
            // locationChanged event will be published AFTER encounter check in V0.5
            // The encounterManager listens to locationChanged.
            // For V0.5, let encounterManager handle encounter checks on 'locationChanged'
            eventBus.publish('locationChanged', { newLocationId: nextLocationId, oldLocationId }); // Corrected: use nextLocationId

            // Call onEnter for the new location (after encounter check if encounters happen before full entry description)
            // If encounters are immediate upon trying to enter, this onEnter might be too late for flavor text.
            // For now, onEnter happens after potential encounter.
            if (typeof nextLocation.onEnter === 'function') {
                // Pass a simple function for adding messages to UI, not the whole UIManager
                nextLocation.onEnter({ addMessage: (text, type) => eventBus.publish('addMessage', {text, type}) }, playerManager);
            }
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

    // Helper for interactions that might need world context
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
