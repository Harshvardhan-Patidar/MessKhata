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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 px-3">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Renew Plan</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 text-lg"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-300">
          Customer: <span className="font-semibold">{customer.full_name}</span>
        </p>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/60 border border-red-700 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Add Plates</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg"
              value={additionalPlates}
              onChange={e => setAdditionalPlates(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 text-sm">
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-amber-400 text-black font-semibold text-sm disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Renew'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};