export enum FreshnessStatus {
  NEW = 'NEW',
  RECENT = 'RECENT',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
}

export function determineFreshness(postedAt: Date, deadline: Date | null): FreshnessStatus {
  const now = new Date();
  
  if (deadline && deadline < now) {
    return FreshnessStatus.EXPIRED;
  }

  const daysSincePosted = (now.getTime() - postedAt.getTime()) / (1000 * 3600 * 24);

  if (daysSincePosted <= 2) {
    return FreshnessStatus.NEW;
  } else if (daysSincePosted <= 7) {
    return FreshnessStatus.RECENT;
  }

  if (deadline) {
    const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (daysUntilDeadline <= 3) {
      return FreshnessStatus.EXPIRING;
    }
  }

  return FreshnessStatus.RECENT; // Default fallback
}

export function isVerified(verifiedFlag: boolean, trustScore: number): boolean {
  return verifiedFlag || trustScore >= 90;
}
