import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchesPlayerSearch, searchKey } from '../src/lib/search.ts';

describe('busca de jogador', () => {
  it('ignora acentos, cedilha, caixa e espaços nas pontas', () => {
    assert.equal(searchKey('  João Conceição '), 'joao conceicao');
    assert.equal(searchKey('ÑANDÚ Müller Zé'), 'nandu muller ze');
    assert.equal(searchKey(null), '');
  });

  it('acha pelo nome ou pelo apelido, digitando com ou sem acento', () => {
    const joao = { name: 'João Antônio', nickname: 'Tonhão' };
    assert.ok(matchesPlayerSearch(joao, 'joao'));
    assert.ok(matchesPlayerSearch(joao, 'ANTONIO'));
    assert.ok(matchesPlayerSearch(joao, 'tonhao'));
    assert.ok(matchesPlayerSearch({ name: 'Joao' }, 'João'));
    assert.ok(!matchesPlayerSearch(joao, 'pedro'));
  });

  it('termo vazio ou só com espaços lista todos; apelido ausente não quebra', () => {
    assert.ok(matchesPlayerSearch({ name: 'Caio', nickname: null }, ''));
    assert.ok(matchesPlayerSearch({ name: 'Caio' }, '   '));
    assert.ok(!matchesPlayerSearch({ name: 'Caio', nickname: null }, 'x'));
  });
});
