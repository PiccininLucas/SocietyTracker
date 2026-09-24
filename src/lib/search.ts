/**
 * Chave de comparação da busca: sem acento, sem caixa e sem espaço nas pontas.
 *
 * O NFD separa a letra do acento ("ã" vira "a" + til combinante) e `\p{M}` tira as marcas
 * combinantes, inclusive a cedilha. Assim "joao" encontra "João" e "conceicao" encontra
 * "Conceição". Antes a busca só baixava a caixa, e quem digitava sem acento no celular não
 * achava o jogador.
 */
export function searchKey(text: string | null | undefined): string {
  return (text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** O jogador casa quando o termo aparece no nome ou no apelido. Termo vazio casa com todos. */
export function matchesPlayerSearch(
  player: { name: string; nickname?: string | null },
  query: string
): boolean {
  const term = searchKey(query);
  if (!term) return true;
  return searchKey(player.name).includes(term) || searchKey(player.nickname).includes(term);
}
