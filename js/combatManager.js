// js/combatManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { aiManager } from './aiManager.js';
import { SKILLS_DATA, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ITEMS_DATA } from './data/items.js';
import { getRandomInt, delay, CONFIG, rollPercentage } from './utils.js'; // Added rollPercentage
import { encounterManager } from './encounterManager.js';
import { ENEMIES_DATA, ALLY_DATA } from './data/enemies.js'; // ALLY_DATA needed for Sansan's redirect, ENEMIES_DATA for rewards


class CombatManager {
    constructor() {
        this.resetCombatState();
        eventBus.subscribe('startCombat', (data) => this.startCombat(data.enemies, data.fixedEncounterId));
        eventBus.subscribe('combatAction', (action) => this.processAction(action));
        eventBus.subscribe('playerSelectedCombatTarget', (targetId) => this.playerSelectsTarget(targetId)); // Added listener
    }

    resetCombatState() {
        this.isActive = false;
        this.playerParty = []; // { instanceId, name, stats, skills, statusEffects, isPlayer, isAlly, allyId }
        this.enemyParty = [];  // { instanceId, name, stats, skills, statusEffects }
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.currentActor = null;
        this.roundCount = 0;
        this.fixedEncounterId = null; // For marking fixed encounters as cleared
        this.pendingPlayerAction = null; // For multi-stage actions like skill target selection
    }

    startCombat(enemyGroup, fixedEncounterId = null) {
        if (this.isActive) {
            console.warn("CombatManager: Attempted to start combat while already active.");
            return;
        }
        this.resetCombatState();
        this.isActive = true;
        playerManager.gameState.inCombat = true;
        this.fixedEncounterId = fixedEncounterId;

        // Populate player party
        const playerData = playerManager.getPublicData();
        this.playerParty.push({
            instanceId: playerData.instanceId || "player_0", // Ensure player has an instanceId
            name: playerData.name,
            stats: { ...playerData.derivedStats }, // Take a snapshot of stats for combat start
            maxStats: { maxHp: playerData.derivedStats.maxHp, maxMp: playerData.derivedStats.maxMp }, // Store max values
            skills: playerData.skills.map(s => s.id),
            statusEffects: [], // Initialize player status effects for combat
            isPlayer: true,
            classId: playerData.classId
        });

        playerData.allies.forEach(allyData => {
            if (allyData.derivedStats.currentHp > 0) { // Only include living allies
                this.playerParty.push({
                    instanceId: allyData.instanceId,
                    name: allyData.name,
                    allyId: allyData.allyId, // Store original allyId
                    id: allyData.allyId, // For AI manager access
                    stats: { ...allyData.derivedStats },
                    maxStats: { maxHp: allyData.derivedStats.maxHp, maxMp: allyData.derivedStats.maxMp },
                    skills: allyData.skills.map(s => SKILLS_DATA[s]?.id || s), // Ensure it's skill IDs
                    statusEffects: [],
                    isAlly: true,
                    classId: allyData.classId,
                    aiProfile: ALLY_DATA[allyData.allyId]?.aiProfile // Add AI Profile for allies
                });
            }
        });

        // Populate enemy party (enemyGroup is an array of enemy objects from EncounterManager)
        this.enemyParty = enemyGroup.map(enemy => ({
            ...enemy, // Includes instanceId, name, stats, skills, aiProfile from EncounterManager
            maxStats: { maxHp: enemy.stats.maxHp, maxMp: enemy.stats.maxMp || 0 },
            statusEffects: enemy.statusEffects || [], // Ensure it exists
        }));


        this.determineTurnOrder();
        this.roundCount = 1;
        eventBus.publish('combatStarted', this.getCombatState());
        this.nextTurn();
    }

    determineTurnOrder() {
        this.turnOrder = [...this.playerParty, ...this.enemyParty]
            .filter(c => c.stats.currentHp > 0)
            .sort((a, b) => (b.stats.speed || 0) - (a.stats.speed || 0)); // Highest speed first
        this.currentTurnIndex = 0;
    }

    async nextTurn() {
        if (!this.isActive) return;

        // Apply DoTs / HoTs / decrement status effect durations
        for (const combatant of [...this.playerParty, ...this.enemyParty]) {
            if (combatant.stats.currentHp > 0) {
                await this.tickStatusEffects(combatant);
            }
        }
        // Remove dead combatants from turn order and parties
        this.cleanupDeadCombatants();


        if (this.checkCombatEnd()) return;

        // Re-determine turn order if speeds might have changed or combatants died
        // For simplicity now, just advance index or reset if end of round
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.roundCount++;
            this.determineTurnOrder(); // Re-calculate at start of new round
            eventBus.publish('combatLog', {text: `--- Round ${this.roundCount} ---`, type: "system-message highlight-color"});
            eventBus.publish('combatRoundAdvanced', { round: this.roundCount, combatState: this.getCombatState() });
        }
        
        if (this.turnOrder.length === 0) { // Should be caught by checkCombatEnd, but safety
            this.endCombat(false); // Or based on who is left
            return;
        }

        this.currentActor = this.turnOrder[this.currentTurnIndex];

        // Skip turn if actor is stunned or incapacitated
        if (this.currentActor.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.blocksTurn)) {
            eventBus.publish('combatLog', { text: `${this.currentActor.name} is stunned and cannot act!`, type: 'system' });
            await delay(CONFIG.DEFAULT_TEXT_SPEED * 10);
            this.currentTurnIndex++;
            this.nextTurn();
            return;
        }
        
        eventBus.publish('combatTurnAdvanced', { currentTurnActor: this.currentActor, combatState: this.getCombatState() });

        if (this.currentActor.isPlayer) {
            // UI will show player action choices
            eventBus.publish('playerTurnStarted', { combatState: this.getCombatState() });
        } else if (this.currentActor.isAlly) {
            const action = aiManager.getCombatAction(this.currentActor, this.playerParty, this.enemyParty);
            await delay(CONFIG.AI_THINK_DELAY); // Simulate AI thinking
            this.processAction(action);
        } else { // Enemy turn
            const action = aiManager.getCombatAction(this.currentActor, this.playerParty, this.enemyParty);
            await delay(CONFIG.AI_THINK_DELAY); // Simulate AI thinking
            this.processAction(action);
        }
    }

    async processAction(action) {
        if (!this.isActive || !this.currentActor ) {
            console.warn("CombatManager: processAction called while inactive or no current actor.");
             return;
        }
        
        // Validate caster matches current turn actor, unless it's a player-commanded ally (future feature)
        if (action.casterId !== this.currentActor.instanceId && !action.isPlayerCommandedAlly) {
            console.warn("Action caster mismatch:", action, this.currentActor);
            // If it's player's turn and the action is not for the player, don't process, let player retry.
            if (this.currentActor.isPlayer) {
                eventBus.publish('playerTurnStarted', { combatState: this.getCombatState(), retry: true });
                return;
            }
            // If AI turn, this is an AI logic error, advance turn to prevent freeze.
            this.currentTurnIndex++;
            this.nextTurn();
            return;
        }
        
        const caster = this.findCombatant(action.casterId);
        if (!caster || caster.stats.currentHp <= 0) {
             this.currentTurnIndex++; this.nextTurn(); return; // Caster is dead or invalid
        }

        let success = false;
        switch (action.type) {
            case 'attack':
                success = await this.executeAttack(caster, this.findCombatant(action.targetId));
                break;
            case 'skill':
                success = await this.executeSkill(caster, action.skillId, action.targetId);
                break;
            case 'item':
                success = await this.executeItem(caster, action.itemInstanceId, action.targetId);
                break;
            case 'flee':
                success = await this.executeFlee(caster);
                break;
            case 'pass': 
                eventBus.publish('combatLog', { text: `${caster.name} takes a moment to observe.`, type: 'system' });
                success = true;
                break;
            default:
                eventBus.publish('combatLog', { text: `Unknown action type: ${action.type}`, type: 'error' });
        }
        
        // If action was successful or turn should pass
        if (success || action.type === 'pass' || (action.type === 'flee' && this.isActive) ) { // Flee ends combat, so turn advances implicitly
            // Decrement duration of "on next attack" buffs if used by an attack/skill
            if (action.type === 'attack' || (action.type === 'skill' && SKILLS_DATA[action.skillId]?.type.includes('attack'))) {
                this.decrementSingleActionBuffs(caster);
            }

            this.currentTurnIndex++;
            if (!this.checkCombatEnd()) { // Only call nextTurn if combat isn't over
                 await delay(CONFIG.POST_ACTION_DELAY); 
                 this.nextTurn();
            }
        } else {
            // Action failed (e.g. not enough MP, invalid target), player might get another chance or turn ends.
             if (caster.isPlayer && !this.pendingPlayerAction) {
                eventBus.publish('playerTurnStarted', { combatState: this.getCombatState(), retry: true }); // Allow player to retry
            } else {
                this.currentTurnIndex++; // If AI or unrecoverable player error, advance turn
                if (!this.checkCombatEnd()) this.nextTurn();
            }
        }
    }

    async executeAttack(caster, target) {
        if (!target || target.stats.currentHp <= 0) {
            eventBus.publish('combatLog', { text: `${caster.name} attacks, but ${target ? target.name : 'the target'} is already defeated!`, type: 'system' });
            return true; 
        }
        
        let actualTarget = target;
        const playerChar = this.playerParty.find(p => p.isPlayer);
        const sansanAlly = this.playerParty.find(p => p.allyId === ALLY_DATA.sansan_dino.id && p.stats.currentHp > 0);

        if (playerChar && target.instanceId === playerChar.instanceId && 
            caster.instanceId !== sansanAlly?.instanceId && // Sansan doesn't redirect his own beneficial actions
            sansanAlly &&
            playerManager.isPlayerCharacter("Cutiepatotie") ) { // Sansan only protects Cutiepatotie this way
            eventBus.publish('combatLog', { text: `Sansan intercepts the attack meant for ${playerChar.name}!`, type: 'ally-special combat-ally' });
            actualTarget = sansanAlly;
        }


        eventBus.publish('combatLog', { text: `${caster.name} attacks ${actualTarget.name}!`, type: caster.isPlayer || caster.isAlly ? 'combat-player' : 'combat-enemy' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);

        const hitChance = (caster.stats.accuracy || 75) - (actualTarget.stats.evasion || 5);
        if (!rollPercentage(Math.max(5, Math.min(95, hitChance)))) { 
            eventBus.publish('combatLog', { text: `...but misses!`, type: 'combat-miss' });
            return true;
        }

        let damage = Math.max(1, Math.floor(
            (caster.stats.attack || 5) * (1 + getRandomInt(-10, 10)/100) - 
            (actualTarget.stats.defense || 0) / 2 
        ));

        let isCrit = false;
        if (caster.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.specialFlags?.includes('guaranteed_crit_next_attack'))) {
            isCrit = true;
        } else {
            isCrit = rollPercentage(caster.stats.critChance || 5);
        }

        if (isCrit) {
            damage = Math.floor(damage * 1.75); 
            eventBus.publish('combatLog', { text: `CRITICAL HIT!`, type: 'combat-crit' });
        }

        this.applyDamage(actualTarget, damage, caster);
        return true;
    }

    async executeSkill(caster, skillId, targetId) {
        const skillData = SKILLS_DATA[skillId];
        if (!skillData) {
            eventBus.publish('combatLog', { text: `${caster.name} tries to use an unknown skill!`, type: 'error' });
            return false; 
        }

        if (caster.stats.currentMp < skillData.mpCost) {
            eventBus.publish('combatLog', { text: `${caster.name} doesn't have enough MP for ${skillData.name}!`, type: 'warning-message' });
            if (caster.isPlayer) return false; 
            return true; 
        }
        
        const playerEquipment = caster.isPlayer ? playerManager.getEquippedItemsData() : null;
        const casterEquipment = caster.isAlly ? playerManager.getAllyEquippedItemsData(caster.instanceId) : playerEquipment;

        if (skillData.requiresShield && !(casterEquipment?.offHand && ITEMS_DATA[casterEquipment.offHand.itemId]?.slot === "offHand")) { // Check actual item type
             eventBus.publish('combatLog', { text: `${caster.name} needs a shield to use ${skillData.name}!`, type: 'warning-message' });
             if (caster.isPlayer) return false; return true;
        }
        if (skillData.requiresStatus && !this.targetHasStatusEffect(caster.instanceId, skillData.requiresStatus) ){
             eventBus.publish('combatLog', { text: `${caster.name} is not in the right state to use ${skillData.name}!`, type: 'warning-message' });
             if (caster.isPlayer) return false; return true;
        }


        if (caster.isPlayer) playerManager.spendMp(skillData.mpCost, caster.instanceId); 
        else caster.stats.currentMp -= skillData.mpCost; 

        eventBus.publish('combatLog', { text: `${caster.name} uses ${skillData.name}!`, type: caster.isPlayer || caster.isAlly ? 'combat-player' : 'combat-enemy' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);

        const targets = this.determineSkillTargets(caster, skillData, targetId);
        if ((!targets || targets.length === 0) && !(skillData.target === "self" || skillData.target === "party" || skillData.target.includes("_all") || skillData.target.includes("_aoe"))) {
             eventBus.publish('combatLog', { text: `...but there's no valid target!`, type: 'system' });
             return true; 
        }


        const effects = Array.isArray(skillData.effect) ? skillData.effect : [skillData.effect];
        for (const effect of effects) {
            let currentTargets = targets; 
            if (effect.targetType) { 
                currentTargets = this.determineSkillTargets(caster, { ...skillData, target: effect.targetType }, targetId);
            }

            for (const target of currentTargets) {
                 if (!target || (target.stats.currentHp <= 0 && effect.type !== "revive")) continue; 

                let actualTarget = target;
                const playerChar = this.playerParty.find(p => p.isPlayer);
                const sansanAlly = this.playerParty.find(p => p.allyId === ALLY_DATA.sansan_dino.id && p.stats.currentHp > 0);

                if (playerChar && (effect.type === "damage" || effect.type === "status_effect" && STATUS_EFFECTS_DATA[effect.statusId]?.type === "debuff") && 
                    target.instanceId === playerChar.instanceId && 
                    caster.instanceId !== sansanAlly?.instanceId &&
                    sansanAlly && 
                    playerManager.isPlayerCharacter("Cutiepatotie")) {
                    eventBus.publish('combatLog', { text: `Sansan intercepts the effect of ${skillData.name} meant for ${playerChar.name}!`, type: 'ally-special combat-ally' });
                    actualTarget = sansanAlly;
                }
                
                switch (effect.type) {
                    case 'damage':
                        let damage = 0;
                        const scaleStatValue = caster.stats[effect.scaleStat] !== undefined ? caster.stats[effect.scaleStat] : (caster.attributes && caster.attributes[effect.scaleStat] ? caster.attributes[effect.scaleStat].current : 0);

                        if (effect.basePower) { 
                            damage = effect.basePower + Math.floor(scaleStatValue * effect.scaleFactor);
                        } else if (effect.baseMultiplier) { 
                            damage = Math.floor((caster.stats.attack || 5) * effect.baseMultiplier);
                             if (effect.scaleStat) damage += Math.floor(scaleStatValue * effect.scaleFactor);
                        }
                        damage = Math.max(1, damage - Math.floor((actualTarget.stats.defense || 0) / 2)); 
                        
                        let isCritSkill = false;
                        if (caster.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.specialFlags?.includes('guaranteed_crit_next_attack'))) {
                            isCritSkill = true;
                        } else {
                            isCritSkill = rollPercentage(caster.stats.critChance || 5);
                        }
                        if (isCritSkill) {
                            damage = Math.floor(damage * 1.75);
                            eventBus.publish('combatLog', { text: `CRITICAL HIT on ${actualTarget.name}!`, type: 'combat-crit' });
                        }
                        this.applyDamage(actualTarget, damage, caster, skillData.name);
                        if (effect.splashMultiplier && targetId === actualTarget.instanceId) { 
                           this.applySplashDamage(caster, actualTarget, damage * effect.splashMultiplier, skillData.name);
                        }
                        break;
                    case 'heal':
                        const healScaleStatValue = caster.stats[effect.scaleStat] !== undefined ? caster.stats[effect.scaleStat] : (caster.attributes && caster.attributes[effect.scaleStat] ? caster.attributes[effect.scaleStat].current : 0);
                        const healAmount = effect.basePower + Math.floor(healScaleStatValue * (effect.scaleFactor || 1));
                        this.applyHeal(actualTarget, healAmount, caster, skillData.name);
                        break;
                    case 'status_effect':
                         if (effect.chance === undefined || rollPercentage(effect.chance)) {
                            this.applyStatusEffect(actualTarget, effect.statusId, effect.duration, caster);
                        } else {
                             eventBus.publish('combatLog', { text: `${skillData.name} failed to apply ${STATUS_EFFECTS_DATA[effect.statusId]?.name} to ${actualTarget.name}.`, type: 'system' });
                        }
                        break;
                }
                await delay(CONFIG.MULTI_TARGET_EFFECT_DELAY); 
            }
        }
        return true;
    }
    
    determineSkillTargets(caster, skillData, primaryTargetId) {
        const primaryTarget = this.findCombatant(primaryTargetId);
        switch (skillData.target) {
            case 'self': return [caster];
            case 'enemy_single': return primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly ? [primaryTarget] : (this.enemyParty.find(e => e.stats.currentHp > 0) ? [this.enemyParty.find(e => e.stats.currentHp > 0)] : []); 
            case 'ally_single': return primaryTarget && (primaryTarget.isPlayer || primaryTarget.isAlly) ? [primaryTarget] : (caster.isPlayer || caster.isAlly ? [caster] : []); 
            case 'ally_leader': 
                const leader = this.playerParty.find(p => p.isPlayer);
                return leader ? [leader] : [];
            case 'enemy_all': return this.enemyParty.filter(e => e.stats.currentHp > 0);
            case 'ally_all': return this.playerParty.filter(p => p.stats.currentHp > 0);
            case 'party': return this.playerParty.filter(p => p.stats.currentHp > 0);
            case 'enemy_aoe_2': 
                 const targets = [];
                 if (primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly && primaryTarget.stats.currentHp > 0) targets.push(primaryTarget);
                 else { // If primary invalid, pick first living enemy
                     const firstEnemy = this.enemyParty.find(e => e.stats.currentHp > 0);
                     if (firstEnemy) targets.push(firstEnemy);
                 }
                 const otherEnemies = this.enemyParty.filter(e => e.stats.currentHp > 0 && e.instanceId !== (targets[0]?.instanceId));
                 if (otherEnemies.length > 0 && targets.length < 2) targets.push(otherEnemies[getRandomInt(0, otherEnemies.length -1)]);
                 return targets;
            case 'enemy_single_splash': 
                 return primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly ? [primaryTarget] : (this.enemyParty.find(e => e.stats.currentHp > 0) ? [this.enemyParty.find(e => e.stats.currentHp > 0)] : []);
            case 'enemy_all_self': 
                 return [caster, ...this.enemyParty.filter(e => e.stats.currentHp > 0)];

            default: return primaryTarget ? [primaryTarget] : [];
        }
    }

    applySplashDamage(caster, primaryTarget, splashDamage, skillName) {
        const targetParty = primaryTarget.isPlayer || primaryTarget.isAlly ? this.playerParty : this.enemyParty;
        const primaryIndex = targetParty.findIndex(t => t.instanceId === primaryTarget.instanceId);
        if (primaryIndex === -1) return;

        const adjacentTargets = [];
        if (primaryIndex > 0) adjacentTargets.push(targetParty[primaryIndex - 1]);
        if (primaryIndex < targetParty.length - 1) adjacentTargets.push(targetParty[primaryIndex + 1]);

        adjacentTargets.forEach(adjTarget => {
            if (adjTarget && adjTarget.stats.currentHp > 0) {
                eventBus.publish('combatLog', { text: `${skillName} splashes onto ${adjTarget.name}!`, type: 'system' });
                this.applyDamage(adjTarget, Math.floor(splashDamage), caster, skillName, true);
            }
        });
    }


    async executeItem(caster, itemInstanceId, targetId) {
        if (!caster.isPlayer) { 
            eventBus.publish('combatLog', { text: "Only players can use items in combat currently.", type: 'error' });
            return true; 
        }
        const itemRef = playerManager.gameState.inventory.find(i => i.instanceId === itemInstanceId);
        if (!itemRef) {
            eventBus.publish('combatLog', { text: "Item not found!", type: 'error' }); return false;
        }
        const itemData = ITEMS_DATA[itemRef.itemId];
        if (!itemData.use_effect) {
            eventBus.publish('combatLog', { text: `${itemData.name} cannot be used in combat.`, type: 'error' }); return false;
        }

        const target = this.findCombatant(targetId);
        let actualTarget = target || caster; // Default to self if target not applicable/needed based on itemEffect.target
        
        // Validate target based on itemData.use_effect.target
        const itemTargetType = itemData.use_effect.target;
        if (itemTargetType === 'enemy_single' && (!actualTarget || actualTarget.isPlayer || actualTarget.isAlly)) {
             eventBus.publish('combatLog', { text: `Invalid target for ${itemData.name}. Must be an enemy.`, type: 'error' }); return false;
        }
        if ((itemTargetType === 'ally_single' || itemTargetType === 'self_or_ally') && (actualTarget && !actualTarget.isPlayer && !actualTarget.isAlly)) {
             eventBus.publish('combatLog', { text: `Invalid target for ${itemData.name}. Must be an ally or self.`, type: 'error' }); return false;
        }
         if (!actualTarget && (itemTargetType === 'ally_single' || itemTargetType === 'enemy_single')) {
            eventBus.publish('combatLog', { text: `No valid target for ${itemData.name}.`, type: 'error' }); return false;
        }

        
        eventBus.publish('combatLog', { text: `${caster.name} uses ${itemData.name}${actualTarget && actualTarget.instanceId !== caster.instanceId ? ` on ${actualTarget.name}` : ''}!`, type: 'combat-player' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);

        const effect = itemData.use_effect;

        switch (effect.type) {
            case 'heal':
                this.applyHeal(actualTarget, effect.amount, caster, itemData.name);
                break;
            case 'restore_mp':
                this.applyMpRestore(actualTarget, effect.amount, caster, itemData.name);
                break;
            case 'cure_status':
                this.removeStatusEffect(actualTarget, effect.statusId, itemData.name);
                break;
            case 'grant_sp': // SP orbs shouldn't be usable in combat
                 eventBus.publish('combatLog', { text: `${itemData.name} cannot be used in combat.`, type: 'error' });
                 return false; // Action fails
            default:
                 eventBus.publish('combatLog', { text: `Effect of ${itemData.name} not implemented.`, type: 'error' });
        }

        // Only remove item if successfully used (e.g. not SP orb in combat)
        if (itemData.stackable) playerManager.removeItem(itemRef.instanceId, 1); 
        else playerManager.removeItem(itemRef.instanceId);

        return true;
    }

    async executeFlee(caster) {
        if (!caster.isPlayer) return true; 

        eventBus.publish('combatLog', { text: `${caster.name} attempts to flee...`, type: 'system' });
        await delay(CONFIG.ACTION_ANIMATION_DELAY);
        
        const enemyAvgSpeed = this.enemyParty.reduce((avg, e) => avg + (e.stats.speed || 0), 0) / (this.enemyParty.length || 1);
        const fleeChance = 60 + (caster.stats.speed || 0) - enemyAvgSpeed;
        if (rollPercentage(Math.max(10, Math.min(90, fleeChance)))) {
            eventBus.publish('combatLog', { text: `Successfully fled!`, type: 'success-message' });
            this.endCombat(false, true); 
            return true; // Important: Flee action is successful in terms of turn progression
        } else {
            eventBus.publish('combatLog', { text: `Could not escape!`, type: 'error-message' });
            return true; // Turn is still used even if flee fails
        }
    }


    applyDamage(target, amount, attacker, sourceName = "Attack", isSplash = false) {
        target.stats.currentHp -= amount;
        let damageType = isSplash ? "splash damage" : "damage";
        eventBus.publish('combatLog', { text: `${target.name} takes ${amount} ${damageType}! (${sourceName})`, type: target.isPlayer || target.isAlly ? 'combat-enemy' : 'combat-player', value: -amount, targetId: target.instanceId });

        if (target.stats.currentHp <= 0) {
            target.stats.currentHp = 0;
            eventBus.publish('combatLog', { text: `${target.name} has been defeated!`, type: 'system highlight-color' });
        }
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }

    applyHeal(target, amount, healer, sourceName = "Heal") {
        const oldHp = target.stats.currentHp;
        target.stats.currentHp = Math.min(target.stats.currentHp + amount, target.maxStats.maxHp);
        const healedAmount = target.stats.currentHp - oldHp;
        eventBus.publish('combatLog', { text: `${target.name} recovers ${healedAmount} HP! (${sourceName})`, type: 'combat-ally', value: healedAmount, targetId: target.instanceId });
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }
    
    applyMpRestore(target, amount, source, sourceName = "MP Restore") {
        const oldMp = target.stats.currentMp;
        target.stats.currentMp = Math.min(target.stats.currentMp + amount, target.maxStats.maxMp);
        const restoredAmount = target.stats.currentMp - oldMp;
        eventBus.publish('combatLog', { text: `${target.name} recovers ${restoredAmount} MP! (${sourceName})`, type: 'combat-ally', valueMp: restoredAmount, targetId: target.instanceId });
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }


    applyStatusEffect(target, statusId, duration, applier) {
        const statusData = STATUS_EFFECTS_DATA[statusId];
        if (!statusData) return;

        const existingEffectIndex = target.statusEffects.findIndex(se => se.statusId === statusId);
        if (existingEffectIndex !== -1) {
            target.statusEffects[existingEffectIndex].duration = Math.max(target.statusEffects[existingEffectIndex].duration, duration); 
        } else {
            target.statusEffects.push({ statusId, duration, appliedBy: applier?.instanceId });
        }
        
        const message = statusData.onApplyMsg ? statusData.onApplyMsg.replace("{targetName}", target.name).replace("{casterName}", applier?.name || "Someone") : `${target.name} is affected by ${statusData.name}!`;
        eventBus.publish('combatLog', { text: message, type: 'combat-status', statusName: statusData.name, targetId: target.instanceId });
        eventBus.publish('combatUiUpdate', this.getCombatState());
    }
    
    removeStatusEffect(target, statusIdToRemove, sourceName="Cure") {
        const effectIndex = target.statusEffects.findIndex(se => se.statusId === statusIdToRemove);
        if (effectIndex !== -1) {
            const statusData = STATUS_EFFECTS_DATA[statusIdToRemove];
            const message = statusData.onRemoveMsg ? statusData.onRemoveMsg.replace("{targetName}", target.name) : `${target.name} is no longer affected by ${statusData.name}. (${sourceName})`;
            eventBus.publish('combatLog', { text: message, type: 'system' });
            target.statusEffects.splice(effectIndex, 1);
            eventBus.publish('combatUiUpdate', this.getCombatState());
        }
    }

    async tickStatusEffects(combatant) {
        const effectsToRemove = [];
        for (let i = combatant.statusEffects.length - 1; i >= 0; i--) {
            const effectInstance = combatant.statusEffects[i];
            const effectData = STATUS_EFFECTS_DATA[effectInstance.statusId];
            if (!effectData) continue;

            if (effectData.dot && combatant.stats.currentHp > 0) {
                let dotAmount = effectData.dot.basePower;
                if (effectData.dot.damageType === "heal") { 
                    this.applyHeal(combatant, dotAmount, null, effectData.name);
                } else { 
                    this.applyDamage(combatant, dotAmount, null, effectData.name);
                }
                 if (effectData.onTickMsg) {
                     eventBus.publish('combatLog', { text: effectData.onTickMsg.replace("{targetName}", combatant.name).replace("{damage}", dotAmount), type: 'combat-status' });
                 }
                 await delay(CONFIG.MULTI_TARGET_EFFECT_DELAY);
            }

            effectInstance.duration--;
            if (effectInstance.duration <= 0) {
                effectsToRemove.push(effectInstance.statusId);
                 const message = effectData.onRemoveMsg ? effectData.onRemoveMsg.replace("{targetName}", combatant.name) : `${effectData.name} wears off from ${combatant.name}.`;
                eventBus.publish('combatLog', { text: message, type: 'system' });
            }
        }
        combatant.statusEffects = combatant.statusEffects.filter(se => !effectsToRemove.includes(se.statusId));
        if (effectsToRemove.length > 0) eventBus.publish('combatUiUpdate', this.getCombatState());
    }
    
    decrementSingleActionBuffs(caster) { 
        caster.statusEffects = caster.statusEffects.filter(effectInstance => {
            const effectData = STATUS_EFFECTS_DATA[effectInstance.statusId];
            if (effectData && effectData.specialFlags?.includes('guaranteed_crit_next_attack')) {
                eventBus.publish('combatLog', { text: `${effectData.name} effect used up by ${caster.name}.`, type: 'system' });
                return false; 
            }
            return true;
        });
    }

    targetHasStatusEffect(targetInstanceId, statusId) {
        const target = this.findCombatant(targetInstanceId);
        return target && target.statusEffects.some(se => se.statusId === statusId);
    }


    cleanupDeadCombatants() {
        this.playerParty = this.playerParty.filter(p => p.stats.currentHp > 0);
        this.enemyParty = this.enemyParty.filter(e => e.stats.currentHp > 0);
        this.turnOrder = this.turnOrder.filter(c => c.stats.currentHp > 0);
        
        const currentActorStillInOrder = this.turnOrder.find(c => c.instanceId === this.currentActor?.instanceId);
        if (currentActorStillInOrder) {
            this.currentTurnIndex = this.turnOrder.indexOf(currentActorStillInOrder);
        } else if (this.currentActor && this.currentActor.stats.currentHp <= 0) {
             // If current actor died, index needs careful adjustment.
             // However, re-determining turn order at start of round and after cleanup
             // should largely handle this. If issues persist, specific index logic needed here.
        }
    }

    checkCombatEnd() {
        const playerTeamAlive = this.playerParty.some(p => p.stats.currentHp > 0);
        const enemyTeamAlive = this.enemyParty.some(e => e.stats.currentHp > 0);

        if (!playerTeamAlive) {
            this.endCombat(false); 
            return true;
        }
        if (!enemyTeamAlive) {
            this.endCombat(true); 
            return true;
        }
        return false;
    }

    endCombat(playerWon, playerFled = false) {
        if (!this.isActive) return;
        this.isActive = false;
        playerManager.gameState.inCombat = false;

        this.playerParty.forEach(combatPlayer => {
            if (combatPlayer.isPlayer) {
                playerManager.gameState.derivedStats.currentHp = combatPlayer.stats.currentHp;
                playerManager.gameState.derivedStats.currentMp = combatPlayer.stats.currentMp;
            } else if (combatPlayer.isAlly) {
                const allyInGameState = playerManager.gameState.allies.find(a => a.instanceId === combatPlayer.instanceId);
                if (allyInGameState) {
                    allyInGameState.derivedStats.currentHp = combatPlayer.stats.currentHp;
                    allyInGameState.derivedStats.currentMp = combatPlayer.stats.currentMp;
                }
            }
        });
        playerManager.updateAllStats(); 
        eventBus.publish('playerDataUpdated', playerManager.getPublicData());


        if (playerWon) {
            let totalXp = 0;
            let totalGoldMin = 0;
            let totalGoldMax = 0;
            const lootDrops = [];

            // Use the initial enemy data for rewards, not the combat-modified instances
            const originalEnemiesInCombat = this.turnOrder.filter(c => !c.isPlayer && !c.isAlly && c.stats.currentHp <= 0)
                                          .map(defeatedCombatant => ENEMIES_DATA[defeatedCombatant.id]); // Get original data

            originalEnemiesInCombat.forEach(originalEnemyData => {
                 if(originalEnemyData) {
                    totalXp += originalEnemyData.xp_reward || 0;
                    totalGoldMin += originalEnemyData.gold_reward?.min || 0;
                    totalGoldMax += originalEnemyData.gold_reward?.max || 0;
                    originalEnemyData.loot_table?.forEach(lootEntry => {
                        if (rollPercentage(lootEntry.chance)) {
                            const quantity = lootEntry.quantity ? (typeof lootEntry.quantity === 'object' ? getRandomInt(lootEntry.quantity.min, lootEntry.quantity.max) : lootEntry.quantity) : 1;
                            if (lootEntry.questIdLink) {
                                const quest = playerManager.gameState.quests[lootEntry.questIdLink];
                                if (quest && !quest.completed) {
                                    lootDrops.push({ itemId: lootEntry.itemId, quantity });
                                }
                            } else {
                                lootDrops.push({ itemId: lootEntry.itemId, quantity });
                            }
                        }
                    });
                }
            });

            const finalGold = getRandomInt(totalGoldMin, Math.max(totalGoldMin, totalGoldMax));
            playerManager.addXp(totalXp); 
            playerManager.addGold(finalGold);

            lootDrops.forEach(drop => playerManager.addItem(drop.itemId, drop.quantity));
            
            eventBus.publish('combatEnded', {
                won: true,
                xpGained: totalXp,
                goldGained: finalGold,
                itemsDropped: lootDrops.map(d => ({...ITEMS_DATA[d.itemId], quantityObtained: d.quantity}))
            });

            if (this.fixedEncounterId) {
                encounterManager.markFixedEncounterAsCleared(this.fixedEncounterId);
            }

        } else { 
            eventBus.publish('combatEnded', { won: false, fled: playerFled });
            if (!playerFled) { 
                eventBus.publish('gameOver', { reason: "Your party was defeated in combat." });
            }
        }
        this.resetCombatState();
    }


    findCombatant(instanceId) {
        return this.playerParty.find(p => p.instanceId === instanceId) || this.enemyParty.find(e => e.instanceId === instanceId);
    }

    getCombatState() {
        return {
            isActive: this.isActive,
            playerParty: JSON.parse(JSON.stringify(this.playerParty)), 
            enemyParty: JSON.parse(JSON.stringify(this.enemyParty)),
            turnOrderInstanceIds: this.turnOrder.map(c => c.instanceId),
            currentActorInstanceId: this.currentActor ? this.currentActor.instanceId : null,
            roundCount: this.roundCount
        };
    }

    playerInitiatesTargetedAction(actionType, detailId ) {
        this.pendingPlayerAction = { type: actionType, detailId: detailId, casterId: this.currentActor.instanceId };
        let targetableEntities = [];
        const playerActor = this.currentActor; // Should be the player

        let skillOrItemData = null;
        let targetDefinition = null;

        if (actionType === 'skill') {
            skillOrItemData = SKILLS_DATA[detailId];
            if (!skillOrItemData) { this.cancelPlayerTargetSelectionWithMessage("Skill not found."); return; }
            targetDefinition = skillOrItemData.target;
        } else if (actionType === 'item') {
            const itemRef = playerManager.gameState.inventory.find(i => i.instanceId === detailId);
            skillOrItemData = itemRef ? ITEMS_DATA[itemRef.itemId] : null;
            if (!skillOrItemData || !skillOrItemData.use_effect) { this.cancelPlayerTargetSelectionWithMessage("Item not found or not usable."); return; }
            targetDefinition = skillOrItemData.use_effect.target;
        } else if (actionType === 'attack') {
            targetDefinition = 'enemy_single'; // Basic attack always targets one enemy
        } else {
            this.cancelPlayerTargetSelectionWithMessage("Unknown action type for targeting.");
            return;
        }
        
        // Determine targetable entities based on definition
        if (targetDefinition.includes('enemy')) targetableEntities = this.enemyParty.filter(e => e.stats.currentHp > 0);
        else if (targetDefinition.includes('ally') || targetDefinition.includes('party') || targetDefinition === 'ally_leader') targetableEntities = this.playerParty.filter(p => p.stats.currentHp > 0);
        else if (targetDefinition === 'self') {
            this.processAction({ ...this.pendingPlayerAction, targetId: playerActor.instanceId });
            this.pendingPlayerAction = null;
            return;
        }
        
        // If target is _all or party, no specific target selection needed for single entities
        if (targetDefinition.includes("_all") || targetDefinition === "party") {
             this.processAction({ ...this.pendingPlayerAction, targetId: null }); // targetId null for _all or party
             this.pendingPlayerAction = null;
             return;
        }

        if (targetableEntities.length === 1 && (targetDefinition.includes('single') || targetDefinition.includes('leader'))) { 
             this.processAction({ ...this.pendingPlayerAction, targetId: targetableEntities[0].instanceId });
             this.pendingPlayerAction = null;
        } else if (targetableEntities.length > 0) {
            eventBus.publish('combatRequestTarget', {
                targetableEntities: targetableEntities.map(t => ({ instanceId: t.instanceId, name: t.name })),
                actionMessage: `Select target for ${actionType === 'skill' ? skillOrItemData.name : (skillOrItemData?.name || 'Attack')}`
            });
        } else {
            this.cancelPlayerTargetSelectionWithMessage("No valid targets available for that action.");
        }
    }
    
    cancelPlayerTargetSelectionWithMessage(message) {
        eventBus.publish('combatLog', {text: message, type: 'warning-message'});
        this.pendingPlayerAction = null; 
        eventBus.publish('playerTurnStarted', { combatState: this.getCombatState(), retry: true });
    }

    playerSelectsTarget(targetInstanceId) {
        if (this.pendingPlayerAction) {
            // Validate if the selected target is valid for the pending action
            const target = this.findCombatant(targetInstanceId);
            if (!target || target.stats.currentHp <= 0) {
                eventBus.publish('combatLog', {text: "Invalid or defeated target selected.", type: 'error-message'});
                // Re-prompt for target without cancelling the whole action
                const tempPendingAction = { ...this.pendingPlayerAction }; // Store before clearing
                this.pendingPlayerAction = null; // Clear to avoid recursion loop if playerInitiatesTargetedAction is called by UI again immediately
                this.playerInitiatesTargetedAction(tempPendingAction.type, tempPendingAction.detailId);
                return;
            }

            const fullAction = { ...this.pendingPlayerAction, targetId: targetInstanceId };
            this.pendingPlayerAction = null;
            this.processAction(fullAction);
        }
    }

     cancelPlayerTargetSelection() {
        this.pendingPlayerAction = null;
        eventBus.publish('playerTurnStarted', { combatState: this.getCombatState(), retry: true }); 
    }
}
export const combatManager = new CombatManager();

// Also need to import ALLY_DATA in combatManager if not already there.
// And ENEMIES_DATA if it's used for reward calculation (which it is).
// This is done at the top of the modified combatManager.js
