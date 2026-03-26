(function () {
    const input = document.getElementById('cardSearchInput');
    const allCardsGrid = document.getElementById('allCardsGrid');
    const comparisonGrid = document.getElementById('comparisonGrid');
    const currentDeckGrid = document.getElementById('currentDeckGrid');
    const comparisonEmpty = document.getElementById('comparisonEmpty');
    const comparisonCountLabel = document.getElementById('comparisonCountLabel');
    const deckCountLabel = document.getElementById('deckCountLabel');

    const overlay = document.getElementById('cardOverlay');
    const overlayCard = document.getElementById('overlayCard');
    const overlayImg = document.getElementById('overlayImg');
    const overlayTierBadge = document.getElementById('overlayTierBadge');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayDescription = document.getElementById('overlayDescription');
    const overlayAddCompare = document.getElementById('overlayAddCompare');
    const overlayAddDeck = document.getElementById('overlayAddDeck');

    const plusAvailabilityCache = new Map();
    const badgePositionOptions = [
        { key: 'tr', label: 'Top Right' },
        { key: 'tl', label: 'Top Left' },
        { key: 'br', label: 'Bottom Right' },
        { key: 'bl', label: 'Bottom Left' },
        { key: 'tc', label: 'Top Center' },
        { key: 'rc', label: 'Right Center' }
    ];

    let cardDescriptions = {};
    let badgePositionIndex = 0;
    let badgeOffsetX = 17;
    let badgeOffsetY = 1;
    const badgeSize = 22;
    let showPlus = false;
    let toggleInProgress = false;
    let activeOverlayItem = null;
    let activeOverlayCardKey = '';

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

    function getTierFromEntry(entry) {
        const tier = typeof entry?.tier === 'string' ? entry.tier.trim().toLowerCase() : '';
        return /^[sabcdef]$/.test(tier) ? tier : '';
    }

    function updateTierBadge(item) {
        const badge = item.querySelector('.tier-badge');
        if (!badge) {
            return;
        }

        const entry = getCardEntry(item);
        const tier = getTierFromEntry(entry);
        if (!tier) {
            badge.hidden = true;
            badge.removeAttribute('src');
            return;
        }

        badge.src = `images/tiers/${tier}.png`;
        badge.hidden = false;
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

        const tier = getTierFromEntry(getCardEntry(item));
        if (tier) {
            overlayTierBadge.src = `images/tiers/${tier}.png`;
            overlayTierBadge.hidden = false;
        } else {
            overlayTierBadge.hidden = true;
            overlayTierBadge.removeAttribute('src');
        }
    }

    function applyBadgePosition(index) {
        const boundedIndex = ((index % badgePositionOptions.length) + badgePositionOptions.length) % badgePositionOptions.length;
        badgePositionIndex = boundedIndex;

        badgePositionOptions.forEach(option => {
            document.body.classList.remove(`badge-pos-${option.key}`);
        });

        const option = badgePositionOptions[badgePositionIndex];
        document.body.classList.add(`badge-pos-${option.key}`);
    }

    function applyBadgeOffset(x, y) {
        badgeOffsetX = Math.max(0, x);
        badgeOffsetY = Math.max(0, y);
        document.documentElement.style.setProperty('--badge-offset-x', `${badgeOffsetX}px`);
        document.documentElement.style.setProperty('--badge-offset-y', `${badgeOffsetY}px`);
    }

    function createCardTile(key) {
        const card = cardCatalog.get(key);
        if (!card) {
            return null;
        }

        const item = document.createElement('div');
        item.className = 'card-grid-item';
        item.setAttribute('data-card-name', card.name);
        item.setAttribute('data-card-key', key);

        item.innerHTML = `
            <div class="card h-100 border-0" style="background-color: #111821;">
                <div class="card-image-wrap">
                    <img class="tier-badge" alt="Tier badge" hidden />
                    <img class="card-art" src="${card.src}" alt="Card image" />
                </div>
                <div class="card-body text-center" style="background-color: rgba(255,255,255,0.06);">
                    <small class="text-truncate d-block text-light fw-semibold" style="max-width: 100%;">${card.label}</small>
                </div>
            </div>`;

        return item;
    }

    async function refreshGridModeAndBadges(grid) {
        const gridItems = Array.from(grid.querySelectorAll('.card-grid-item'));
        gridItems.forEach(prepareItem);
        await Promise.all(gridItems.map(item => applyCardMode(item, showPlus)));
        gridItems.forEach(updateTierBadge);
    }

    async function renderCollection(grid, keys) {
        grid.innerHTML = '';

        keys.forEach(key => {
            const item = createCardTile(key);
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
    }

    async function addToDeck(key) {
        if (!cardCatalog.has(key)) {
            return;
        }

        deckState.push(key);
        await renderCollection(currentDeckGrid, deckState);
        updateCounts();
    }

    async function addToComparison(key) {
        if (!cardCatalog.has(key)) {
            return;
        }

        comparisonState.push(key);
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
    }

    async function clearComparison() {
        comparisonState.length = 0;
        await renderCollection(comparisonGrid, comparisonState);
        updateCounts();
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

    comparisonGrid.addEventListener('click', function (event) {
        const item = event.target.closest('.card-grid-item');
        if (!item) {
            return;
        }
        openOverlayForItem(item);
    });

    currentDeckGrid.addEventListener('click', function (event) {
        const item = event.target.closest('.card-grid-item');
        if (!item) {
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

    applyBadgePosition(0);
    applyBadgeOffset(17, 1);
    document.documentElement.style.setProperty('--badge-size', `${badgeSize}%`);

    Promise.resolve()
        .then(() => loadDescriptions())
        .then(async () => {
            await refreshGridModeAndBadges(allCardsGrid);
            await renderCollection(currentDeckGrid, deckState);
            updateCounts();
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
