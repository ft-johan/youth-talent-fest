// pages/leaderboard.tsx
'use client';
import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { supabase } from '@/lib/supabaseClient';

// --- 1. Define All Data Types ---

type Branch = {
    branch_id: number;
    branch_name: string;
};

type Event = {
    event_id: number;
    event_type: 'Individual' | 'Group';
    is_championship_event: boolean;
};

type Entry = {
    chest_no: number;
    branch_id: number;
    entry_type: 'Individual' | 'Group';
    gender: 'Male' | 'Female' | null;
};

type Result = {
    chest_no: number;
    event_id: number;
    points_awarded: number;
};

type TeamMember = {
    group_chest_no: number;
    member_chest_no: number;
};

// --- 2. Define Types for Calculated Rankings ---

type BranchRanking = {
    branch_id: number;
    branch_name: string;
    official_points: number; // For the championship
    total_points: number;      // Includes excluded events
};

type IndividualRanking = {
    chest_no: number;
    name: string;
    branch_name: string;
    individual_points: number;
    group_points: number;
    total_points: number;
    category_count: number;
};

const LeaderboardPage: NextPage = () => {
    // State for rankings
    const [branchRankings, setBranchRankings] = useState<BranchRanking[]>([]);
    const [kalaprathibha, setKalaprathibha] = useState<IndividualRanking[]>([]);
    const [kalathilakam, setKalathilakam] = useState<IndividualRanking[]>([]);

    // State for loading/error
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State to switch tabs
    const [activeTab, setActiveTab] = useState<'Branch' | 'Prathibha' | 'Thilakam'>('Branch');

    // --- 3. Data Fetching and Calculation ---
    useEffect(() => {
    async function calculateLeaderboards() {
      try {
        setLoading(true);
        setError(null);

        // --- A. Fetch all raw data in parallel ---
        const [
          { data: branches, error: errBranches },
          { data: events, error: errEvents },
          { data: entries, error: errEntries },
          { data: results, error: errResults },
          { data: teamMembers, error: errTeamMembers },
        ] = await Promise.all([
          //
          // --- FIX IS HERE: Added [] to all .returns() types ---
          //
          supabase.from('branches').select('branch_id, branch_name').returns<Branch[]>(),
          supabase.from('events').select('event_id, event_type, is_championship_event').returns<Event[]>(),
          supabase.from('entries').select('chest_no, branch_id, entry_type, gender, entry_name').returns<(Entry & { entry_name: string })[]>(),
          supabase.from('results').select('chest_no, event_id, points_awarded').returns<Result[]>(),
          supabase.from('team_members').select('group_chest_no, member_chest_no').returns<TeamMember[]>(),
        ]);

        if (errBranches || errEvents || errEntries || errResults || errTeamMembers) {
          throw new Error(
            errBranches?.message || errEvents?.message || errEntries?.message || errResults?.message || errTeamMembers?.message
          );
        }

        // --- Added a check for null data ---
        if (!branches || !events || !entries || !results || !teamMembers) {
            throw new Error("Failed to fetch all necessary data. One or more queries returned null.");
        }

        // Create fast-access Maps for calculations
        const eventMap = new Map<number, Event>(events.map(e => [e.event_id, e]));
        const entryMap = new Map<number, Entry & { entry_name: string }>(entries.map(e => [e.chest_no, e]));
        const branchMap = new Map<number, Branch>(branches.map(b => [b.branch_id, b]));

        // --- B. Calculate Branch Rankings ---
        const branchPoints: Map<number, BranchRanking> = new Map();

        // Initialize all branches
        for (const branch of branches) {
          branchPoints.set(branch.branch_id, {
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
            official_points: 0,
            total_points: 0,
          });
        }

        // Process results
        for (const result of results) {
          const event = eventMap.get(result.event_id);
          const entry = entryMap.get(result.chest_no);
          if (!event || !entry) continue;

          const ranking = branchPoints.get(entry.branch_id);
          if (!ranking) continue;

          ranking.total_points += result.points_awarded;

          if (event.is_championship_event) {
            ranking.official_points += result.points_awarded;
          }
        }
        
        const sortedBranchRankings = Array.from(branchPoints.values())
          .sort((a, b) => b.official_points - a.official_points);
        setBranchRankings(sortedBranchRankings);

        // --- C. Calculate Individual Rankings (Kalaprathibha/Kalathilakam) ---
        const individualPoints: Map<number, IndividualRanking> = new Map();

        for (const entry of entries) {
          if (entry.entry_type === 'Individual') {
            individualPoints.set(entry.chest_no, {
              chest_no: entry.chest_no,
              name: entry.entry_name,
              branch_name: branchMap.get(entry.branch_id)?.branch_name || 'Unknown',
              individual_points: 0,
              group_points: 0,
              total_points: 0,
              category_count: 0,
            });
          }
        }
        
        for (const result of results) {
            const event = eventMap.get(result.event_id);
            if (!event) continue;

            if (event.event_type === 'Individual') {
                const individual = individualPoints.get(result.chest_no);
                if (individual) {
                    individual.individual_points += result.points_awarded;
                }
            } else if (event.event_type === 'Group') {
                const members = teamMembers.filter(tm => tm.group_chest_no === result.chest_no);
                for (const member of members) {
                    const individual = individualPoints.get(member.member_chest_no);
                    if (individual) {
                        individual.group_points += result.points_awarded;
                    }
                }
            }
        }
        
        // TODO: Calculate Category_Count (requires joining results -> events -> category)
        
        const allIndividuals = Array.from(individualPoints.values());
        allIndividuals.forEach(ind => {
          ind.total_points = ind.individual_points + ind.group_points;
        });

        setKalaprathibha(
          allIndividuals
            .filter(ind => entryMap.get(ind.chest_no)?.gender === 'Male')
            .sort((a, b) => b.total_points - a.total_points)
        );

        setKalathilakam(
          allIndividuals
            .filter(ind => entryMap.get(ind.chest_no)?.gender === 'Female')
            .sort((a, b) => b.total_points - a.total_points)
        );

      } catch (err: unknown) { // <-- FIX: Added :unknown
        if (err instanceof Error) setError(err.message);
        else setError('An unexpected error occurred during calculation');
      } finally {
        setLoading(false);
      }
    }

    calculateLeaderboards();
  }, []);
    // --- 4. Render UI ---
    if (loading) return <div className="text-white p-5">Calculating Leaderboards...</div>;
    if (error) return <div className="text-red-500 p-5">Error: {error}</div>;

    return (
        <div className="p-5 bg-neutral-900 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6">Live Leaderboard</h1>

            {/* --- Tab Navigation --- */}
            <div className="flex mb-6 border-b border-neutral-700">
                <TabButton
                    title="Branch (Shakha)"
                    isActive={activeTab === 'Branch'}
                    onClick={() => setActiveTab('Branch')}
                />
                <TabButton
                    title="Kalaprathibha"
                    isActive={activeTab === 'Prathibha'}
                    onClick={() => setActiveTab('Prathibha')}
                />
                <TabButton
                    title="Kalathilakam"
                    isActive={activeTab === 'Thilakam'}
                    onClick={() => setActiveTab('Thilakam')}
                />
            </div>

            {/* --- Tab Content --- */}
            <div>
                {/* Branch Leaderboard */}
                {activeTab === 'Branch' && (
                    <div className="space-y-4">
                        {branchRankings.map((branch, index) => (
                            <div key={branch.branch_id} className="p-4 bg-neutral-800 rounded-lg shadow">
                                <div className="flex justify-between items-center">
                                    <span className="text-xl font-bold">{index + 1}. {branch.branch_name}</span>
                                    <span className="text-2xl font-bold text-blue-400">{branch.official_points} pts</span>
                                </div>
                                {branch.total_points !== branch.official_points && (
                                    <div className="text-sm text-neutral-400 mt-1">
                                        (Total including non-championship events: {branch.total_points} pts)
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Kalaprathibha Leaderboard */}
                {activeTab === 'Prathibha' && (
                    <div className="space-y-4">
                        {kalaprathibha.slice(0, 10).map((person, index) => ( // Show top 10
                            <div key={person.chest_no} className="p-4 bg-neutral-800 rounded-lg shadow">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-xl font-bold">{index + 1}. {person.name}</span>
                                        <p className="text-neutral-400 text-sm">{person.branch_name}</p>
                                    </div>
                                    <span className="text-2xl font-bold text-green-400">{person.total_points} pts</span>
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                    (Individual: {person.individual_points} pts, Group: {person.group_points} pts)
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Kalathilakam Leaderboard */}
                {activeTab === 'Thilakam' && (
                    <div className="space-y-4">
                        {kalathilakam.slice(0, 10).map((person, index) => ( // Show top 10
                            <div key={person.chest_no} className="p-4 bg-neutral-800 rounded-lg shadow">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-xl font-bold">{index + 1}. {person.name}</span>
                                        <p className="text-neutral-400 text-sm">{person.branch_name}</p>
                                    </div>
                                    <span className="text-2xl font-bold text-pink-400">{person.total_points} pts</span>
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                    (Individual: {person.individual_points} pts, Group: {person.group_points} pts)
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Simple Tab Button Component ---
const TabButton = ({ title, isActive, onClick }: { title: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`py-3 px-5 font-semibold text-lg
      ${isActive
                ? 'border-b-2 border-blue-500 text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }
    `}
    >
        {title}
    </button>
);

export default LeaderboardPage;