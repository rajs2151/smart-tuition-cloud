/**
 * Consecutive taken-session absences for a student ending just before
 * `beforeDate` (exclusive). Used for the amber "Nd" streak badge on the
 * mark grid — same signal coaches watch in Teachmint-style apps.
 */
export function consecutiveAbsenceStreak(
  studentId: string,
  beforeDate: string,
  takenSessionsDesc: Array<{ id: string; sessionDate: string }>,
  absentStudentIdsBySession: Map<string, Set<string>>,
): number {
  let streak = 0;
  for (const session of takenSessionsDesc) {
    if (session.sessionDate >= beforeDate) continue;
    const absents = absentStudentIdsBySession.get(session.id);
    if (absents?.has(studentId)) streak += 1;
    else break;
  }
  return streak;
}

export function buildConsecutiveAbsenceMap(
  studentIds: string[],
  beforeDate: string,
  takenSessionsDesc: Array<{ id: string; sessionDate: string }>,
  absentStudentIdsBySession: Map<string, Set<string>>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of studentIds) {
    const n = consecutiveAbsenceStreak(id, beforeDate, takenSessionsDesc, absentStudentIdsBySession);
    if (n > 0) map.set(id, n);
  }
  return map;
}
