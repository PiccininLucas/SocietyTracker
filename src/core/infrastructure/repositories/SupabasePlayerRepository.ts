import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '../database/supabaseClient';
import type { IPlayerRepository } from '../../domain/repositories/IPlayerRepository';
import { Player } from '../../domain/entities/Player';

interface PlayerRow {
  id: string;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
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
      throw new Error(`Erro ao buscar jogadores: ${error.message}`);
    }

    return (data as PlayerRow[] || []).map((row) => this.toDomain(row));
  }

  public async findById(id: string): Promise<Player | null> {
    const { data, error } = await this.client
      .from('players')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar jogador por ID (${id}): ${error.message}`);
    }

    if (!data) return null;

    return this.toDomain(data as PlayerRow);
  }

  public async create(player: Player): Promise<Player> {
    const { data, error } = await this.client
      .from('players')
      .insert({
        name: player.name,
        nickname: player.nickname || null,
        avatar_url: player.avatarUrl || null,
        is_active: player.isActive,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao criar jogador: ${error.message}`);
    }

    return this.toDomain(data as PlayerRow);
  }

  public async update(player: Player): Promise<Player> {
    if (!player.id) {
      throw new Error('ID do jogador é obrigatório para atualização.');
    }

    const { data, error } = await this.client
      .from('players')
      .update({
        name: player.name,
        nickname: player.nickname || null,
        avatar_url: player.avatarUrl || null,
        is_active: player.isActive,
      })
      .eq('id', player.id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar jogador (${player.id}): ${error.message}`);
    }

    return this.toDomain(data as PlayerRow);
  }
}
