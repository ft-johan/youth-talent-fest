// pages/schedule.tsx
'use client';
import { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { supabase } from '@/lib/supabaseClient'; // Adjust path if needed

// 1. Define the EventType
type EventType = {
  event_id: number;
  event_name: string;
  event_category: string;
  event_status: 'Scheduled' | 'PROVISIONAL' | 'ON APPEAL' | 'FINAL';
  // Add other fields if needed, like Event_Time or Venue
};

// 2. Define the type for our grouped data
type GroupedEvents = {
  [category: string]: EventType[];
};

// Helper object for status tag styling
const statusStyles: { [key in EventType['event_status']]: string } = {
  'Scheduled': 'text-neutral-500',
  'PROVISIONAL': 'text-yellow-500 bg-yellow-500/10',
  'FINAL': 'text-green-500 bg-green-500/10',
  'ON APPEAL': 'text-red-500 bg-red-500/10'
};

const SchedulePage: NextPage = () => {
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvents>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- This function groups the events ---
  // We'll call this on initial load AND when we get a real-time update
  const groupEvents = (events: EventType[]): GroupedEvents => {
    return events.reduce((acc, event) => {
      const category = event.event_category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(event);
      return acc;
    }, {} as GroupedEvents);
  };

  useEffect(() => {
    // --- 3. Initial Data Fetch ---
    async function fetchAndGroupEvents() {
      try {
        setLoading(true);
        setError(null);

        const { data: events, error } = await supabase
          .from('events')
          .select('event_id, event_name, event_category, event_status')
          .returns<EventType[]>()
          .order('event_category', { ascending: true })
          .order('event_name', { ascending: true });

        if (error) throw error;
        if (events) {
          setGroupedEvents(groupEvents(events)); // Group and set initial data
        }
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAndGroupEvents();

    // --- 4. Set up Real-Time Subscription ---
    const channel = supabase
      .channel('events-schedule-feed')
      .on(
        'postgres_changes', // Listen to database changes
        { 
          event: 'UPDATE', // Specifically for UPDATEs
          schema: 'public', 
          table: 'Events'   // On the 'Events' table
        },
        (payload) => {
          // --- 5. Handle the Change ---
          console.log('Change received!', payload);
          
          // The payload contains the new, updated event data
          const updatedEvent = payload.new as EventType;

          // Update our local state
          setGroupedEvents((currentGroups) => {
            // Create a deep copy of the state to avoid mutation
            const newGroups = { ...currentGroups };
            
            // Find the event in our state and update it
            let found = false;
            for (const category in newGroups) {
              newGroups[category] = newGroups[category].map(event => {
                if (event.event_id === updatedEvent.event_id) {
                  found = true;
                  return updatedEvent; // Replace the old event with the new one
                }
                return event;
              });
            }
            
            // If the event's category changed, we'd need a more complex update,
            // but for status changes, this is fine.
            return newGroups;
          });
        }
      )
      .subscribe();

    // --- 6. Cleanup Function ---
    // This runs when the component is unmounted (user leaves the page)
    return () => {
      supabase.removeChannel(channel); // Unsubscribe to prevent memory leaks
    };

  }, []); // The empty array [] means this runs only once

  // --- Render UI ---
  if (loading) return <div className="text-white p-5">Loading schedule...</div>;
  if (error) return <div className="text-red-500 p-5">Error: {error}</div>;

  return (
    <div className="p-5 bg-neutral-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Event Schedule</h1>
      
      <div className="space-y-6">
        {Object.keys(groupedEvents).map(category => (
          <div key={category}>
            <h2 className="text-2xl font-semibold text-blue-400 mb-3 border-b-2 border-neutral-700 pb-2">
              {category}
            </h2>
            
            <div className="space-y-2">
              {groupedEvents[category].map(event => (
                <div
                  key={event.event_id}
                  className="flex justify-between items-center py-3 px-4 bg-neutral-800 rounded-md"
                >
                  <span className="text-lg">{event.event_name}</span>
                  <span className={`text-sm font-bold py-1 px-2 rounded ${statusStyles[event.event_status]}`}>
                    [{event.event_status}]
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchedulePage;