"use client";

import { AlertTriangle, X } from "lucide-react";

export default function DeleteConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message,
  isLoading = false 
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md scale-100 animate-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 truncate">
                    {title || "Confirm Delete"}
                  </h3>
                  <button 
                    onClick={onClose}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {message || "Are you sure you want to delete this item? This action cannot be undone."}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 bg-slate-50 px-6 py-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting...
                </>
              ) : (
                "Delete Now"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
