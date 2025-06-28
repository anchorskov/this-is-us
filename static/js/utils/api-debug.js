export function logApi(endpoint, { ok, status, body }) {
  const colour =
    ok               ? 'green'
    : status >= 500  ? 'red'
    : status >= 400  ? 'orange'
    :                  'grey';

  console.log(
    `%c${status} %c${endpoint}`,
    `color:${colour};font-weight:bold`,
    'color:inherit',
    body
  );
}
