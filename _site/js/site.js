(function () {
    const input = document.getElementById('cardSearchInput');
    const allCardsGrid = document.getElementById('allCardsGrid');
    const comparisonGrid = document.getElementById('comparisonGrid');
    const currentDeckGrid = document.getElementById('currentDeckGrid');
    const comparisonEmpty = document.getElementById('comparisonEmpty');
    const comparisonCountLabel = document.getElementById('comparisonCountLabel');
    const deckCountLabel = document.getElementById('deckCountLabel');
    const deckHealthOverall = document.getElementById('deckHealthOverall');
    const metricFrontloadValue = document.getElementById('metricFrontloadValue');
    const metricBlockValue = document.getElementById('metricBlockValue');
    const metricScalingValue = document.getElementById('metricScalingValue');
    const metricConsistencyValue = document.getElementById('metricConsistencyValue');
    const metricUtilityValue = document.getElementById('metricUtilityValue');
    const metricFrontloadBar = document.getElementById('metricFrontloadBar');
    const metricBlockBar = document.getElementById('metricBlockBar');
    const metricScalingBar = document.getElementById('metricScalingBar');
    const metricConsistencyBar = document.getElementById('metricConsistencyBar');
    const metricUtilityBar = document.getElementById('metricUtilityBar');
    const deckHealthWeaknesses = document.getElementById('deckHealthWeaknesses');
    const deckHealthNextPicks = document.getElementById('deckHealthNextPicks');
    const pickAdvisorBanner = document.getElementById('pickAdvisorBanner');
    const pickAdvisorList = document.getElementById('pickAdvisorList');
    const rightPanels = document.querySelector('.right-panels');
    const tabComparisonBtn = document.getElementById('tabComparisonBtn');
    const tabDeckBtn = document.getElementById('tabDeckBtn');

    const overlay = document.getElementById('cardOverlay');
    const overlayCard = document.getElementById('overlayCard');
    const overlayImg = document.getElementById('overlayImg');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayDescription = document.getElementById('overlayDescription');
    const overlayAddCompare = document.getElementById('overlayAddCompare');
    const overlayAddDeck = document.getElementById('overlayAddDeck');

    if (!input || !allCardsGrid || !comparisonGrid || !currentDeckGrid || !comparisonEmpty || !comparisonCountLabel || !deckCountLabel || !overlay || !overlayCard || !overlayImg || !overlayTitle || !overlayDescription || !overlayAddCompare || !overlayAddDeck) {
        return;
    }

    const plusAvailabilityCache = new Map();
    const cardTraitsCache = new Map();

    let cardDescriptions = {};
    let cardCanonical = {};
    let synergyMetadata = {
        packages: {},
        cards: {}
    };
    let showPlus = false;
    let toggleInProgress = false;
    let activeOverlayItem = null;
    let activeOverlayCardKey = '';
    let activeOverlaySource = '';
    let overlayImageRequestId = 0;
    let activeRightPanel = 'comparison';

    const cardCatalog = new Map();
    const deckState = Array.from(currentDeckGrid.querySelectorAll('.card-grid-item'))
        .map(item => item.getAttribute('data-card-key'))
        .filter(Boolean);
    const comparisonState = [];

    function allGridItems() {
        return Array.from(document.querySelectorAll('.card-grid-item'));
    }

    function prepareItem(item) {
        const img = item.querySelector('.card-image-wrap > img:last-child');
        const small = item.querySelector('small');
        if (!img || !small) {
            return;
        }

        if (!img.dataset.baseSrc) {
            img.dataset.baseSrc = img.src;
        }

        if (!small.dataset.originalText) {
            small.dataset.originalText = small.textContent.trim();
        }
    }

    function normalizeCardKey(cardKey) {
        return (cardKey || '').replace(/Plus$/i, '');
    }

    function getPlusSrc(baseSrc) {
        return baseSrc.replace(/\.png(?=($|\?))/i, 'Plus.png');
    }

    function canLoadImage(url) {
        if (plusAvailabilityCache.has(url)) {
            return Promise.resolve(plusAvailabilityCache.get(url));
        }

        return new Promise(resolve => {
            const probe = new Image();
            probe.onload = () => {
                plusAvailabilityCache.set(url, true);
                resolve(true);
            };
            probe.onerror = () => {
                plusAvailabilityCache.set(url, false);
                resolve(false);
            };
            probe.src = url;
        });
    }

    async function applyCardMode(item, enablePlus) {
        prepareItem(item);

        const img = item.querySelector('.card-image-wrap > img:last-child');
        const small = item.querySelector('small');
        if (!img || !small) {
            return;
        }

        const baseSrc = img.dataset.baseSrc;

        if (!enablePlus) {
            img.src = baseSrc;
            small.classList.remove('plus-mode');
            small.textContent = small.dataset.originalText;
            return;
        }

        const plusSrc = getPlusSrc(baseSrc);
        const plusExists = await canLoadImage(plusSrc);

        if (plusExists) {
            img.src = plusSrc;
            small.classList.add('plus-mode');
            small.textContent = small.dataset.originalText + '+';
        } else {
            img.src = baseSrc;
            small.classList.remove('plus-mode');
            small.textContent = small.dataset.originalText;
        }
    }

    function getCardEntry(item) {
        const cardKey = normalizeCardKey(item.getAttribute('data-card-key'));
        return cardDescriptions[cardKey] || null;
    }

    function getCardEntryByKey(cardKey) {
        return cardDescriptions[normalizeCardKey(cardKey)] || null;
    }

    function getCardDescription(item, fallbackTitle, useUpgraded) {
        const entry = getCardEntry(item);
        if (entry) {
            if (useUpgraded && typeof entry.upgraded_description === 'string' && entry.upgraded_description.trim()) {
                return entry.upgraded_description;
            }
            if (typeof entry.description === 'string' && entry.description.trim()) {
                return entry.description;
            }
        }
        return `No description found for ${fallbackTitle}.`;
    }

    function getCardDescriptionByKey(cardKey, fallbackTitle, useUpgraded) {
        const entry = getCardEntryByKey(cardKey);
        if (entry) {
            if (useUpgraded && typeof entry.upgraded_description === 'string' && entry.upgraded_description.trim()) {
                return entry.upgraded_description;
            }
            if (typeof entry.description === 'string' && entry.description.trim()) {
                return entry.description;
            }
        }

        return `No description found for ${fallbackTitle}.`;
    }

    function resolveOverlaySourceElement(cardKey, source) {
        if (!cardKey) {
            return null;
        }

        const selectorsBySource = {
            all: '#allCardsGrid',
            comparison: '#comparisonGrid',
            deck: '#currentDeckGrid'
        };

        const sourceSelector = selectorsBySource[source] || '';
        if (sourceSelector) {
            const sourceRoot = document.querySelector(sourceSelector);
            const fromSource = sourceRoot?.querySelector(`.card-grid-item[data-card-key="${cardKey}"]`);
            if (fromSource) {
                return fromSource;
            }
        }

        return document.querySelector(`.card-grid-item[data-card-key="${cardKey}"]`);
    }

    function getBaseImageSource(cardKey, item) {
        if (item) {
            const img = item.querySelector('.card-image-wrap > img:last-child');
            if (img?.dataset?.baseSrc) {
                return img.dataset.baseSrc;
            }
        }

        return cardCatalog.get(cardKey)?.src || '';
    }

    function setOverlayImage(cardKey, useUpgraded, item) {
        const baseSrc = getBaseImageSource(cardKey, item);
        if (!baseSrc) {
            return;
        }

        overlayImg.dataset.baseSrc = baseSrc;
        const requestId = ++overlayImageRequestId;

        if (!useUpgraded) {
            overlayImg.src = baseSrc;
            return;
        }

        const plusSrc = getPlusSrc(baseSrc);
        canLoadImage(plusSrc).then(exists => {
            if (requestId !== overlayImageRequestId) {
                return;
            }

            overlayImg.src = exists ? plusSrc : baseSrc;
        });
    }

    function syncOverlayFromCardKey(cardKey, source, preferredItem) {
        if (!cardKey) {
            return;
        }

        let item = preferredItem;
        if (!item || !document.body.contains(item) || item.getAttribute('data-card-key') !== cardKey) {
            item = resolveOverlaySourceElement(cardKey, source);
        }

        let useUpgraded = showPlus;
        const fallbackLabel = cardCatalog.get(cardKey)?.label || cardKey;

        if (item) {
            prepareItem(item);
            const small = item.querySelector('small');
            if (small) {
                overlayTitle.textContent = small.textContent;
                overlayTitle.classList.toggle('plus-mode', small.classList.contains('plus-mode'));
                overlayTitle.dataset.originalText = small.dataset.originalText || fallbackLabel;
                useUpgraded = small.classList.contains('plus-mode');
            } else {
                overlayTitle.textContent = useUpgraded ? `${fallbackLabel}+` : fallbackLabel;
                overlayTitle.classList.toggle('plus-mode', useUpgraded);
                overlayTitle.dataset.originalText = fallbackLabel;
            }
        } else {
            overlayTitle.textContent = useUpgraded ? `${fallbackLabel}+` : fallbackLabel;
            overlayTitle.classList.toggle('plus-mode', useUpgraded);
            overlayTitle.dataset.originalText = fallbackLabel;
        }

        setOverlayImage(cardKey, useUpgraded, item);

        overlayDescription.textContent = getCardDescriptionByKey(cardKey, fallbackLabel, useUpgraded);
        renderOverlayInsights(cardKey, useUpgraded);

        activeOverlayItem = item;
        activeOverlayCardKey = cardKey;
        activeOverlaySource = source || activeOverlaySource;
    }

    function refreshOverlayIfOpen() {
        if (overlay.style.opacity !== '1') {
            return;
        }

        syncOverlayFromCardKey(activeOverlayCardKey, activeOverlaySource, activeOverlayItem);
    }

    function ensurePickupCornerScore(item) {
        const imageWrap = item.querySelector('.card-image-wrap');
        if (!imageWrap) {
            return null;
        }

        let badge = imageWrap.querySelector('.pickup-corner-score');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'pickup-corner-score';
            imageWrap.appendChild(badge);
        }

        return badge;
    }

    function createCardTile(key, actionMode, stateIndex) {
        const card = cardCatalog.get(key);
        if (!card) {
            return null;
        }

        const item = document.createElement('div');
        item.className = 'card-grid-item';
        item.setAttribute('data-card-name', card.name);
        item.setAttribute('data-card-key', key);
        if (typeof stateIndex === 'number') {
            item.setAttribute('data-state-index', String(stateIndex));
        }

        let actionsHtml = '';
        let strengthSlotHtml = '';
        if (actionMode === 'comparison') {
            strengthSlotHtml = `
                <div class="comparison-strength-slot">
                    <div class="card-strength-block">
                        <div class="card-strength-head comparison-strength-head">
                            <span class="card-strength-score" data-strength-score>0</span>
                            <span class="card-strength-band" data-strength-band>Playable</span>
                        </div>
                        <div class="card-strength-bars comparison-strength-bars">
                            <div class="card-strength-row comparison-strength-row">
                                <span class="card-strength-row-label">B</span>
                                <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="base"></div></div>
                                <span class="card-strength-value" data-strength-value="base">0</span>
                            </div>
                            <div class="card-strength-row comparison-strength-row">
                                <span class="card-strength-row-label">N</span>
                                <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="need"></div></div>
                                <span class="card-strength-value" data-strength-value="need">0</span>
                            </div>
                            <div class="card-strength-row comparison-strength-row">
                                <span class="card-strength-row-label">F</span>
                                <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="fit"></div></div>
                                <span class="card-strength-value" data-strength-value="fit">0</span>
                            </div>
                        </div>
                        <div class="card-strength-why"></div>
                    </div>
                </div>`;
            actionsHtml = `<div class="card-actions">
                    <button type="button" class="action-btn btn-deck" data-action="add-deck">Deck</button>
               </div>`;
        }
        if (actionMode === 'deck') {
            actionsHtml = `<div class="card-actions">
                    <button type="button" class="action-btn btn-remove" data-action="remove-deck">Remove</button>
               </div>`;
        }

        item.innerHTML = `
            <div class="card h-100 border-0" style="background-color: #111821;">
                <div class="card-image-wrap">
                    <img class="card-art" src="${card.src}" alt="Card image" />
                </div>
                ${strengthSlotHtml}
                <div class="card-body text-center" style="background-color: rgba(255,255,255,0.06);">
                    <small class="text-truncate d-block text-light fw-semibold" style="max-width: 100%;">${card.label}</small>
                </div>
                ${actionsHtml}
            </div>`;

        return item;
    }

    async function refreshGridModeAndBadges(grid) {
        const gridItems = Array.from(grid.querySelectorAll('.card-grid-item'));
        gridItems.forEach(prepareItem);
        await Promise.all(gridItems.map(item => applyCardMode(item, showPlus)));
    }

    async function renderCollection(grid, keys) {
        grid.innerHTML = '';
        let actionMode = null;
        if (grid === comparisonGrid) {
            actionMode = 'comparison';
        }
        if (grid === currentDeckGrid) {
            actionMode = 'deck';
        }

        keys.forEach((key, index) => {
            const item = createCardTile(key, actionMode, index);
            if (item) {
                grid.appendChild(item);
            }
        });

        await refreshGridModeAndBadges(grid);
    }

    function updateCounts() {
        comparisonCountLabel.textContent = `${comparisonState.length} cards`;
        deckCountLabel.textContent = `${deckState.length} cards`;
        comparisonEmpty.hidden = comparisonState.length > 0;
        renderDeckHealth();
        renderSynergyHighlights();
    }

    function clampScore(value) {
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    function getDeckCardText(cardKey) {
        const normalized = normalizeCardKey(cardKey).toLowerCase();
        const entry = cardDescriptions[normalizeCardKey(cardKey)] || {};
        const title = typeof entry.title === 'string' ? entry.title.toLowerCase() : '';
        const description = typeof entry.description === 'string' ? entry.description.toLowerCase() : '';
        const upgraded = typeof entry.upgraded_description === 'string' ? entry.upgraded_description.toLowerCase() : '';
        return `${normalized} ${title} ${description} ${upgraded}`;
    }

    function includesAny(text, terms) {
        return terms.some(term => text.includes(term));
    }

    function uniqueValues(items) {
        return Array.from(new Set(items.filter(Boolean)));
    }

    function incrementCount(map, key, amount) {
        if (!key) {
            return;
        }

        map[key] = (map[key] || 0) + (amount || 1);
    }

    function getCardMetadata(cardKey) {
        return synergyMetadata.cards[normalizeCardKey(cardKey)] || null;
    }

    function getPackageMetadata(packageName) {
        return synergyMetadata.packages[packageName] || null;
    }

    function getMetadataPenaltyWeight(penalty) {
        if (penalty === 'high') {
            return 8;
        }
        if (penalty === 'medium') {
            return 5;
        }
        return 3;
    }

    function getRoleMetricAdjustments(roles) {
        const metrics = {
            frontload: 0,
            block: 0,
            scaling: 0,
            consistency: 0,
            utility: 0
        };

        roles.forEach(role => {
            if (role === 'strength_source') {
                metrics.scaling += 8;
            }
            if (role === 'strength_payoff' || role === 'burst_multiplier') {
                metrics.frontload += 6;
                metrics.scaling += 4;
            }
            if (role === 'block_engine' || role === 'block_generator') {
                metrics.block += 8;
            }
            if (role === 'block_payoff' || role === 'block_multiplier') {
                metrics.block += 6;
                metrics.scaling += 3;
            }
            if (role === 'exhaust_engine' || role === 'exhaust_enabler') {
                metrics.utility += 5;
                metrics.consistency += 3;
            }
            if (role === 'exhaust_payoff') {
                metrics.scaling += 7;
                metrics.utility += 4;
            }
            if (role === 'self_damage_enabler') {
                metrics.frontload += 3;
                metrics.utility += 3;
            }
            if (role === 'self_damage_payoff') {
                metrics.scaling += 7;
            }
            if (role === 'vulnerable_source') {
                metrics.frontload += 4;
                metrics.utility += 4;
            }
            if (role === 'vulnerable_payoff') {
                metrics.frontload += 5;
                metrics.scaling += 3;
            }
            if (role === 'draw_engine' || role === 'draw_support') {
                metrics.consistency += 8;
            }
            if (role === 'energy_engine' || role === 'cost_cheat') {
                metrics.consistency += 6;
            }
            if (role === 'aoe' || role === 'aoe_finisher') {
                metrics.frontload += 4;
                metrics.utility += 6;
            }
            if (role === 'finisher') {
                metrics.frontload += 4;
            }
            if (role === 'boss_scaling') {
                metrics.scaling += 5;
            }
            if (role === 'utility') {
                metrics.utility += 4;
            }
        });

        return metrics;
    }

    function inferPackagesFromTraits(traits) {
        const packages = [];

        if (traits.scaling || traits.multiHit || traits.attackPayoff) {
            packages.push('strength');
        }
        if (traits.block || traits.blockPayoff) {
            packages.push('block');
        }
        if (traits.exhaustEnabler || traits.exhaustPayoff) {
            packages.push('exhaust');
        }
        if (traits.selfDamage || traits.selfDamagePayoff) {
            packages.push('self_damage');
        }
        if (traits.vulnerable || traits.vulnerablePayoff) {
            packages.push('vulnerable');
        }
        if (traits.strike || traits.strikePayoff) {
            packages.push('strike');
        }

        return uniqueValues(packages);
    }

    function inferRolesFromTraits(traits) {
        const roles = [];

        if (traits.draw || traits.deckManipulation) {
            roles.push('draw_support');
        }
        if (traits.block) {
            roles.push('repeatable_block');
        }
        if (traits.scaling) {
            roles.push('strength_source');
        }
        if (traits.multiHit) {
            roles.push('strength_payoff');
        }
        if (traits.exhaustEnabler) {
            roles.push('exhaust_enabler');
        }
        if (traits.exhaustPayoff) {
            roles.push('exhaust_payoff');
        }
        if (traits.vulnerable) {
            roles.push('vulnerable_source');
        }
        if (traits.vulnerablePayoff) {
            roles.push('vulnerable_payoff');
        }
        if (traits.selfDamage) {
            roles.push('self_damage_enabler');
        }
        if (traits.selfDamagePayoff) {
            roles.push('self_damage_payoff');
        }
        if (traits.strikePayoff) {
            roles.push('strike_payoff');
        }
        if (traits.strike) {
            roles.push('strike_support');
        }
        if (traits.costCheat) {
            roles.push('cost_cheat');
        }
        if (traits.energyGain) {
            roles.push('energy_engine');
        }
        if (traits.block || traits.status || traits.draw) {
            roles.push('stabilizer');
        }
        if (!traits.attack || traits.block || traits.draw || traits.exhaust) {
            roles.push('non_attack_density');
            roles.push('skill_density');
        }
        if (traits.block || traits.draw || traits.status) {
            roles.push('setup_time');
        }

        return uniqueValues(roles);
    }

    function getProfileMetricValue(profile, packageName, metricKey) {
        if (metricKey === 'strengthSources') {
            return profile.roleCounts.strength_source || 0;
        }
        if (metricKey === 'multiHitPayoffs') {
            return profile.multiHit || 0;
        }
        if (metricKey === 'repeatableBlockCards') {
            return profile.roleCounts.repeatable_block || 0;
        }
        if (metricKey === 'corePayoffs') {
            return profile.blockPayoffCards || 0;
        }
        if (metricKey === 'exhaustEnablers') {
            return profile.exhaustEnablerCards || 0;
        }
        if (metricKey === 'enginePieces') {
            return profile.exhaustEnginePieces || 0;
        }
        if (metricKey === 'repeatableHpLoss') {
            return profile.selfDamageEnablerCards || 0;
        }
        if (metricKey === 'payoffCards') {
            if (packageName === 'self_damage') {
                return profile.selfDamagePayoffCards || 0;
            }
            if (packageName === 'vulnerable') {
                return profile.vulnerablePayoffCards || 0;
            }
            return 0;
        }
        if (metricKey === 'stabilizers') {
            return profile.stabilizers || 0;
        }
        if (metricKey === 'vulnerableSources') {
            return profile.vulnerableEnablerCards || 0;
        }
        if (metricKey === 'strikeCards') {
            return profile.strikeCards || 0;
        }
        if (metricKey === 'drawOrEnergySupport') {
            return (profile.roleCounts.draw_support || 0) + (profile.roleCounts.energy_engine || 0) + (profile.roleCounts.cost_cheat || 0);
        }

        return 0;
    }

    function getPackageActivation(profile, packageName) {
        const packageMetadata = getPackageMetadata(packageName);
        const enabledAt = packageMetadata?.thresholds?.enabledAt;
        if (!enabledAt) {
            return profile.packageCounts[packageName] > 0 ? 1 : 0;
        }

        const keys = Object.keys(enabledAt);
        if (keys.length === 0) {
            return 1;
        }

        const ratios = keys.map(key => {
            const actual = getProfileMetricValue(profile, packageName, key);
            const target = Math.max(enabledAt[key], 1);
            return clamp01(actual / target);
        });

        return sumValues(ratios) / ratios.length;
    }

    function requirementIsSatisfied(requirement, profile) {
        if (!requirement) {
            return true;
        }

        if (requirement.type === 'packageCount') {
            return (profile.packageCounts[requirement.package] || 0) >= (requirement.min || 0);
        }
        if (requirement.type === 'roleCount') {
            return (profile.roleCounts[requirement.role] || 0) >= (requirement.min || 0);
        }
        if (requirement.type === 'rolePresence') {
            return (profile.roleCounts[requirement.role] || 0) > 0;
        }
        if (requirement.type === 'cardPresence') {
            return (requirement.anyOf || []).some(cardKey => profile.cardPresence.has(cardKey));
        }
        if (requirement.type === 'stabilizerCount') {
            return (profile.stabilizers || 0) >= (requirement.min || 0);
        }

        return true;
    }

    function getRequirementReason(requirement) {
        if (requirement.type === 'packageCount') {
            return `Needs a real ${requirement.package.replace('_', ' ')} shell`;
        }
        if (requirement.type === 'roleCount') {
            return `Needs more ${requirement.role.replace(/_/g, ' ')}`;
        }
        if (requirement.type === 'cardPresence') {
            return 'Needs one of its anchor cards to come together';
        }
        if (requirement.type === 'stabilizerCount') {
            return 'Needs more sustain or mitigation first';
        }

        return 'Needs more deck support';
    }

    function sumValues(items) {
        return items.reduce((total, value) => total + value, 0);
    }

    function scaledContribution(deckValue, cardValue, factor) {
        if (deckValue <= 0 || cardValue <= 0) {
            return 0;
        }

        return Math.min(deckValue, 6) * Math.min(cardValue, 3) * factor;
    }

    function getCardTraits(cardKey) {
        const normalized = normalizeCardKey(cardKey);
        if (cardTraitsCache.has(normalized)) {
            return cardTraitsCache.get(normalized);
        }

        const text = getDeckCardText(normalized);
        const entry = cardDescriptions[normalized] || {};
        const title = typeof entry.title === 'string' ? entry.title.toLowerCase() : normalized.toLowerCase();

        const metadata = getCardMetadata(normalized);
        const metadataRoles = metadata?.roles || [];
        const metadataPackages = metadata?.packages || [];

        let attack = includesAny(text, ['deal', 'hits', 'attack', 'fatal']);
        let block = includesAny(text, [' block', 'gain block', 'gain 5 block', 'gain 7 block', 'gain 8 block', 'gain 12 block', 'gain 16 block', 'gain 30 block', 'gain 40 block', 'plating', 'double your block', 'block is not removed']);
        let scaling = includesAny(text, ['strength', 'dexterity', 'at the start of your turn', 'increase this card\'s damage', 'max hp']) || includesAny(title, ['demon form', 'inflame', 'rampage', 'feed']);
        let draw = includesAny(text, ['draw', 'into your hand', 'on top of your draw pile']);
        let exhaust = includesAny(text, ['exhaust']);
        let vulnerable = includesAny(text, ['vulnerable']);
        let aoe = includesAny(text, ['all enemies', 'each enemy']);
        let status = includesAny(text, ['weak', 'frail', 'artifact', 'enemy loses', 'status', 'wound', 'burn', 'dazed']);
        let highCost = includesAny(text, ['cost 2', 'costs 2', 'cost 3', 'costs 3']) || includesAny(title, ['bludgeon', 'demon form', 'barricade', 'impervious', 'fiend fire', 'offering', 'corruption']);
        let lowCost = includesAny(text, ['cost 0', 'costs 0', 'free to play', 'costs 1 less', 'skills cost 0']) || includesAny(title, ['anger', 'battle trance', 'infernal blade']);
        let conditional = includesAny(text, ['if ', 'can only be played', 'only be played']) || title.includes('clash');
        let multiHit = includesAny(text, ['twice', '3 times', '4 times', 'x times', 'hits an additional time', 'played an extra time']);
        let selfDamage = includesAny(text, ['lose 1 hp', 'lose 2 hp', 'lose 3 hp', 'lose 6 hp']);
        let strike = title.includes('strike') || includesAny(text, ['containing “strike”', 'containing "strike"', 'containing strike']);
        let deckManipulation = includesAny(text, ['top card of your draw pile', 'discard pile', 'transform', 'copy of', 'choose an attack or power card']);
        let costCheat = includesAny(text, ['costs 0', 'cost 0', 'free to play', 'costs 1 less', 'skills cost 0']);
        let energyGain = includesAny(text, ['gain 1 energy', 'gain 2 energy', 'gain 3 energy', 'gain x energy', 'gain energy', 'energy for each attack']);
        let attackPayoff = includesAny(text, ['attack you play', 'attacks in your hand', 'for each other attack', 'for each attack in your hand', 'third attack', 'next attack', 'random attack']);
        let exhaustEnabler = includesAny(text, ['exhaust 1 card', 'exhaust your hand', 'exhaust all', 'exhaust the top card', 'whenever you play a skill, exhaust it']) ? 2 : (exhaust ? 1 : 0);
        let exhaustPayoff = includesAny(text, ['whenever a card is exhausted', 'for each card exhausted', 'exhaust pile', 'if you exhausted', 'plays from the exhaust pile']) ? 2 : 0;
        let blockPayoff = includesAny(text, ['damage equal to your block', 'whenever you gain block', 'block is not removed', 'double your block', 'first time you gain block']) ? 2 : 0;
        let vulnerablePayoff = includesAny(text, ['for each vulnerable', 'vulnerable enemies', 'double the enemy\'s vulnerable', 'whenever you apply vulnerable']) ? 2 : 0;
        let selfDamagePayoff = includesAny(text, ['whenever you lose hp on your turn', 'if you lost hp this turn', 'for each time you lost hp', 'whenever you lose hp']) ? 2 : 0;
        let strikePayoff = includesAny(text, ['containing “strike”', 'containing "strike"', 'containing strike']) ? 2 : 0;

        if (metadataRoles.includes('strength_source') || metadataRoles.includes('boss_scaling')) {
            scaling = true;
        }
        if (metadataRoles.includes('strength_payoff')) {
            multiHit = true;
            attackPayoff = true;
        }
        if (metadataRoles.includes('block_engine') || metadataRoles.includes('block_generator')) {
            block = true;
        }
        if (metadataRoles.includes('block_payoff') || metadataRoles.includes('block_multiplier')) {
            blockPayoff = Math.max(blockPayoff, 2);
        }
        if (metadataRoles.includes('draw_engine') || metadataRoles.includes('draw_support')) {
            draw = true;
        }
        if (metadataRoles.includes('vulnerable_source')) {
            vulnerable = true;
        }
        if (metadataRoles.includes('vulnerable_payoff')) {
            vulnerablePayoff = Math.max(vulnerablePayoff, 2);
        }
        if (metadataRoles.includes('self_damage_enabler')) {
            selfDamage = true;
        }
        if (metadataRoles.includes('self_damage_payoff')) {
            selfDamagePayoff = Math.max(selfDamagePayoff, 2);
        }
        if (metadataRoles.includes('exhaust_enabler') || metadataRoles.includes('exhaust_engine')) {
            exhaust = true;
            exhaustEnabler = Math.max(exhaustEnabler, 2);
        }
        if (metadataRoles.includes('exhaust_payoff')) {
            exhaustPayoff = Math.max(exhaustPayoff, 2);
        }
        if (metadataRoles.includes('strike_support')) {
            strike = true;
        }
        if (metadataRoles.includes('strike_payoff')) {
            strikePayoff = Math.max(strikePayoff, 2);
        }
        if (metadataRoles.includes('cost_cheat') || metadataRoles.includes('energy_engine')) {
            costCheat = true;
            lowCost = true;
            energyGain = true;
        }
        if (metadataRoles.includes('aoe') || metadataRoles.includes('aoe_finisher')) {
            aoe = true;
        }
        if (metadataRoles.includes('finisher') || metadataRoles.includes('frontload')) {
            attack = true;
        }

        const metrics = {
            frontload: 0,
            block: 0,
            scaling: 0,
            consistency: 0,
            utility: 0
        };

        if (attack) {
            metrics.frontload += 14;
        }
        if (block) {
            metrics.block += 16;
        }
        if (scaling) {
            metrics.scaling += 16;
        }
        if (draw) {
            metrics.consistency += 14;
        }
        if (aoe) {
            metrics.frontload += 6;
            metrics.utility += 12;
        }
        if (vulnerable) {
            metrics.frontload += 5;
            metrics.utility += 8;
        }
        if (status) {
            metrics.utility += 10;
            metrics.block += 2;
        }
        if (exhaust) {
            metrics.utility += 4;
        }
        if (exhaustPayoff) {
            metrics.scaling += 8;
            metrics.utility += 4;
        }
        if (blockPayoff) {
            metrics.block += 8;
            metrics.scaling += 6;
        }
        if (vulnerablePayoff) {
            metrics.frontload += 7;
            metrics.scaling += 4;
        }
        if (selfDamagePayoff) {
            metrics.scaling += 8;
            metrics.utility += 4;
        }
        if (attackPayoff) {
            metrics.frontload += 8;
            metrics.consistency += 3;
        }
        if (strikePayoff) {
            metrics.frontload += 7;
        }
        if (multiHit) {
            metrics.frontload += 4;
            metrics.scaling += scaling ? 4 : 0;
        }
        if (lowCost || costCheat) {
            metrics.consistency += 8;
        }
        if (energyGain) {
            metrics.consistency += 10;
            metrics.utility += 2;
        }
        if (deckManipulation) {
            metrics.consistency += 5;
        }
        if (selfDamage) {
            metrics.frontload += 4;
            metrics.utility += 3;
        }
        if (highCost) {
            metrics.scaling += 4;
            metrics.consistency -= 8;
        }
        if (conditional) {
            metrics.consistency -= 7;
        }

        const metadataMetricAdjustments = getRoleMetricAdjustments(metadataRoles);
        metrics.frontload += metadataMetricAdjustments.frontload;
        metrics.block += metadataMetricAdjustments.block;
        metrics.scaling += metadataMetricAdjustments.scaling;
        metrics.consistency += metadataMetricAdjustments.consistency;
        metrics.utility += metadataMetricAdjustments.utility;

        const packages = uniqueValues(metadataPackages.concat(inferPackagesFromTraits({
            attack,
            block,
            scaling,
            draw,
            exhaust,
            vulnerable,
            aoe,
            status,
            highCost,
            lowCost,
            conditional,
            multiHit,
            selfDamage,
            strike,
            deckManipulation,
            costCheat,
            energyGain,
            attackPayoff,
            exhaustEnabler,
            exhaustPayoff,
            blockPayoff,
            vulnerablePayoff,
            selfDamagePayoff,
            strikePayoff
        })));
        const roles = uniqueValues(metadataRoles.concat(inferRolesFromTraits({
            attack,
            block,
            scaling,
            draw,
            exhaust,
            vulnerable,
            aoe,
            status,
            highCost,
            lowCost,
            conditional,
            multiHit,
            selfDamage,
            strike,
            deckManipulation,
            costCheat,
            energyGain,
            attackPayoff,
            exhaustEnabler,
            exhaustPayoff,
            blockPayoff,
            vulnerablePayoff,
            selfDamagePayoff,
            strikePayoff
        })));

        const traits = {
            attack,
            block,
            scaling,
            draw,
            exhaust,
            vulnerable,
            aoe,
            status,
            highCost,
            lowCost,
            conditional,
            multiHit,
            selfDamage,
            strike,
            deckManipulation,
            costCheat,
            energyGain,
            attackPayoff,
            exhaustEnabler,
            exhaustPayoff,
            blockPayoff,
            vulnerablePayoff,
            selfDamagePayoff,
            strikePayoff,
            metadata,
            packages,
            roles,
            metrics
        };

        cardTraitsCache.set(normalized, traits);
        return traits;
    }

    function analyzeDeckHealth() {
        const summary = {
            frontload: 0,
            block: 0,
            scaling: 0,
            consistency: 0,
            utility: 0,
            aoeCards: 0,
            drawCards: 0,
            highCurveCards: 0,
            conditionalCards: 0
        };

        deckState.forEach(cardKey => {
            const traits = getCardTraits(cardKey);
            summary.frontload += traits.metrics.frontload;
            summary.block += traits.metrics.block;
            summary.scaling += traits.metrics.scaling;
            summary.consistency += traits.metrics.consistency;
            summary.utility += traits.metrics.utility;

            if (traits.aoe) {
                summary.aoeCards += 1;
            }
            if (traits.draw || traits.deckManipulation || traits.costCheat) {
                summary.drawCards += 1;
            }
            if (traits.highCost) {
                summary.highCurveCards += 1;
            }
            if (traits.conditional && !traits.exhaustPayoff && !traits.vulnerablePayoff) {
                summary.conditionalCards += 1;
            }
        });

        const deckSize = Math.max(deckState.length, 1);
        const frontload = clampScore(24 + (summary.frontload / deckSize) * 3.1 + summary.aoeCards * 4);
        const block = clampScore(20 + (summary.block / deckSize) * 3.3 + summary.utility * 0.18);
        const scaling = clampScore(18 + (summary.scaling / deckSize) * 3.4 + summary.drawCards * 2);
        const consistency = clampScore(45 + (summary.consistency / deckSize) * 2.9 + summary.drawCards * 3 - summary.highCurveCards * 5 - summary.conditionalCards * 4 - Math.max(0, deckSize - 22) * 2);
        const utility = clampScore(18 + (summary.utility / deckSize) * 3 + summary.aoeCards * 5);
        const overall = clampScore(frontload * 0.25 + block * 0.25 + scaling * 0.2 + consistency * 0.2 + utility * 0.1);

        return {
            frontload,
            block,
            scaling,
            consistency,
            utility,
            overall
        };
    }

    function metricSeverity(score) {
        if (score < 40) {
            return 'critical';
        }
        if (score < 60) {
            return 'weak';
        }
        return 'ok';
    }

    function toWeaknessText(metricKey) {
        if (metricKey === 'frontload') {
            return 'Low early damage pressure in turns 1-3.';
        }
        if (metricKey === 'block') {
            return 'Defense consistency is shaky in bad draws.';
        }
        if (metricKey === 'scaling') {
            return 'Limited long-fight scaling for elites and bosses.';
        }
        if (metricKey === 'consistency') {
            return 'Draw and energy curve can produce clunky turns.';
        }
        return 'Utility coverage is narrow against varied fights.';
    }

    function toSuggestionText(metricKey) {
        if (metricKey === 'frontload') {
            return 'Prioritize cheap attacks and vulnerable application.';
        }
        if (metricKey === 'block') {
            return 'Add efficient block and weak/mitigation tools.';
        }
        if (metricKey === 'scaling') {
            return 'Pick repeatable scaling powers or strength engines.';
        }
        if (metricKey === 'consistency') {
            return 'Add draw/energy smoothing and trim high-curve cards.';
        }
        return 'Look for AoE and broad utility effects.';
    }

    function setMetricDisplay(valueElement, barElement, score) {
        if (!valueElement || !barElement) {
            return;
        }

        valueElement.textContent = String(score);
        barElement.style.width = `${score}%`;
        if (score >= 70) {
            barElement.style.background = 'linear-gradient(90deg, #2f8f54 0%, #56d07d 100%)';
            return;
        }
        if (score >= 45) {
            barElement.style.background = 'linear-gradient(90deg, #9b7c2b 0%, #e0b94e 100%)';
            return;
        }
        barElement.style.background = 'linear-gradient(90deg, #8d2d2d 0%, #d45757 100%)';
    }

    function setListItems(listElement, items) {
        if (!listElement) {
            return;
        }

        listElement.innerHTML = '';
        items.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            listElement.appendChild(li);
        });
    }

    function renderDeckHealth() {
        if (!deckHealthOverall) {
            return;
        }

        const scores = analyzeDeckHealth();
        const rankedWeaknesses = [
            { key: 'frontload', score: scores.frontload },
            { key: 'block', score: scores.block },
            { key: 'scaling', score: scores.scaling },
            { key: 'consistency', score: scores.consistency },
            { key: 'utility', score: scores.utility }
        ].sort((a, b) => a.score - b.score);

        setMetricDisplay(metricFrontloadValue, metricFrontloadBar, scores.frontload);
        setMetricDisplay(metricBlockValue, metricBlockBar, scores.block);
        setMetricDisplay(metricScalingValue, metricScalingBar, scores.scaling);
        setMetricDisplay(metricConsistencyValue, metricConsistencyBar, scores.consistency);
        setMetricDisplay(metricUtilityValue, metricUtilityBar, scores.utility);
        deckHealthOverall.textContent = `${scores.overall} overall`;

        const weaknessItems = rankedWeaknesses
            .filter(item => metricSeverity(item.score) !== 'ok')
            .slice(0, 3)
            .map(item => toWeaknessText(item.key));

        if (weaknessItems.length === 0) {
            weaknessItems.push('No major weakness detected in this V1 model.');
        }

        const suggestionItems = rankedWeaknesses
            .slice(0, 2)
            .map(item => toSuggestionText(item.key));

        setListItems(deckHealthWeaknesses, weaknessItems);
        setListItems(deckHealthNextPicks, suggestionItems);
    }

    function getNeedDeficits(scores) {
        return {
            frontload: Math.max(0, 70 - scores.frontload),
            block: Math.max(0, 70 - scores.block),
            scaling: Math.max(0, 70 - scores.scaling),
            consistency: Math.max(0, 70 - scores.consistency),
            utility: Math.max(0, 70 - scores.utility)
        };
    }

    function clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    function getBasePowerScore(traits, context) {
        let score = 18;
        score += traits.metrics.frontload * 0.6;
        score += traits.metrics.block * 0.48;
        score += traits.metrics.scaling * 0.55;
        score += traits.metrics.consistency * 0.42;
        score += traits.metrics.utility * 0.35;

        if (traits.highCost) {
            score -= 4;
        }
        if (traits.conditional) {
            score -= 4;
        }

        if (context === 'short') {
            if (traits.attack) {
                score += 7;
            }
            if (traits.aoe) {
                score += 4;
            }
            if (traits.costCheat || traits.lowCost) {
                score += 4;
            }
            if (traits.highCost) {
                score -= 5;
            }
        }
        if (context === 'elite') {
            if (traits.block) {
                score += 6;
            }
            if (traits.scaling) {
                score += 4;
            }
            if (traits.aoe) {
                score += 3;
            }
        }
        if (context === 'boss') {
            if (traits.scaling) {
                score += 8;
            }
            if (traits.draw) {
                score += 4;
            }
            if (traits.blockPayoff) {
                score += 3;
            }
            if (traits.highCost) {
                score += 2;
            }
            if (traits.attack && !traits.scaling) {
                score -= 2;
            }
        }

        return clampScore(score);
    }

    function getMetricNeedContribution(metricValue, deficit, divisor) {
        if (metricValue <= 0 || deficit <= 0) {
            return 0;
        }

        return deficit * Math.min(metricValue, divisor) / divisor;
    }

    function getNeedMatchScore(traits, deficits, context) {
        let score = 0;
        score += getMetricNeedContribution(traits.metrics.frontload, deficits.frontload, 34);
        score += getMetricNeedContribution(traits.metrics.block, deficits.block, 34);
        score += getMetricNeedContribution(traits.metrics.scaling, deficits.scaling, 30);
        score += getMetricNeedContribution(traits.metrics.consistency, deficits.consistency, 34);
        score += getMetricNeedContribution(traits.metrics.utility, deficits.utility, 34);

        if (context === 'short') {
            score += traits.attack || traits.aoe ? 7 : 0;
        }
        if (context === 'elite') {
            score += traits.block || traits.blockPayoff ? 6 : 0;
        }
        if (context === 'boss') {
            score += traits.scaling || traits.exhaustPayoff || traits.selfDamagePayoff ? 10 : 0;
        }

        return clampScore(score);
    }

    function toPickupBand(score) {
        if (score >= 85) {
            return { className: 'pickup-snap', label: 'Snap Pick' };
        }
        if (score >= 70) {
            return { className: 'pickup-strong', label: 'Strong' };
        }
        if (score >= 55) {
            return { className: 'pickup-playable', label: 'Playable' };
        }
        if (score >= 40) {
            return { className: 'pickup-niche', label: 'Niche' };
        }
        return { className: 'pickup-skip', label: 'Skip Lean' };
    }

    function buildStrengthReasons(traits, profile, deficits, synergy) {
        const reasons = [];

        synergy.positiveReasons.slice(0, 2).forEach(reason => reasons.push(reason));

        if (reasons.length < 2 && deficits.block >= 20 && (traits.block || traits.blockPayoff)) {
            reasons.push('Patches your current block weakness');
        }
        if (reasons.length < 2 && deficits.scaling >= 20 && (traits.scaling || traits.exhaustPayoff || traits.selfDamagePayoff)) {
            reasons.push('Improves long-fight scaling');
        }
        if (reasons.length < 2 && deficits.frontload >= 20 && (traits.attack || traits.vulnerable || traits.aoe)) {
            reasons.push('Adds early-fight pressure');
        }
        if (reasons.length < 2 && deficits.consistency >= 20 && (traits.draw || traits.deckManipulation || traits.costCheat)) {
            reasons.push('Smooths clunky draws and setup turns');
        }

        synergy.negativeReasons.slice(0, 1).forEach(reason => reasons.push(reason));

        if (reasons.length === 0) {
            reasons.push('Neutral impact for current deck and context');
        }

        return Array.from(new Set(reasons)).slice(0, 3);
    }

    function getDeckSynergyProfile() {
        const profile = {
            attack: 0,
            block: 0,
            scaling: 0,
            draw: 0,
            exhaust: 0,
            vulnerable: 0,
            aoe: 0,
            status: 0,
            highCost: 0,
            lowCost: 0,
            conditional: 0,
            multiHit: 0,
            attackEnablers: 0,
            attackPayoffs: 0,
            exhaustEnablers: 0,
            exhaustPayoffs: 0,
            blockEnablers: 0,
            blockPayoffs: 0,
            vulnerableEnablers: 0,
            vulnerablePayoffs: 0,
            selfDamageEnablers: 0,
            selfDamagePayoffs: 0,
            strikeCards: 0,
            strikePayoffs: 0,
            packageCounts: {},
            roleCounts: {},
            cardPresence: new Set(),
            blockPayoffCards: 0,
            exhaustEnablerCards: 0,
            exhaustPayoffCards: 0,
            exhaustEnginePieces: 0,
            selfDamageEnablerCards: 0,
            selfDamagePayoffCards: 0,
            vulnerableEnablerCards: 0,
            vulnerablePayoffCards: 0,
            stabilizers: 0
        };

        deckState.forEach(cardKey => {
            const traits = getCardTraits(cardKey);
            profile.cardPresence.add(normalizeCardKey(cardKey));

            if (traits.attack) {
                profile.attack += 1;
                profile.attackEnablers += traits.highCost ? 1 : 2;
            }
            if (traits.block) {
                profile.block += 1;
                profile.blockEnablers += 2;
            }
            if (traits.scaling) {
                profile.scaling += 1;
            }
            if (traits.draw || traits.deckManipulation || traits.costCheat) {
                profile.draw += 1;
            }
            if (traits.exhaust) {
                profile.exhaust += 1;
            }
            if (traits.vulnerable) {
                profile.vulnerable += 1;
                profile.vulnerableEnablers += 2;
                profile.vulnerableEnablerCards += 1;
            }
            if (traits.aoe) {
                profile.aoe += 1;
            }
            if (traits.status) {
                profile.status += 1;
            }
            if (traits.highCost) {
                profile.highCost += 1;
            }
            if (traits.lowCost || traits.costCheat) {
                profile.lowCost += 1;
            }
            if (traits.conditional) {
                profile.conditional += 1;
            }
            if (traits.multiHit) {
                profile.multiHit += 1;
            }

            profile.attackPayoffs += traits.attackPayoff;
            profile.exhaustEnablers += traits.exhaustEnabler;
            profile.exhaustPayoffs += traits.exhaustPayoff;
            profile.blockPayoffs += traits.blockPayoff;
            profile.vulnerablePayoffs += traits.vulnerablePayoff;
            profile.selfDamageEnablers += traits.selfDamage ? 2 : 0;
            profile.selfDamagePayoffs += traits.selfDamagePayoff;
            profile.strikeCards += traits.strike ? 1 : 0;
            profile.strikePayoffs += traits.strikePayoff;

            if (traits.blockPayoff) {
                profile.blockPayoffCards += 1;
            }
            if (traits.exhaustEnabler) {
                profile.exhaustEnablerCards += 1;
            }
            if (traits.exhaustPayoff) {
                profile.exhaustPayoffCards += 1;
            }
            if (traits.selfDamage) {
                profile.selfDamageEnablerCards += 1;
            }
            if (traits.selfDamagePayoff) {
                profile.selfDamagePayoffCards += 1;
            }
            if (traits.vulnerablePayoff) {
                profile.vulnerablePayoffCards += 1;
            }
            if (traits.roles.includes('stabilizer')) {
                profile.stabilizers += 1;
            }
            if (traits.roles.includes('exhaust_engine') || ['StS2_Ironclad-Corruption', 'StS2_Ironclad-DarkEmbrace', 'StS2_Ironclad-FeelNoPain'].includes(normalizeCardKey(cardKey))) {
                profile.exhaustEnginePieces += 1;
            }

            traits.packages.forEach(packageName => incrementCount(profile.packageCounts, packageName));
            traits.roles.forEach(roleName => incrementCount(profile.roleCounts, roleName));
        });

        return profile;
    }

    function getSynergyScore(profile, traits) {
        const contributions = [];
        const addContribution = function (value, reason) {
            if (Math.abs(value) < 0.5) {
                return;
            }

            contributions.push({ value, reason });
        };

        addContribution(scaledContribution(profile.exhaustEnablers, traits.exhaustPayoff, 2.4), 'Pays off your exhaust shell');
        addContribution(scaledContribution(profile.exhaustPayoffs, traits.exhaustEnabler, 2), 'Adds fuel to your exhaust payoffs');
        addContribution(scaledContribution(profile.blockEnablers, traits.blockPayoff, 2.2), 'Converts your block package into extra value');
        addContribution(scaledContribution(profile.blockPayoffs, traits.block ? 2 : 0, 1.8), 'Feeds existing block payoffs');
        addContribution(scaledContribution(profile.vulnerableEnablers, traits.vulnerablePayoff, 2.6), 'Capitalizes on your Vulnerable package');
        addContribution(scaledContribution(profile.vulnerablePayoffs, traits.vulnerable ? 2 : 0, 2.2), 'Adds more Vulnerable for current payoffs');
        addContribution(scaledContribution(profile.selfDamageEnablers, traits.selfDamagePayoff, 2.7), 'Turns HP loss into upside');
        addContribution(scaledContribution(profile.selfDamagePayoffs, traits.selfDamage ? 2 : 0, 2.3), 'Feeds existing self-damage payoffs');
        addContribution(scaledContribution(profile.attackEnablers, traits.attackPayoff, 1.8), 'Rewards your attack-dense deck');
        addContribution(scaledContribution(profile.attackPayoffs, traits.attack ? (traits.highCost ? 1 : 2) : 0, 1.5), 'Adds attacks for current attack payoffs');
        addContribution(scaledContribution(profile.strikeCards, traits.strikePayoff, 1.7), 'Uses your current Strike count');
        addContribution(scaledContribution(profile.strikePayoffs, traits.strike ? 2 : 0, 1.2), 'Adds another Strike for existing payoffs');
        addContribution(scaledContribution(profile.scaling, traits.multiHit ? 2 : 0, 1.4), 'Existing scaling boosts this multi-hit card');
        addContribution(scaledContribution(profile.multiHit, traits.scaling ? 2 : 0, 1.6), 'Adds scaling for your multi-hit attacks');
        addContribution(scaledContribution(profile.draw, traits.highCost ? 1 : 0, 1.6), 'Draw support makes the curve safer');

        if (profile.aoe < 2 && traits.aoe) {
            addContribution(6, 'Adds missing AoE coverage');
        }
        if (profile.scaling < 2 && traits.scaling) {
            addContribution(5, 'Adds missing long-fight scaling');
        }
        if (profile.block < 3 && traits.block) {
            addContribution(4, 'Adds reliable block density');
        }

        if (traits.highCost) {
            const curvePressure = Math.max(0, profile.highCost - Math.min(profile.draw + profile.lowCost, 5));
            if (curvePressure > 1) {
                addContribution(-Math.min(12, curvePressure * 3), 'Deck is already clunky at the top end');
            }
        }
        if (traits.conditional) {
            const consistencyGap = Math.max(0, profile.conditional + 1 - profile.draw);
            if (consistencyGap > 0) {
                addContribution(-Math.min(10, consistencyGap * 3), 'Current deck may not enable this consistently');
            }
        }
        if (traits.vulnerablePayoff && profile.vulnerableEnablers === 0 && !traits.vulnerable) {
            addContribution(-10, 'Needs more Vulnerable support');
        }
        if (traits.exhaustPayoff && profile.exhaustEnablers === 0 && !traits.exhaust) {
            addContribution(-10, 'Needs more exhaust support');
        }
        if (traits.blockPayoff && profile.blockEnablers === 0 && !traits.block) {
            addContribution(-9, 'Needs more reliable block generation');
        }
        if (traits.selfDamagePayoff && profile.selfDamageEnablers === 0 && !traits.selfDamage) {
            addContribution(-10, 'Needs HP-loss enablers');
        }
        if (traits.strikePayoff && profile.strikeCards < 5 && !traits.strike) {
            addContribution(-8, 'Needs a larger Strike count');
        }

        if (traits.metadata) {
            const confidence = traits.metadata.confidence || 0.75;

            (traits.metadata.paysOff || []).forEach(packageName => {
                const activation = getPackageActivation(profile, packageName);
                if (activation >= 0.9) {
                    addContribution(9 * confidence, `Strong payoff for your ${packageName.replace('_', ' ')} deck`);
                } else if (activation >= 0.55) {
                    addContribution(5 * confidence, `Has support in your ${packageName.replace('_', ' ')} shell`);
                } else {
                    addContribution(-8 * confidence, `Not enough ${packageName.replace('_', ' ')} support yet`);
                }
            });

            (traits.metadata.enables || []).forEach(packageName => {
                const payoffPresence = (traits.metadata.paysOff || []).includes(packageName)
                    ? 0
                    : getPackageActivation(profile, packageName);
                if (payoffPresence >= 0.55) {
                    addContribution(5 * confidence, `Feeds your existing ${packageName.replace('_', ' ')} payoffs`);
                } else if ((profile.packageCounts[packageName] || 0) > 0) {
                    addContribution(3 * confidence, `Keeps your ${packageName.replace('_', ' ')} lane open`);
                }
            });

            (traits.metadata.requires || []).forEach(requirement => {
                if (!requirementIsSatisfied(requirement, profile)) {
                    addContribution(-getMetadataPenaltyWeight('medium') * confidence, getRequirementReason(requirement));
                }
            });

            (traits.metadata.antiSynergy || []).forEach(rule => {
                if (rule.type === 'missingPackage' && (profile.packageCounts[rule.package] || 0) === 0) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, `Missing ${rule.package.replace('_', ' ')} support`);
                }
                if (rule.type === 'missingRoleDensity' && (profile.roleCounts[rule.role] || 0) === 0) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, `Needs more ${rule.role.replace(/_/g, ' ')}`);
                }
                if (rule.type === 'lowRoleDensity' && (profile.roleCounts[rule.role] || 0) < (rule.min || 2)) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, `Needs more ${rule.role.replace(/_/g, ' ')}`);
                }
                if (rule.type === 'missingStabilizer' && (profile.stabilizers || 0) === 0) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, 'Needs sustain or mitigation first');
                }
                if (rule.type === 'tooManyHpCostCards' && profile.selfDamageEnablerCards >= 4) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, 'Deck is already heavy on HP-cost cards');
                }
                if (rule.type === 'tooMuchTopEnd' && profile.highCost >= 4) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, 'Deck already has enough expensive setup');
                }
                if (rule.type === 'deckOverstuffedWithLowImpactStrikes' && profile.strikeCards >= 7 && profile.block < 3 && profile.scaling < 2) {
                    addContribution(-getMetadataPenaltyWeight(rule.penalty) * confidence, 'Too many Strike cards without enough payoff support');
                }
            });
        }

        const positiveReasons = contributions
            .filter(item => item.value > 0)
            .sort((left, right) => right.value - left.value)
            .map(item => item.reason);
        const negativeReasons = contributions
            .filter(item => item.value < 0)
            .sort((left, right) => left.value - right.value)
            .map(item => item.reason);

        return {
            score: sumValues(contributions.map(item => item.value)),
            positiveReasons,
            negativeReasons
        };
    }

    function evaluateCardStrength(cardKey, deficits, profile, context) {
        const traits = getCardTraits(cardKey);
        const synergy = getSynergyScore(profile, traits);
        const basePower = getBasePowerScore(traits, context);
        const fit = clampScore(52 + synergy.score);
        const need = getNeedMatchScore(traits, deficits, context);
        const pickup = clampScore(basePower * 0.3 + fit * 0.38 + need * 0.32);
        const band = toPickupBand(pickup);
        const reasons = buildStrengthReasons(traits, profile, deficits, synergy);

        return {
            traits,
            basePower,
            fit,
            need,
            pickup,
            band,
            reasons,
            synergy
        };
    }

    function evaluateCardStrengthOverall(cardKey, deficits, profile) {
        // Adaptive weights: base 0.35/0.30/0.35, shifted by current deck deficits
        let shortWeight = 0.35;
        let bossWeight = 0.35;
        shortWeight += Math.min((deficits.frontload || 0) / 60, 0.10);
        bossWeight += Math.min((deficits.scaling || 0) / 60, 0.10);
        const eliteWeight = Math.max(0, 1 - shortWeight - bossWeight);

        const short = evaluateCardStrength(cardKey, deficits, profile, 'short');
        const elite = evaluateCardStrength(cardKey, deficits, profile, 'elite');
        const boss = evaluateCardStrength(cardKey, deficits, profile, 'boss');

        const pickup = clampScore(short.pickup * shortWeight + elite.pickup * eliteWeight + boss.pickup * bossWeight);
        const basePower = clampScore(short.basePower * shortWeight + elite.basePower * eliteWeight + boss.basePower * bossWeight);
        const need = clampScore(short.need * shortWeight + elite.need * eliteWeight + boss.need * bossWeight);
        const fit = clampScore(short.fit * shortWeight + elite.fit * eliteWeight + boss.fit * bossWeight);
        const band = toPickupBand(pickup);

        return {
            traits: short.traits,
            basePower,
            fit,
            need,
            pickup,
            band,
            reasons: short.reasons,
            synergy: short.synergy
        };
    }

    function describeMetric(metricKey) {
        if (metricKey === 'frontload') {
            return 'frontload';
        }
        if (metricKey === 'block') {
            return 'block';
        }
        if (metricKey === 'scaling') {
            return 'scaling';
        }
        if (metricKey === 'consistency') {
            return 'consistency';
        }
        return 'utility';
    }

    function summarizeCardFundamentals(cardKey, entry, upgradedText, traits) {
        const canonical = cardCanonical[normalizeCardKey(cardKey)] || {};
        const baseText = `${entry?.description || ''} ${upgradedText || ''}`.toLowerCase();
        const costMatch = baseText.match(/costs?\s+([0-9x]+)/i);
        const fallbackCost = costMatch ? costMatch[1].toUpperCase() : (traits.highCost ? '2+' : (traits.lowCost ? '0-1' : '1'));
        let canonicalCost = '';
        if (typeof canonical.cost === 'string' && canonical.cost.trim()) {
            canonicalCost = canonical.cost.trim();
        }
        if (typeof canonical.cost === 'number' && Number.isFinite(canonical.cost)) {
            canonicalCost = String(canonical.cost);
        }
        const costLabel = canonicalCost || fallbackCost;
        const fallbackType = traits.attack && !traits.block
            ? 'Attack'
            : (!traits.attack && (traits.block || traits.draw || traits.exhaust || traits.deckManipulation) ? 'Skill' : 'Mixed');
        const type = typeof canonical.type === 'string' && canonical.type.trim()
            ? canonical.type
            : fallbackType;
        const flags = Array.isArray(canonical.keywords) && canonical.keywords.length > 0
            ? canonical.keywords.filter(Boolean)
            : [];

        if (flags.length === 0) {
            if (baseText.includes('exhaust')) {
                flags.push('Exhaust');
            }
            if (baseText.includes('ethereal')) {
                flags.push('Ethereal');
            }
            if (baseText.includes('innate')) {
                flags.push('Innate');
            }
            if (baseText.includes('retain')) {
                flags.push('Retain');
            }
        }

        return {
            cost: costLabel,
            type,
            rarity: typeof canonical.rarity === 'string' && canonical.rarity.trim() ? canonical.rarity : 'Unknown',
            flags
        };
    }

    function summarizeUpgradeDelta(entry) {
        const base = typeof entry?.description === 'string' ? entry.description : '';
        const upgraded = typeof entry?.upgraded_description === 'string' ? entry.upgraded_description : '';
        if (!upgraded || upgraded.trim() === '' || upgraded.trim() === base.trim()) {
            return ['No text delta on upgrade (usually numeric scaling only or already optimized).'];
        }

        const changes = [];
        const patterns = [
            { label: 'Damage', regex: /deal\s+(\d+)\s+damage/i },
            { label: 'Block', regex: /gain\s+(\d+)\s+block/i },
            { label: 'Vulnerable', regex: /apply\s+(\d+)\s+vulnerable/i },
            { label: 'Weak', regex: /apply\s+(\d+)\s+weak/i },
            { label: 'Energy', regex: /gain\s+(\d+)\s+energy/i }
        ];

        patterns.forEach(pattern => {
            const before = base.match(pattern.regex);
            const after = upgraded.match(pattern.regex);
            if (before && after) {
                const delta = Number.parseInt(after[1], 10) - Number.parseInt(before[1], 10);
                if (delta > 0) {
                    changes.push(`${pattern.label} +${delta}`);
                }
            }
        });

        if (changes.length === 0) {
            changes.push('Upgrade changes card behavior text or conditions.');
        }

        return changes;
    }

    function summarizeRealEffects(traits) {
        const notes = [];
        if (traits.attack) {
            notes.push('Immediate damage');
        }
        if (traits.block) {
            notes.push('Defensive value');
        }
        if (traits.scaling) {
            notes.push('Long-fight scaling');
        }
        if (traits.draw || traits.deckManipulation || traits.costCheat || traits.energyGain) {
            notes.push('Turn smoothing');
        }
        if (traits.aoe) {
            notes.push('AoE coverage');
        }
        if (traits.conditional) {
            notes.push('Conditional timing');
        }
        return notes;
    }

    function getBestNeed(deficits) {
        return Object.keys(deficits).sort((left, right) => deficits[right] - deficits[left])[0] || 'frontload';
    }

    function getPracticalTips(traits, overall, deficits) {
        const tips = [];
        if (traits.highCost && deficits.consistency >= 15) {
            tips.push('Play when energy and draw are stabilized; avoid early hand clogs.');
        }
        if (traits.conditional) {
            tips.push('Sequence around the condition first, then cash out this card.');
        }
        if (traits.scaling) {
            tips.push('Prioritize in elite and boss paths where scaling decides outcomes.');
        }
        if (traits.attack && deficits.frontload >= 18) {
            tips.push('Use for turn 1-3 tempo to avoid early HP leaks.');
        }
        if (traits.block && deficits.block >= 18) {
            tips.push('Treat as mitigation glue when your opening draws miss defense.');
        }
        if (overall.band.className === 'pickup-skip') {
            tips.push('Skip unless the offered alternatives are even less aligned with deck needs.');
        }

        if (tips.length === 0) {
            tips.push('Draft when it strengthens your weakest metric without bending curve too hard.');
        }

        return Array.from(new Set(tips)).slice(0, 3);
    }

    function withSimulatedCard(cardKey, action) {
        deckState.push(cardKey);
        try {
            return action();
        } finally {
            deckState.pop();
        }
    }

    function renderOverlayInsights(cardKey, useUpgraded) {
        if (!cardKey) {
            return;
        }

        const entry = getCardEntryByKey(cardKey) || {};
        const traits = getCardTraits(cardKey);
        const deckScores = analyzeDeckHealth();
        const deficits = getNeedDeficits(deckScores);
        const profile = getDeckSynergyProfile();
        const overall = evaluateCardStrengthOverall(cardKey, deficits, profile);
        const shortCtx = evaluateCardStrength(cardKey, deficits, profile, 'short');
        const eliteCtx = evaluateCardStrength(cardKey, deficits, profile, 'elite');
        const bossCtx = evaluateCardStrength(cardKey, deficits, profile, 'boss');
        const upgradedText = useUpgraded ? entry.upgraded_description : entry.description;
        const fundamentals = summarizeCardFundamentals(cardKey, entry, upgradedText, traits);
        const upgradeDelta = summarizeUpgradeDelta(entry);
        const realEffects = summarizeRealEffects(traits);
        const bestNeed = getBestNeed(deficits);
        const tips = getPracticalTips(traits, overall, deficits);

        const packageTags = (traits.packages || []).slice(0, 4).map(name => name.replace(/_/g, ' '));
        const roleTags = (traits.roles || []).slice(0, 4).map(name => name.replace(/_/g, ' '));
        const missingRequirements = ((traits.metadata?.requires || [])
            .filter(req => !requirementIsSatisfied(req, profile))
            .map(getRequirementReason)
            .slice(0, 2));

        const simulated = withSimulatedCard(cardKey, () => ({
            scores: analyzeDeckHealth(),
            profile: getDeckSynergyProfile()
        }));

        const curveDelta = {
            frontload: simulated.scores.frontload - deckScores.frontload,
            block: simulated.scores.block - deckScores.block,
            scaling: simulated.scores.scaling - deckScores.scaling,
            consistency: simulated.scores.consistency - deckScores.consistency,
            utility: simulated.scores.utility - deckScores.utility,
            overall: simulated.scores.overall - deckScores.overall,
            highCost: (simulated.profile.highCost || 0) - (profile.highCost || 0),
            lowCost: (simulated.profile.lowCost || 0) - (profile.lowCost || 0)
        };

        const comparePool = uniqueValues(comparisonState.concat(cardKey));
        const compareScores = comparePool.map(key => {
            const ev = evaluateCardStrengthOverall(key, deficits, profile);
            return {
                key,
                pickup: ev.pickup,
                label: cardCatalog.get(key)?.label || key
            };
        }).sort((left, right) => right.pickup - left.pickup);
        const rankIndex = compareScores.findIndex(entryScore => entryScore.key === cardKey);

        let insights = document.getElementById('overlayInsights');
        if (!insights) {
            insights = document.createElement('div');
            insights.id = 'overlayInsights';
            insights.className = 'overlay-insights';
            overlayDescription.insertAdjacentElement('afterend', insights);
        }

        insights.innerHTML = `
            <section class="overlay-section">
                <h3>Card Fundamentals</h3>
                <div class="overlay-chip-row">
                    <span class="overlay-chip"><strong>Cost:</strong> ${fundamentals.cost}</span>
                    <span class="overlay-chip"><strong>Type:</strong> ${fundamentals.type}</span>
                    <span class="overlay-chip"><strong>Rarity:</strong> ${fundamentals.rarity}</span>
                    ${fundamentals.flags.map(flag => `<span class="overlay-chip">${flag}</span>`).join('')}
                </div>
                <ul class="overlay-mini-list">
                    ${upgradeDelta.map(line => `<li>${line}</li>`).join('')}
                </ul>
            </section>

            <section class="overlay-section">
                <h3>Real Effect Summary</h3>
                <div class="overlay-chip-row">
                    ${realEffects.map(effect => `<span class="overlay-chip">${effect}</span>`).join('')}
                </div>
                <p class="overlay-subtle">Best immediate fit: ${describeMetric(bestNeed)} gap.</p>
            </section>

            <section class="overlay-section">
                <h3>Deck Fit Breakdown</h3>
                <div class="overlay-score-grid">
                    <div><span class="overlay-score-label">Pickup</span><span class="overlay-score-value">${overall.pickup}</span></div>
                    <div><span class="overlay-score-label">Base</span><span class="overlay-score-value">${overall.basePower}</span></div>
                    <div><span class="overlay-score-label">Need</span><span class="overlay-score-value">${overall.need}</span></div>
                    <div><span class="overlay-score-label">Fit</span><span class="overlay-score-value">${overall.fit}</span></div>
                </div>
                <ul class="overlay-mini-list">
                    ${overall.reasons.slice(0, 3).map(reason => `<li>${reason}</li>`).join('')}
                </ul>
            </section>

            <section class="overlay-section">
                <h3>Synergy and Anti-Synergy</h3>
                <div class="overlay-chip-row">
                    ${packageTags.map(tag => `<span class="overlay-chip">Pkg: ${tag}</span>`).join('')}
                    ${roleTags.map(tag => `<span class="overlay-chip">Role: ${tag}</span>`).join('')}
                </div>
                <ul class="overlay-mini-list">
                    ${overall.synergy.positiveReasons.slice(0, 2).map(reason => `<li>+ ${reason}</li>`).join('')}
                    ${overall.synergy.negativeReasons.slice(0, 2).map(reason => `<li>- ${reason}</li>`).join('')}
                    ${missingRequirements.map(reason => `<li>- ${reason}</li>`).join('')}
                </ul>
            </section>

            <section class="overlay-section">
                <h3>Fight Context Impact</h3>
                <div class="overlay-context-grid">
                    <div><span>Hallway</span><strong>${shortCtx.pickup}</strong></div>
                    <div><span>Elite</span><strong>${eliteCtx.pickup}</strong></div>
                    <div><span>Boss</span><strong>${bossCtx.pickup}</strong></div>
                </div>
            </section>

            <section class="overlay-section">
                <h3>Curve and Consistency Impact</h3>
                <div class="overlay-mini-metrics">
                    <span>Overall ${curveDelta.overall >= 0 ? '+' : ''}${curveDelta.overall}</span>
                    <span>Consistency ${curveDelta.consistency >= 0 ? '+' : ''}${curveDelta.consistency}</span>
                    <span>Scaling ${curveDelta.scaling >= 0 ? '+' : ''}${curveDelta.scaling}</span>
                    <span>High Cost ${curveDelta.highCost >= 0 ? '+' : ''}${curveDelta.highCost}</span>
                    <span>Low Cost ${curveDelta.lowCost >= 0 ? '+' : ''}${curveDelta.lowCost}</span>
                </div>
            </section>

            <section class="overlay-section">
                <h3>Compare Ready</h3>
                <p class="overlay-subtle">Rank ${rankIndex >= 0 ? rankIndex + 1 : '-'} of ${compareScores.length} in current comparison pool.</p>
                <ul class="overlay-mini-list">
                    ${compareScores.slice(0, 3).map((entryScore, idx) => `<li>${idx + 1}. ${entryScore.label} (${entryScore.pickup})</li>`).join('')}
                </ul>
            </section>

            <section class="overlay-section">
                <h3>Practical Play Tips</h3>
                <ul class="overlay-mini-list">
                    ${tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </section>`;
    }

    function ensureStrengthBlock(item) {
        const slot = item.querySelector('.comparison-strength-slot');
        const container = slot || item.querySelector('.card-body');
        if (!container) {
            return null;
        }

        let block = container.querySelector('.card-strength-block');
        if (!block) {
            block = document.createElement('div');
            block.className = 'card-strength-block';
            block.innerHTML = `
                <div class="card-strength-head comparison-strength-head">
                    <span class="card-strength-score" data-strength-score>0</span>
                    <span class="card-strength-band" data-strength-band>Playable</span>
                </div>
                <div class="card-strength-bars comparison-strength-bars">
                    <div class="card-strength-row comparison-strength-row">
                        <span class="card-strength-row-label">B</span>
                        <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="base"></div></div>
                        <span class="card-strength-value" data-strength-value="base">0</span>
                    </div>
                    <div class="card-strength-row comparison-strength-row">
                        <span class="card-strength-row-label">N</span>
                        <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="need"></div></div>
                        <span class="card-strength-value" data-strength-value="need">0</span>
                    </div>
                    <div class="card-strength-row comparison-strength-row">
                        <span class="card-strength-row-label">F</span>
                        <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="fit"></div></div>
                        <span class="card-strength-value" data-strength-value="fit">0</span>
                    </div>
                </div>
                <div class="card-strength-why"></div>`;
            container.appendChild(block);
        }

        return block;
    }

    function renderComparisonStrengthBlock(item, data) {
        const slot = item.querySelector('.comparison-strength-slot');
        if (!slot) {
            return null;
        }

        const base = clampScore(data.base);
        const need = clampScore(data.need);
        const fit = clampScore(data.fit);
        const pickup = clampScore(data.pickup);
        const reason = data.reasons[0] || 'Neutral impact for current deck and context';
        const reasonTitle = data.reasons.join(' | ');

        slot.innerHTML = `
            <div class="card-strength-block">
                <div class="card-strength-head comparison-strength-head">
                    <span class="card-strength-score" data-strength-score title="Pickup score ${pickup} (Overall)">${pickup}</span>
                    <span class="card-strength-band" data-strength-band>${data.band}</span>
                </div>
                <div class="card-strength-bars comparison-strength-bars">
                    <div class="card-strength-row comparison-strength-row">
                        <span class="card-strength-row-label">B</span>
                        <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="base" style="width:${base}%;"></div></div>
                        <span class="card-strength-value" data-strength-value="base">${base}</span>
                    </div>
                    <div class="card-strength-row comparison-strength-row">
                        <span class="card-strength-row-label">N</span>
                        <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="need" style="width:${need}%;"></div></div>
                        <span class="card-strength-value" data-strength-value="need">${need}</span>
                    </div>
                    <div class="card-strength-row comparison-strength-row">
                        <span class="card-strength-row-label">F</span>
                        <div class="card-strength-track"><div class="card-strength-fill" data-strength-kind="fit" style="width:${fit}%;"></div></div>
                        <span class="card-strength-value" data-strength-value="fit">${fit}</span>
                    </div>
                </div>
                <div class="card-strength-why" title="${reasonTitle}">${reason}</div>
            </div>`;

        return slot.querySelector('.card-strength-block');
    }

    function setStrengthFill(block, kind, score) {
        const fill = block.querySelector(`.card-strength-fill[data-strength-kind="${kind}"]`);
        if (!fill) {
            return;
        }
        fill.style.width = `${clampScore(score)}%`;

        const value = block.querySelector(`.card-strength-value[data-strength-value="${kind}"]`);
        if (value) {
            value.textContent = String(clampScore(score));
        }
    }

    function renderCardStrengthSignals() {
        if (!allCardsGrid) {
            return;
        }

        const deckScores = analyzeDeckHealth();
        const deficits = getNeedDeficits(deckScores);
        const profile = getDeckSynergyProfile();
        const allCardItems = Array.from(allCardsGrid.querySelectorAll('.card-grid-item'));
        const comparisonItems = comparisonGrid ? Array.from(comparisonGrid.querySelectorAll('.card-grid-item')) : [];

        const renderOne = function (item, showDetails) {
            item.classList.remove('pickup-snap', 'pickup-strong', 'pickup-playable', 'pickup-niche', 'pickup-skip');

            const key = item.getAttribute('data-card-key') || '';
            const evaluation = evaluateCardStrengthOverall(key, deficits, profile);

            item.classList.add(evaluation.band.className);

            const cornerBadge = ensurePickupCornerScore(item);
            if (cornerBadge) {
                cornerBadge.hidden = false;
                cornerBadge.textContent = String(evaluation.pickup);
                cornerBadge.title = evaluation.reasons.join(' | ');
            }

            if (!showDetails) {
                const existing = item.querySelector('.card-strength-block');
                if (existing) {
                    existing.remove();
                }
                item.title = evaluation.reasons.join(' | ');
                return;
            }

            const block = renderComparisonStrengthBlock(item, {
                pickup: evaluation.pickup,
                band: evaluation.band.label,
                base: evaluation.basePower,
                need: evaluation.need,
                fit: evaluation.fit,
                reasons: evaluation.reasons
            }) || ensureStrengthBlock(item);
            if (!block) {
                return;
            }

            item.title = evaluation.reasons.join(' | ');
        };

        allCardItems.forEach(item => renderOne(item, false));
        comparisonItems.forEach(item => renderOne(item, true));
        renderPickAdvisor();
    }

    function renderSynergyHighlights() {
        if (!allCardsGrid) {
            return;
        }

        const profile = getDeckSynergyProfile();
        const deficits = getNeedDeficits(analyzeDeckHealth());
        const allItems = Array.from(allCardsGrid.querySelectorAll('.card-grid-item'));
        const deckSize = deckState.length;

        allItems.forEach(item => {
            item.classList.remove('synergy-high', 'synergy-medium');

            if (deckSize < 5) {
                return;
            }

            const key = item.getAttribute('data-card-key') || '';
            const score = evaluateCardStrengthOverall(key, deficits, profile).synergy.score;

            if (score >= 16) {
                item.classList.add('synergy-high');
                return;
            }

            if (score >= 8) {
                item.classList.add('synergy-medium');
            }
        });
    }

    function renderPickAdvisor() {
        if (!pickAdvisorBanner || !pickAdvisorList) {
            return;
        }

        if (comparisonState.length < 2) {
            pickAdvisorBanner.hidden = true;
            return;
        }

        const deficits = getNeedDeficits(analyzeDeckHealth());
        const profile = getDeckSynergyProfile();

        const scored = comparisonState.map(key => {
            const ev = evaluateCardStrengthOverall(key, deficits, profile);
            const card = cardCatalog.get(key);
            return {
                key,
                label: card ? card.label : key,
                pickup: ev.pickup,
                reason: ev.reasons[0] || 'Neutral impact'
            };
        });

        scored.sort((a, b) => b.pickup - a.pickup);

        scored.forEach(({ key }) => {
            const item = comparisonGrid.querySelector(`.card-grid-item[data-card-key="${key}"]`);
            if (item) {
                comparisonGrid.appendChild(item);
            }
        });

        const verdictLabel = index => {
            if (index === 0) return 'TAKE';
            if (index === 1) return 'CONSIDER';
            return 'SKIP';
        };

        const verdictClass = index => {
            if (index === 0) return 'pick-take';
            if (index === 1) return 'pick-consider';
            return 'pick-skip';
        };

        pickAdvisorList.innerHTML = scored.map((card, i) => `
            <li class="pick-advisor-row ${verdictClass(i)}">
                <span class="pick-verdict-label">${verdictLabel(i)}</span>
                <span class="pick-card-name">${card.label}</span>
                <span class="pick-score">${card.pickup}</span>
                <span class="pick-reason">${card.reason}</span>
            </li>`).join('');

        pickAdvisorBanner.hidden = false;
    }

    function setActiveRightPanel(panel) {
        activeRightPanel = panel === 'deck' ? 'deck' : 'comparison';

        if (rightPanels) {
            rightPanels.setAttribute('data-active-panel', activeRightPanel);
        }

        const buttons = [tabComparisonBtn, tabDeckBtn].filter(Boolean);
        buttons.forEach(button => {
            const isSelected = button.getAttribute('data-panel') === activeRightPanel;
            button.classList.toggle('is-active', isSelected);
            button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });
    }

    async function addToDeck(key) {
        if (!cardCatalog.has(key)) {
            return;
        }

        deckState.push(key);
        await renderCollection(currentDeckGrid, deckState);
        updateCounts();
        if (comparisonState.length > 0) {
            await renderCollection(comparisonGrid, comparisonState);
        }
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function removeFromDeck(stateIndex, cardKey) {
        if (Number.isInteger(stateIndex) && stateIndex >= 0 && stateIndex < deckState.length) {
            deckState.splice(stateIndex, 1);
        } else {
            const fallbackIndex = deckState.lastIndexOf(cardKey);
            if (fallbackIndex >= 0) {
                deckState.splice(fallbackIndex, 1);
            }
        }

        await renderCollection(currentDeckGrid, deckState);
        updateCounts();
        if (comparisonState.length > 0) {
            await renderCollection(comparisonGrid, comparisonState);
        }
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function addToComparison(key) {
        if (!cardCatalog.has(key)) {
            return;
        }

        comparisonState.push(key);
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function clearComparison() {
        comparisonState.length = 0;
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function loadDescriptions() {
        try {
            const response = await fetch('images/cards/ironclad_card_descriptions.json', { cache: 'no-store' });
            if (!response.ok) {
                return;
            }
            cardDescriptions = await response.json();
            cardTraitsCache.clear();
        } catch {
            cardDescriptions = {};
            cardTraitsCache.clear();
        }
    }

    async function loadCanonicalCardData() {
        try {
            const response = await fetch('images/cards/ironclad_card_canonical.json', { cache: 'no-store' });
            if (!response.ok) {
                cardCanonical = {};
                return;
            }

            const payload = await response.json();
            cardCanonical = payload?.cards || {};
        } catch {
            cardCanonical = {};
        }
    }

    async function loadSynergyMetadata() {
        try {
            const response = await fetch('images/cards/ironclad_synergy_metadata.json', { cache: 'no-store' });
            if (!response.ok) {
                synergyMetadata = { packages: {}, cards: {} };
                cardTraitsCache.clear();
                return;
            }

            const payload = await response.json();
            synergyMetadata = {
                packages: payload?.packages || {},
                cards: payload?.cards || {}
            };
            cardTraitsCache.clear();
        } catch {
            synergyMetadata = { packages: {}, cards: {} };
            cardTraitsCache.clear();
        }
    }

    function openOverlayForItem(item, source) {
        const cardKey = item?.getAttribute('data-card-key') || '';
        activeOverlaySource = source || '';
        syncOverlayFromCardKey(cardKey, activeOverlaySource, item);
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    }

    function closeOverlay() {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        activeOverlayItem = null;
        activeOverlayCardKey = '';
        activeOverlaySource = '';
    }

    Array.from(allCardsGrid.querySelectorAll('.card-grid-item')).forEach(item => {
        prepareItem(item);

        const key = item.getAttribute('data-card-key');
        const small = item.querySelector('small');
        const img = item.querySelector('.card-image-wrap > img:last-child');
        if (!key || !small || !img) {
            return;
        }

        cardCatalog.set(key, {
            key,
            label: small.dataset.originalText,
            name: (item.getAttribute('data-card-name') || '').toLowerCase(),
            src: img.dataset.baseSrc
        });
    });

    overlayCard.addEventListener('click', function (event) {
        event.stopPropagation();
    });

    overlay.addEventListener('click', function () {
        closeOverlay();
    });

    allCardsGrid.addEventListener('click', async function (event) {
        const actionButton = event.target.closest('button[data-action]');
        const item = event.target.closest('.card-grid-item');
        if (!item) {
            return;
        }

        const cardKey = item.getAttribute('data-card-key');
        if (actionButton && cardKey) {
            event.stopPropagation();
            const action = actionButton.getAttribute('data-action');
            if (action === 'add-compare') {
                await addToComparison(cardKey);
            }
            if (action === 'add-deck') {
                await addToDeck(cardKey);
            }
            return;
        }

        openOverlayForItem(item, 'all');
    });

    comparisonGrid.addEventListener('click', async function (event) {
        const actionButton = event.target.closest('button[data-action]');
        const item = event.target.closest('.card-grid-item');
        if (!item) {
            return;
        }

        const cardKey = item.getAttribute('data-card-key');
        if (actionButton && cardKey) {
            event.stopPropagation();
            const action = actionButton.getAttribute('data-action');
            if (action === 'add-deck') {
                await addToDeck(cardKey);
            }
            return;
        }

        openOverlayForItem(item, 'comparison');
    });

    currentDeckGrid.addEventListener('click', async function (event) {
        const actionButton = event.target.closest('button[data-action]');
        const item = event.target.closest('.card-grid-item');
        if (!item) {
            return;
        }

        const cardKey = item.getAttribute('data-card-key');
        if (actionButton && cardKey) {
            event.stopPropagation();
            const action = actionButton.getAttribute('data-action');
            if (action === 'remove-deck') {
                const stateIndex = Number.parseInt(item.getAttribute('data-state-index') || '', 10);
                await removeFromDeck(stateIndex, cardKey);
            }
            return;
        }

        openOverlayForItem(item, 'deck');
    });

    overlayAddCompare.addEventListener('click', async function () {
        if (!activeOverlayCardKey) {
            return;
        }
        await addToComparison(activeOverlayCardKey);
    });

    overlayAddDeck.addEventListener('click', async function () {
        if (!activeOverlayCardKey) {
            return;
        }
        await addToDeck(activeOverlayCardKey);
    });

    const clearComparisonBtn = document.getElementById('clearComparisonBtn');
    if (clearComparisonBtn) {
        clearComparisonBtn.addEventListener('click', async function () {
            await clearComparison();
        });
    }

    if (tabComparisonBtn) {
        tabComparisonBtn.addEventListener('click', function () {
            setActiveRightPanel('comparison');
        });
    }

    if (tabDeckBtn) {
        tabDeckBtn.addEventListener('click', function () {
            setActiveRightPanel('deck');
        });
    }

    input.addEventListener('input', function () {
        const term = this.value.trim().toLowerCase();
        Array.from(allCardsGrid.querySelectorAll('.card-grid-item')).forEach(item => {
            const name = item.getAttribute('data-card-name') || '';
            item.style.display = name.includes(term) ? 'block' : 'none';
        });
    });

    const upgradeHint = document.getElementById('upgradeHint');
    const toggleKey = 'q';
    if (upgradeHint) {
        upgradeHint.textContent = `Press ${toggleKey.toUpperCase()} to view upgraded cards`;
    }

    document.body.classList.remove('ui-preset-review');
    document.body.classList.add('ui-preset-focus');
    setActiveRightPanel('comparison');

    Promise.resolve()
        .then(() => Promise.all([loadDescriptions(), loadCanonicalCardData(), loadSynergyMetadata()]))
        .then(async () => {
            await refreshGridModeAndBadges(allCardsGrid);
            await renderCollection(currentDeckGrid, deckState);
            updateCounts();
            renderCardStrengthSignals();
            refreshOverlayIfOpen();
        });

    document.addEventListener('keydown', async function (event) {
        const pressedKey = (event.key || '').toLowerCase();

        if (pressedKey === toggleKey) {
            event.preventDefault();
            if (toggleInProgress) {
                return;
            }

            toggleInProgress = true;
            showPlus = !showPlus;

            const updates = allGridItems().map(item => applyCardMode(item, showPlus));
            await Promise.all(updates);

            if (overlay.style.opacity === '1') {
                syncOverlayFromCardKey(activeOverlayCardKey, activeOverlaySource, activeOverlayItem);
            }

            toggleInProgress = false;
        }
    });
})();
