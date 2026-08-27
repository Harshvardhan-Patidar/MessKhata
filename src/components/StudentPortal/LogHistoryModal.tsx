/**
 * @file LogHistoryModal.tsx
 * @description A modal component that displays a timeline of the student's recent meal consumption and plan renewals.
 */

import React from 'react';

/**
 * Represents a single log entry for a customer's activity.
 */
export type LogEntry = {
  id: number;
  plates_deducted: number;
  note: string;
  created_at: string;
};

/**
 * Props for the LogHistoryModal component.
 */
export type LogHistoryModalProps = {
  /**
   * The name of the mess currently being viewed.
   */
  messName: string;
  /**
   * The array of log entries to display in the timeline.
   */
  logs: LogEntry[];
  /**
   * Whether the logs are currently being fetched from the server.
   */
  loadingLogs: boolean;
  /**
   * An error message if the fetch failed, or null if successful.
   */
  logsError: string | null;
  /**
   * Callback function triggered when the modal is closed.
   */
  onClose: () => void;
};

/**
 * LogHistoryModal
 * 
 * Displays a glassmorphic modal containing a vertical timeline of the student's
 * activity (plates consumed, plans renewed) over the past 15 days.
 * 
 * @param {LogHistoryModalProps} props The component props.
 * @returns {JSX.Element} The rendered modal component.
 */
export const LogHistoryModal: React.FC<LogHistoryModalProps> = ({
  messName,
  logs,
  loadingLogs,
  logsError,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
          <div>
            <h3 className="text-lg font-bold text-white">Meal History</h3>
            <p className="text-xs text-slate-400">{messName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loadingLogs ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 text-sm">Fetching records...</p>
            </div>
          ) : logsError ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center text-red-400 text-sm">
              {logsError}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-300 font-medium">No recent activity</p>
              <p className="text-slate-500 text-sm mt-1">No meals recorded in the past 15 days.</p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
              {logs.map((log) => {
                const isDeduction = log.plates_deducted > 0;
                return (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Timeline Dot */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-800 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${isDeduction ? 'text-blue-400' : 'text-green-400'}`}>
                      {isDeduction ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Content Card */}
                    <div className="w-[calc(100%_-_4rem)] md:w-[calc(50%_-_2.5rem)] bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${isDeduction ? 'text-white' : 'text-green-400'}`}>
                          {isDeduction ? `Meal Consumed` : 'Plan Renewed'}
                        </span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${isDeduction ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                          {isDeduction ? `-${log.plates_deducted}` : '+'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{log.note}</p>
                      <p className="text-xs font-mono text-slate-500 bg-slate-900/50 inline-block px-2 py-1 rounded">
                        {new Date(log.created_at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
