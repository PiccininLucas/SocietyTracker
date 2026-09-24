import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDraft,
  serializeDraft,
  DRAFT_MAX_AGE_MS,
} from '../src/components/live/teamDraft.ts';

const templates = [
  { id: 'team-1', name: 'Time Preto', colorHex: '#1f2937', colorName: 'Preto' },
  { id: 'team-2', name: 'Time Branco', colorHex: '#e5e7eb', colorName: 'Branco' },
  { id: 'team-3', name: 'Time Azul', colorHex: '#3b82f6', colorName: 'Azul' },
  { id: 'team-4', name: 'Time Vermelho', colorHex: '#ef4444', colorName: 'Vermelho' },
];
const players = [
  { id: 'a', name: 'Ana', nickname: 'Aninha' },
  { id: 'b', name: 'Bruno', isGoalkeeper: true },
  { id: 'c', name: 'Caio' },
];
const now = Date.parse('2026-09-24T22:00:00Z');

function stored(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    savedAt: now - 60_000,
    sessionDate: '2026-09-24',
    notes: 'Quadra 2',
    presentPlayerIds: ['a', 'b', 'c'],
    teamCount: 3,
    matchDurationMinutes: 8,
    teams: [
      {
        id: 'team-1',
        name: 'Time Aninha',
        captainId: 'a',
        players: [
          { id: 'a', isGoalkeeper: false },
          { id: 'b', isGoalkeeper: true },
        ],
      },
      {
        id: 'team-2',
        name: 'Time Branco',
        captainId: null,
        players: [{ id: 'c', isGoalkeeper: false }],
      },
      { id: 'team-3', name: 'Time Azul', captainId: null, players: [] },
    ],
    ...overrides,
  };
}

describe('sanitizeDraft', () => {
  it('restores a recent draft with the current player data', () => {
    const renamed = players.map((p) => (p.id === 'a' ? { ...p, nickname: 'Ana Paula' } : p));
    const draft = sanitizeDraft(stored(), renamed, templates, now);
    assert.ok(draft);
    assert.equal(draft.teamCount, 3);
    assert.equal(draft.notes, 'Quadra 2');
    assert.deepEqual(
      draft.teams.map((t) => t.players.map((p) => p.id)),
      [['a', 'b'], ['c'], []]
    );
    assert.equal(draft.teams[0].players[0].nickname, 'Ana Paula', 'nomes vêm do cadastro atual');
    assert.equal(draft.teams[0].players[1].isGoalkeeper, true);
    assert.equal(draft.teams[0].captainId, 'a');
    assert.equal(draft.teams[0].name, 'Time Aninha');
    assert.equal(draft.teams[0].colorHex, '#1f2937', 'cor vem do molde, não do aparelho');
  });

  it('rejects drafts from another night, another version or with a broken shape', () => {
    assert.equal(
      sanitizeDraft(stored({ savedAt: now - DRAFT_MAX_AGE_MS - 1 }), players, templates, now),
      null
    );
    assert.equal(
      sanitizeDraft(stored({ savedAt: now + 5 * 60_000 }), players, templates, now),
      null
    );
    assert.equal(sanitizeDraft(stored({ version: 2 }), players, templates, now), null);
    assert.equal(sanitizeDraft(stored({ teamCount: 5 }), players, templates, now), null);
    assert.equal(
      sanitizeDraft(stored({ sessionDate: '24/09/2026' }), players, templates, now),
      null
    );
    assert.equal(
      sanitizeDraft(stored({ matchDurationMinutes: 'x' }), players, templates, now),
      null
    );
    assert.equal(sanitizeDraft(stored({ teams: 'x' }), players, templates, now), null);
    assert.equal(sanitizeDraft(null, players, templates, now), null);
  });

  it('drops players who are no longer registered and never places anyone twice', () => {
    const raw = stored({
      presentPlayerIds: ['a', 'b', 'c', 'sumiu'],
      teams: [
        {
          id: 'team-1',
          name: 'Time Sumiu',
          captainId: 'sumiu',
          players: [{ id: 'sumiu' }, { id: 'a' }],
        },
        { id: 'team-2', name: 'Time Branco', captainId: null, players: [{ id: 'a' }, { id: 'c' }] },
        { id: 'team-3', name: 'Time Azul', captainId: null, players: [] },
      ],
    });
    const draft = sanitizeDraft(raw, players, templates, now)!;
    assert.deepEqual(draft.presentPlayerIds.sort(), ['a', 'b', 'c']);
    assert.deepEqual(
      draft.teams.map((t) => t.players.map((p) => p.id)),
      [['a'], ['c'], []]
    );
    // O capitão sumiu: o time volta ao nome padrão em vez de "Time <capitão ausente>".
    assert.equal(draft.teams[0].captainId, null);
    assert.equal(draft.teams[0].name, 'Time Preto');
  });

  it('marks as present anyone already placed in a team', () => {
    const draft = sanitizeDraft(stored({ presentPlayerIds: [] }), players, templates, now)!;
    assert.deepEqual(draft.presentPlayerIds.sort(), ['a', 'b', 'c']);
  });

  it('round-trips what the builder serializes', () => {
    const draft = sanitizeDraft(stored(), players, templates, now)!;
    const again = sanitizeDraft(
      { version: 1, savedAt: now, ...serializeDraft(draft) },
      players,
      templates,
      now
    )!;
    assert.deepEqual(serializeDraft(again), serializeDraft(draft));
  });
});
