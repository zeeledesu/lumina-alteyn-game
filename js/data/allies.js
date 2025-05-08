// js/data/allies.js
import { SKILLS_DATA } from './skills.js'; 

export const ALLY_DATA = {
    sansan_dino: {
        id: "sansan_dino",
        name: "Sansan", // Changed name to just Sansan for simplicity in UI
        classId: "dino_guardian", 
        level: 10,
        baseStats: { // These stats contribute to the class base + level scaling
            str: 25, dex: 15, con: 30, int: 10, wis: 12, cha: 18,
            hp: 200, mp: 50, mpRegen: 1,
            attack: 0, // Derived
            defense: 0, // Derived
        },
        skills: ["skill_dino_roar_taunt", "skill_protective_aura", "skill_dino_bash"], // Starting skills
        equipment: { // Example starting equipment defined in items.js
            weapon: "w010_primal_club", 
            body: "a010_thick_hide_armor"
        },
        aiProfile: "guardian_dps", // Used only if not player-controlled
        isUnobtainablePlayerAlly: true,
        // Player control is determined by playerManager based on player name/gender
        dialogueTriggers: { 
            missYouPrompt: "I miss you baby ko",
            loveYouPrompt1: "baby ko i love you", 
            loveYouPrompt2: "i love you baby ko", 
            proposalPrompt: "I love you gid so much... will you be my forever?",
            hugReply: "*hugs Cutiepatotie tight with kisses*",
            loveReply1: "I love you so much please kita lang okay? kita lang gid asta sa ulihit.. i love you.. baby? sabta ko or bite bite roror",
            loveReply2: "*kisses Cutiepatotie on her cheeks*",
            proposalAcceptReply: "I love you gid so much... *Gets on one knee, a small, glowing box in his hand.* Will you be my forever?",
            negativeResponse1: "...",
            negativeResponse2: "ok...",
            leavePartyMessage: "*Sansan looks heartbroken, his form flickering. He slowly fades away...*",
        }
    }
};

export const ALLY_CLASSES = {
     dino_guardian: {
        name: "Dino Guardian",
        isAllyOnly: true, // Mark as not selectable by player
        description: "A primeval protector, channeling the might of ancient beasts to shield their charge.",
        baseStats: { // Base stats for the class itself
            str: 20, dex: 12, con: 25, int: 8, wis: 10, cha: 15,
            hp: 150, mp: 30, mpRegen: 0.5
        },
        skillProgression: { // Skills learned by level up
            1: ["skill_dino_bash"],
            5: ["skill_dino_roar_taunt"],
            10: ["skill_protective_aura"], 
            15: ["skill_earthshaker_stomp"]
        },
        // The damage redirection passive is handled explicitly in combatManager.applyDamage for now
    }
};
