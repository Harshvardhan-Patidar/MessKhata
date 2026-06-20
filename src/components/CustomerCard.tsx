import { useState } from 'react';
import { MessageCircle, PhoneCall } from 'lucide-react';
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
    const { error } = await supabase
      .from('customers')
      .update({ status: 'archived' })
      .eq('id', customer.id);
    if (!error) onArchive();
  };

  const waLink = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(
    `Hello ${customer.full_name}, your mess plan is over. Please renew.`
  )}`;

  const statusColor =
    customer.status === 'active'
      ? 'bg-emerald-500/20 text-emerald-300'
      : customer.status === 'expired'
        ? 'bg-red-500/20 text-red-300'
        : 'bg-slate-600/40 text-slate-200';

  return (
    <div className="bg-slate-900/80 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
      {/* ── Top row: avatar + info + WhatsApp ── */}
      <div className="flex items-center gap-3">
        <img
          src={
            customer.photo_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.full_name)}`
          }
          alt={customer.full_name}
          className="w-14 h-14 rounded-full object-cover border border-slate-700"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold truncate">{customer.full_name}</div>
            {customer.customer_code && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-200 shrink-0">
                ID: {customer.customer_code}
              </span>
            )}
          </div>
          <button
            className="flex items-center gap-1 text-xs text-sky-400"
            onClick={() => (window.location.href = `tel:${customer.mobile}`)}
          >
            <PhoneCall className="w-4 h-4" /> {customer.mobile}
          </button>
          {expiry && (
            <p className="text-xs text-slate-400 mt-1">
              Expires: {format(expiry, 'dd MMM, hh:mm a')}
            </p>
          )}
        </div>
        {isExpiredNow && (
          <button
            onClick={() => window.open(waLink, '_blank')}
            className="text-green-400 hover:text-green-300"
            aria-label="WhatsApp reminder"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* ── Mid row: plates + status badge ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400">Remaining Plates</p>
          <p className={`text-3xl font-extrabold ${canEat ? 'text-primary' : 'text-red-500'}`}>
            {remaining}
          </p>
          {typeof customer.total_plates === 'number' && (
            <p className="text-[11px] text-slate-500">
              Lifetime total: {customer.total_plates}
            </p>
          )}

          {/* Plates today counter: EAT increases, +1 More decreases */}
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-amber-400 leading-none">
              {mealsToday - platesAddedToday}
            </span>
            <span className="text-[10px] text-slate-400">plates today</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`px-2 py-1 rounded-full text-[11px] uppercase ${statusColor}`}>
            {customer.status}
          </span>

          {/* Refund Plate button */}
          <button
            onClick={handleAddPlate}
            disabled={!canAddPlate || isAdding}
            title={
              (mealsToday - platesAddedToday) <= 0
                ? 'Can only refund after eating a plate today'
                : 'Refund 1 Plate'
            }
            className={`px-4 py-2 rounded-lg text-sm font-bold w-28 transition-colors ${canAddPlate && !isAdding
              ? 'bg-amber-500 hover:bg-amber-400 text-black'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
          >
            {isAdding ? '…' : '+1 More'}
          </button>
          {addError && (
            <p className="text-[10px] text-red-400 text-right max-w-[7rem] leading-tight">
              {addError}
            </p>
          )}

          <button
            onClick={onRenew}
            className="px-4 py-1 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 w-28"
          >
            RENEW
          </button>

          <button
            onClick={handleArchive}
            className="px-4 py-1 rounded-lg text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 w-28"
          >
            Remove
          </button>
        </div>
      </div>

      {/* ── Bottom: EAT button full-width green ── */}
      <button
        onClick={handleEat}
        disabled={!canEat || isEating}
        className={`w-full py-3 rounded-xl text-lg font-bold tracking-wide transition-colors ${canEat && !isEating
          ? 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white'
          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
      >
        {isEating ? 'Please wait…' : 'EAT'}
      </button>
      {eatError && (
        <p className="text-[10px] text-red-400 text-center leading-tight -mt-1">
          {eatError}
        </p>
      )}
    </div>
  );
};