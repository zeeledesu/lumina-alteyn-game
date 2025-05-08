// js/combatManager.js
import { eventBus } from './eventManager.js';
import { playerManager } from './playerManager.js';
import { aiManager } from './aiManager.js';
import { SKILLS_DATA, STATUS_EFFECTS_DATA } from './data/skills.js';
import { ITEMS_DATA } from './data/items.js';
import { getRandomInt, delay, CONFIG } from './utils.js';
import { encounterManager } from './encounterManager.js';


class CombatManager {
    constructor() {
        this.resetCombatState();
        eventBus.subscribe('startCombat', (data) => this.startCombat(data.enemies, data.fixedEncounterId));
        eventBus.subscribe('combatAction', (action) => this.processAction(action));
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
                    stats: { ...allyData.derivedStats },
                    maxStats: { maxHp: allyData.derivedStats.maxHp, maxMp: allyData.derivedStats.maxMp },
                    skills: allyData.skills.map(s => SKILLS_DATA[s]?.id || s), // Ensure it's skill IDs
                    statusEffects: [],
                    isAlly: true,
                    classId: allyData.classId
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
            // TODO: Basic ally AI or player commands for allies
            const action = aiManager.getCombatAction(this.currentActor, this.playerParty, this.enemyParty);
            await delay(CONFIG.DEFAULT_TEXT_SPEED * 20); // Simulate AI thinking
            this.processAction(action);
        } else { // Enemy turn
            const action = aiManager.getCombatAction(this.currentActor, this.playerParty, this.enemyParty);
            await delay(CONFIG.DEFAULT_TEXT_SPEED * 20); // Simulate AI thinking
            this.processAction(action);
        }
    }

    async processAction(action) {
        if (!this.isActive || !this.currentActor || (this.currentActor.isPlayer && action.casterId !== this.currentActor.instanceId && !action.isPlayerCommandedAlly)) {
             // If it's player's turn, action.casterId must match currentActor.instanceId unless it's an ally command
            if (this.currentActor.isPlayer && action.casterId !== this.currentActor.instanceId && !action.isPlayerCommandedAlly) {
                console.warn("Action caster mismatch for player turn:", action, this.currentActor);
                // return; // Don't advance turn if it's an invalid action for the current player
            } else if (!this.currentActor.isPlayer && action.casterId !== this.currentActor.instanceId){
                 console.warn("Action caster mismatch for AI turn:", action, this.currentActor);
                 // AI action, proceed cautiously or re-evaluate
            }
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
            case 'pass': // AI might pass
                eventBus.publish('combatLog', { text: `${caster.name} takes a moment to observe.`, type: 'system' });
                success = true;
                break;
            default:
                eventBus.publish('combatLog', { text: `Unknown action type: ${action.type}`, type: 'error' });
        }
        
        // If action was successful or turn should pass
        if (success || action.type === 'pass' || action.type === 'flee') { // Flee ends combat, so turn advances implicitly
            // Decrement duration of "on next attack" buffs if used by an attack/skill
            if (action.type === 'attack' || (action.type === 'skill' && SKILLS_DATA[action.skillId]?.type.includes('attack'))) {
                this.decrementSingleActionBuffs(caster);
            }

            this.currentTurnIndex++;
            if (!this.checkCombatEnd()) { // Only call nextTurn if combat isn't over
                 await delay(CONFIG.DEFAULT_TEXT_SPEED * 5); // Brief pause after action text
                 this.nextTurn();
            }
        } else {
            // Action failed (e.g. not enough MP, invalid target), player might get another chance or turn ends.
            // For AI, this means AI logic error. For player, UI should prevent this.
            // If it's player's turn and action failed client-side (e.g. UI should have caught no MP), don't advance.
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
            return true; // Action taken, even if ineffective
        }
        
        // Sansan's redirect for Cutiepatotie (Player character)
        const playerChar = this.playerParty.find(p => p.isPlayer);
        let actualTarget = target;
        if (target.instanceId === playerChar?.instanceId && caster.instanceId !== ALLY_DATA.sansan_dino.id /* Sansan doesn't redirect his own heals/buffs on her */) {
            const sansanAlly = this.playerParty.find(p => p.allyId === ALLY_DATA.sansan_dino.id && p.stats.currentHp > 0);
            if (sansanAlly) {
                eventBus.publish('combatLog', { text: `Sansan intercepts the attack meant for ${playerChar.name}!`, type: 'ally-special' });
                actualTarget = sansanAlly;
            }
        }


        eventBus.publish('combatLog', { text: `${caster.name} attacks ${actualTarget.name}!`, type: caster.isPlayer || caster.isAlly ? 'combat-player' : 'combat-enemy' });
        await delay(CONFIG.DEFAULT_TEXT_SPEED * 10);

        // Accuracy check
        const hitChance = (caster.stats.accuracy || 75) - (actualTarget.stats.evasion || 5);
        if (!rollPercentage(Math.max(5, Math.min(95, hitChance)))) { // Clamp hit chance between 5% and 95%
            eventBus.publish('combatLog', { text: `...but misses!`, type: 'combat-miss' });
            return true;
        }

        // Damage calculation
        let damage = Math.max(1, Math.floor(
            (caster.stats.attack || 5) * (1 + getRandomInt(-10, 10)/100) - // Base attack with slight variance
            (actualTarget.stats.defense || 0) / 2 // Defense reduces damage
        ));

        // Critical hit check
        let isCrit = false;
        if (caster.statusEffects.some(se => STATUS_EFFECTS_DATA[se.statusId]?.specialFlags?.includes('guaranteed_crit_next_attack'))) {
            isCrit = true;
        } else {
            isCrit = rollPercentage(caster.stats.critChance || 5);
        }

        if (isCrit) {
            damage = Math.floor(damage * 1.75); // Standard crit multiplier
            eventBus.publish('combatLog', { text: `CRITICAL HIT!`, type: 'combat-crit' });
        }

        this.applyDamage(actualTarget, damage, caster);
        return true;
    }

    async executeSkill(caster, skillId, targetId) {
        const skillData = SKILLS_DATA[skillId];
        if (!skillData) {
            eventBus.publish('combatLog', { text: `${caster.name} tries to use an unknown skill!`, type: 'error' });
            return false; // Skill doesn't exist
        }

        if (caster.stats.currentMp < skillData.mpCost) {
            eventBus.publish('combatLog', { text: `${caster.name} doesn't have enough MP for ${skillData.name}!`, type: 'warning-message' });
            if (caster.isPlayer) return false; // Player action fails, allow retry
            return true; // AI action counts as taken even if failed due to MP
        }
        
        if (skillData.requiresShield && !(caster.isPlayer ? playerManager.gameState.equipment.offHand : caster.equipment?.offHand) ){
             eventBus.publish('combatLog', { text: `${caster.name} needs a shield to use ${skillData.name}!`, type: 'warning-message' });
             if (caster.isPlayer) return false; return true;
        }
        if (skillData.requiresStatus && !this.targetHasStatusEffect(caster.instanceId, skillData.requiresStatus) ){
             eventBus.publish('combatLog', { text: `${caster.name} is not in the right state to use ${skillData.name}!`, type: 'warning-message' });
             if (caster.isPlayer) return false; return true;
        }


        if (caster.isPlayer) playerManager.spendMp(skillData.mpCost); // Deduct MP for player
        else caster.stats.currentMp -= skillData.mpCost; // Deduct for AI

        eventBus.publish('combatLog', { text: `${caster.name} uses ${skillData.name}!`, type: caster.isPlayer || caster.isAlly ? 'combat-player' : 'combat-enemy' });
        await delay(CONFIG.DEFAULT_TEXT_SPEED * 10);

        const targets = this.determineSkillTargets(caster, skillData, targetId);
        if (!targets || targets.length === 0 && !(skillData.target === "self" || skillData.target === "party" || skillData.target === "enemy_all" || skillData.target === "ally_all")) {
             eventBus.publish('combatLog', { text: `...but there's no valid target!`, type: 'system' });
             return true; // Action taken
        }


        const effects = Array.isArray(skillData.effect) ? skillData.effect : [skillData.effect];
        for (const effect of effects) {
            let currentTargets = targets; // Default to all targets determined
            if (effect.targetType) { // If an effect within a multi-effect skill specifies its own target type
                currentTargets = this.determineSkillTargets(caster, { ...skillData, target: effect.targetType }, targetId);
            }

            for (const target of currentTargets) {
                 if (!target || target.stats.currentHp <= 0 && effect.type !== "revive") continue; // Skip dead targets unless reviving

                // Sansan's redirect for Cutiepatotie (Player character) for damaging effects
                let actualTarget = target;
                const playerChar = this.playerParty.find(p => p.isPlayer);
                if (effect.type === "damage" && target.instanceId === playerChar?.instanceId && caster.instanceId !== ALLY_DATA.sansan_dino.id) {
                    const sansanAlly = this.playerParty.find(p => p.allyId === ALLY_DATA.sansan_dino.id && p.stats.currentHp > 0);
                    if (sansanAlly) {
                        eventBus.publish('combatLog', { text: `Sansan intercepts the effect of ${skillData.name} meant for ${playerChar.name}!`, type: 'ally-special' });
                        actualTarget = sansanAlly;
                    }
                }
                
                switch (effect.type) {
                    case 'damage':
                        let damage = 0;
                        if (effect.basePower) { // Spell-like damage
                            damage = effect.basePower + Math.floor((caster.stats[effect.scaleStat] || caster.attributes[effect.scaleStat]?.current || 0) * effect.scaleFactor);
                        } else if (effect.baseMultiplier) { // Weapon-based damage
                            damage = Math.floor((caster.stats.attack || 5) * effect.baseMultiplier);
                             if (effect.scaleStat) damage += Math.floor((caster.stats[effect.scaleStat] || caster.attributes[effect.scaleStat]?.current || 0) * effect.scaleFactor);
                        }
                        damage = Math.max(1, damage - Math.floor((actualTarget.stats.defense || 0) / 2)); // Basic defense reduction
                        
                        // TODO: Elemental resistances/vulnerabilities
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
                        if (effect.splashMultiplier && targetId === actualTarget.instanceId) { // Apply splash to adjacent if main target
                           this.applySplashDamage(caster, actualTarget, damage * effect.splashMultiplier, skillData.name);
                        }
                        break;
                    case 'heal':
                        const healAmount = effect.basePower + Math.floor((caster.stats[effect.scaleStat] || caster.attributes[effect.scaleStat]?.current || 0) * (effect.scaleFactor || 1));
                        this.applyHeal(actualTarget, healAmount, caster, skillData.name);
                        break;
                    case 'status_effect':
                         if (effect.chance === undefined || rollPercentage(effect.chance)) {
                            this.applyStatusEffect(actualTarget, effect.statusId, effect.duration, caster);
                        } else {
                             eventBus.publish('combatLog', { text: `${skillData.name} failed to apply ${STATUS_EFFECTS_DATA[effect.statusId]?.name} to ${actualTarget.name}.`, type: 'system' });
                        }
                        break;
                    // Add more effect types: stat_change (direct temporary), restore_mp, etc.
                }
                await delay(CONFIG.DEFAULT_TEXT_SPEED * 5); // Pause between multi-target effects
            }
        }
        return true;
    }
    
    determineSkillTargets(caster, skillData, primaryTargetId) {
        const primaryTarget = this.findCombatant(primaryTargetId);
        switch (skillData.target) {
            case 'self': return [caster];
            case 'enemy_single': return primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly ? [primaryTarget] : (this.enemyParty.find(e => e.stats.currentHp > 0) ? [this.enemyParty.find(e => e.stats.currentHp > 0)] : []); // Fallback to first living enemy
            case 'ally_single': return primaryTarget && (primaryTarget.isPlayer || primaryTarget.isAlly) ? [primaryTarget] : (caster.isPlayer || caster.isAlly ? [caster] : []); // Fallback to self if ally target invalid
            case 'ally_leader': // Specific for Sansan's Protective Aura
                const leader = this.playerParty.find(p => p.isPlayer);
                return leader ? [leader] : [];
            case 'enemy_all': return this.enemyParty.filter(e => e.stats.currentHp > 0);
            case 'ally_all': return this.playerParty.filter(p => p.stats.currentHp > 0);
            case 'party': return this.playerParty.filter(p => p.stats.currentHp > 0);
            case 'enemy_aoe_2': // Example: hits primary target + 1 random other enemy
                 const targets = [];
                 if (primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly && primaryTarget.stats.currentHp > 0) targets.push(primaryTarget);
                 const otherEnemies = this.enemyParty.filter(e => e.stats.currentHp > 0 && e.instanceId !== primaryTargetId);
                 if (otherEnemies.length > 0) targets.push(otherEnemies[getRandomInt(0, otherEnemies.length -1)]);
                 return targets;
            case 'enemy_single_splash': // Primary target, splash handled separately
                 return primaryTarget && !primaryTarget.isPlayer && !primaryTarget.isAlly ? [primaryTarget] : (this.enemyParty.find(e => e.stats.currentHp > 0) ? [this.enemyParty.find(e => e.stats.currentHp > 0)] : []);
            case 'enemy_all_self': // For taunts that also buff self
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
        if (!caster.isPlayer) { // Only players can use items for now
            eventBus.publish('combatLog', { text: "Only players can use items in combat currently.", type: 'error' });
            return true; // AI turn still counts
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
        if (!target && (itemData.use_effect.target === 'ally_single' || itemData.use_effect.target === 'enemy_single')) {
            eventBus.publish('combatLog', { text: "Invalid target for item.", type: 'error' }); return false;
        }
        
        eventBus.publish('combatLog', { text: `${caster.name} uses ${itemData.name}${target ? ` on ${target.name}` : ''}!`, type: 'combat-player' });
        await delay(CONFIG.DEFAULT_TEXT_SPEED * 10);

        // Process item effect
        const effect = itemData.use_effect;
        let actualTarget = target || caster; // Default to self if target not applicable/needed

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
            // Add more item effects: damage (grenades), buffs, etc.
            default:
                 eventBus.publish('combatLog', { text: `Effect of ${itemData.name} not implemented.`, type: 'error' });
        }

        if (itemData.stackable) playerManager.removeItem(itemInstanceId, 1); // Use instanceId to correctly identify stack
        else playerManager.removeItem(itemInstanceId);

        return true;
    }

    async executeFlee(caster) {
        if (!caster.isPlayer) return true; // AI doesn't flee yet

        eventBus.publish('combatLog', { text: `${caster.name} attempts to flee...`, type: 'system' });
        await delay(CONFIG.DEFAULT_TEXT_SPEED * 10);
        // Flee chance calculation (simple for now)
        const fleeChance = 60 + (caster.stats.speed || 0) - (this.enemyParty.reduce((avg, e) => avg + (e.stats.speed || 0), 0) / this.enemyParty.length || 0);
        if (rollPercentage(Math.max(10, Math.min(90, fleeChance)))) {
            eventBus.publish('combatLog', { text: `Successfully fled!`, type: 'success-message' });
            this.endCombat(false, true); // Player fled
        } else {
            eventBus.publish('combatLog', { text: `Could not escape!`, type: 'error-message' });
        }
        return true; // Turn is used
    }


    applyDamage(target, amount, attacker, sourceName = "Attack", isSplash = false) {
        target.stats.currentHp -= amount;
        let damageType = isSplash ? "splash damage" : "damage";
        eventBus.publish('combatLog', { text: `${target.name} takes ${amount} ${damageType}! (${sourceName})`, type: target.isPlayer || target.isAlly ? 'combat-enemy' : 'combat-player', value: -amount, targetId: target.instanceId });

        if (target.stats.currentHp <= 0) {
            target.stats.currentHp = 0;
            eventBus.publish('combatLog', { text: `${target.name} has been defeated!`, type: 'system highlight-color' });
            // Don't remove from party arrays immediately, cleanupDeadCombatants will handle it
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

        // Prevent stacking identical blocking statuses like stun (allow reapplication to refresh duration)
        const existingEffectIndex = target.statusEffects.findIndex(se => se.statusId === statusId);
        if (existingEffectIndex !== -1) {
            target.statusEffects[existingEffectIndex].duration = Math.max(target.statusEffects[existingEffectIndex].duration, duration); // Refresh duration
        } else {
            target.statusEffects.push({ statusId, duration, appliedBy: applier?.instanceId });
        }
        
        const message = statusData.onApplyMsg ? statusData.onApplyMsg.replace("{targetName}", target.name).replace("{casterName}", applier?.name || "Someone") : `${target.name} is affected by ${statusData.name}!`;
        eventBus.publish('combatLog', { text: message, type: 'combat-status', statusName: statusData.name, targetId: target.instanceId });
        // TODO: Apply immediate stat changes if any (though most are passive or tick-based)
        // For V0.5, stat changes from status effects are calculated in playerManager.updateCharacterBaseStats before combat
        // or need a combat-specific stat recalculation here.
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

            // Apply DoT/HoT
            if (effectData.dot && combatant.stats.currentHp > 0) {
                let dotAmount = effectData.dot.basePower;
                // TODO: Add scaling for DoT if specified
                if (effectData.dot.damageType === "heal") { // HoT
                    this.applyHeal(combatant, dotAmount, null, effectData.name);
                } else { // DoT
                    this.applyDamage(combatant, dotAmount, null, effectData.name);
                }
                 if (effectData.onTickMsg) {
                     eventBus.publish('combatLog', { text: effectData.onTickMsg.replace("{targetName}", combatant.name).replace("{damage}", dotAmount), type: 'combat-status' });
                 }
                 await delay(CONFIG.DEFAULT_TEXT_SPEED * 5);
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
    
    decrementSingleActionBuffs(caster) { // For "next attack is crit" etc.
        caster.statusEffects = caster.statusEffects.filter(effectInstance => {
            const effectData = STATUS_EFFECTS_DATA[effectInstance.statusId];
            if (effectData && effectData.specialFlags?.includes('guaranteed_crit_next_attack')) {
                eventBus.publish('combatLog', { text: `${effectData.name} effect used up by ${caster.name}.`, type: 'system' });
                return false; // Remove it
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
        // Adjust currentTurnIndex if current actor died or actors before it died
        const currentActorStillInOrder = this.turnOrder.find(c => c.instanceId === this.currentActor?.instanceId);
        if (currentActorStillInOrder) {
            this.currentTurnIndex = this.turnOrder.indexOf(currentActorStillInOrder);
        } else if (this.currentActor && this.currentActor.stats.currentHp <= 0) {
            // Current actor died, index might effectively stay same if list shrinks before it
            // Or if it was last, index might become out of bounds, handled by nextTurn logic
            // This re-calculation of turn order at start of round helps.
        }
    }

    checkCombatEnd() {
        const playerTeamAlive = this.playerParty.some(p => p.stats.currentHp > 0);
        const enemyTeamAlive = this.enemyParty.some(e => e.stats.currentHp > 0);

        if (!playerTeamAlive) {
            this.endCombat(false); // Player party wiped
            return true;
        }
        if (!enemyTeamAlive) {
            this.endCombat(true); // Enemy party wiped
            return true;
        }
        return false;
    }

    endCombat(playerWon, playerFled = false) {
        if (!this.isActive) return;
        this.isActive = false;
        playerManager.gameState.inCombat = false;

        // Restore player/ally stats from combat instances to main gameState
        this.playerParty.forEach(combatPlayer => {
            if (combatPlayer.isPlayer) {
                playerManager.gameState.derivedStats.currentHp = combatPlayer.stats.currentHp;
                playerManager.gameState.derivedStats.currentMp = combatPlayer.stats.currentMp;
                // Player status effects usually don't persist out of combat unless specified
            } else if (combatPlayer.isAlly) {
                const allyInGameState = playerManager.gameState.allies.find(a => a.instanceId === combatPlayer.instanceId);
                if (allyInGameState) {
                    allyInGameState.derivedStats.currentHp = combatPlayer.stats.currentHp;
                    allyInGameState.derivedStats.currentMp = combatPlayer.stats.currentMp;
                }
            }
        });
        // Full update to playerManager's state to reflect HP/MP changes
        playerManager.updateAllStats(); // Recalculates based on current HP/MP and other factors.
        eventBus.publish('playerDataUpdated', playerManager.getPublicData());


        if (playerWon) {
            let totalXp = 0;
            let totalGoldMin = 0;
            let totalGoldMax = 0;
            const lootDrops = [];

            // Calculate rewards from original enemy data before they were modified in combat
            this.turnOrder.filter(c => !c.isPlayer && !c.isAlly).forEach(defeatedEnemyBaseData => {
                 const originalEnemyData = ENEMIES_DATA[defeatedEnemyBaseData.id]; // Use original ID
                 if(originalEnemyData) {
                    totalXp += originalEnemyData.xp_reward || 0;
                    totalGoldMin += originalEnemyData.gold_reward?.min || 0;
                    totalGoldMax += originalEnemyData.gold_reward?.max || 0;
                    originalEnemyData.loot_table?.forEach(lootEntry => {
                        if (rollPercentage(lootEntry.chance)) {
                            const quantity = lootEntry.quantity ? (typeof lootEntry.quantity === 'object' ? getRandomInt(lootEntry.quantity.min, lootEntry.quantity.max) : lootEntry.quantity) : 1;
                            // Check for quest-linked drops
                            if (lootEntry.questIdLink) {
                                const quest = playerManager.gameState.quests[lootEntry.questIdLink];
                                // Only drop if quest is active and at appropriate stage (more complex logic might be needed)
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
            playerManager.addXp(totalXp); // PlayerManager handles ally XP distribution
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

        } else { // Player lost or fled
            eventBus.publish('combatEnded', { won: false, fled: playerFled });
            if (!playerFled) { // Player party wiped
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
            playerParty: JSON.parse(JSON.stringify(this.playerParty)), // Deep clone for UI
            enemyParty: JSON.parse(JSON.stringify(this.enemyParty)),
            turnOrderInstanceIds: this.turnOrder.map(c => c.instanceId),
            currentActorInstanceId: this.currentActor ? this.currentActor.instanceId : null,
            roundCount: this.roundCount
        };
    }

    // Called by UI when player selects an action that needs a target
    playerInitiatesTargetedAction(actionType, detailId /* skillId or itemInstanceId */) {
        this.pendingPlayerAction = { type: actionType, detailId: detailId, casterId: this.currentActor.instanceId };
        let targetableEntities = [];
        const player = this.currentActor;

        if (actionType === 'skill') {
            const skillData = SKILLS_DATA[detailId];
            if (!skillData) return;
             // Determine valid targets based on skillData.target
            if (skillData.target.includes('enemy')) targetableEntities = this.enemyParty.filter(e => e.stats.currentHp > 0);
            else if (skillData.target.includes('ally') || skillData.target.includes('party') || skillData.target === 'ally_leader') targetableEntities = this.playerParty.filter(p => p.stats.currentHp > 0);
            else if (skillData.target === 'self') { // Auto-target self
                this.processAction({ ...this.pendingPlayerAction, targetId: player.instanceId });
                this.pendingPlayerAction = null;
                return;
            }
             // If target is _all, no specific target selection needed, but UI might confirm
            if (skillData.target.includes("_all") || skillData.target === "party") {
                 this.processAction({ ...this.pendingPlayerAction, targetId: null }); // targetId null for _all
                 this.pendingPlayerAction = null;
                 return;
            }

        } else if (actionType === 'item') {
            const itemRef = playerManager.gameState.inventory.find(i => i.instanceId === detailId);
            const itemData = itemRef ? ITEMS_DATA[itemRef.itemId] : null;
            if (!itemData || !itemData.use_effect) return;
            
            const itemEffectTargetType = itemData.use_effect.target;
            if (itemEffectTargetType === 'self_or_ally' || itemEffectTargetType === 'ally_single') targetableEntities = this.playerParty.filter(p => p.stats.currentHp > 0);
            else if (itemEffectTargetType === 'enemy_single') targetableEntities = this.enemyParty.filter(e => e.stats.currentHp > 0);
            else if (itemEffectTargetType === 'self') {
                this.processAction({ ...this.pendingPlayerAction, targetId: player.instanceId });
                this.pendingPlayerAction = null;
                return;
            }
        }

        if (targetableEntities.length === 1 && (actionType === 'skill' ? SKILLS_DATA[detailId].target.includes('single') : true) ) { // Auto-select if only one valid single target
             this.processAction({ ...this.pendingPlayerAction, targetId: targetableEntities[0].instanceId });
             this.pendingPlayerAction = null;
        } else if (targetableEntities.length > 0) {
            eventBus.publish('combatRequestTarget', {
                targetableEntities: targetableEntities.map(t => ({ instanceId: t.instanceId, name: t.name })),
                actionMessage: `Select target for ${actionType === 'skill' ? SKILLS_DATA[detailId].name : ITEMS_DATA[playerManager.gameState.inventory.find(i=>i.instanceId === detailId)?.itemId]?.name}`
            });
        } else {
            eventBus.publish('combatLog', {text: "No valid targets available for that action.", type: 'warning-message'});
            this.pendingPlayerAction = null; // Clear pending action
            eventBus.publish('playerTurnStarted', { combatState: this.getCombatState(), retry: true }); // Allow player to retry
        }
    }

    // Called by UI after player clicks a target
    playerSelectsTarget(targetInstanceId) {
        if (this.pendingPlayerAction) {
            const fullAction = { ...this.pendingPlayerAction, targetId: targetInstanceId };
            this.pendingPlayerAction = null;
            this.processAction(fullAction);
        }
    }
     cancelPlayerTargetSelection() {
        this.pendingPlayerAction = null;
        eventBus.publish('playerTurnStarted', { combatState: this.getCombatState(), retry: true }); // Go back to action selection
    }

}
export const combatManager = new CombatManager();
