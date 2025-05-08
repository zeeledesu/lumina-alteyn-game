// js/eventManager.js
class EventManager {
    constructor() {
        this.listeners = {};
    }

    subscribe(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    unsubscribe(eventName, callback) {
        if (!this.listeners[eventName]) return;

        this.listeners[eventName] = this.listeners[eventName].filter(
            listener => listener !== callback
        );
    }

    publish(eventName, data) {
        if (!this.listeners[eventName]) return;

        this.listeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${eventName}:`, error, "Data:", data);
            }
        });
    }
}

export const eventBus = new EventManager();
