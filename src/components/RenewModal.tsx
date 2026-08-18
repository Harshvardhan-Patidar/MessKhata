import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

import type { Customer } from './CustomerCard';

type Props = {
  open: boolean;
  onClose: () => void;
  onUpdated: (customer: Customer) => void;
  customer: {
    id: string;
    full_name: string;
  } | null;
};

export const RenewModal = ({ open, onClose, onUpdated, customer }: Props) => {
  const [additionalPlates, setAdditionalPlates] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !customer) return null;

  const handleClose = () => {
    if (loading) return;
    setAdditionalPlates('');
    setHasExpiry(false);
    setExpiryDate('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setError(null);
    setLoading(true);

    const plates = Number(additionalPlates || 0);
    if (plates <= 0) {
      setError('Please enter plates to add.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.rpc('renew_plan', {
      p_customer_id: customer.id,
      p_additional_plates: plates,
      p_new_expiry: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : null,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    setAdditionalPlates('');
    setHasExpiry(false);
    setExpiryDate('');
    if (data) {
      onUpdated(data as Customer);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 px-3">
      <div className="w-full max-w-md glass-panel rounded-[24px] p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Renew Plan</h2>
          <button
            onClick={handleClose}
            className="text-slate-450 hover:text-slate-700 transition-colors text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-600 font-medium">
          Customer: <span className="font-bold text-slate-900">{customer.full_name}</span>
        </p>

        {error && (
          <p className="text-xs text-red-555 bg-red-50 border border-red-200/60 rounded-2xl px-4 py-3 text-center font-bold">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Add Plates</label>
            <input
              type="number"
              min={1}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
              value={additionalPlates}
              onChange={e => setAdditionalPlates(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={e => setHasExpiry(e.target.checked)}
              />
              <span>Set new expiry date?</span>
            </label>
            {hasExpiry && (
              <input
                type="date"
                className="w-full glass-input px-3.5 py-2 text-sm"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-black text-xs transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Renew'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};