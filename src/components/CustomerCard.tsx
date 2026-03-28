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
};

type Props = {
  customer: Customer;
  /**
   * Called after a successful EAT operation with the updated customer row.
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
  const canEat = remaining > 0 && isValidExpiry && customer.status === 'active';
  const isExpiredNow = !canEat;

  const [isEating, setIsEating] = useState(false);
  const [eatError, setEatError] = useState<string | null>(null);

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
      // consume_plate returns the updated customer row
      onEatUpdated(data as Customer);
    }
  };

  const waLink = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(
    `Hello ${customer.full_name}, your mess plan is over. Please renew.`
  )}`;

  const showWhatsApp = isExpiredNow;

  const handleArchive = async () => {
    const { error } = await supabase
      .from('customers')
      .update({ status: 'archived' })
      .eq('id', customer.id);
    if (!error) onArchive();
  };

  const statusColor =
    customer.status === 'active'
      ? 'bg-emerald-500/20 text-emerald-300'
      : customer.status === 'expired'
      ? 'bg-red-500/20 text-red-300'
      : 'bg-slate-600/40 text-slate-200';

  return (
    <div className="bg-slate-900/80 rounded-2xl p-4 flex flex-col gap-3 shadow-lg">
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
        {showWhatsApp && (
          <button
            onClick={() => window.open(waLink, '_blank')}
            className="text-green-400 hover:text-green-300"
            aria-label="WhatsApp reminder"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">Remaining Plates</p>
          <p className={`text-3xl font-extrabold ${canEat ? 'text-primary' : 'text-red-500'}`}>
            {remaining}
          </p>
          {/* Current plan total (fallback to lifetime if current_plan_total is undefined) */}
          {typeof (customer.current_plan_total ?? customer.total_plates) === 'number' && (
            <p className="text-[11px] text-slate-500">
              Plan total: {customer.current_plan_total ?? customer.total_plates}
            </p>
          )}
          {/* Lifetime total across all renewals */}
          {typeof customer.total_plates === 'number' && (
            <p className="text-[11px] text-slate-500">
              Lifetime total: {customer.total_plates}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`px-2 py-1 rounded-full text-[11px] uppercase ${statusColor}`}>
            {customer.status}
          </span>

          <button
            onClick={handleEat}
            disabled={!canEat || isEating}
            className={`px-4 py-2 rounded-lg text-lg font-bold w-28 ${
              canEat && !isEating
                ? 'bg-primary hover:bg-green-600 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isEating ? '…' : 'EAT'}
          </button>

          {eatError && (
            <p className="text-[10px] text-red-400 text-right max-w-[7rem] leading-tight">
              {eatError}
            </p>
          )}

          <button
            onClick={onRenew}
            className="px-4 py-1 rounded-lg text-sm font-semibold bg-amber-500 text-black hover:bg-amber-400 w-28"
          >
            RENEW
          </button>

          <button
            onClick={handleArchive}
            className="px-4 py-1 rounded-lg text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 w-28"
          >
            Remove (Archive)
          </button>
        </div>
      </div>
    </div>
  );
};