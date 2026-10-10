const DEFAULT_PRICES = {
    'local-1on1': 1500, 'local-minigroup': 850, 'local-smallgroup': 500, 'local-largegroup': 400,
    'prep-g15-1on1': 18000, 'prep-g15-2to3': 12000, 'prep-g15-4to5': 8000, 'prep-g15-6to10': 5000,
    'prep-g6-1on1': 20000, 'prep-g6-2to3': 10000, 'prep-g6-4to5': 5000, 'prep-g6-6to10': 4000,
    'prep-g8-1on1': 21000, 'prep-g8-2to3': 12000, 'prep-g8-4to5': 7000, 'prep-g8-6to10': 6000,
    'prep-g12-1on1': 24000, 'prep-g12-2to3': 14000, 'prep-g12-4to5': 9000, 'prep-g12-6to10': 8000,
    'intl-1on1': 2500, 'intl-minigroup': 1500, 'intl-smallgroup': 1000, 'intl-largegroup': 700,
    'intl-prep-1on1': 30000, 'intl-prep-2to3': 20000, 'intl-prep-4to5': 10500, 'intl-prep-6to10': 5000,
};

const PRICING_PLANS = {};
const PLAN_SIZES = [
    ['1on1', '1-to-1', 1, 1, '1on1'],
    ['minigroup', 'Mini group', 2, 3, '2to3'],
    ['smallgroup', 'Small group', 4, 5, '4to5'],
    ['largegroup', 'Large group', 6, 10, '6to10'],
];
const INTERNATIONAL_SUBJECTS = new Set([
    'ielts', 'toefl ibt', 'duolingo english test', 'pte academic', 'cambridge english', 'oet',
    'sat', 'act', 'gre', 'gmat', 'ap exams', 'international baccalaureate (ib)',
]);

function legacyPackageId(minSize, maxSize) {
    if (minSize === 1) return 'premium-one-to-one';
    if (minSize === 2 && maxSize === 3) return 'mini-group';
    if (minSize === 4) return 'small-group';
    return 'group-basic';
}

function packageIdForSize(size) {
    if (size === 1) return 'premium-one-to-one';
    if (size === 2) return 'duo';
    if (size === 3) return 'mini-group';
    if (size <= 5) return 'small-group';
    return 'group-basic';
}

function addPricingPlan(id, label, size, period, planType) {
    PRICING_PLANS[id] = {
        label: label,
        classSize: size[2] === 1 ? '1 student' : size[2] + '-' + size[3] + ' students',
        min: size[2],
        max: size[3],
        period: period,
        packageId: legacyPackageId(size[2], size[3]),
        planType: planType,
    };
}

['local', 'intl'].forEach(function (track) {
    PLAN_SIZES.forEach(function (size) {
        addPricingPlan(track + '-' + size[0], (track === 'intl' ? 'International ' : 'Local ') + size[1], size, 'hour', 'hourly');
    });
});

[
    ['g15', 'Grades 1–5'],
    ['g6', 'Grade 6'],
    ['g8', 'Grade 8'],
    ['g12', 'Grade 12'],
].forEach(function (grade) {
    PLAN_SIZES.forEach(function (size) {
        addPricingPlan('prep-' + grade[0] + '-' + size[4], grade[1] + ' ' + size[1] + ' exam prep', size, 'month', 'monthly');
    });
});

PLAN_SIZES.forEach(function (size) {
    addPricingPlan('intl-prep-' + size[4], 'International ' + size[1] + ' exam prep', size, 'month', 'monthly');
});

function groupTier(session, groupSize) {
    if (session !== 'group') return PLAN_SIZES[0];
    const size = Number(groupSize);
    return PLAN_SIZES.find(function (tier) { return size >= tier[2] && size <= tier[3]; }) || null;
}

function resolvePricingPlanId(details) {
    const subjects = Array.isArray(details.subject) ? details.subject : [details.subject];
    const international = subjects.some(function (subject) {
        return INTERNATIONAL_SUBJECTS.has(String(subject || '').trim().toLowerCase());
    });
    const tier = groupTier(details.session, details.groupSize);
    if (!tier) return null;

    if (details.planType === 'monthly') {
        if (international) return 'intl-prep-' + tier[4];
        const gradeMatch = String(details.grade || '').match(/grade\s+(\d+)/i);
        if (!gradeMatch) return null;
        const grade = Number(gradeMatch[1]);
        const gradeGroup = grade >= 1 && grade <= 5 ? 'g15'
            : grade === 6 ? 'g6'
                : grade === 8 ? 'g8'
                    : grade === 12 ? 'g12' : null;
        return gradeGroup ? 'prep-' + gradeGroup + '-' + tier[4] : null;
    }

    if (details.planType !== 'hourly' && details.planType !== 'weekly') return null;
    return (international ? 'intl-' : 'local-') + tier[0];
}

async function getPricingRates() {
    const result = await apiRequest('/pricing');
    if (!result || !result.prices || typeof result.prices !== 'object' || Array.isArray(result.prices)) {
        throw new Error('The pricing service returned an invalid response.');
    }
    return Object.assign({}, DEFAULT_PRICES, result.prices);
}

function getPricingQuote(details, prices) {
    const planId = resolvePricingPlanId(details);
    const plan = PRICING_PLANS[planId];
    const rate = prices && prices[planId];
    if (!plan || !Number.isSafeInteger(rate) || rate < 0) {
        throw new Error('A current price is not available for this grade, subject, and group size.');
    }

    const group = details.session === 'group';
    const size = group ? Number(details.groupSize) : 1;
    const packageId = packageIdForSize(size);
    const classSize = size === 1 ? '1 student' : size + ' students';
    const durationHours = details.duration === '1.5 Hours' ? 1.5
        : details.duration === '2 Hours' ? 2
            : details.duration === '2 + Hours' ? 2.5 : 1;
    const selectedDays = Array.isArray(details.selectedDays) ? details.selectedDays.length : 0;
    const weekly = details.planType === 'weekly';
    if (weekly && selectedDays === 0) {
        throw new Error('Select at least one study day to calculate the weekly price.');
    }
    const amount = weekly ? rate * durationHours * selectedDays
        : details.planType === 'hourly' ? rate * durationHours : rate;
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('The calculated price is outside the supported range.');
    }

    const period = details.planType === 'monthly' ? 'month'
        : weekly ? 'student/week' : (group ? 'student/session' : 'session');
    const perLabel = details.planType === 'monthly' ? 'per student / month'
        : weekly ? 'per student / week'
            : group ? 'per student / session' : 'per session';
    return {
        planId: planId,
        rate: rate,
        amount: amount,
        period: period,
        perLabel: perLabel,
        packageId: packageId,
        classSize: classSize,
        planLabel: plan.label,
        formattedAmount: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(amount),
    };
}

function formatPricingRate(planId, price) {
    if (!PRICING_PLANS[planId] || !Number.isSafeInteger(price) || price < 0) {
        throw new Error('A current price is not available for the selected plan.');
    }
    return new Intl.NumberFormat('en-US').format(price);
}
