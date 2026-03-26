(function () {
    const input = document.getElementById('cardSearchInput');
    const allCardsGrid = document.getElementById('allCardsGrid');
    const comparisonGrid = document.getElementById('comparisonGrid');
    const currentDeckGrid = document.getElementById('currentDeckGrid');
    const comparisonEmpty = document.getElementById('comparisonEmpty');
    const comparisonCountLabel = document.getElementById('comparisonCountLabel');
    const deckCountLabel = document.getElementById('deckCountLabel');
    const strengthContextSelect = document.getElementById('strengthContextSelect');
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

    const overlay = document.getElementById('cardOverlay');
    const overlayCard = document.getElementById('overlayCard');
    const overlayImg = document.getElementById('overlayImg');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayDescription = document.getElementById('overlayDescription');
    const overlayAddCompare = document.getElementById('overlayAddCompare');
    const overlayAddDeck = document.getElementById('overlayAddDeck');

    const plusAvailabilityCache = new Map();

    let cardDescriptions = {};
    let showPlus = false;
    let toggleInProgress = false;
    let activeOverlayItem = null;
    let activeOverlayCardKey = '';
    let strengthContext = 'short';

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

    function syncOverlayFromItem(item) {
        if (!item) {
            return;
        }

        prepareItem(item);
        const img = item.querySelector('.card-image-wrap > img:last-child');
        const small = item.querySelector('small');
        if (!img || !small) {
            return;
        }

        overlayImg.src = img.src;
        overlayImg.dataset.baseSrc = img.dataset.baseSrc;
        overlayTitle.textContent = small.textContent;
        overlayTitle.classList.toggle('plus-mode', small.classList.contains('plus-mode'));
        overlayTitle.dataset.originalText = small.dataset.originalText;
        overlayDescription.textContent = getCardDescription(item, small.dataset.originalText, small.classList.contains('plus-mode'));
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
                    <button type="button" class="action-btn btn-deck" data-action="add-deck">Add to Deck</button>
               </div>`;
        }
        if (actionMode === 'deck') {
            actionsHtml = `<div class="card-actions">
                    <button type="button" class="action-btn btn-remove" data-action="remove-deck">Remove from Deck</button>
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
        const description = typeof entry.description === 'string' ? entry.description.toLowerCase() : '';
        const upgraded = typeof entry.upgraded_description === 'string' ? entry.upgraded_description.toLowerCase() : '';
        return `${normalized} ${description} ${upgraded}`;
    }

    function includesAny(text, terms) {
        return terms.some(term => text.includes(term));
    }

    function analyzeDeckHealth() {
        const summary = {
            frontloadCards: 0,
            blockCards: 0,
            scalingCards: 0,
            drawCards: 0,
            utilityCards: 0,
            aoeCards: 0,
            lowCurveCards: 0,
            highCurveCards: 0,
            conditionalCards: 0
        };

        deckState.forEach(cardKey => {
            const text = getDeckCardText(cardKey);

            if (includesAny(text, ['damage', 'strike', 'bash', 'attack'])) {
                summary.frontloadCards += 1;
            }
            if (includesAny(text, ['block', 'defend', 'armor', 'plated'])) {
                summary.blockCards += 1;
            }
            if (includesAny(text, ['strength', 'dexterity', 'gain 1 strength', 'at the start of each turn', 'power'])) {
                summary.scalingCards += 1;
            }
            if (includesAny(text, ['draw', 'drawn', 'exhaust to draw'])) {
                summary.drawCards += 1;
            }
            if (includesAny(text, ['all enemies', 'each enemy'])) {
                summary.aoeCards += 1;
            }
            if (includesAny(text, ['vulnerable', 'weak', 'frail', 'exhaust', 'status', 'artifact', 'disarm'])) {
                summary.utilityCards += 1;
            }
            if (includesAny(text, ['cost 0', 'costs 0', 'cost 1', 'costs 1'])) {
                summary.lowCurveCards += 1;
            }
            if (includesAny(text, ['cost 2', 'costs 2', 'cost 3', 'costs 3', 'demon form', 'bludgeon', 'barricade'])) {
                summary.highCurveCards += 1;
            }
            if (includesAny(text, ['if', 'only', 'when', 'clash'])) {
                summary.conditionalCards += 1;
            }
        });

        const deckSize = Math.max(deckState.length, 1);
        const frontload = clampScore((summary.frontloadCards / deckSize) * 140 + summary.aoeCards * 6);
        const block = clampScore((summary.blockCards / deckSize) * 150 + summary.utilityCards * 2);
        const scaling = clampScore((summary.scalingCards / deckSize) * 180 + summary.drawCards * 4);
        const consistency = clampScore(60 + summary.drawCards * 8 + summary.lowCurveCards * 3 - summary.highCurveCards * 6 - summary.conditionalCards * 4 - Math.max(0, deckSize - 22) * 2);
        const utility = clampScore((summary.utilityCards / deckSize) * 170 + summary.aoeCards * 8);
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
        let score = 30;
        if (traits.attack) {
            score += 14;
        }
        if (traits.block) {
            score += 14;
        }
        if (traits.scaling) {
            score += 12;
        }
        if (traits.draw) {
            score += 9;
        }
        if (traits.aoe) {
            score += 8;
        }
        if (traits.vulnerable || traits.status) {
            score += 7;
        }
        if (traits.highCost) {
            score -= 8;
        }
        if (traits.conditional) {
            score -= 6;
        }

        if (context === 'short') {
            if (traits.attack) {
                score += 6;
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
        }
        if (context === 'boss') {
            if (traits.scaling) {
                score += 8;
            }
            if (traits.draw) {
                score += 4;
            }
            if (traits.attack && !traits.scaling) {
                score -= 2;
            }
        }

        return clampScore(score);
    }

    function getNeedMatchScore(traits, deficits, context) {
        let score = 0;
        score += (traits.attack || traits.vulnerable ? deficits.frontload * 0.32 : 0);
        score += (traits.block ? deficits.block * 0.42 : 0);
        score += (traits.scaling ? deficits.scaling * 0.5 : 0);
        score += (traits.draw || traits.exhaust ? deficits.consistency * 0.34 : 0);
        score += (traits.aoe || traits.status || traits.exhaust ? deficits.utility * 0.36 : 0);

        if (context === 'short') {
            score += traits.attack ? 8 : 0;
        }
        if (context === 'elite') {
            score += traits.block ? 6 : 0;
        }
        if (context === 'boss') {
            score += traits.scaling ? 10 : 0;
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

    function buildStrengthReasons(traits, profile, deficits) {
        const reasons = [];

        if (profile.exhaust >= 2 && traits.exhaust) {
            reasons.push('Supports your exhaust package');
        }
        if (deficits.block >= 20 && traits.block) {
            reasons.push('Patches current block weakness');
        }
        if (deficits.scaling >= 20 && traits.scaling) {
            reasons.push('Improves long-fight scaling');
        }
        if (deficits.frontload >= 20 && (traits.attack || traits.vulnerable)) {
            reasons.push('Adds early fight pressure');
        }
        if (deficits.consistency >= 20 && (traits.draw || traits.exhaust)) {
            reasons.push('Smooths draw and consistency');
        }
        if (traits.highCost && profile.highCost >= 4) {
            reasons.push('Curve risk: already heavy on high-cost cards');
        }
        if (traits.conditional && profile.conditional >= 3) {
            reasons.push('Can be unreliable in current deck shape');
        }

        if (reasons.length === 0) {
            reasons.push('Neutral impact for current deck and context');
        }

        return reasons.slice(0, 3);
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
                    <span class="card-strength-score" data-strength-score title="Pickup score ${pickup} (${strengthContext})">${pickup}</span>
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
            const traits = getCardTraits(key);
            const basePower = getBasePowerScore(traits, strengthContext);
            const fit = clampScore(50 + getSynergyScore(profile, traits) * 2);
            const need = getNeedMatchScore(traits, deficits, strengthContext);
            const pickup = clampScore(basePower * 0.25 + fit * 0.45 + need * 0.3);
            const band = toPickupBand(pickup);
            const reasons = buildStrengthReasons(traits, profile, deficits);

            item.classList.add(band.className);

            const cornerBadge = ensurePickupCornerScore(item);
            if (cornerBadge) {
                cornerBadge.hidden = false;
                cornerBadge.textContent = String(pickup);
                cornerBadge.title = reasons.join(' | ');
            }

            if (!showDetails) {
                const existing = item.querySelector('.card-strength-block');
                if (existing) {
                    existing.remove();
                }
                item.title = reasons.join(' | ');
                return;
            }

            const block = renderComparisonStrengthBlock(item, {
                pickup,
                band: band.label,
                base: basePower,
                need,
                fit,
                reasons,
                context: strengthContext
            }) || ensureStrengthBlock(item);
            if (!block) {
                return;
            }

            item.title = reasons.join(' | ');
        };

        allCardItems.forEach(item => renderOne(item, false));
        comparisonItems.forEach(item => renderOne(item, true));
    }

    function getCardTraits(cardKey) {
        const text = getDeckCardText(cardKey);
        return {
            attack: includesAny(text, [' attack', 'deal', 'strike', 'bash', 'whirlwind', 'heavy blade']),
            block: includesAny(text, [' block', 'defend', 'plated armor', 'gain armor']),
            scaling: includesAny(text, ['strength', 'dexterity', 'power', 'at the start of each turn']),
            draw: includesAny(text, ['draw', 'drawn']),
            exhaust: includesAny(text, ['exhaust', 'exhausted']),
            vulnerable: includesAny(text, ['vulnerable']),
            aoe: includesAny(text, ['all enemies', 'each enemy']),
            status: includesAny(text, ['status', 'wound', 'burn', 'dazed']),
            highCost: includesAny(text, ['cost 2', 'costs 2', 'cost 3', 'costs 3', 'bludgeon', 'barricade', 'demon form']),
            conditional: includesAny(text, ['if', 'only', 'when', 'clash'])
        };
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
            conditional: 0
        };

        deckState.forEach(cardKey => {
            const traits = getCardTraits(cardKey);
            Object.keys(profile).forEach(key => {
                if (traits[key]) {
                    profile[key] += 1;
                }
            });
        });

        return profile;
    }

    function getSynergyScore(profile, traits) {
        let score = 0;

        if (profile.exhaust >= 2 && traits.exhaust) {
            score += 28;
        }
        if (profile.scaling >= 2 && (traits.scaling || traits.draw)) {
            score += 18;
        }
        if (profile.attack >= 5 && traits.vulnerable) {
            score += 18;
        }
        if (profile.block >= 4 && traits.block) {
            score += 14;
        }
        if (profile.draw >= 2 && traits.highCost) {
            score += 10;
        }
        if (profile.status >= 1 && (traits.exhaust || traits.status)) {
            score += 14;
        }
        if (profile.aoe < 2 && traits.aoe) {
            score += 12;
        }
        if (profile.scaling < 2 && traits.scaling) {
            score += 12;
        }

        if (profile.highCost >= 4 && traits.highCost) {
            score -= 16;
        }
        if (profile.conditional >= 3 && traits.conditional) {
            score -= 8;
        }

        return score;
    }

    function renderSynergyHighlights() {
        if (!allCardsGrid) {
            return;
        }

        const profile = getDeckSynergyProfile();
        const allItems = Array.from(allCardsGrid.querySelectorAll('.card-grid-item'));
        const deckSize = deckState.length;

        allItems.forEach(item => {
            item.classList.remove('synergy-high', 'synergy-medium');

            if (deckSize < 5) {
                return;
            }

            const key = item.getAttribute('data-card-key') || '';
            const traits = getCardTraits(key);
            const score = getSynergyScore(profile, traits);

            if (score >= 28) {
                item.classList.add('synergy-high');
                return;
            }

            if (score >= 14) {
                item.classList.add('synergy-medium');
            }
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
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function clearComparison() {
        comparisonState.length = 0;
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
        renderCardStrengthSignals();
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function loadDescriptions() {
        try {
            const response = await fetch('images/cards/ironclad_card_descriptions.json', { cache: 'no-store' });
            if (!response.ok) {
                return;
            }
            cardDescriptions = await response.json();
        } catch {
            cardDescriptions = {};
        }
    }

    function openOverlayForItem(item) {
        activeOverlayItem = item;
        activeOverlayCardKey = item?.getAttribute('data-card-key') || '';
        syncOverlayFromItem(item);
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
    }

    function closeOverlay() {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        activeOverlayItem = null;
        activeOverlayCardKey = '';
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

        openOverlayForItem(item);
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

        openOverlayForItem(item);
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

        openOverlayForItem(item);
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

    if (strengthContextSelect) {
        strengthContext = strengthContextSelect.value || 'short';
        strengthContextSelect.addEventListener('change', function () {
            strengthContext = this.value || 'short';
            renderCardStrengthSignals();
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

    Promise.resolve()
        .then(() => loadDescriptions())
        .then(async () => {
            await refreshGridModeAndBadges(allCardsGrid);
            await renderCollection(currentDeckGrid, deckState);
            updateCounts();
            renderCardStrengthSignals();
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
                let sourceItem = activeOverlayItem;
                if (!sourceItem || !document.body.contains(sourceItem)) {
                    sourceItem = document.querySelector(`.card-grid-item[data-card-key="${activeOverlayCardKey}"]`);
                }

                if (sourceItem) {
                    syncOverlayFromItem(sourceItem);
                    activeOverlayItem = sourceItem;
                }
            }

            toggleInProgress = false;
        }
    });
})();
