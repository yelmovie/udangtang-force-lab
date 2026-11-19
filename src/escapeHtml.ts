/** Text placed inside HTML markup or a quoted attribute. (`reward-cards.js`·`concept-focus.js` keep their own copy: they are shared with the other science projects and import nothing.) */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
