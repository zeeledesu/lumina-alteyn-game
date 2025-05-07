// js/utils.js
export function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollPercentage(chance) {
    return Math.random() * 100 < chance;
}

export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Simple promise-based delay for animations
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Typing effect for a single paragraph
export async function typeEffect(element, text, charDelay = 30) {
    element.innerHTML = ''; // Clear existing content
    const chars = text.split('');
    for (let i = 0; i < chars.length; i++) {
        const span = document.createElement('span');
        span.textContent = chars[i];
        span.style.animationDelay = `${i * (charDelay / 1000)}s`;
        element.appendChild(span);
        if (chars[i] === ' ' || chars[i] === '.' || chars[i] === ',') {
             // No extra delay for spaces/punctuation in this simple version
        } else {
            await delay(charDelay); // Wait for character "typing" time
        }
    }
}