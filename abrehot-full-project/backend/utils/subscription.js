const DAY_MS = 24 * 60 * 60 * 1000;

function durationHours(duration) {
  if (duration && duration.includes('1.5')) return 1.5;
  if (duration && (duration.includes('2 +') || duration.includes('2+'))) return 2.5;
  if (duration && duration.includes('2')) return 2;
  return 1;
}

function calculateSubscription({ planType, packageId, tutorRate, session, groupSize, selectedDays, duration }) {
  if (planType !== 'weekly' && planType !== 'monthly') {
    return { frequency: null, amount: null, weeklySessions: 0 };
  }

  const days = Array.isArray(selectedDays) ? selectedDays.length : 0;
  if (!days) throw new Error('Please select at least one study day for your subscription.');

  if (packageId === 'starter') {
    return {
      frequency: planType,
      amount: 0,
      weeklySessions: days,
    };
  }

  const hourlyRate = Number(tutorRate);
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    throw new Error('This tutor does not have a valid hourly rate.');
  }

  const groupDivisor = session === 'group' && Number(groupSize) > 0 ? Number(groupSize) : 1;
  const studentHourlyRate = hourlyRate / groupDivisor;
  const weeklyAmount = studentHourlyRate * durationHours(duration) * days;
  const amount = planType === 'monthly' ? weeklyAmount * 4 : weeklyAmount;

  return {
    frequency: planType,
    amount: Math.round(amount * 100) / 100,
    weeklySessions: days,
  };
}

function subscriptionEndDate(startDate, frequency) {
  const end = new Date(startDate);
  end.setTime(end.getTime() + (frequency === 'weekly' ? 7 : 30) * DAY_MS);
  return end;
}

module.exports = { calculateSubscription, subscriptionEndDate, durationHours };
