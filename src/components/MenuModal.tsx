import { useEffect, useState } from 'react';

export type MenuData = {
  morning: string[];
  evening: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: MenuData) => void;
  initialData: MenuData | null;
};

export const MenuModal = ({ open, onClose, onSave, initialData }: Props) => {
  const [morningText, setMorningText] = useState('');
  const [eveningText, setEveningText] = useState('');

  useEffect(() => {
    if (open) {
      // Use the raw data from the DB — no client-side hiding.
      // The server/StudentDashboardPage logic should handle visibility of old menus,
      // but the Admin should always see what they previously saved.
      setMorningText(initialData?.morning?.join('\n') || '');
      setEveningText(initialData?.evening?.join('\n') || '');
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const morningItems = morningText.split('\n').map(line => line.trim()).filter(Boolean);
    const eveningItems = eveningText.split('\n').map(line => line.trim()).filter(Boolean);
    onSave({ morning: morningItems, evening: eveningItems });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 px-3 overflow-y-auto py-10">
      <div className="w-full max-w-md glass-panel rounded-[24px] p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Today's Menu</h2>
          <button type="button" onClick={onClose} className="text-slate-450 hover:text-slate-700 transition-colors text-lg cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">
              🌅 Morning Menu (Shows 5 AM to 5 PM)
            </label>
            <textarea
              className="w-full glass-input px-3.5 py-3 text-sm min-h-[100px] resize-none placeholder-slate-400"
              value={morningText}
              onChange={e => setMorningText(e.target.value)}
              placeholder="e.g.&#10;Idli Sambar&#10;Poha"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">
              🌆 Evening Menu (Shows 5 PM to 5 AM)
            </label>
            <textarea
              className="w-full glass-input px-3.5 py-3 text-sm min-h-[100px] resize-none placeholder-slate-400"
              value={eveningText}
              onChange={e => setEveningText(e.target.value)}
              placeholder="e.g.&#10;Dal Makhani&#10;Roti"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 border border-slate-200 transition-all cursor-pointer">Cancel</button>
            <button type="submit" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white font-black text-xs transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer">Save Menu</button>
          </div>
        </form>
      </div>
    </div>
  );
};
