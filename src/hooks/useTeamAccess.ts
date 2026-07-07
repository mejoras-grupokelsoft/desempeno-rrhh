// src/hooks/useTeamAccess.ts
// Determina si el usuario actual lidera equipos y/o es miembro de equipos de evaluación.
import { useState, useEffect } from 'react';
import { fetchTeamsByLeader, fetchTeamsByMember, type TeamWithMembers } from '../lib/supabaseQueries';
import type { User } from '../types';

export interface TeamAccessResult {
  loading: boolean;
  error: string | null;
  /** Equipos donde soy líder (con sus miembros) */
  teamsAsLeader: TeamWithMembers[];
  /** Emails únicos de personas que debo evaluar (miembros de mis equipos) */
  memberEmailsToEvaluate: string[];
  /** ¿Debo autoevaluarme? (soy miembro de algún equipo con performs_self_evaluation) */
  shouldSelfEvaluate: boolean;
  /** ¿Debo evaluar a otros? (soy líder de al menos 1 equipo con miembros) */
  shouldEvaluateTeam: boolean;
}

export function useTeamAccess(currentUser: User | null): TeamAccessResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamsAsLeader, setTeamsAsLeader] = useState<TeamWithMembers[]>([]);
  const [shouldSelfEvaluate, setShouldSelfEvaluate] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const [leaderTeams, memberEntries] = await Promise.all([
          fetchTeamsByLeader(currentUser.email),
          fetchTeamsByMember(currentUser.email),
        ]);
        setTeamsAsLeader(leaderTeams);
        setShouldSelfEvaluate(memberEntries.some(m => m.performs_self_evaluation));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando equipos');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser?.email]);

  const memberEmailsToEvaluate = [
    ...new Set(
      teamsAsLeader.flatMap(t =>
        t.members
          .filter(m => m.receives_evaluation_from_leader)
          .map(m => m.user_email)
      )
    ),
  ];

  return {
    loading,
    error,
    teamsAsLeader,
    memberEmailsToEvaluate,
    shouldSelfEvaluate,
    shouldEvaluateTeam: memberEmailsToEvaluate.length > 0,
  };
}
