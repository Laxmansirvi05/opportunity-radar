export function getDeadlineInfo(deadline: string | null): { label: string; colorClass: string; expired: boolean } | null {
  if (!deadline) return null
  
  const now = new Date()
  const deadlineDate = new Date(deadline)
  // Normalize both dates to start of day for deterministic days calculation
  now.setHours(0, 0, 0, 0)
  const normalizedDeadline = new Date(deadlineDate)
  normalizedDeadline.setHours(0, 0, 0, 0)
  
  const diffMs = normalizedDeadline.getTime() - now.getTime()
  
  if (diffMs < 0) {
    return {
      label: 'Expired',
      colorClass: 'bg-[#FCE8E6] text-[#D93025]', // Red
      expired: true
    }
  }
  
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return {
      label: 'Closing Today',
      colorClass: 'bg-[#FEF7E0] text-[#E37400]', // Orange
      expired: false
    }
  }
  
  if (diffDays <= 3) {
    return {
      label: `${diffDays} Day${diffDays > 1 ? 's' : ''} Left`,
      colorClass: 'bg-[#FEF7E0] text-[#E37400]', // Orange
      expired: false
    }
  }
  
  if (diffDays <= 7) {
    return {
      label: `${diffDays} Days Left`,
      colorClass: 'bg-[#FFF3E0] text-[#F57C00]', // Yellow-Orange
      expired: false
    }
  }
  
  return {
    label: `${diffDays} Days Left`,
    colorClass: 'bg-[#E6F4EA] text-[#137333]', // Green
    expired: false
  }
}
