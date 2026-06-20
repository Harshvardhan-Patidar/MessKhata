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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 px-3 overflow-y-auto py-10">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Today's Menu</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg">✕</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-slate-300 font-semibold">
              🌅 Morning Menu (Shows 5 AM to 5 PM)
            </label>
            <textarea
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-none"
              value={morningText}
              onChange={e => setMorningText(e.target.value)}
              placeholder="e.g.&#10;Idli Sambar&#10;Poha"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-300 font-semibold">
              🌆 Evening Menu (Shows 5 PM to 5 AM)
            </label>
            <textarea
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px] resize-none"
              value={eveningText}
              onChange={e => setEveningText(e.target.value)}
              placeholder="e.g.&#10;Dal Makhani&#10;Roti"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 text-sm hover:bg-slate-700">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-primary text-slate-950 font-bold text-sm hover:bg-green-500">Save Menu</button>
          </div>
        </form>
      </div>
    </div>
  );
};
