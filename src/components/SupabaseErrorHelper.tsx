import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface SupabaseErrorHelperProps {
  error: any;
  table?: string;
  operation?: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';
}

const SupabaseErrorHelper: React.FC<SupabaseErrorHelperProps> = ({ 
  error, 
  table = 'projects',
  operation = 'INSERT' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if this is an RLS policy error
  const isRLSError = error && 
    error.message && 
    error.message.includes('violates row-level security policy') &&
    error.message.includes(`table "${table}"`);

  // Check if it's specifically an INSERT policy error with 401 status
  const isInsertPolicyError = isRLSError && 
    (error.status === 401 || error.message.includes('42501')) &&
    operation === 'INSERT';

  if (!isInsertPolicyError) {
    return null;
  }

  const sqlFix = `alter table ${table} enable row level security;

drop policy if exists "Enable insert for authenticated users" on ${table};

create policy "Users can insert own ${table}"
  on ${table} for insert
  with check (auth.uid() = created_by);`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sqlFix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-red-800 font-semibold text-sm">
            ❌ {table.charAt(0).toUpperCase() + table.slice(1)} cannot be created – INSERT policy missing
          </h3>
          <p className="text-red-700 text-sm mt-1">
            Row Level Security is blocking INSERT operations. You need to add an INSERT policy.
          </p>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 flex items-center space-x-2 text-red-700 hover:text-red-800 text-sm font-medium transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            <span>How to fix it</span>
          </button>

          {isExpanded && (
            <div className="mt-3 p-3 bg-red-100 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <p className="text-red-800 text-sm font-medium">
                  Run this SQL in your Supabase SQL Editor:
                </p>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-red-200 hover:bg-red-300 text-red-800 rounded transition-colors"
                >
                  {copied ? (
                    <>
                      <Check size={12} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
                <code>{sqlFix}</code>
              </pre>
              <div className="mt-2 text-xs text-red-700">
                <p><strong>What this does:</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Enables Row Level Security on the {table} table</li>
                  <li>Removes any conflicting INSERT policies</li>
                  <li>Creates a new policy allowing users to insert their own {table}</li>
                  <li>Uses <code>auth.uid() = created_by</code> to ensure users can only create {table} for themselves</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupabaseErrorHelper;