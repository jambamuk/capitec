export function humanize(value: string) {
  const names: Record<string, string> = {
    POS: 'In store',
    ECOMMERCE: 'Online',
    ATM: 'ATM',
    MOBILE: 'Mobile banking',
    ONLINE: 'Online banking',
  }
  return (
    names[value] ??
    value
      .toLowerCase()
      .replaceAll('_', ' ')
      .replace(/^./, (first) => first.toUpperCase())
  )
}
