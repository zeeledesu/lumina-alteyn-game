// js/worldManager.js
import { eventBus } from './eventManager.js';
import { LOCATIONS_DATA } from './data/locations.js';
import { playerManager } from './playerManager.js'; // To check conditions

class WorldManager {
    constructor() {
        this.locations = LOCATIONS_DATA;
    }

    getCurrentLocation() {
        const currentLocationId = playerManager.gameState.currentLocationId;
        return this.locations[currentLocationId];
    }

    move(direction) {
        const currentLocation = this.getCurrentLocation();
        if (!currentLocation) return false;

        const nextLocationId = currentLocation.exits[direction.toLowerCase()];
        if (nextLocationId && this.locations[nextLocationId]) {
            const nextLocation = this.locations[nextLocationId];
            // Check entry conditions for the next location
            if (nextLocation.condition && !nextLocation.condition(playerManager)) {
                 if (typeof nextLocation.onEnter === 'function') { // Allow onEnter to display a custom message
                    if (nextLocation.onEnter(eventBus, playerManager) === false) { // if onEnter returns false, it might mean blocked
                        // Message already handled by onEnter usually
                        return false;
                    }
                 } else {
                    eventBus.publish('uiNotification', { message: "You cannot go that way right now.", type: 'error' });
                 }
                return false;
            }

            const oldLocationId = playerManager.gameState.currentLocationId;
            playerManager.gameState.currentLocationId = nextLocationId;
            eventBus.publish('locationChanged', { newLocationId, oldLocationId });
            
            if (typeof nextLocation.onEnter === 'function') {
                nextLocation.onEnter(eventBus, playerManager); // Pass eventBus or UIManager if direct DOM manipulation is needed
            }
            return true;
        }
        eventBus.publish('uiNotification', { message: "You can't go that way.", type: 'error' });
        return false;
    }

    getLocationData(locationId) {
        return this.locations[locationId];
    }
}

export const worldManager = new WorldManager();