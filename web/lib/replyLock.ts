// Reply lock for the talk board.
// After the user picks a reply, no other reply can be picked until the caregiver says something NEW
// (after the pick) and the replies for that message are ready. Synchronous, so two selects in the same
// frame can't both get through.
export class ReplyLock {
  private locked = false;
  private lockedAtMsg = 0; // caregiver messages seen when the lock was taken
  private msg = 0; // caregiver messages seen so far
  private off = false; // no microphone: locking would never end

  get isLocked(): boolean {
    return this.locked;
  }

  /** The user picked a reply. false = already locked, ignore the pick. */
  tryLock(): boolean {
    if (this.off) return true;
    if (this.locked) return false;
    this.locked = true;
    this.lockedAtMsg = this.msg;
    return true;
  }

  /** A caregiver message arrived. Returns its id for repliesReady(). */
  caregiverSaid(): number {
    return ++this.msg;
  }

  /**
   * Replies for caregiver message `id` are ready (or failed and the old ones stay).
   * Returns true if the board should show them; in that case it is unlocked.
   * Returns false for stale results: a newer caregiver message is on its way, or the message
   * came before the user's pick (the user already answered it).
   */
  repliesReady(id: number): boolean {
    if (id !== this.msg) return false;
    if (this.locked && id <= this.lockedAtMsg) return false;
    this.locked = false;
    return true;
  }

  /** No caregiver message can ever arrive (no microphone): unlock now and stop locking. */
  release(): void {
    this.locked = false;
    this.off = true;
  }
}
