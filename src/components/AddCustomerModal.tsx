import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type PlanPreset = '30' | '56' | 'custom';

const planOptions: { label: string; value: PlanPreset; plates: number | null }[] = [
  { label: '30 Plates', value: '30', plates: 30 },
  { label: '56 Plates', value: '56', plates: 56 },
  { label: 'Custom', value: 'custom', plates: null },
];

export const AddCustomerModal = ({ open, onClose, onCreated }: Props) => {
  const [customerCode, setCustomerCode] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [plan, setPlan] = useState<PlanPreset>('56');
  const [customPlates, setCustomPlates] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setCustomerCode('');
    setName('');
    setMobile('');
    setPhotoUrl('');
    setPlan('56');
    setCustomPlates('');
    setHasExpiry(false);
    setExpiryDate('');
    setError(null);
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const plates =
      plan === 'custom'
        ? Number(customPlates || 0)
        : planOptions.find(p => p.value === plan)?.plates ?? 0;

    if (!customerCode.trim() || !name.trim() || !mobile.trim()) {
      setError('Customer ID, name and mobile are required.');
      setLoading(false);
      return;
    }
    if (plates <= 0) {
      setError('Plates must be greater than 0.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('customers').insert({
      customer_code: customerCode.trim(),
      full_name: name.trim(),
      mobile: mobile.trim(),
      photo_url: photoUrl.trim() || null,
      current_plan_type: 'fixed_plates',
      total_plates: plates,
      remaining_plates: plates,
      plan_expiry_date: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : null,
      status: 'active',
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    reset();
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 px-3">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add Customer</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 text-lg"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/60 border border-red-700 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Customer ID (unique)</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg"
              value={customerCode}
              onChange={e => setCustomerCode(e.target.value)}
              placeholder="e.g. 101"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Full Name</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Mobile</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-lg"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              inputMode="tel"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Photo (URL or leave blank)</label>
            <input
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
              value={photoUrl}
              onChange={e => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-[11px] text-slate-500 mt-1">
              You can also later extend this to use file upload / camera.
            </p>
          </div>

          <div>
            <label className="block text-sm mb-1">Plan</label>
            <div className="flex gap-2">
              <select
                value={plan}
                onChange={e => setPlan(e.target.value as PlanPreset)}
                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
              >
                {planOptions.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {plan === 'custom' && (
                <input
                  type="number"
                  min={1}
                  className="w-24 rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-sm"
                  value={customPlates}
                  onChange={e => setCustomPlates(e.target.value)}
                  placeholder="Plates"
                />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasExpiry}
                onChange={e => setHasExpiry(e.target.checked)}
              />
              <span>Has Expiry Date?</span>
            </label>
            {hasExpiry && (
              <input
                type="date"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
              />
            )}
            <p className="text-[11px] text-slate-500">
              Leave unchecked for no expiry (unlimited time).
            </p>
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
              className="px-5 py-2 rounded-lg bg-primary text-black font-semibold text-sm disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};