import type { PisteSousTitres } from '../aggregates/piste-sous-titres'
import type { DeclinaisonId } from '../value-objects/declinaison-id'
import type { PisteSousTitresId } from '../value-objects/piste-sous-titres-id'

export interface PisteSousTitresRepository {
  save(track: PisteSousTitres): Promise<void>
  findById(id: PisteSousTitresId): Promise<PisteSousTitres | null>
  findByDeclinaison(declinaisonId: DeclinaisonId): Promise<PisteSousTitres | null>
  findMaster(): Promise<PisteSousTitres | null>
}
