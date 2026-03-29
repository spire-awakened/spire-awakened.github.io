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
    const upgradePriorityScore = document.getElementById('upgradePriorityScore');
    const upgradePriorityName = document.getElementById('upgradePriorityName');
    const upgradePriorityReason = document.getElementById('upgradePriorityReason');
    const upgradePriorityWhy = document.getElementById('upgradePriorityWhy');
    const removalPriorityScore = document.getElementById('removalPriorityScore');
    const removalPriorityName = document.getElementById('removalPriorityName');
    const removalPriorityReason = document.getElementById('removalPriorityReason');
    const removalPriorityWhy = document.getElementById('removalPriorityWhy');
    const deckStrategyTag = document.getElementById('deckStrategyTag');
    const deckStrategySummary = document.getElementById('deckStrategySummary');
    const deckStrategyPlan = document.getElementById('deckStrategyPlan');
    const deckNextTwoTag = document.getElementById('deckNextTwoTag');
    const deckNextTwoList = document.getElementById('deckNextTwoList');
    const pickAdvisorBanner = document.getElementById('pickAdvisorBanner');
    const pickAdvisorList = document.getElementById('pickAdvisorList');
    const synergyReadinessBar = document.getElementById('synergyReadinessBar');
    const synergyReadinessChips = document.getElementById('synergyReadinessChips');
    const rightPanels = document.querySelector('.right-panels');
    const tabComparisonBtn = document.getElementById('tabComparisonBtn');
    const tabDeckBtn = document.getElementById('tabDeckBtn');
    const viewBaseBtn = document.getElementById('viewBaseBtn');
    const viewUpgradedBtn = document.getElementById('viewUpgradedBtn');

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
    let activeOverlayIsUpgraded = false;
    let activeOverlaySource = '';
    let overlayImageRequestId = 0;
    let activeRightPanel = 'comparison';
    let stateIdCounter = 0;
    let activeOfferSnapshot = null;
    const runContextStorageKey = 'spire-helper-run-context-v3';
    const runLogSchemaVersion = 2;
    const runLogAppVersion = '2026-03-29';
    const runLogger = window.SpireRecommender?.createRunLogger('spire-helper-run-logs-v2') || null;
    let runContext = {
        act: 1,
        floor: 1,
        ascension: 0,
        currentHp: 80,
        maxHp: 80,
        gold: 99,
        relics: 1,
        potions: 0,
        nodeType: 'unknown',
        seed: '',
        runId: ''
    };

    function clampRunFloor(value) {
        return Math.max(1, Math.min(60, Number.parseInt(value || '1', 10) || 1));
    }

    function deriveActFromFloor(floorValue) {
        const floor = clampRunFloor(floorValue);
        if (floor <= 16) {
            return 1;
        }
        if (floor <= 32) {
            return 2;
        }

        return 3;
    }

    function setFloorFromAct(targetAct) {
        const safeAct = Math.max(1, Math.min(3, Number.parseInt(targetAct || '1', 10) || 1));
        const floorInAct = Math.max(1, Math.min(16, ((clampRunFloor(runContext.floor) - 1) % 16) + 1));
        runContext.floor = ((safeAct - 1) * 16) + floorInAct;
        syncActFromFloor();
    }

    function syncActFromFloor() {
        runContext.floor = clampRunFloor(runContext.floor);
        runContext.act = deriveActFromFloor(runContext.floor);
    }

    function advanceRunFloor() {
        runContext.floor = clampRunFloor(runContext.floor + 1);
        syncActFromFloor();
    }

    function clampAscension(value) {
        return Math.max(0, Math.min(10, Number.parseInt(value || '0', 10) || 0));
    }

    function clampStatInt(value, fallback, min, max) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }

        return Math.max(min, Math.min(max, parsed));
    }

    function createRunId() {
        return `run-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(36)}`;
    }

    const cardCatalog = new Map();
    const deckState = Array.from(currentDeckGrid.querySelectorAll('.card-grid-item'))
        .map(item => createCardState(item.getAttribute('data-card-key'), false))
        .filter(Boolean);
    const comparisonState = [];
    let journeyStep = 'context';

    function getJourneyStatusText(step) {
        if (step === 'reward') {
            return 'Step 2: Choose exactly 3 reward cards using Compare.';
        }

        if (step === 'decision') {
            return 'Step 3: Pick one of those cards or press Skip Reward.';
        }

        return 'Step 1: Enter floor and run context first, then continue to reward setup.';
    }

    function setJourneyStatusText(message) {
        const status = document.getElementById('journeyStatusText');
        if (!status) {
            return;
        }

        status.textContent = message || getJourneyStatusText(journeyStep);
    }

    async function handleSkipRewardAction(reason) {
        const logged = recordSkippedReward(reason || 'userSkip');
        await clearComparison();
        if (logged) {
            advanceRunFloor();
            saveRunContext();
            refreshRunContextControlValues();
        }
        setJourneyStep('context', logged
            ? 'Reward skipped and logged. Floor advanced by 1; adjust floor manually if needed.'
            : 'No active reward snapshot found. Build reward choices first.');
    }

    function syncJourneyUI() {
        const wrapper = document.getElementById('journeyFlowControls');
        if (!wrapper) {
            return;
        }

        wrapper.setAttribute('data-step', journeyStep);

        const contextChip = document.getElementById('journeyChipContext');
        const rewardChip = document.getElementById('journeyChipReward');
        const decisionChip = document.getElementById('journeyChipDecision');
        const toRewardBtn = document.getElementById('journeyToRewardBtn');
        const toDecisionBtn = document.getElementById('journeyToDecisionBtn');
        const rewardResetBtn = document.getElementById('journeyResetRewardBtn');
        const decisionBackBtn = document.getElementById('journeyBackToRewardBtn');
        const decisionSkipBtn = document.getElementById('journeySkipRewardBtn');
        const inlineSkipBtn = document.getElementById('journeySkipInlineBtn');

        [contextChip, rewardChip, decisionChip].forEach(chip => {
            if (chip) {
                chip.classList.remove('is-active');
            }
        });

        if (journeyStep === 'context' && contextChip) {
            contextChip.classList.add('is-active');
        }
        if (journeyStep === 'reward' && rewardChip) {
            rewardChip.classList.add('is-active');
        }
        if (journeyStep === 'decision' && decisionChip) {
            decisionChip.classList.add('is-active');
        }

        if (toRewardBtn) {
            toRewardBtn.hidden = journeyStep !== 'context';
        }

        if (toDecisionBtn) {
            toDecisionBtn.hidden = journeyStep !== 'reward';
            toDecisionBtn.disabled = comparisonState.length !== 3;
        }

        if (rewardResetBtn) {
            rewardResetBtn.hidden = journeyStep !== 'reward';
        }

        if (decisionBackBtn) {
            decisionBackBtn.hidden = journeyStep !== 'decision';
        }

        if (decisionSkipBtn) {
            decisionSkipBtn.hidden = journeyStep !== 'decision';
            decisionSkipBtn.disabled = comparisonState.length !== 3;
        }

        if (inlineSkipBtn) {
            inlineSkipBtn.hidden = journeyStep !== 'decision';
            inlineSkipBtn.disabled = comparisonState.length !== 3;
        }
    }

    function setJourneyStep(step, message) {
        if (step === 'reward' && journeyStep === 'context') {
            setActiveRightPanel('comparison');
        }

        journeyStep = step === 'reward' || step === 'decision' ? step : 'context';
        document.body.setAttribute('data-journey-step', journeyStep);
        if (journeyStep === 'reward' || journeyStep === 'decision') {
            setActiveRightPanel('comparison');
        }
        syncJourneyUI();
        setJourneyStatusText(message || getJourneyStatusText(journeyStep));
    }

    function createCardState(cardKey, isUpgraded) {
        const normalized = normalizeCardKey(cardKey);
        if (!normalized) {
            return null;
        }

        stateIdCounter += 1;
        return {
            id: `state-${stateIdCounter}`,
            cardKey: normalized,
            isUpgraded: !!isUpgraded
        };
    }

    function getStateCardKey(stateEntry) {
        if (stateEntry && typeof stateEntry === 'object') {
            return normalizeCardKey(stateEntry.cardKey);
        }

        return normalizeCardKey(stateEntry);
    }

    function getStateUpgraded(stateEntry) {
        if (stateEntry && typeof stateEntry === 'object') {
            return !!stateEntry.isUpgraded;
        }

        return /Plus$/i.test(String(stateEntry || ''));
    }

    function allCardsGridItems() {
        return Array.from(allCardsGrid.querySelectorAll('.card-grid-item'));
    }

    function prepareItem(item) {
        const img = item.querySelector('.card-image-wrap > img.card-art');
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
        if (cardKey && typeof cardKey === 'object') {
            cardKey = cardKey.cardKey;
        }

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

        const img = item.querySelector('.card-image-wrap > img.card-art');
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
            const img = item.querySelector('.card-image-wrap > img.card-art');
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
        activeOverlayIsUpgraded = useUpgraded;
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

    function createCardTile(stateEntry, actionMode, stateIndex) {
        const key = getStateCardKey(stateEntry);
        const isUpgraded = getStateUpgraded(stateEntry);
        const card = cardCatalog.get(key);
        if (!card) {
            return null;
        }

        const item = document.createElement('div');
        item.className = 'card-grid-item';
        item.setAttribute('data-card-name', card.name);
        item.setAttribute('data-card-key', key);
        item.setAttribute('data-card-upgraded', String(isUpgraded));
        if (stateEntry && typeof stateEntry === 'object' && stateEntry.id) {
            item.setAttribute('data-state-id', stateEntry.id);
        }
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
                    <button type="button" class="action-btn" data-action="toggle-upgrade">${isUpgraded ? 'Base' : 'Upg'}</button>
                   </div>`;
        }
        if (actionMode === 'deck') {
            actionsHtml = `<div class="card-actions">
                    <button type="button" class="action-btn" data-action="toggle-upgrade">${isUpgraded ? 'Base' : 'Upg'}</button>
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
        await Promise.all(gridItems.map(item => {
            const enablePlus = grid === allCardsGrid
                ? showPlus
                : item.getAttribute('data-card-upgraded') === 'true';
            return applyCardMode(item, enablePlus);
        }));
    }

    async function renderCollection(grid, stateEntries) {
        grid.innerHTML = '';
        let actionMode = null;
        if (grid === comparisonGrid) {
            actionMode = 'comparison';
        }
        if (grid === currentDeckGrid) {
            actionMode = 'deck';
        }

        stateEntries.forEach((stateEntry, index) => {
            const item = createCardTile(stateEntry, actionMode, index);
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
        syncJourneyUI();
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

    function toTitleLabel(text) {
        if (!text) {
            return '';
        }

        return text
            .split('_')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ');
    }

    function getPackageProgressInfo(profile, packageName) {
        const metadata = getPackageMetadata(packageName);
        const enabledAt = metadata?.thresholds?.enabledAt || {};
        const keys = Object.keys(enabledAt);

        if (keys.length === 0) {
            const activeCount = profile.packageCounts[packageName] || 0;
            return {
                text: activeCount > 0 ? 'active' : '0',
                missingHint: activeCount > 0 ? '' : `Need ${toTitleLabel(packageName)} support`
            };
        }

        const weakest = keys
            .map(key => {
                const target = Math.max(enabledAt[key], 1);
                const actual = getProfileMetricValue(profile, packageName, key);
                return {
                    key,
                    actual,
                    target,
                    ratio: actual / target
                };
            })
            .sort((left, right) => left.ratio - right.ratio)[0];

        const progressCount = `${Math.min(weakest.actual, weakest.target)}/${weakest.target}`;
        const missingAmount = Math.max(0, weakest.target - weakest.actual);
        const missingHint = missingAmount > 0
            ? `Need ${missingAmount} more ${weakest.key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`
            : '';

        return {
            text: progressCount,
            missingHint
        };
    }

    function renderSynergyReadiness() {
        if (!synergyReadinessBar || !synergyReadinessChips) {
            return;
        }

        if (deckState.length === 0) {
            synergyReadinessBar.hidden = true;
            synergyReadinessChips.innerHTML = '';
            return;
        }

        const profile = getDeckSynergyProfile();
        const packageOrder = ['strength', 'block', 'exhaust', 'vulnerable', 'self_damage', 'strike'];
        const metadataPackages = Object.keys(synergyMetadata.packages || {});
        const packageNames = uniqueValues(packageOrder.concat(metadataPackages));

        const packageStates = packageNames.map(packageName => {
            const activation = getPackageActivation(profile, packageName);
            const progress = getPackageProgressInfo(profile, packageName);
            let status = 'is-missing';
            let statusText = 'Missing';

            if (activation >= 0.9) {
                status = 'is-ready';
                statusText = 'Ready';
            } else if (activation >= 0.45 || (profile.packageCounts[packageName] || 0) > 0) {
                status = 'is-growing';
                statusText = 'Growing';
            }

            const titleParts = [
                `${toTitleLabel(packageName)}: ${statusText}`,
                progress.missingHint
            ].filter(Boolean);

            return {
                packageName,
                status,
                statusText,
                activation,
                progressText: progress.text,
                title: titleParts.join(' | ')
            };
        });

        packageStates.sort((left, right) => right.activation - left.activation);
        const topStates = packageStates.slice(0, 6);

        synergyReadinessChips.innerHTML = topStates.map(item => `
            <span class="synergy-readiness-chip ${item.status}" title="${item.title}">
                <span>${toTitleLabel(item.packageName)}</span>
                <span class="synergy-chip-count">${item.progressText}</span>
            </span>`).join('');
        synergyReadinessBar.hidden = topStates.length === 0;
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

    function loadRunContext() {
        try {
            const raw = localStorage.getItem(runContextStorageKey);
            if (!raw) {
                if (!runContext.runId) {
                    runContext.runId = createRunId();
                }
                return;
            }

            const parsed = JSON.parse(raw);
            runContext.act = Math.max(1, Math.min(3, Number.parseInt(parsed.act || 1, 10) || 1));
            runContext.floor = clampRunFloor(parsed.floor || 1);
            runContext.ascension = clampAscension(parsed.ascension || 0);
            runContext.currentHp = clampStatInt(parsed.currentHp, runContext.currentHp, 1, 999);
            runContext.maxHp = clampStatInt(parsed.maxHp, runContext.maxHp, 1, 999);
            runContext.currentHp = Math.min(runContext.currentHp, runContext.maxHp);
            runContext.gold = clampStatInt(parsed.gold, runContext.gold, 0, 9999);
            runContext.relics = clampStatInt(parsed.relics, runContext.relics, 0, 99);
            runContext.potions = clampStatInt(parsed.potions, runContext.potions, 0, 10);
            runContext.nodeType = typeof parsed.nodeType === 'string' && parsed.nodeType.trim()
                ? parsed.nodeType.trim()
                : 'unknown';
            runContext.seed = typeof parsed.seed === 'string' ? parsed.seed.trim() : '';
            runContext.runId = typeof parsed.runId === 'string' && parsed.runId.trim()
                ? parsed.runId.trim()
                : createRunId();
            syncActFromFloor();
        } catch {
            runContext = {
                act: 1,
                floor: 1,
                ascension: 0,
                currentHp: 80,
                maxHp: 80,
                gold: 99,
                relics: 1,
                potions: 0,
                nodeType: 'unknown',
                seed: '',
                runId: createRunId()
            };
            syncActFromFloor();
        }

        if (!runContext.runId) {
            runContext.runId = createRunId();
        }

        syncActFromFloor();
    }

    function saveRunContext() {
        try {
            localStorage.setItem(runContextStorageKey, JSON.stringify(runContext));
        } catch {
            // Ignore storage errors to keep recommendations responsive.
        }
    }

    function getRunContext() {
        return {
            act: runContext.act,
            floor: runContext.floor,
            ascension: runContext.ascension,
            currentHp: runContext.currentHp,
            maxHp: runContext.maxHp,
            gold: runContext.gold,
            relics: runContext.relics,
            potions: runContext.potions,
            nodeType: runContext.nodeType,
            seed: runContext.seed,
            runId: runContext.runId
        };
    }

    function refreshRunContextControlValues() {
        const actSelect = document.getElementById('runActSelect');
        const floorInput = document.getElementById('runFloorInput');
        const floorStepBtn = document.getElementById('runFloorStepBtn');
        const ascensionInput = document.getElementById('runAscensionInput');
        const nodeTypeSelect = document.getElementById('runNodeTypeSelect');
        const hpInput = document.getElementById('runHpInput');
        const maxHpInput = document.getElementById('runMaxHpInput');
        const goldInput = document.getElementById('runGoldInput');
        const relicsInput = document.getElementById('runRelicsInput');
        const potionsInput = document.getElementById('runPotionsInput');
        const seedInput = document.getElementById('runSeedInput');

        if (!actSelect || !floorInput || !floorStepBtn || !ascensionInput || !nodeTypeSelect || !hpInput || !maxHpInput || !goldInput || !relicsInput || !potionsInput || !seedInput) {
            return;
        }

        syncActFromFloor();
        actSelect.value = String(runContext.act);
        floorInput.value = String(runContext.floor);
        ascensionInput.value = String(runContext.ascension);
        nodeTypeSelect.value = runContext.nodeType || 'unknown';
        hpInput.value = String(runContext.currentHp);
        maxHpInput.value = String(runContext.maxHp);
        goldInput.value = String(runContext.gold);
        relicsInput.value = String(runContext.relics);
        potionsInput.value = String(runContext.potions);
        seedInput.value = runContext.seed || '';

        actSelect.disabled = false;
        floorInput.readOnly = false;
        floorStepBtn.hidden = true;
        floorStepBtn.disabled = true;
        ascensionInput.disabled = runContext.floor > 1;
    }

    function recordDeckMutation(action, cardKey, details) {
        if (!runLogger) {
            return;
        }

        runLogger.append({
            eventType: 'deckMutation',
            schemaVersion: runLogSchemaVersion,
            appVersion: runLogAppVersion,
            id: `deck-${Date.now()}`,
            timestampUtc: new Date().toISOString(),
            runId: runContext.runId,
            context: getRunContext(),
            action,
            cardKey: normalizeCardKey(cardKey),
            deckSize: deckState.length,
            deck: getDeckSnapshotKeys(),
            ...details
        });
    }

    function getDeckSnapshotKeys() {
        return deckState.map(stateEntry => {
            const key = getStateCardKey(stateEntry);
            return getStateUpgraded(stateEntry) ? `${key}Plus` : key;
        });
    }

    function recordOfferSnapshot(scoredCards, skipScore) {
        if (!Array.isArray(scoredCards) || scoredCards.length === 0) {
            activeOfferSnapshot = null;
            return;
        }

        activeOfferSnapshot = {
            eventType: 'pickOffer',
            schemaVersion: runLogSchemaVersion,
            appVersion: runLogAppVersion,
            id: `offer-${Date.now()}`,
            timestampUtc: new Date().toISOString(),
            runId: runContext.runId,
            eventSource: 'cardReward',
            context: getRunContext(),
            deck: getDeckSnapshotKeys(),
            skipScore,
            offers: scoredCards.map(card => ({
                key: card.key,
                label: card.label,
                score: card.score,
                immediatePickup: card.immediatePickup,
                lookaheadPickup: card.lookaheadPickup,
                risk: card.risk,
                confidence: card.confidence,
                marginVsSkip: card.marginVsSkip
            }))
        };
    }

    function recordPickedCard(cardKey, source) {
        if (!runLogger || !activeOfferSnapshot) {
            return false;
        }

        if (source !== 'comparisonReward') {
            return false;
        }

        const picked = normalizeCardKey(cardKey);
        const top = activeOfferSnapshot.offers[0] || null;
        const chosenIndex = activeOfferSnapshot.offers.findIndex(option => option.key === picked);
        if (chosenIndex < 0) {
            activeOfferSnapshot = null;
            return false;
        }

        runLogger.append({
            ...activeOfferSnapshot,
            picked,
            pickedFromOffer: true,
            chosenIndex,
            offerCount: activeOfferSnapshot.offers.length,
            topRecommended: top ? top.key : '',
            matchedRecommendation: !!top && top.key === picked
        });

        activeOfferSnapshot = null;
        return true;
    }

    function recordSkippedReward(reason) {
        if (!runLogger || !activeOfferSnapshot) {
            return false;
        }

        const top = activeOfferSnapshot.offers[0] || null;
        runLogger.append({
            ...activeOfferSnapshot,
            picked: 'SKIP',
            skipped: true,
            skipReason: reason || 'userSkip',
            pickedFromOffer: false,
            chosenIndex: -1,
            offerCount: activeOfferSnapshot.offers.length,
            topRecommended: top ? top.key : '',
            matchedRecommendation: false
        });

        activeOfferSnapshot = null;
        return true;
    }

    function recordRunSummary(status) {
        if (!runLogger) {
            return;
        }

        const safeStatus = typeof status === 'string' && status.trim() ? status.trim() : 'ended';
        runLogger.append({
            eventType: 'runSummary',
            schemaVersion: runLogSchemaVersion,
            appVersion: runLogAppVersion,
            id: `run-summary-${Date.now()}`,
            timestampUtc: new Date().toISOString(),
            runId: runContext.runId,
            context: getRunContext(),
            finalFloor: runContext.floor,
            status: safeStatus,
            outcome: safeStatus,
            deck: getDeckSnapshotKeys()
        });
    }

    function exportRunLogs() {
        if (!runLogger) {
            return;
        }

        const payload = runLogger.export();
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `spire-helper-run-logs-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function exportCurrentRunLogs() {
        if (!runLogger) {
            return;
        }

        const filtered = runLogger.read().filter(entry => entry && entry.runId === runContext.runId);
        const payload = JSON.stringify(filtered, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `spire-helper-run-${runContext.runId}-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function clearRunLogs() {
        if (!runLogger) {
            return;
        }

        runLogger.clear();
    }

    function initRunContextControls() {
        const searchBox = document.querySelector('.search-box');
        if (!searchBox) {
            return;
        }

        const existing = document.getElementById('runContextControls');
        if (existing) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'runContextControls';
        wrapper.className = 'strength-context-row';
        wrapper.innerHTML = `
            <label for="runActSelect">Run Context</label>
            <div class="run-context-grid">
                <div>
                    <label for="runActSelect">Act</label>
                    <select id="runActSelect" class="form-select form-select-sm" aria-label="Act selector">
                        <option value="1">Act 1</option>
                        <option value="2">Act 2</option>
                        <option value="3">Act 3</option>
                    </select>
                </div>
                <div>
                    <label for="runFloorStepBtn">Total Floor</label>
                    <div class="run-floor-row">
                        <input id="runFloorInput" type="number" min="1" max="60" step="1" class="form-control form-control-sm run-floor-value" aria-label="Total floor" />
                        <button id="runFloorStepBtn" type="button" class="action-btn btn-compare" aria-label="Increase floor by one">+1 Floor</button>
                    </div>
                </div>
                <div>
                    <label for="runAscensionInput">Ascension</label>
                    <input id="runAscensionInput" type="number" min="0" max="10" step="1" class="form-control form-control-sm" aria-label="Ascension level" />
                </div>
                <div>
                    <label for="runNodeTypeSelect">Node</label>
                    <select id="runNodeTypeSelect" class="form-select form-select-sm" aria-label="Map node type">
                        <option value="unknown">Unknown</option>
                        <option value="normal">Normal</option>
                        <option value="elite">Elite</option>
                        <option value="boss">Boss</option>
                        <option value="event">Event</option>
                        <option value="shop">Shop</option>
                        <option value="rest">Rest</option>
                    </select>
                </div>
                <div>
                    <label for="runHpInput">HP</label>
                    <div class="run-floor-row">
                        <input id="runHpInput" type="number" min="1" max="999" step="1" class="form-control form-control-sm" aria-label="Current HP" />
                        <span class="run-inline-separator">/</span>
                        <input id="runMaxHpInput" type="number" min="1" max="999" step="1" class="form-control form-control-sm" aria-label="Max HP" />
                    </div>
                </div>
                <div>
                    <label for="runGoldInput">Gold</label>
                    <input id="runGoldInput" type="number" min="0" max="9999" step="1" class="form-control form-control-sm" aria-label="Gold" />
                </div>
                <div>
                    <label for="runRelicsInput">Relics</label>
                    <input id="runRelicsInput" type="number" min="0" max="99" step="1" class="form-control form-control-sm" aria-label="Relic count" />
                </div>
                <div>
                    <label for="runPotionsInput">Potions</label>
                    <input id="runPotionsInput" type="number" min="0" max="10" step="1" class="form-control form-control-sm" aria-label="Potion count" />
                </div>
                <div>
                    <label for="runSeedInput">Seed</label>
                    <input id="runSeedInput" type="text" class="form-control form-control-sm" aria-label="Run seed" maxlength="40" />
                </div>
                <div>
                    <label for="runOutcomeSelect">Run Outcome</label>
                    <select id="runOutcomeSelect" class="form-select form-select-sm" aria-label="Run outcome">
                        <option value="ended">Ended</option>
                        <option value="victory">Victory</option>
                        <option value="death">Death</option>
                        <option value="abandon">Abandon</option>
                    </select>
                </div>
            </div>
            <div class="run-log-actions">
                <button id="startNewRunBtn" type="button" class="action-btn btn-compare">New Run</button>
                <button id="endRunBtn" type="button" class="action-btn btn-deck">End Run</button>
                <button id="exportCurrentRunLogsBtn" type="button" class="action-btn btn-deck">Export Active Run</button>
                <button id="exportRunLogsBtn" type="button" class="action-btn btn-compare">Export Logs</button>
                <button id="clearRunLogsBtn" type="button" class="action-btn btn-remove">Clear Logs</button>
            </div>`;
        searchBox.appendChild(wrapper);

        const actSelect = document.getElementById('runActSelect');
        const floorInput = document.getElementById('runFloorInput');
        const floorStepBtn = document.getElementById('runFloorStepBtn');
        const ascensionInput = document.getElementById('runAscensionInput');
        const nodeTypeSelect = document.getElementById('runNodeTypeSelect');
        const hpInput = document.getElementById('runHpInput');
        const maxHpInput = document.getElementById('runMaxHpInput');
        const goldInput = document.getElementById('runGoldInput');
        const relicsInput = document.getElementById('runRelicsInput');
        const potionsInput = document.getElementById('runPotionsInput');
        const seedInput = document.getElementById('runSeedInput');
        const outcomeSelect = document.getElementById('runOutcomeSelect');
        const startNewRunBtn = document.getElementById('startNewRunBtn');
        const endRunBtn = document.getElementById('endRunBtn');
        const exportCurrentRunBtn = document.getElementById('exportCurrentRunLogsBtn');
        const exportBtn = document.getElementById('exportRunLogsBtn');
        const clearBtn = document.getElementById('clearRunLogsBtn');

        if (!actSelect || !floorInput || !floorStepBtn || !ascensionInput || !nodeTypeSelect || !hpInput || !maxHpInput || !goldInput || !relicsInput || !potionsInput || !seedInput || !outcomeSelect) {
            return;
        }

        const syncContextInputs = function () {
            refreshRunContextControlValues();
        };

        syncContextInputs();

        const parseContextInputs = function () {
            runContext.floor = clampRunFloor(floorInput.value || runContext.floor);
            const selectedAct = Math.max(1, Math.min(3, Number.parseInt(actSelect.value || String(runContext.act), 10) || runContext.act));
            if (selectedAct !== deriveActFromFloor(runContext.floor)) {
                setFloorFromAct(selectedAct);
            } else {
                syncActFromFloor();
            }
            if (runContext.floor <= 1) {
                runContext.ascension = clampAscension(ascensionInput.value || runContext.ascension);
            }
            runContext.maxHp = clampStatInt(maxHpInput.value, runContext.maxHp, 1, 999);
            runContext.currentHp = clampStatInt(hpInput.value, runContext.currentHp, 1, runContext.maxHp);
            runContext.gold = clampStatInt(goldInput.value, runContext.gold, 0, 9999);
            runContext.relics = clampStatInt(relicsInput.value, runContext.relics, 0, 99);
            runContext.potions = clampStatInt(potionsInput.value, runContext.potions, 0, 10);
            runContext.nodeType = typeof nodeTypeSelect.value === 'string' && nodeTypeSelect.value.trim()
                ? nodeTypeSelect.value.trim()
                : 'unknown';
            runContext.seed = (seedInput.value || '').trim();
        };

        const persistAndRender = function () {
            saveRunContext();
            renderCardStrengthSignals();
            renderDeckHealth();
            refreshOverlayIfOpen();
        };

        const onContextChange = function () {
            parseContextInputs();
            syncContextInputs();
            persistAndRender();
        };

        actSelect.addEventListener('change', onContextChange);
        floorInput.addEventListener('change', onContextChange);
        floorInput.addEventListener('blur', onContextChange);
        ascensionInput.addEventListener('change', onContextChange);
        ascensionInput.addEventListener('blur', onContextChange);
        nodeTypeSelect.addEventListener('change', onContextChange);
        hpInput.addEventListener('change', onContextChange);
        hpInput.addEventListener('blur', onContextChange);
        maxHpInput.addEventListener('change', onContextChange);
        maxHpInput.addEventListener('blur', onContextChange);
        goldInput.addEventListener('change', onContextChange);
        goldInput.addEventListener('blur', onContextChange);
        relicsInput.addEventListener('change', onContextChange);
        relicsInput.addEventListener('blur', onContextChange);
        potionsInput.addEventListener('change', onContextChange);
        potionsInput.addEventListener('blur', onContextChange);
        seedInput.addEventListener('change', onContextChange);
        seedInput.addEventListener('blur', onContextChange);
        floorStepBtn.addEventListener('click', function () {
            // Floor progression is automatic after reward decisions.
        });

        if (startNewRunBtn) {
            startNewRunBtn.addEventListener('click', function () {
                runContext = {
                    act: 1,
                    floor: 1,
                    ascension: runContext.ascension,
                    currentHp: runContext.maxHp,
                    maxHp: runContext.maxHp,
                    gold: 99,
                    relics: 1,
                    potions: 0,
                    nodeType: 'unknown',
                    seed: '',
                    runId: createRunId()
                };
                syncActFromFloor();
                activeOfferSnapshot = null;
                syncContextInputs();
                persistAndRender();
            });
        }

        if (endRunBtn) {
            endRunBtn.addEventListener('click', function () {
                parseContextInputs();
                syncContextInputs();
                saveRunContext();
                recordRunSummary(outcomeSelect.value || 'ended');
            });
        }

        if (exportCurrentRunBtn) {
            exportCurrentRunBtn.addEventListener('click', exportCurrentRunLogs);
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', exportRunLogs);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', clearRunLogs);
        }
    }

    function initJourneyFlowControls() {
        const searchBox = document.querySelector('.search-box');
        if (!searchBox || document.getElementById('journeyFlowControls')) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.id = 'journeyFlowControls';
        wrapper.className = 'journey-flow';
        wrapper.innerHTML = `
            <div class="journey-steps" role="list" aria-label="Reward workflow steps">
                <span id="journeyChipContext" class="journey-chip is-active" role="listitem">1. Floor and Context</span>
                <span id="journeyChipReward" class="journey-chip" role="listitem">2. Reward Setup</span>
                <span id="journeyChipDecision" class="journey-chip" role="listitem">3. Pick or Skip</span>
            </div>
            <p id="journeyStatusText" class="journey-status"></p>
            <div class="journey-actions">
                <button id="journeyToRewardBtn" type="button" class="action-btn btn-compare">Continue to Reward Setup</button>
                <button id="journeyToDecisionBtn" type="button" class="action-btn btn-deck" hidden>Continue to Decision</button>
                <button id="journeyResetRewardBtn" type="button" class="action-btn btn-remove" hidden>Reset Reward Choices</button>
                <button id="journeyBackToRewardBtn" type="button" class="action-btn btn-compare" hidden>Back to Reward Setup</button>
                <button id="journeySkipRewardBtn" type="button" class="action-btn btn-remove" hidden>Skip Reward</button>
            </div>`;
        searchBox.appendChild(wrapper);

        const toRewardBtn = document.getElementById('journeyToRewardBtn');
        const toDecisionBtn = document.getElementById('journeyToDecisionBtn');
        const resetRewardBtn = document.getElementById('journeyResetRewardBtn');
        const backToRewardBtn = document.getElementById('journeyBackToRewardBtn');
        const skipRewardBtn = document.getElementById('journeySkipRewardBtn');
        const clearComparisonBtn = document.getElementById('clearComparisonBtn');

        if (clearComparisonBtn && !document.getElementById('journeySkipInlineBtn')) {
            const inlineSkipBtn = document.createElement('button');
            inlineSkipBtn.id = 'journeySkipInlineBtn';
            inlineSkipBtn.type = 'button';
            inlineSkipBtn.className = 'action-btn btn-remove';
            inlineSkipBtn.textContent = 'Skip Reward';
            inlineSkipBtn.hidden = true;
            inlineSkipBtn.disabled = true;
            inlineSkipBtn.style.fontSize = '0.75rem';
            inlineSkipBtn.style.padding = '0.25rem 0.6rem';
            inlineSkipBtn.style.whiteSpace = 'nowrap';
            clearComparisonBtn.insertAdjacentElement('afterend', inlineSkipBtn);
        }

        const inlineSkipBtn = document.getElementById('journeySkipInlineBtn');

        if (toRewardBtn) {
            toRewardBtn.addEventListener('click', function () {
                setJourneyStep('reward');
            });
        }

        if (toDecisionBtn) {
            toDecisionBtn.addEventListener('click', function () {
                if (comparisonState.length !== 3) {
                    setJourneyStatusText('Select exactly 3 reward cards before moving to decision.');
                    return;
                }

                renderCardStrengthSignals();
                setJourneyStep('decision');
            });
        }

        if (resetRewardBtn) {
            resetRewardBtn.addEventListener('click', async function () {
                await clearComparison();
                setJourneyStatusText('Reward choices reset. Choose exactly 3 cards.');
            });
        }

        if (backToRewardBtn) {
            backToRewardBtn.addEventListener('click', function () {
                setJourneyStep('reward');
            });
        }

        if (skipRewardBtn) {
            skipRewardBtn.addEventListener('click', async function () {
                await handleSkipRewardAction('userSkip');
            });
        }

        if (inlineSkipBtn) {
            inlineSkipBtn.addEventListener('click', async function () {
                await handleSkipRewardAction('inlineSkip');
            });
        }

        setJourneyStep('context');
    }

    function getCardLabel(cardKey) {
        const normalized = normalizeCardKey(cardKey);
        const fromCatalog = cardCatalog.get(normalized)?.label;
        if (fromCatalog) {
            return fromCatalog;
        }

        const fromEntry = getCardEntryByKey(normalized)?.title;
        if (typeof fromEntry === 'string' && fromEntry.trim()) {
            return fromEntry.trim();
        }

        return normalized.replace(/^StS2_Ironclad-/, '').replace(/[_-]/g, ' ');
    }

    function buildReasonSummary(reasons) {
        if (!Array.isArray(reasons) || reasons.length === 0) {
            return 'No strong signal yet.';
        }

        const primary = reasons[0] || '';
        return primary || 'No strong signal yet.';
    }

    function scoreDeckUpgradeCandidate(cardKey, deficits, profile, duplicateCounts) {
        const traits = getCardTraits(cardKey);
        const entry = getCardEntryByKey(cardKey) || {};
        const normalized = normalizeCardKey(cardKey);
        const hasUpgradeText = typeof entry.upgraded_description === 'string'
            && entry.upgraded_description.trim()
            && entry.upgraded_description.trim() !== (entry.description || '').trim();

        let score = 18;
        const reasons = [];

        const pushReason = function (weight, text) {
            reasons.push({ weight, text });
            score += weight;
        };

        const needFrontload = getMetricNeedContribution(traits.metrics.frontload, deficits.frontload, 28);
        if (needFrontload >= 6) {
            pushReason(needFrontload, 'Improves an immediate frontload weakness');
        }

        const needBlock = getMetricNeedContribution(traits.metrics.block, deficits.block, 28);
        if (needBlock >= 6) {
            pushReason(needBlock, 'Adds needed defensive consistency');
        }

        const needScaling = getMetricNeedContribution(traits.metrics.scaling, deficits.scaling, 26);
        if (needScaling >= 6) {
            pushReason(needScaling, 'Strengthens long-fight scaling pressure');
        }

        const needConsistency = getMetricNeedContribution(traits.metrics.consistency, deficits.consistency, 28);
        if (needConsistency >= 5) {
            pushReason(needConsistency, 'Smooths awkward draw and energy turns');
        }

        if (traits.scaling || traits.blockPayoff || traits.exhaustPayoff || traits.vulnerablePayoff || traits.selfDamagePayoff) {
            pushReason(8, 'Core engine piece scales harder with upgrades');
        }

        if (traits.highCost) {
            pushReason(3, 'Top-end cards usually gain a high-value breakpoint');
        }

        if (normalized.includes('Strike') && profile.strikePayoffs === 0) {
            pushReason(-10, 'Starter Strike upgrade is low impact without Strike payoffs');
        }

        if (normalized.includes('Defend') && deficits.block >= 16) {
            pushReason(5, 'Extra block now helps stabilize weak openings');
        }

        if ((duplicateCounts[normalized] || 0) >= 3 && normalized.includes('Strike') && profile.strikePayoffs === 0) {
            pushReason(-5, 'Many similar copies reduce marginal upgrade value');
        }

        if (!hasUpgradeText) {
            pushReason(-9, 'Upgrade text delta is limited in current data');
        }

        if (traits.conditional && deficits.consistency >= 14) {
            pushReason(-5, 'Conditional cards are harder to capitalize on right now');
        }

        const finalScore = clampScore(score);
        const sortedReasons = reasons
            .slice()
            .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
            .map(item => item.text);

        return {
            cardKey: normalized,
            label: getCardLabel(cardKey),
            score: finalScore,
            summary: buildReasonSummary(sortedReasons),
            reasons: Array.from(new Set(sortedReasons)).slice(0, 3)
        };
    }

    function scoreDeckRemovalCandidate(cardKey, deficits, profile) {
        const traits = getCardTraits(cardKey);
        const normalized = normalizeCardKey(cardKey);
        const overall = evaluateCardStrengthOverall(cardKey, deficits, profile);

        let score = 8;
        const reasons = [];

        const pushReason = function (weight, text) {
            reasons.push({ weight, text });
            score += weight;
        };

        if (normalized.includes('Strike') && profile.strikePayoffs === 0) {
            pushReason(30, 'Starter Strike is low-value without Strike payoff support');
        }

        if (traits.conditional) {
            pushReason(16, 'Conditional play pattern lowers reliability');
        }

        if (traits.highCost && (deficits.consistency >= 14 || profile.highCost >= 4)) {
            pushReason(14, 'Curve is strained by expensive setup cards');
        }

        if (traits.selfDamage && profile.selfDamagePayoffCards === 0) {
            pushReason(10, 'HP-loss downside lacks payoff support');
        }

        const rawImpact = traits.metrics.frontload + traits.metrics.block + traits.metrics.scaling + traits.metrics.consistency + traits.metrics.utility;
        if (rawImpact < 28) {
            pushReason(10, 'Low-impact card compared with current deck needs');
        }

        if (traits.scaling && deficits.scaling >= 16) {
            pushReason(-12, 'Keep this because scaling is currently a weakness');
        }
        if (traits.block && deficits.block >= 16) {
            pushReason(-10, 'Keep this because deck still needs stable block');
        }
        if ((traits.draw || traits.deckManipulation || traits.costCheat || traits.energyGain) && deficits.consistency >= 16) {
            pushReason(-10, 'Keep this because consistency support is needed');
        }
        if (traits.vulnerable && deficits.frontload >= 16) {
            pushReason(-6, 'Vulnerable support helps close early damage gaps');
        }

        if (overall.pickup <= 35) {
            pushReason(8, 'Overall fit score is currently very low');
        }

        const finalScore = clampScore(score);
        const sortedReasons = reasons
            .slice()
            .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
            .map(item => item.text);

        return {
            cardKey: normalized,
            label: getCardLabel(cardKey),
            score: finalScore,
            pickup: overall.pickup,
            summary: buildReasonSummary(sortedReasons),
            reasons: Array.from(new Set(sortedReasons)).slice(0, 3)
        };
    }

    function renderDeckActionPriority(scoreElement, nameElement, reasonElement, whyElement, candidate, defaults) {
        if (!scoreElement || !nameElement || !reasonElement || !whyElement) {
            return;
        }

        if (!candidate) {
            scoreElement.textContent = '-';
            nameElement.textContent = defaults.emptyName;
            reasonElement.textContent = defaults.emptyReason;
            setListItems(whyElement, [defaults.emptyWhy]);
            return;
        }

        scoreElement.textContent = String(candidate.score);
        nameElement.textContent = candidate.label;
        reasonElement.textContent = candidate.summary;
        setListItems(whyElement, candidate.reasons.length > 0 ? candidate.reasons : [defaults.emptyWhy]);
    }

    function renderDeckPriorities(scores) {
        const defaults = {
            upgrade: {
                emptyName: 'Add cards to evaluate.',
                emptyReason: 'Upgrade recommendation will appear here.',
                emptyWhy: 'No deck data yet.'
            },
            removal: {
                emptyName: 'Add cards to evaluate.',
                emptyReason: 'Removal recommendation will appear here.',
                emptyWhy: 'No deck data yet.'
            }
        };

        if (!scores || deckState.length === 0) {
            renderDeckActionPriority(upgradePriorityScore, upgradePriorityName, upgradePriorityReason, upgradePriorityWhy, null, defaults.upgrade);
            renderDeckActionPriority(removalPriorityScore, removalPriorityName, removalPriorityReason, removalPriorityWhy, null, defaults.removal);
            return;
        }

        const deficits = getNeedDeficits(scores);
        const profile = getDeckSynergyProfile();
        const duplicateCounts = {};
        deckState.forEach(cardKey => incrementCount(duplicateCounts, normalizeCardKey(cardKey)));

        const baseUpgradeCandidates = deckState
            .filter(stateEntry => !getStateUpgraded(stateEntry))
            .map(stateEntry => scoreDeckUpgradeCandidate(getStateCardKey(stateEntry), deficits, profile, duplicateCounts));
        const removalCandidates = deckState.map(cardKey => scoreDeckRemovalCandidate(cardKey, deficits, profile));

        const upgradeChoice = baseUpgradeCandidates
            .slice()
            .sort((left, right) => right.score - left.score)[0] || null;
        const removalChoice = removalCandidates
            .slice()
            .sort((left, right) => {
                if (right.score !== left.score) {
                    return right.score - left.score;
                }
                return left.pickup - right.pickup;
            })[0] || null;

        if (!upgradeChoice && deckState.length > 0 && baseUpgradeCandidates.length === 0) {
            renderDeckActionPriority(upgradePriorityScore, upgradePriorityName, upgradePriorityReason, upgradePriorityWhy, {
                score: 0,
                label: 'All cards upgraded',
                summary: 'No base cards remain to upgrade.',
                reasons: ['Deck currently has no non-upgraded card copies.']
            }, defaults.upgrade);
        } else {
            renderDeckActionPriority(upgradePriorityScore, upgradePriorityName, upgradePriorityReason, upgradePriorityWhy, upgradeChoice, defaults.upgrade);
        }

        renderDeckActionPriority(removalPriorityScore, removalPriorityName, removalPriorityReason, removalPriorityWhy, removalChoice, defaults.removal);
    }

    function renderFightStrategy(scores) {
        if (!deckStrategyTag || !deckStrategySummary || !deckStrategyPlan) {
            return;
        }

        if (!scores || deckState.length === 0) {
            deckStrategyTag.textContent = 'Adaptive';
            deckStrategySummary.textContent = 'Add cards to get a play pattern recommendation.';
            setListItems(deckStrategyPlan, ['No deck data yet.']);
            return;
        }

        const deficits = getNeedDeficits(scores);
        const profile = getDeckSynergyProfile();
        const deckSize = deckState.length;
        const runPhase = deckSize <= 14 ? 'early' : (deckSize <= 24 ? 'mid' : 'late');
        const biggestGap = Object.keys(deficits)
            .sort((left, right) => deficits[right] - deficits[left])[0] || 'frontload';
        const plans = [];
        let tag = 'Balanced';
        let summary = 'Play for stable value each turn and shift to scaling when safe.';

        if (runPhase === 'late' && scores.scaling >= 62) {
            tag = 'Scale';
            summary = 'In longer fights, protect HP early and lean hard into scaling lines.';
            plans.push('Prioritize setup cards that compound over multiple turns.');
            plans.push('Delay premium attacks until scaling or Vulnerable windows are active.');
            plans.push('Against bosses, trade short-term tempo for reliable late-turn dominance.');
        } else if (scores.scaling >= 70 && scores.block >= 55 && scores.frontload < 55) {
            tag = 'Scale';
            summary = 'Open with mitigation, then commit to scaling lines and close later.';
            plans.push('First two turns: prioritize block and setup effects over greedy damage.');
            plans.push('Spend premium attacks after scaling pieces or Vulnerable are online.');
            plans.push('Against elites/bosses, plan for a longer fight and protect HP early.');
        } else if (runPhase === 'early' && scores.block < 58) {
            tag = 'Stabilize';
            summary = 'In early floors, prioritize HP preservation and consistent turns over greed.';
            plans.push('Take cleaner lines that reduce incoming damage, even at small tempo loss.');
            plans.push('Avoid overcommitting fragile setups before your defense is online.');
            plans.push('Prefer reliable hallway clears over high-variance burst plans.');
        } else if (scores.frontload >= 68 && scores.block < 52) {
            tag = 'Tempo';
            summary = 'Race early damage and end fights quickly before defense falls behind.';
            plans.push('Prioritize aggressive turn 1-3 lines to remove enemy actions fast.');
            plans.push('Use block opportunistically, not as a full defensive posture.');
            plans.push('Path toward hallway/elite fights you can burst before attrition starts.');
        } else if (scores.block >= 68 && scores.scaling < 52) {
            tag = 'Stabilize';
            summary = 'Defend consistently while drafting toward a reliable win condition.';
            plans.push('Spend early energy on efficient block and status mitigation.');
            plans.push('Delay risky trades unless they secure lethal or major tempo.');
            plans.push('Draft and sequence cards that convert defense into scaling pressure.');
        } else {
            tag = 'Adaptive';
            summary = 'Take low-risk turns early, then pivot to your best payoff pattern.';
            plans.push('Use opening turns to fix draw order and avoid dead energy.');
            plans.push('Commit to damage only when your support pieces are active.');
            plans.push('Adjust per fight: faster lines in hallways, safer lines in elites.');
        }

        if (scores.consistency < 52) {
            plans.unshift('Mulligan mindset: prioritize low-cost, high-certainty cards each turn.');
        }
        if (runPhase === 'early') {
            plans.push('Early act rule: preserve HP first; avoid unnecessary damage races.');
        }
        if (runPhase === 'late') {
            plans.push('Late act rule: sequence for boss scaling turns, not just immediate tempo.');
        }
        if (profile.highCost >= 4) {
            plans.push('Protect hand quality: avoid overcommitting expensive cards in one turn.');
        }
        if (biggestGap === 'utility') {
            plans.push('Preserve flexible answers for multi-enemy or status-heavy fights.');
        }

        deckStrategyTag.textContent = tag;
        deckStrategySummary.textContent = summary;
        setListItems(deckStrategyPlan, Array.from(new Set(plans)).slice(0, 4));
    }

    function toPrimaryNeedLabel(metricKey) {
        if (metricKey === 'frontload') {
            return 'frontload and quick damage';
        }
        if (metricKey === 'block') {
            return 'stable block density';
        }
        if (metricKey === 'scaling') {
            return 'late-fight scaling';
        }
        if (metricKey === 'consistency') {
            return 'draw and energy smoothing';
        }
        return 'utility coverage';
    }

    function getPackageGapPlan(profile) {
        const packageNames = Object.keys(synergyMetadata.packages || {});
        const candidates = packageNames.map(packageName => {
            const activation = getPackageActivation(profile, packageName);
            const progress = getPackageProgressInfo(profile, packageName);
            return {
                packageName,
                activation,
                progressHint: progress.missingHint
            };
        });

        const nearReady = candidates
            .filter(item => item.activation >= 0.35 && item.activation < 0.9)
            .sort((left, right) => right.activation - left.activation)[0];

        if (!nearReady) {
            return null;
        }

        return {
            packageName: nearReady.packageName,
            text: nearReady.progressHint || `Finish ${toTitleLabel(nearReady.packageName)} package support`
        };
    }

    function renderNextTwoPickPlan(scores, deficits, profile) {
        if (!deckNextTwoTag || !deckNextTwoList) {
            return;
        }

        if (!scores || deckState.length === 0) {
            deckNextTwoTag.textContent = 'Plan';
            setListItems(deckNextTwoList, ['Add cards to generate a pick path.']);
            return;
        }

        const biggestGap = Object.keys(deficits).sort((left, right) => deficits[right] - deficits[left])[0] || 'frontload';
        const secondGap = Object.keys(deficits).sort((left, right) => deficits[right] - deficits[left])[1] || 'block';
        const packagePlan = getPackageGapPlan(profile);
        const steps = [];

        steps.push(`Pick 1: Prioritize ${toPrimaryNeedLabel(biggestGap)}.`);
        if (packagePlan) {
            steps.push(`Pick 2: ${packagePlan.text}.`);
            deckNextTwoTag.textContent = `${toTitleLabel(packagePlan.packageName)} lane`;
        } else {
            steps.push(`Pick 2: Reinforce ${toPrimaryNeedLabel(secondGap)} or skip for quality.`);
            deckNextTwoTag.textContent = 'Adaptive';
        }

        setListItems(deckNextTwoList, steps.slice(0, 2));
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
        renderDeckPriorities(scores);
        renderFightStrategy(scores);
        const deficits = getNeedDeficits(scores);
        const profile = getDeckSynergyProfile();
        renderNextTwoPickPlan(scores, deficits, profile);
        renderSynergyReadiness();
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

    function evaluateCardStrengthOverall(cardKey, deficits, profile, contextState) {
        const context = contextState || getRunContext();
        const fallbackWeights = {
            short: 0.35,
            elite: 0.3,
            boss: 0.35
        };
        const weights = window.SpireRecommender?.computeContextWeights
            ? window.SpireRecommender.computeContextWeights(deficits, context)
            : fallbackWeights;

        const short = evaluateCardStrength(cardKey, deficits, profile, 'short');
        const elite = evaluateCardStrength(cardKey, deficits, profile, 'elite');
        const boss = evaluateCardStrength(cardKey, deficits, profile, 'boss');

        const pickup = clampScore(short.pickup * weights.short + elite.pickup * weights.elite + boss.pickup * weights.boss);
        const basePower = clampScore(short.basePower * weights.short + elite.basePower * weights.elite + boss.basePower * weights.boss);
        const need = clampScore(short.need * weights.short + elite.need * weights.elite + boss.need * weights.boss);
        const fit = clampScore(short.fit * weights.short + elite.fit * weights.elite + boss.fit * weights.boss);
        const band = toPickupBand(pickup);

        return {
            traits: short.traits,
            basePower,
            fit,
            need,
            pickup,
            shortPickup: short.pickup,
            elitePickup: elite.pickup,
            bossPickup: boss.pickup,
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
        const simulatedState = createCardState(cardKey, false);
        if (!simulatedState) {
            return action();
        }

        deckState.push(simulatedState);
        try {
            return action();
        } finally {
            deckState.pop();
        }
    }

    function withSimulatedCards(cardKeys, action) {
        const pushed = [];

        (cardKeys || []).forEach(cardKey => {
            const simulatedState = createCardState(cardKey, false);
            if (simulatedState) {
                deckState.push(simulatedState);
                pushed.push(simulatedState);
            }
        });

        try {
            return action();
        } finally {
            while (pushed.length > 0) {
                pushed.pop();
                deckState.pop();
            }
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

        const comparePool = uniqueValues(comparisonState.map(getStateCardKey).concat(normalizeCardKey(cardKey)));
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
        const deltaReasons = [];
        if (data.deltaPositive) {
            deltaReasons.push(`<li class="delta-positive">+ ${data.deltaPositive}</li>`);
        }
        if (data.deltaNegative) {
            deltaReasons.push(`<li class="delta-negative">- ${data.deltaNegative}</li>`);
        }
        const deltaHtml = deltaReasons.length > 0
            ? `<ul class="card-strength-delta">${deltaReasons.join('')}</ul>`
            : '';

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
                ${deltaHtml}
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
                reasons: evaluation.reasons,
                deltaPositive: (evaluation.synergy.positiveReasons || [])[0] || '',
                deltaNegative: (evaluation.synergy.negativeReasons || [])[0] || ''
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
            activeOfferSnapshot = null;
            return;
        }

        const deckScores = analyzeDeckHealth();
        const deficits = getNeedDeficits(deckScores);
        const profile = getDeckSynergyProfile();
        const context = getRunContext();

        const comparisonOptions = comparisonState.map((stateEntry, index) => {
            const key = getStateCardKey(stateEntry);
            const card = cardCatalog.get(key);
            return {
                stateId: stateEntry?.id || `comparison-${index}`,
                key,
                label: card ? card.label : key
            };
        });

        const allPool = uniqueValues(allCardsGridItems().map(item => getStateCardKey(item.getAttribute('data-card-key'))).filter(Boolean));
        const preRankedFollowups = allPool
            .map(key => ({
                key,
                pickup: evaluateCardStrengthOverall(key, deficits, profile, context).pickup
            }))
            .sort((left, right) => right.pickup - left.pickup)
            .slice(0, 24)
            .map(entry => entry.key);

        const estimateSkip = function () {
            if (window.SpireRecommender?.estimateSkipBaseline) {
                return window.SpireRecommender.estimateSkipBaseline(deckScores, deficits, context);
            }

            return clampScore(46 + (deckScores.overall - 50) * 0.2);
        };

        let scored = [];
        let skipScore = estimateSkip();
        let shouldSkipTop = false;

        if (window.SpireRecommender?.rankOptions) {
            const ranked = window.SpireRecommender.rankOptions(comparisonOptions, {
                evaluateImmediate: function (cardKey) {
                    const ev = evaluateCardStrengthOverall(cardKey, deficits, profile, context);
                    return {
                        pickup: ev.pickup,
                        shortPickup: ev.shortPickup,
                        elitePickup: ev.elitePickup,
                        bossPickup: ev.bossPickup,
                        reason: ev.reasons[0] || 'Neutral impact',
                        reasons: ev.reasons
                    };
                },
                evaluateWithSequence: function (sequence) {
                    return withSimulatedCards(sequence, function () {
                        const simulatedScores = analyzeDeckHealth();
                        const simulatedDeficits = getNeedDeficits(simulatedScores);
                        const simulatedProfile = getDeckSynergyProfile();
                        const tail = sequence[sequence.length - 1];
                        const ev = evaluateCardStrengthOverall(tail, simulatedDeficits, simulatedProfile, context);
                        return {
                            pickup: ev.pickup
                        };
                    });
                },
                estimateSkip,
                followupPool: preRankedFollowups,
                lookaheadDepth: 2
            });

            scored = ranked.ranked;
            skipScore = ranked.decision.skipScore;
            shouldSkipTop = ranked.decision.shouldSkip;
        } else {
            scored = comparisonOptions.map(option => {
                const ev = evaluateCardStrengthOverall(option.key, deficits, profile, context);
                return {
                    ...option,
                    score: ev.pickup,
                    immediatePickup: ev.pickup,
                    lookaheadPickup: ev.pickup,
                    risk: 45,
                    confidence: 55,
                    marginVsSkip: ev.pickup - skipScore,
                    reason: ev.reasons[0] || 'Neutral impact',
                    reasons: ev.reasons
                };
            }).sort((a, b) => b.score - a.score);
        }

        scored.forEach(({ key, stateId }) => {
            const item = comparisonGrid.querySelector(`.card-grid-item[data-state-id="${stateId}"]`) || comparisonGrid.querySelector(`.card-grid-item[data-card-key="${key}"]`);
            if (item) {
                comparisonGrid.appendChild(item);
            }
        });

        recordOfferSnapshot(scored, skipScore);

        const verdictLabel = index => {
            if (index === 0 && shouldSkipTop) return 'SKIP';
            if (index === 0) return 'TAKE';
            if (index === 1) return 'CONSIDER';
            return 'SKIP';
        };

        const verdictClass = index => {
            if (index === 0 && shouldSkipTop) return 'pick-skip';
            if (index === 0) return 'pick-take';
            if (index === 1) return 'pick-consider';
            return 'pick-skip';
        };

        pickAdvisorList.innerHTML = scored.map((card, i) => `
            <li class="pick-advisor-row ${verdictClass(i)}">
                <span class="pick-verdict-label">${verdictLabel(i)}</span>
                <span class="pick-card-name">${card.label}</span>
                <span class="pick-score">${card.score}</span>
                <span class="pick-reason">I ${card.immediatePickup} | L ${card.lookaheadPickup} | R ${card.risk} | C ${card.confidence} | ${card.reason}</span>
            </li>`).join('');

        const skipHint = document.createElement('li');
        skipHint.className = `pick-advisor-row ${shouldSkipTop ? 'pick-skip' : 'pick-consider'}`;
        skipHint.innerHTML = `
            <span class="pick-verdict-label">BASE</span>
            <span class="pick-card-name">Skip baseline</span>
            <span class="pick-score">${skipScore}</span>
            <span class="pick-reason">Top pick should beat this unless deck quality already supports skipping.</span>`;
        pickAdvisorList.appendChild(skipHint);

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

    async function addToDeck(key, isUpgraded, source) {
        const normalized = normalizeCardKey(key);
        if (!cardCatalog.has(normalized)) {
            return;
        }

        const state = createCardState(normalized, !!isUpgraded);
        if (!state) {
            return;
        }

        const safeSource = typeof source === 'string' && source ? source : 'manualDeckEdit';
        if (safeSource === 'comparisonReward' && journeyStep !== 'decision') {
            setJourneyStatusText('Move to Step 3 before finalizing a reward pick.');
            return;
        }

        if (safeSource === 'comparisonReward' && comparisonState.length !== 3) {
            setJourneyStatusText('Step 3 requires exactly 3 reward cards in comparison.');
            return;
        }

        const offerWasActive = !!activeOfferSnapshot;
        deckState.push(state);
        const pickedLogged = recordPickedCard(normalized, safeSource);
        recordDeckMutation('add', normalized, {
            eventSource: safeSource,
            isUpgraded: !!state.isUpgraded,
            pickedFromOffer: safeSource === 'comparisonReward' && offerWasActive
        });
        await renderCollection(currentDeckGrid, deckState);
        updateCounts();
        if (comparisonState.length > 0) {
            await renderCollection(comparisonGrid, comparisonState);
        }
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());

        if (safeSource === 'comparisonReward') {
            await clearComparison();
            advanceRunFloor();
            setJourneyStep('context', pickedLogged
                ? 'Reward pick logged. Floor advanced by 1; adjust floor manually if needed.'
                : 'Card added but pick was not logged as a valid reward choice.');
            saveRunContext();
            refreshRunContextControlValues();
        }
    }

    async function removeFromDeck(stateIndex, cardKey, isUpgraded) {
        const normalized = normalizeCardKey(cardKey);
        let removed = null;
        if (Number.isInteger(stateIndex) && stateIndex >= 0 && stateIndex < deckState.length) {
            removed = deckState[stateIndex];
            deckState.splice(stateIndex, 1);
        } else {
            const fallbackIndex = deckState.findLastIndex(entry => getStateCardKey(entry) === normalized && getStateUpgraded(entry) === !!isUpgraded);
            if (fallbackIndex >= 0) {
                removed = deckState[fallbackIndex];
                deckState.splice(fallbackIndex, 1);
            }
        }

        if (removed) {
            recordDeckMutation('remove', normalized, {
                eventSource: 'manualDeckEdit',
                isUpgraded: !!removed.isUpgraded
            });
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

    async function toggleDeckUpgrade(stateIndex, cardKey, isUpgraded) {
        const normalized = normalizeCardKey(cardKey);
        let toggled = null;
        if (Number.isInteger(stateIndex) && stateIndex >= 0 && stateIndex < deckState.length) {
            deckState[stateIndex].isUpgraded = !deckState[stateIndex].isUpgraded;
            toggled = deckState[stateIndex];
        } else {
            const fallbackIndex = deckState.findLastIndex(entry => getStateCardKey(entry) === normalized && getStateUpgraded(entry) === !!isUpgraded);
            if (fallbackIndex >= 0) {
                deckState[fallbackIndex].isUpgraded = !deckState[fallbackIndex].isUpgraded;
                toggled = deckState[fallbackIndex];
            }
        }

        if (toggled) {
            recordDeckMutation('toggleUpgrade', normalized, {
                eventSource: 'manualDeckEdit',
                isUpgraded: !!toggled.isUpgraded
            });
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

    async function addToComparison(key, isUpgraded) {
        if (journeyStep !== 'reward') {
            setJourneyStatusText('Enter Step 2 Reward Setup before adding comparison cards.');
            return;
        }

        if (comparisonState.length >= 3) {
            setJourneyStatusText('Reward setup already has 3 cards. Continue to decision or reset.');
            return;
        }

        const normalized = normalizeCardKey(key);
        if (!cardCatalog.has(normalized)) {
            return;
        }

        const state = createCardState(normalized, !!isUpgraded);
        if (!state) {
            return;
        }

        comparisonState.push(state);
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());

        if (comparisonState.length === 3) {
            setJourneyStatusText('Reward setup complete. Continue to decision.');
        } else {
            setJourneyStatusText(`Reward setup: ${comparisonState.length}/3 cards selected.`);
        }
    }

    async function clearComparison() {
        comparisonState.length = 0;
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
        renderCardStrengthSignals();
        refreshOverlayIfOpen();
        requestAnimationFrame(() => renderCardStrengthSignals());
    }

    async function pickComparisonByIndex(index) {
        if (journeyStep !== 'decision') {
            return;
        }

        if (!Number.isInteger(index) || index < 0 || index >= comparisonState.length) {
            return;
        }

        const stateEntry = comparisonState[index];
        if (!stateEntry) {
            return;
        }

        await addToDeck(getStateCardKey(stateEntry), getStateUpgraded(stateEntry), 'comparisonReward');
    }

    async function toggleComparisonUpgrade(stateIndex, cardKey, isUpgraded) {
        if (Number.isInteger(stateIndex) && stateIndex >= 0 && stateIndex < comparisonState.length) {
            comparisonState[stateIndex].isUpgraded = !comparisonState[stateIndex].isUpgraded;
        } else {
            const normalized = normalizeCardKey(cardKey);
            const fallbackIndex = comparisonState.findLastIndex(entry => getStateCardKey(entry) === normalized && getStateUpgraded(entry) === !!isUpgraded);
            if (fallbackIndex >= 0) {
                comparisonState[fallbackIndex].isUpgraded = !comparisonState[fallbackIndex].isUpgraded;
            }
        }

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
        activeOverlayIsUpgraded = false;
        activeOverlaySource = '';
    }

    Array.from(allCardsGrid.querySelectorAll('.card-grid-item')).forEach(item => {
        prepareItem(item);

        const key = item.getAttribute('data-card-key');
        const small = item.querySelector('small');
        const img = item.querySelector('.card-image-wrap > img.card-art');
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
                await addToComparison(cardKey, showPlus);
            }
            if (action === 'add-deck') {
                await addToDeck(cardKey, showPlus, 'manualDeckEdit');
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
        const itemIsUpgraded = item.getAttribute('data-card-upgraded') === 'true';
        if (actionButton && cardKey) {
            event.stopPropagation();
            const action = actionButton.getAttribute('data-action');
            const stateIndex = Number.parseInt(item.getAttribute('data-state-index') || '', 10);
            if (action === 'add-deck') {
                await addToDeck(cardKey, itemIsUpgraded, 'comparisonReward');
            }
            if (action === 'toggle-upgrade') {
                await toggleComparisonUpgrade(stateIndex, cardKey, itemIsUpgraded);
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
        const itemIsUpgraded = item.getAttribute('data-card-upgraded') === 'true';
        if (actionButton && cardKey) {
            event.stopPropagation();
            const action = actionButton.getAttribute('data-action');
            const stateIndex = Number.parseInt(item.getAttribute('data-state-index') || '', 10);
            if (action === 'remove-deck') {
                await removeFromDeck(stateIndex, cardKey, itemIsUpgraded);
            }
            if (action === 'toggle-upgrade') {
                await toggleDeckUpgrade(stateIndex, cardKey, itemIsUpgraded);
            }
            return;
        }

        openOverlayForItem(item, 'deck');
    });

    overlayAddCompare.addEventListener('click', async function () {
        if (!activeOverlayCardKey) {
            return;
        }
        await addToComparison(activeOverlayCardKey, activeOverlayIsUpgraded);
    });

    overlayAddDeck.addEventListener('click', async function () {
        if (!activeOverlayCardKey) {
            return;
        }
        const source = activeOverlaySource === 'comparison' ? 'comparisonReward' : 'manualDeckEdit';
        await addToDeck(activeOverlayCardKey, activeOverlayIsUpgraded, source);
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

    const toggleKey = 'u';
    const upgradeModeStorageKey = 'spire-helper-upgrade-mode';
    const managedWheelRegionIds = new Set(['comparisonPanel', 'deck']);

    function isHotkeyEditableTarget(target) {
        if (!(target instanceof Element)) {
            return false;
        }

        return !!target.closest('input, textarea, select, [contenteditable], [contenteditable="true"]');
    }

    function getScrollRegionFromTarget(target) {
        if (!(target instanceof Element)) {
            return null;
        }

        return target.closest('[data-scroll-region]');
    }

    function canRegionScroll(region) {
        if (!region) {
            return false;
        }

        return region.scrollHeight > region.clientHeight + 1;
    }

    function wheelShouldBeHandled(region, deltaY) {
        if (!canRegionScroll(region)) {
            return false;
        }

        if (deltaY < 0) {
            return region.scrollTop > 0;
        }

        if (deltaY > 0) {
            return region.scrollTop + region.clientHeight < region.scrollHeight - 1;
        }

        return true;
    }

    function normalizeWheelDelta(event) {
        let deltaY = event.deltaY;

        // Delta can be expressed in lines or pages depending on browser/device.
        if (event.deltaMode === 1) {
            deltaY *= 16;
        } else if (event.deltaMode === 2) {
            deltaY *= window.innerHeight;
        }

        return deltaY;
    }

    function bindIndependentPaneScroll() {
        document.addEventListener('wheel', function (event) {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) {
                return;
            }

            if (isHotkeyEditableTarget(event.target)) {
                return;
            }

            if (overlay.style.opacity === '1' && overlay.contains(event.target)) {
                return;
            }

            const region = getScrollRegionFromTarget(event.target);
            if (!region) {
                return;
            }

            // Keep all-cards on native wheel behavior; only manage right-side panes.
            if (!managedWheelRegionIds.has(region.id)) {
                return;
            }

            const deltaY = normalizeWheelDelta(event);
            if (!wheelShouldBeHandled(region, deltaY)) {
                return;
            }

            const previousTop = region.scrollTop;
            region.scrollTop = previousTop + deltaY;

            if (region.scrollTop !== previousTop) {
                // Keep wheel input scoped to the hovered pane instead of chaining to page scroll.
                event.preventDefault();
            }
        }, { passive: false });
    }

    function setUpgradeToggleState() {
        if (viewBaseBtn) {
            viewBaseBtn.classList.toggle('is-active', !showPlus);
            viewBaseBtn.setAttribute('aria-pressed', String(!showPlus));
        }

        if (viewUpgradedBtn) {
            viewUpgradedBtn.classList.toggle('is-active', showPlus);
            viewUpgradedBtn.setAttribute('aria-pressed', String(showPlus));
        }
    }

    function readSavedUpgradeMode() {
        try {
            return localStorage.getItem(upgradeModeStorageKey) === 'upgraded';
        } catch {
            return false;
        }
    }

    function saveUpgradeMode() {
        try {
            localStorage.setItem(upgradeModeStorageKey, showPlus ? 'upgraded' : 'base');
        } catch {
            // Ignore storage errors to keep the UI responsive in restricted contexts.
        }
    }

    async function setUpgradeMode(nextShowPlus, shouldPersist) {
        if (toggleInProgress || showPlus === nextShowPlus) {
            setUpgradeToggleState();
            return;
        }

        toggleInProgress = true;
        showPlus = nextShowPlus;
        setUpgradeToggleState();

        if (shouldPersist) {
            saveUpgradeMode();
        }

        const updates = allCardsGridItems().map(item => applyCardMode(item, showPlus));
        await Promise.all(updates);

        if (overlay.style.opacity === '1') {
            syncOverlayFromCardKey(activeOverlayCardKey, activeOverlaySource, activeOverlayItem);
        }

        toggleInProgress = false;
    }

    showPlus = readSavedUpgradeMode();
    setUpgradeToggleState();

    if (viewBaseBtn) {
        viewBaseBtn.addEventListener('click', async function () {
            await setUpgradeMode(false, true);
        });
    }

    if (viewUpgradedBtn) {
        viewUpgradedBtn.addEventListener('click', async function () {
            await setUpgradeMode(true, true);
        });
    }

    loadRunContext();
    initRunContextControls();
    initJourneyFlowControls();

    document.body.classList.remove('ui-preset-review');
    document.body.classList.add('ui-preset-focus');
    setActiveRightPanel('comparison');
    bindIndependentPaneScroll();

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

        if (event.altKey || event.ctrlKey || event.metaKey || isHotkeyEditableTarget(event.target)) {
            return;
        }

        if (pressedKey === toggleKey) {
            event.preventDefault();
            await setUpgradeMode(!showPlus, true);
            return;
        }

        if (journeyStep === 'decision' && ['1', '2', '3'].includes(pressedKey)) {
            event.preventDefault();
            await pickComparisonByIndex(Number.parseInt(pressedKey, 10) - 1);
            return;
        }

        if (journeyStep === 'decision' && pressedKey === 's') {
            event.preventDefault();
            await handleSkipRewardAction('hotkeySkip');
            return;
        }

        if (journeyStep === 'context' && pressedKey === 'n') {
            // Floor progression is automatic after reward decisions.
        }
    });
})();
