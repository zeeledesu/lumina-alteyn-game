// js/utils.js

export const CONFIG = {
    DEFAULT_TEXT_SPEED: 20, // ms per character (faster)
    FAST_TEXT_SPEED: 5,
    INTRO_TEXT_SPEED: 50, // Slower for intro lore
    GAME_OVER_DELAY: 5000, // ms before reload/reset on game over
};

export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollPercentage(chance) {
    return Math.random() * 100 < chance;
}

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Improved type effect for a single element, character by character
export async function typeEffect(element, text, charDelay = CONFIG.DEFAULT_TEXT_SPEED, clearExisting = true) {
    if (clearExisting) element.innerHTML = '';

    const chars = text.split('');
    for (let i = 0; i < chars.length; i++) {
        const span = document.createElement('span');
        span.textContent = chars[i];
        span.style.opacity = '0'; // Start invisible
        element.appendChild(span);

        // Simple sequential fade-in, could be more complex with requestAnimationFrame
        await delay(charDelay / 2); // Small delay before fade-in starts
        span.style.transition = `opacity ${charDelay / 1000 * 2}s ease-in-out`;
        span.style.opacity = '1';
        
        if (chars[i] !== ' ') { // Only "pause" for actual characters
            await delay(charDelay);
        }
    }
}

// Animate text by revealing words or phrases - good for titles or short messages
export async function animateText(element, text, wordDelay = 150, clearExisting = true) {
    if (clearExisting) element.innerHTML = '';
    const words = text.split(' ');
    for (const word of words) {
        const span = document.createElement('span');
        span.textContent = word + ' ';
        span.style.opacity = '0';
        span.style.transform = 'translateY(10px)';
        span.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        element.appendChild(span);
        await delay(wordDelay / 2);
        span.style.opacity = '1';
        span.style.transform = 'translateY(0)';
        await delay(wordDelay);
    }
}

// Generate a simple unique ID
export function generateId(prefix = 'id_') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
