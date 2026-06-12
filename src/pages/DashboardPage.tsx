import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Customer } from '../components/CustomerCard';
import { CustomerCard } from '../components/CustomerCard';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { RenewModal } from '../components/RenewModal';
import type { MenuData } from '../components/MenuModal';
import { MenuModal } from '../components/MenuModal';
import { useAuth } from '../context/AuthContext';
import { Search, Utensils, Trash2 } from 'lucide-react';

type Filter = 'all' | 'active' | 'expiring' | 'expired' | 'archived';

const useDebouncedValue = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

export const DashboardPage = () => {
  const { signOut, session } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Menu state
  const [menuData, setMenuData] = useState<MenuData | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Load menu from Supabase on mount
  useEffect(() => {
    const loadMenu = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('admins')
        .select('menu_data, menu_last_updated')
        .eq('auth_id', session.user.id)
        .single();

      if (data && data.menu_data) {
        setMenuData(data.menu_data);
      }
    };
    loadMenu();
  }, [session]);

  const handleSaveMenu = async (data: MenuData) => {
    setMenuData(data);
    if (!session?.user?.id) return;
    const now = new Date().toISOString();
    await supabase
      .from('admins')
      .update({ menu_data: data, menu_last_updated: now })
      .eq('auth_id', session.user.id);
  };

  const handleDeleteMenu = async () => {
    if (window.confirm('Are you sure you want to clear the daily menus?')) {
      setMenuData(null);
      if (!session?.user?.id) return;
      await supabase
        .from('admins')
        .update({ menu_data: { morning: [], evening: [] }, menu_last_updated: new Date().toISOString() })
        .eq('auth_id', session.user.id);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);

    // Auto update expired/archived AND hard-delete users expired for 3+ months (runs in parallel)
    await Promise.all([
      supabase.rpc('auto_update_expired_and_archived'),
      supabase.rpc('delete_stale_users'),
    ]);

    let query = supabase
      .from('customers')
      .select('*')
      .order('full_name', { ascending: true })
      .limit(200);

    const term = debouncedSearch.trim();
    if (term) {
      const like = `%${term}%`;
      // Search by name, mobile or customer_code
      query = query.or(
        `full_name.ilike.${like},mobile.ilike.${like},customer_code.ilike.${like}`
      );
    }

    const { data, error } = await query;
    setLoading(false);
    if (error || !data) return;

    const now = new Date();
    const typed = data as Customer[];

    const filtered = typed.filter(c => {
      if (filter === 'all') return true;
      if (filter === 'archived') return c.status === 'archived';
      if (filter === 'expired') return c.status === 'expired';
      if (filter === 'active') return c.status === 'active';
      if (filter === 'expiring') {
        if (!c.plan_expiry_date) return false;
        const expiry = new Date(c.plan_expiry_date);
        const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        return c.status === 'active' && expiry > now && expiry <= threeDaysLater;
      }
      return true;
    });

    setCustomers(filtered);
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filter]);

  const totalPlatesServedToday = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return customers.reduce((sum, c) => {
      if (c.last_active_date !== todayStr) return sum;
      const meals = c.meals_consumed_today ?? 0;
      const added = c.plates_added_today ?? 0;
      return sum + meals - added; // EAT ↑, +1 More ↓
    }, 0);
  }, [customers]);

  const handleOpenRenew = (customer: Customer) => {
    setSelectedCustomer(customer);
    setRenewOpen(true);
  };

  // Update just one customer in local state after an EAT action,
  // so we don't refetch the whole list from Supabase.
  const handleEatUpdated = (updated: Customer) => {
    setCustomers(prev =>
      prev.map(c => (c.id === updated.id ? { ...c, ...updated } : c))
    );
  };

  // Determine active menu based on time
  // 5 AM to 4:59 PM -> Morning
  // 5 PM to 4:59 AM -> Evening
  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 5 && currentHour < 17;
  const activeMenuTitle = isMorning ? "🌅 Morning Menu" : "🌆 Evening Menu";
  const activeMenuItems = isMorning ? menuData?.morning || [] : menuData?.evening || [];
  const hasAnyMenu = menuData && (menuData.morning.length > 0 || menuData.evening.length > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">MessKhata</h1>
          <p className="text-xs text-slate-400">Fast mess management for Indian mess owners</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-400 text-sm font-semibold flex items-center gap-1 hover:bg-slate-700"
          >
            <Utensils className="w-4 h-4" />
            <span className="hidden sm:inline">{hasAnyMenu ? 'Update Menu' : 'Add Menu'}</span>
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-400 text-sm font-semibold flex items-center gap-1 hover:bg-slate-700"
          >
            + <span className="hidden sm:inline">Add Customer</span>
          </button>
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-6 pt-3 space-y-4">
        {/* Top stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-900/80 rounded-xl p-3">
            <p className="text-xs text-slate-400">Plates today</p>
            <p className="text-xl font-bold text-primary">{totalPlatesServedToday}</p>
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3">
            <p className="text-xs text-slate-400">Customers</p>
            <p className="text-xl font-bold">{customers.length}</p>
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3">
            <p className="text-xs text-slate-400">Filter</p>
            <p className="text-xs capitalize">{filter}</p>
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3">
            <p className="text-xs text-slate-400">Search</p>
            <p className="text-xs truncate">{search || '—'}</p>
          </div>
        </section>

        {/* Daily Menu Card */}
        {hasAnyMenu && (
          <section className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex justify-between items-start gap-4">
            <div className="flex-1">
              <h2 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-2">
                <Utensils className="w-4 h-4" /> {activeMenuTitle}
              </h2>
              {activeMenuItems.length > 0 ? (
                <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1">
                  {activeMenuItems.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No items listed for this shift.</p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setMenuOpen(true)}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                Edit All
              </button>
              <button
                onClick={handleDeleteMenu}
                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center transition-colors"
                title="Clear Menu"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {/* Search + filters */}
        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-base focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Search by name, mobile or customer ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar text-xs">
            {(['all', 'active', 'expiring', 'expired', 'archived'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full border ${filter === f
                  ? 'bg-primary text-slate-950 font-semibold border-primary'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
                  } capitalize whitespace-nowrap`}
              >
                {f}
              </button>
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="mt-2">
          {loading ? (
            <p className="text-center text-sm text-slate-400">Loading customers…</p>
          ) : customers.length === 0 ? (
            <p className="text-center text-sm text-slate-400 mt-8">
              No customers found. Try changing search/filter or add a new one.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {customers.map(c => (
                <CustomerCard
                  key={c.id}
                  customer={c}
                  onEatUpdated={handleEatUpdated}
                  onRenew={() => handleOpenRenew(c)}
                  onArchive={fetchCustomers}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <MenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        initialData={menuData}
        onSave={handleSaveMenu}
      />

      <AddCustomerModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(newCustomer) => {
          setCustomers(prev => {
            const list = [...prev, newCustomer];
            return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
          });
        }}
      />

      <RenewModal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        onUpdated={handleEatUpdated}
        customer={
          selectedCustomer && {
            id: selectedCustomer.id,
            full_name: selectedCustomer.full_name,
          }
        }
      />
    </div>
  );
};