import { useState } from 'react';
import { MessageCircle, PhoneCall, Utensils } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { supabase } from '../lib/supabaseClient';

export type Customer = {
  id: string;
  /**
   * Human-friendly customer ID set by the admin (unique)
   */
  customer_code?: string | null;
  full_name: string;
  mobile: string;
  photo_url: string | null;
  remaining_plates: number | null;
  plan_expiry_date: string | null;
  status: 'active' | 'expired' | 'archived';
  /**
   * Lifetime total plates purchased across all renewals
   */
  total_plates: number | null;
  /**
   * Total plates in the current active plan (resets on renew)
   * Falls back to total_plates if not present (for older rows)
   */
  current_plan_total?: number | null;
  /**
   * How many meals this customer has eaten today (resets each calendar day)
   */
  meals_consumed_today: number | null;
  /**
   * How many +1 plate additions have been done today (max 1/day)
   */
  plates_added_today: number | null;
  /**
   * The last date daily counters were active (used to detect a new day)
   */
  last_active_date: string | null;
};

type Props = {
  customer: Customer;
  /**
   * Called after a successful EAT or +1 More operation with the updated customer row.
   * This lets the parent update only that one customer in state.
   */
  onEatUpdated: (updated: Customer) => void;
  onRenew: () => void;
  onArchive: () => void;
};

export const CustomerCard = ({ customer, onEatUpdated, onRenew, onArchive }: Props) => {
  const remaining = customer.remaining_plates ?? 0;
  const expiry = customer.plan_expiry_date ? new Date(customer.plan_expiry_date) : null;
  const now = new Date();

  const isValidExpiry = !expiry || isAfter(expiry, now);

  // Detect if daily counters need to be treated as reset (new day)
  // Use IST (Asia/Kolkata) date so the reset aligns with midnight IST, not UTC
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
  const isToday = customer.last_active_date === todayStr;
  const mealsToday = isToday ? (customer.meals_consumed_today ?? 0) : 0;
  const platesAddedToday = isToday ? (customer.plates_added_today ?? 0) : 0;

  const canEat =
    customer.status === 'active' &&
    remaining > 0 &&
    isValidExpiry;

  // Refund Plate: only if they have consumed a net > 0 plates today
  const canAddPlate =
    customer.status === 'active' &&
    isValidExpiry &&
    (mealsToday - platesAddedToday) > 0;

  const isExpiredNow = customer.status !== 'active';

  const [isEating, setIsEating] = useState(false);
  const [eatError, setEatError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleEat = async () => {
    if (!canEat || isEating) return;
    setEatError(null);
    setIsEating(true);
    const { data, error } = await supabase.rpc('consume_plate', {
      p_customer_id: customer.id,
      p_count: 1,
    });
    setIsEating(false);
    if (error) {
      setEatError(error.message);
      return;
    }
    if (data) {
      onEatUpdated(data as Customer);
    }
  };

  const handleAddPlate = async () => {
    if (!canAddPlate || isAdding) return;
    setAddError(null);
    setIsAdding(true);
    const { data, error } = await supabase.rpc('add_plate', {
      p_customer_id: customer.id,
      p_count: 1,
    });
    setIsAdding(false);
    if (error) {
      setAddError(error.message);
      return;
    }
    if (data) {
      onEatUpdated(data as Customer);
    }
  };

  const handleArchive = async () => {
    if (window.confirm(`Are you sure you want to archive ${customer.full_name}?`)) {
      const { error } = await supabase
        .from('customers')
        .update({ status: 'archived' })
        .eq('id', customer.id);
      if (!error) onArchive();
    }
  };

  const waLink = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(
    `Hello ${customer.full_name}, your mess plan is over. Please renew.`
  )}`;

  const initials = (customer.full_name || '')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between">
      <div className="p-4 flex-1 flex flex-col justify-between">
        {/* Card Header block with grey background and border */}
        <div className="flex items-start justify-between mb-4 bg-slate-50 dark:bg-slate-800/50 -mx-4 -mt-4 p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {customer.photo_url ? (
              <img
                src={customer.photo_url}
                alt={customer.full_name}
                className="w-12 h-12 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg font-semibold text-slate-700 dark:text-slate-300">
                {initials}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-text-light dark:text-text-dark">{customer.full_name}</h3>
                {customer.customer_code && (
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-text-muted-light dark:text-text-muted-dark px-1.5 py-0.5 rounded">
                    ID: {customer.customer_code}
                  </span>
                )}
              </div>
              <button
                className="flex items-center gap-1 text-sm text-accent dark:text-accent-dark font-medium cursor-pointer"
                onClick={() => (window.location.href = `tel:${customer.mobile}`)}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{customer.mobile}</span>
              </button>
              {expiry && (
                <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark mt-0.5 font-medium">
                  Expires: {format(expiry, 'dd MMM, hh:mm a')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExpiredNow && (
              <button
                onClick={() => window.open(waLink, '_blank')}
                className="text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                aria-label="WhatsApp reminder"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            )}
            <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider shadow-sm ${
              customer.status === 'active'
                ? 'bg-emerald-500 text-white'
                : customer.status === 'expired'
                  ? 'bg-red-500 text-white'
                  : 'bg-slate-500 text-white'
            }`}>
              {customer.status}
            </span>
          </div>
        </div>

        {/* Stats Row + Vertical Actions Column */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-1 uppercase tracking-wider font-medium font-semibold">Remaining Plates</p>
            <div className="text-4xl font-black text-text-light dark:text-text-dark">{remaining}</div>
            {typeof customer.total_plates === 'number' && (
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">Lifetime total: {customer.total_plates}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleAddPlate}
              disabled={!canAddPlate || isAdding}
              title={
                (mealsToday - platesAddedToday) <= 0
                  ? 'Can only refund after eating a plate today'
                  : 'Refund 1 Plate'
              }
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
            >
              {isAdding ? '…' : '+1 More'}
            </button>
            <button
              onClick={onRenew}
              className="px-4 py-2 bg-warning/10 hover:bg-warning/20 text-warning text-sm font-bold rounded-lg transition-colors border border-warning/20 cursor-pointer text-center"
            >
              RENEW
            </button>
            <button
              onClick={handleArchive}
              className="px-4 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-red-500/10 hover:text-red-650 hover:border-red-500/20 border border-transparent rounded-lg text-[10px] text-text-muted-light dark:text-text-muted-dark transition-colors cursor-pointer text-center"
            >
              Remove
            </button>
          </div>
        </div>

        {/* Plates today */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg font-bold text-warning">{mealsToday - platesAddedToday}</span>
          <span className="text-xs text-text-muted-light dark:text-text-muted-dark">plates today</span>
        </div>

        {/* EAT Button */}
        <button
          onClick={handleEat}
          disabled={!canEat || isEating}
          className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-2xl rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 active:scale-[0.95] cursor-pointer"
        >
          <Utensils className="w-6 h-6" />
          <span>EAT</span>
        </button>
        {eatError && (
          <p className="text-xs text-red-550 text-center mt-2 leading-tight font-semibold">
            {eatError}
          </p>
        )}
        {addError && (
          <p className="text-xs text-red-550 text-center mt-2 leading-tight font-semibold">
            {addError}
          </p>
        )}
      </div>
    </div>
  );
};