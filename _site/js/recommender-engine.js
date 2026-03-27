(function (global) {
    function clampScore(value) {
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    function clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    function toNumber(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function computeContextWeights(deficits, runContext) {
        const context = runContext || {};
        const act = Math.max(1, Math.min(3, Math.round(toNumber(context.act, 1))));

        let shortWeight = 0.34;
        let eliteWeight = 0.31;
        let bossWeight = 0.35;

        shortWeight += Math.min((deficits.frontload || 0) / 100, 0.12);
        bossWeight += Math.min((deficits.scaling || 0) / 100, 0.12);

        if (act <= 1) {
            shortWeight += 0.06;
            bossWeight -= 0.05;
        } else if (act >= 3) {
            bossWeight += 0.07;
            shortWeight -= 0.04;
        }

        shortWeight = Math.max(0.15, shortWeight);
        eliteWeight = Math.max(0.15, eliteWeight);
        bossWeight = Math.max(0.15, bossWeight);

        const sum = shortWeight + eliteWeight + bossWeight;
        return {
            short: shortWeight / sum,
            elite: eliteWeight / sum,
            boss: bossWeight / sum,
            act
        };
    }

    function estimateSkipBaseline(deckScores, deficits, runContext) {
        const context = runContext || {};
        const act = Math.max(1, Math.min(3, Math.round(toNumber(context.act, 1))));

        let baseline = 48;
        baseline += (deckScores.overall - 50) * 0.22;

        const largestDeficit = Math.max(
            deficits.frontload || 0,
            deficits.block || 0,
            deficits.scaling || 0,
            deficits.consistency || 0,
            deficits.utility || 0
        );
        baseline -= Math.min(12, largestDeficit * 0.3);

        if (act >= 3) {
            baseline += 2;
        }

        return clampScore(baseline);
    }

    function blendContextScores(shortScore, eliteScore, bossScore, weights) {
        const pickup = shortScore * weights.short + eliteScore * weights.elite + bossScore * weights.boss;
        return clampScore(pickup);
    }

    function rankOptions(options, deps) {
        const evaluateImmediate = deps.evaluateImmediate;
        const evaluateWithSequence = deps.evaluateWithSequence;
        const estimateSkip = deps.estimateSkip;
        const followupPool = Array.isArray(deps.followupPool) ? deps.followupPool : [];
        const lookaheadDepth = Math.max(0, Math.min(2, Math.round(toNumber(deps.lookaheadDepth, 2))));

        const skipScore = clampScore(toNumber(estimateSkip(), 50));
        const ranked = options.map(option => {
            const immediate = evaluateImmediate(option.key);
            let lookahead = immediate.pickup;
            let nextBest = null;

            if (lookaheadDepth > 0 && followupPool.length > 0) {
                let bestScore = -1;
                let bestCard = null;

                followupPool.forEach(followKey => {
                    if (followKey === option.key) {
                        return;
                    }

                    const seqEval = evaluateWithSequence([option.key, followKey]);
                    if (seqEval.pickup > bestScore) {
                        bestScore = seqEval.pickup;
                        bestCard = followKey;
                    }
                });

                if (bestScore >= 0) {
                    lookahead = bestScore;
                    nextBest = bestCard;
                }
            }

            const marginVsSkip = immediate.pickup - skipScore;
            const score = clampScore(immediate.pickup * 0.68 + lookahead * 0.22 + clampScore(marginVsSkip + 50) * 0.10);
            const spread = Math.max(immediate.shortPickup, immediate.elitePickup, immediate.bossPickup)
                - Math.min(immediate.shortPickup, immediate.elitePickup, immediate.bossPickup);
            const risk = clampScore(25 + spread * 1.4 + (marginVsSkip < 0 ? Math.abs(marginVsSkip) * 0.9 : 0));
            const confidence = clampScore(72 - spread * 0.8 + Math.max(0, marginVsSkip) * 0.35);

            return {
                key: option.key,
                label: option.label,
                stateId: option.stateId,
                immediatePickup: immediate.pickup,
                lookaheadPickup: clampScore(lookahead),
                score,
                risk,
                confidence,
                marginVsSkip: Math.round(marginVsSkip),
                nextBest,
                reason: immediate.reason,
                reasons: immediate.reasons
            };
        });

        ranked.sort((left, right) => right.score - left.score);

        const top = ranked[0] || null;
        const decision = {
            skipScore,
            shouldSkip: !!top && top.score < skipScore + 3,
            topGap: ranked.length > 1 ? top.score - ranked[1].score : top ? top.score : 0
        };

        return {
            ranked,
            decision
        };
    }

    function createRunLogger(storageKey) {
        const key = storageKey || 'spire-helper-run-logs-v1';

        function readLogs() {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) {
                    return [];
                }

                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        function writeLogs(logs) {
            try {
                localStorage.setItem(key, JSON.stringify(logs));
            } catch {
                // Ignore write failures to preserve gameplay UX in restricted browsers.
            }
        }

        return {
            read: readLogs,
            append(entry) {
                const logs = readLogs();
                logs.push(entry);
                writeLogs(logs);
            },
            clear() {
                writeLogs([]);
            },
            export() {
                return JSON.stringify(readLogs(), null, 2);
            }
        };
    }

    global.SpireRecommender = {
        clampScore,
        clamp01,
        computeContextWeights,
        estimateSkipBaseline,
        blendContextScores,
        rankOptions,
        createRunLogger
    };
})(window);
