import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin as defaultClient } from '../database/supabaseClient';
import type { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import { Player } from '../../domain/entities/Player';
import { DatabaseError } from '../database/DatabaseError';

interface PlayerRow {
  id: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  is_goalkeeper?: boolean;
  is_active: boolean;
  created_at: string;
}

export class SupabasePlayerRepository implements IPlayerRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || defaultClient;
  }

  private toDomain(row: PlayerRow): Player {
    return new Player({
      id: row.id,
      name: row.name,
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      isGoalkeeper: row.is_goalkeeper ?? false,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    });
  }

  public async findAll(activeOnly = false): Promise<Player[]> {
    let query = this.client.from('players').select('*').order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(`Erro ao buscar jogadores: ${error.message}`, error.code);
    }

    return ((data as PlayerRow[]) || []).map((row) => this.toDomain(row));
  }

  public async findById(id: string): Promise<Player | null> {
    const { data, error } = await this.client
      .from('players')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(
        `Erro ao buscar jogador por ID (${id}): ${error.message}`,
        error.code
      );
    }

    if (!data) return null;

    return this.toDomain(data as PlayerRow);
  }

  public async create(player: Player): Promise<Player> {
    const payload = {
      name: player.name,
      nickname: player.nickname || null,
      avatar_url: player.avatarUrl || null,
      is_goalkeeper: player.isGoalkeeper,
      is_active: player.isActive,
    };

    // Grava direto: coluna ausente ou cache velho do PostgREST vira erro (503, nova
    // tentativa), nunca um cadastro salvo sem o campo e respondido como sucesso.
    const { data, error } = await this.client.from('players').insert(payload).select('*').single();

    if (error) {
      throw new DatabaseError(`Erro ao criar jogador: ${error.message}`, error.code);
    }

    return this.toDomain(data as PlayerRow);
  }

  public async update(player: Player): Promise<Player> {
    if (!player.id) {
      throw new Error('ID do jogador é obrigatório para atualização.');
    }

    const payload = {
      name: player.name,
      nickname: player.nickname || null,
      avatar_url: player.avatarUrl || null,
      is_goalkeeper: player.isGoalkeeper,
      is_active: player.isActive,
    };

    const { data, error } = await this.client
      .from('players')
      .update(payload)
      .eq('id', player.id)
      .select('*')
      .single();

    if (error) {
      throw new DatabaseError(
        `Erro ao atualizar jogador (${player.id}): ${error.message}`,
        error.code
      );
    }

    return this.toDomain(data as PlayerRow);
  }
}
