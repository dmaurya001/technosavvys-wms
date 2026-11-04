'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '@/context/AppContext';

interface NewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewStudentModal: React.FC<NewStudentModalProps> = ({ isOpen, onClose }) => {
  const { addStudent, workshops } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    regNo: `TS-2026-${Math.floor(200 + Math.random() * 800)}`,
    college: 'Techno Institute of Technology',
    batch: 'Batch 2026 - CSE',
    status: 'Active' as const,
    enrolledWorkshopIds: [] as string[],
  });

  const toggleWorkshop = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      enrolledWorkshopIds: prev.enrolledWorkshopIds.includes(id)
        ? prev.enrolledWorkshopIds.filter((wId) => wId !== id)
        : [...prev.enrolledWorkshopIds, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    addStudent({
      name: formData.name,
      email: formData.email,
      phone: formData.phone || '+91 98000 00000',
      regNo: formData.regNo,
      college: formData.college,
      batch: formData.batch,
      status: formData.status,
      enrolledWorkshopIds: formData.enrolledWorkshopIds,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enroll New Student"
      description="Register attendee record and assign workshop curriculum."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Aniket Sharma"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="aniket.s@technosavvys.edu"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+91 98765 00000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Registration / Roll ID
            </label>
            <input
              type="text"
              value={formData.regNo}
              onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Academic Batch / Branch
            </label>
            <input
              type="text"
              value={formData.batch}
              onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            College / Organization
          </label>
          <input
            type="text"
            value={formData.college}
            onChange={(e) => setFormData({ ...formData, college: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Assign Initial Workshops
          </label>
          <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
            {workshops.map((w) => {
              const checked = formData.enrolledWorkshopIds.includes(w.id);
              return (
                <label
                  key={w.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                    checked
                      ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleWorkshop(w.id)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <div className="flex-1 truncate">
                    <span className="font-semibold">[{w.id}]</span> {w.title}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Register Student
          </Button>
        </div>
      </form>
    </Modal>
  );
};

