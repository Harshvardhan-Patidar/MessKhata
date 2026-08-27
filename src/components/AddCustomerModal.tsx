import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

import type { Customer } from './CustomerCard';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
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
  const [plan, setPlan] = useState<PlanPreset>('56');
  const [customPlates, setCustomPlates] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null); // data-URL
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Stop any running stream ──────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ── Start camera stream ──────────────────────────────────────────
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    setCameraError(null);
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permission in your browser.');
      console.error(err);
    }
  }, [stopStream]);

  // Open camera overlay
  const openCamera = async () => {
    setCameraOpen(true);
    await startCamera(facingMode);
  };

  // Flip between front / back camera
  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    await startCamera(next);
  };

  // Capture current video frame onto canvas → data-URL
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror the image if using front camera (looks natural)
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoPreview(dataUrl);
    stopStream();
    setCameraOpen(false);
  };

  const cancelCamera = () => {
    stopStream();
    setCameraOpen(false);
    setCameraError(null);
  };

  const clearPhoto = () => setPhotoPreview(null);

  // Clean up stream when modal closes
  useEffect(() => {
    if (!open) {
      stopStream();
      setCameraOpen(false);
    }
  }, [open, stopStream]);

  if (!open) return null;

  // ── Form helpers ─────────────────────────────────────────────────
  const reset = () => {
    setCustomerCode('');
    setName('');
    setMobile('');
    setPhotoPreview(null);
    setPlan('56');
    setCustomPlates('');
    setHasExpiry(false);
    setExpiryDate('');
    setError(null);
    setCameraError(null);
  };

  const handleClose = () => {
    if (!loading) { reset(); onClose(); }
  };

  // Convert data-URL → Blob → File for upload
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new File([arr], filename, { type: mime });
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

    // Validate Indian mobile number: 10 digits, starts with 6-9
    const cleanMobile = mobile.trim().replace(/^\+?91/, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setError('Enter a valid 10-digit Indian mobile number (starting with 6-9).');
      setLoading(false);
      return;
    }

    if (plates <= 0) {
      setError('Plates must be greater than 0.');
      setLoading(false);
      return;
    }

    // Upload captured photo if present
    let uploadedPhotoUrl: string | null = null;
    if (photoPreview) {
      const file = dataUrlToFile(photoPreview, `${customerCode.trim()}_${Date.now()}.jpg`);

      // Guard: reject photos larger than 2 MB
      const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 MB
      if (file.size > MAX_PHOTO_SIZE) {
        setError('Photo is too large. Please use an image under 2 MB.');
        setLoading(false);
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from('customer-photos')
        .upload(file.name, file, { upsert: true });
      if (uploadError) {
        setError('Photo upload failed: ' + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage
        .from('customer-photos')
        .getPublicUrl(file.name);
      uploadedPhotoUrl = urlData.publicUrl;
    }

    const { data: newCustomer, error } = await supabase.from('customers').insert({
      customer_code: customerCode.trim(),
      full_name: name.trim(),
      mobile: mobile.trim(),
      photo_url: uploadedPhotoUrl,
      current_plan_type: 'fixed_plates',
      total_plates: plates,
      remaining_plates: plates,
      plan_expiry_date: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : null,
      status: 'active',
    }).select('*').single();

    setLoading(false);
    if (error) { setError(error.message); return; }

    reset();
    onCreated(newCustomer as Customer);
    onClose();
  };

  return (
    <>
      {/* ── Live camera overlay ───────────────────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="relative w-full max-w-sm">
            {cameraError ? (
              <div className="text-center px-6 space-y-4">
                <Camera className="w-14 h-14 text-slate-500 mx-auto" />
                <p className="text-red-400 text-sm">{cameraError}</p>
                <button
                  onClick={cancelCamera}
                  className="px-5 py-2 bg-slate-800 rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Live video — mirrored for front cam feel */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-2xl"
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                />

                {/* Controls bar */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-around px-6">
                  {/* Close */}
                  <button
                    onClick={cancelCamera}
                    className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300"
                    aria-label="Cancel"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Capture shutter */}
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full border-4 border-white bg-white/20 active:scale-95 transition-transform"
                    aria-label="Capture"
                  />

                  {/* Flip camera */}
                  <button
                    onClick={flipCamera}
                    className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-300"
                    aria-label="Flip camera"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Hidden canvas used only to grab a frame */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* ── Add Customer modal ────────────────────────────────────── */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40 px-3">
        <div className="w-full max-w-md glass-panel rounded-[24px] p-6 space-y-4 max-h-[90vh] overflow-y-auto relative">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Customer</h2>
            <button
              onClick={handleClose}
              className="text-slate-450 hover:text-slate-700 text-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-550 bg-red-50 border border-red-200/60 rounded-2xl px-4 py-3 text-center font-bold">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Customer ID (unique)</label>
              <input
                className="w-full glass-input px-3.5 py-2.5 text-sm"
                value={customerCode}
                onChange={e => setCustomerCode(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Full Name</label>
              <input
                className="w-full glass-input px-3.5 py-2.5 text-sm"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Mobile</label>
              <input
                className="w-full glass-input px-3.5 py-2.5 text-sm"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                inputMode="tel"
                maxLength={10}
              />
            </div>

            {/* ── Photo capture ── */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Photo</label>

              {photoPreview ? (
                <div className="flex items-center gap-4">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary/50 shadow-md shadow-primary/10"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={openCamera}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> Retake
                    </button>
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/20 text-slate-500 text-xs font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openCamera}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50/50 hover:bg-slate-100/50 transition-all py-6 cursor-pointer"
                >
                  <Camera className="w-8 h-8 text-primary" />
                  <span className="text-sm font-bold text-slate-700">Open Camera</span>
                  <span className="text-[10px] text-slate-500 font-medium">Tap to take a live photo</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider">Plan</label>
              <div className="flex gap-2">
                <select
                  value={plan}
                  onChange={e => setPlan(e.target.value as PlanPreset)}
                  className="flex-1 glass-input px-3 py-2.5 text-sm"
                >
                  {planOptions.map(p => (
                    <option key={p.value} value={p.value} className="bg-white text-slate-800">{p.label}</option>
                  ))}
                </select>
                {plan === 'custom' && (
                  <input
                    type="number"
                    min={1}
                    className="w-24 glass-input px-2.5 py-2 text-sm"
                    value={customPlates}
                    onChange={e => setCustomPlates(e.target.value)}
                    placeholder="Plates"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 font-medium">
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
                  className="w-full glass-input px-3.5 py-2 text-sm"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                />
              )}
              <p className="text-[10px] text-slate-500 font-semibold mt-1">
                Leave unchecked for no expiry (unlimited time).
              </p>
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
                {loading ? 'Saving…' : 'Save Customer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};