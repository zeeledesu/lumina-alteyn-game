// js/utils.js

export const CONFIG = {
    DEFAULT_TEXT_SPEED: 20, 
    FAST_TEXT_SPEED: 5,
    INTRO_TEXT_SPEED: 50, 
    GAME_OVER_DELAY: 5000, 
    AI_THINK_DELAY: 1000, // ms for AI "thinking"
    ACTION_ANIMATION_DELAY: 700, // ms for action text display before effect
    POST_ACTION_DELAY: 300, // ms brief pause after action text/effect before next turn
    MULTI_TARGET_EFFECT_DELAY: 200, // ms pause between effects on multiple targets
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

export async function typeEffect(element, text, charDelay = CONFIG.DEFAULT_TEXT_SPEED, clearExisting = true) {
    if (clearExisting) element.innerHTML = '';
    if (!text) return; // Guard against null/undefined text

    // Simple textContent update for general messages to avoid animation conflicts
    // The intro sequence will rely solely on CSS for its animation.
    const chars = text.split('');
    for (let i = 0; i < chars.length; i++) {
        element.textContent += chars[i];
        if (chars[i] !== ' ') { 
            await delay(charDelay);
        }
    }
}

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

export function generateId(prefix = 'id_') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}
