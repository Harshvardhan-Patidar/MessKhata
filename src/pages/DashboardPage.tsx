import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Customer } from '../components/CustomerCard';
import { CustomerCard } from '../components/CustomerCard';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { RenewModal } from '../components/RenewModal';
import type { MenuData } from '../components/MenuModal';
import { MenuModal } from '../components/MenuModal';
import { useAuth } from '../context/AuthContext';
import { Search, Utensils, Trash2, UserPlus, LogOut } from 'lucide-react';

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
  }, [customers]);  const handleOpenRenew = (customer: Customer) => {
    setSelectedCustomer(customer);
    setRenewOpen(true);
  };

  const handleLogout = async () => {
    localStorage.removeItem('admin_login_timestamp');
    await signOut();
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
    <div className="min-h-screen text-slate-800 flex flex-col relative overflow-hidden">
      <header className="sticky top-0 z-35 bg-surface-light dark:bg-surface-dark shadow-sm px-4 py-3.5 flex flex-row items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-light dark:text-text-dark">MessKhata</h1>
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Fast mess management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen(true)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{hasAnyMenu ? 'Update Menu' : 'Add Menu'}</span>
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-800 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-105 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Student</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8 pt-5 space-y-6 relative z-10">
        {/* Top stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium mb-1">Plates Today</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{totalPlatesServedToday}</span>
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium mb-1">Total Customers</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{customers.length}</span>
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium mb-1">Filter</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold capitalize">{filter}</span>
            </div>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium mb-1">Search</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold truncate max-w-full block">{search || '—'}</span>
            </div>
          </div>
        </section>

        {/* Daily Menu Card */}
        {hasAnyMenu && (
          <section className="bg-surface-light dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-warning" />
                <h2 className="font-semibold text-lg text-warning">{activeMenuTitle}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center gap-1 hover:text-text-light dark:hover:text-text-dark transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteMenu}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Clear Menu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {activeMenuItems.length > 0 ? (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {activeMenuItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted-light dark:text-text-muted-dark">No items listed for this shift.</p>
            )}
          </section>
        )}

        {/* Search + filters */}
        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
            <input
              className="w-full bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-text-muted-light dark:placeholder:text-text-muted-dark"
              placeholder="Search name, mobile or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {(['all', 'active', 'expiring', 'expired', 'archived'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-text-muted-light dark:text-text-muted-dark hover:bg-slate-100 dark:hover:bg-slate-800'
                } capitalize`}
              >
                {f}
              </button>
            ))}
          </div>
        </section>

        {/* Grid */}
        <section className="mt-2">
          {loading ? (
            <p className="text-center text-sm text-slate-400 font-semibold py-8">Loading customers…</p>
          ) : customers.length === 0 ? (
            <p className="text-center text-sm text-slate-400 font-semibold mt-12 py-10 glass-panel rounded-[24px]">
              No customers found. Try changing search/filter or add a new one.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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