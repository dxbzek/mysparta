/**
 * Where Tonight's Card comes from (contract `OpponentSource`). The first build ships the local
 * source: rivals made by the same code as a player's scrapper. A server source drops in later
 * with no change to the sim or the fight screen.
 */
import { REALM_SALT, api } from "@rankzero/core";
import type { CoreApi, DayKey, FighterSnapshot, ScrapperRecord } from "@rankzero/core";
import type { OpponentSource } from "../contracts";

export class LocalRivalSource implements OpponentSource {
  constructor(private readonly core: CoreApi = api, private readonly realmSalt: string = REALM_SALT) {}
  async hand(rec: ScrapperRecord, today: DayKey): Promise<FighterSnapshot[]> {
    return this.core.tonightsCard(rec, this.realmSalt, today);
  }
}
