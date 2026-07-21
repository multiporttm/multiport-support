export const MAX_TITLE = 200;
export const MAX_BODY = 10000;
export const MAX_NAME = 60;

export function cleanAuthorName(raw) {
  const name = String(raw || '').trim();
  return name ? name.slice(0, MAX_NAME) : 'Anonymous';
}
