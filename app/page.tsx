// pages/results.tsx
'use client';
import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { supabase } from '../lib/supabaseClient'; // Adjust path if needed

// 1. Define the types we need
type EventType = {
  event_id: number;
  event_name: string;
  event_category: string;
  event_type: 'Individual' | 'Group';
  event_status: 'Scheduled' | 'PROVISIONAL' | 'ON APPEAL' | 'FINAL';
  is_championship_event: boolean;
};

// Type for the results we fetch from the 'Results' table
type EventResultType = {
  rank: number;
  points_awarded: number;
  entries: {
    chest_no: number;
    entry_name: string;
    branches: {
      branch_name: string;
    } | null;
  } | null;
};

// 2. Helper object for status tag styling
const statusStyles: { [key in EventType['event_status']]: string } = {
  'Scheduled': 'text-neutral-500',
  'PROVISIONAL': 'text-yellow-500 bg-yellow-500/10',
  'FINAL': 'text-green-500 bg-green-500/10',
  'ON APPEAL': 'text-red-500 bg-red-500/10'
};

const ResultsPage: NextPage = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [eventResults, setEventResults] = useState<EventResultType[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // --- Fetch all events (runs once on load) ---
  useEffect(() => {
    async function fetchAllEvents() {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .returns<EventType[]>()
          .order('event_category', { ascending: true })
          .order('event_name', { ascending: true });
        if (error) throw error;
        if (data) setEvents(data);
      } catch (err) {
        if (err instanceof Error) setError(err.message);
        else setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchAllEvents();
  }, []);

  // --- Function to fetch results for a single event ---
  const handleEventClick = async (event: EventType) => {
    if (event.event_status === 'Scheduled') {
      alert('This event has not happened yet.');
      return;
    }
    
    setSelectedEvent(event);
    setIsModalLoading(true);
    setEventResults([]);

    try {
      const { data, error } = await supabase
        .from('results')
        .select(`
          rank,
          points_awarded,
          entries (
            chest_no,
            entry_name,
            branches (
              Branch_Name
            )
          )
        `)
        .eq('event_id', event.event_id)
        .order('rank', { ascending: true })
        .returns<EventResultType[]>();
      
      if (error) throw error;
      if (data) setEventResults(data);

    } catch (err) {
      // 1. Check if the error is an instance of Error
      if (err instanceof Error) {
        setError(err.message); // Now it's safe to access .message
      } else {
        // 2. Handle cases where the thrown object isn't an Error
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Render UI ---
  if (loading) return <div className="text-white p-5">Loading events...</div>;
  if (error) return <div className="text-red-500 p-5">Error: {error}</div>;

  return (
    <div className="p-5 bg-neutral-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">All Event Results</h1>
      
      {/* 3. The list of events, now with Tailwind classes */}
      <div className="space-y-2">
        {events.map((event: EventType) => (
          <div 
            key={event.event_id} 
            className="flex justify-between items-center py-3 px-4 mb-2 bg-neutral-800 rounded-md cursor-pointer transition-colors duration-200 hover:bg-neutral-700"
            onClick={() => handleEventClick(event)}
          >
            <strong className="text-lg">{event.event_name}</strong>
            <span className={`text-sm font-bold py-1 px-2 rounded ${statusStyles[event.event_status]}`}>
              [{event.event_status}]
            </span>
          </div>
        ))}
      </div>

      {/* 4. The Modal (appears when 'selectedEvent' is not null) */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 w-full h-full bg-black/70 flex justify-center items-center z-50" 
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-neutral-800 p-6 rounded-lg w-11/12 max-w-md text-white shadow-lg shadow-black/50" 
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mt-0">{selectedEvent.event_name}</h2>
            <span className={`text-sm font-bold py-1 px-2 rounded ${statusStyles[selectedEvent.event_status]}`}>
              [{selectedEvent.event_status}]
            </span>
            <hr className="border-neutral-700 my-4" />
            
            {isModalLoading ? (
              <div>Loading results...</div>
            ) : (
              <div>
                {/* 5. Display the fetched results */}
                {eventResults.length > 0 ? (
                  <div className="space-y-3">
                    {eventResults.map((result) => (
                      <div key={result.entries?.chest_no} className="bg-neutral-700 p-3 rounded-md">
                        <strong className="text-blue-400">
                          {result.rank === 1 ? '1st' : result.rank === 2 ? '2nd' : '3rd'} Place:
                        </strong>
                        <p className="text-xl my-0.5">{result.entries?.entry_name} ({result.entries?.chest_no})</p>
                        <p className="text-sm text-neutral-300 my-0.5">
                          {result.entries?.branches?.branch_name || 'No Branch'}
                        </p>
                        <p className="text-base my-0.5">{result.points_awarded} pts</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No results have been entered for this event yet.</p>
                )}

                {/* 6. Show the "Exclude" flag if it's false */}
                {!selectedEvent.is_championship_event && (
                  <div className="mt-4 p-3 bg-red-500/10 text-red-500 border border-red-500 rounded-md font-bold">
                    [!] These points are not included in the Championship totals.
                  </div>
                )}
              </div>
            )}
            
            <button 
              className="mt-5 py-2 px-4 bg-blue-600 text-white rounded-md cursor-pointer text-base transition-colors hover:bg-blue-700" 
              onClick={() => setSelectedEvent(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;