"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface AvailabilityConfig {
  id: string;
  availableDays: number[];
  startHour: number;
  endHour: number;
  slotDurationMinutes: number;
  timezone: string;
  blockedDates: string[];
  maxBookingsPerDay: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const SLOT_DURATIONS = [30, 45, 60, 90];

export default function AvailabilitySettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [config, setConfig] = useState<AvailabilityConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [availableDays, setAvailableDays] = useState<number[]>([2, 4]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [slotDuration, setSlotDuration] = useState(60);
  const [timezone, setTimezone] = useState("Asia/Taipei");
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newBlockedDate, setNewBlockedDate] = useState("");
  const [maxBookingsPerDay, setMaxBookingsPerDay] = useState(3);

  // Fetch current config
  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }

    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/availability");
        const data = await res.json();
        if (data.ok) {
          const cfg = data.config;
          setConfig(cfg);
          setAvailableDays(
            Array.isArray(cfg.availableDays)
              ? cfg.availableDays
              : JSON.parse(cfg.availableDays)
          );
          setStartHour(cfg.startHour);
          setEndHour(cfg.endHour);
          setSlotDuration(cfg.slotDurationMinutes);
          setTimezone(cfg.timezone);
          setBlockedDates(
            Array.isArray(cfg.blockedDates)
              ? cfg.blockedDates
              : JSON.parse(cfg.blockedDates)
          );
          setMaxBookingsPerDay(cfg.maxBookingsPerDay);
        }
      } catch (e) {
        console.error("Failed to fetch config:", e);
      }
      setLoading(false);
    };

    fetchConfig();
  }, [user, router]);

  const handleDayToggle = (day: number) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleAddBlockedDate = () => {
    if (newBlockedDate && !blockedDates.includes(newBlockedDate)) {
      setBlockedDates((prev) => [...prev, newBlockedDate].sort());
      setNewBlockedDate("");
    }
  };

  const handleRemoveBlockedDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((d) => d !== date));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availableDays,
          startHour,
          endHour,
          slotDurationMinutes: slotDuration,
          timezone,
          blockedDates,
          maxBookingsPerDay,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Save error:", e);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400 text-sm">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Availability Settings
        </h1>
        <p className="text-slate-600">
          Configure your meeting booking availability and schedule.
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 font-medium">
            Settings saved successfully!
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        {/* Available Days */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Available Days
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.value}
                className="flex items-center gap-2 p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={availableDays.includes(day.value)}
                  onChange={() => handleDayToggle(day.value)}
                  className="w-4 h-4 rounded text-[#00b4c3] cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-900">
                  {day.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Business Hours */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Business Hours
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                Start Hour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={startHour}
                  onChange={(e) => setStartHour(parseInt(e.target.value))}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-600">:00</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                End Hour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={endHour}
                  onChange={(e) => setEndHour(parseInt(e.target.value))}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-600">:00</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Hours are in 24-hour format (0-23). Slots available from {startHour}:00 to {endHour}:00.
          </p>
        </div>

        {/* Slot Duration */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Time Slot Duration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {SLOT_DURATIONS.map((duration) => (
              <button
                key={duration}
                onClick={() => setSlotDuration(duration)}
                className={`
                  px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    slotDuration === duration
                      ? "bg-[#00b4c3] text-white"
                      : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                  }
                `}
              >
                {duration} min
              </button>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
            Timezone
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Taipei"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Max Bookings Per Day */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
            Maximum Bookings Per Day
          </label>
          <input
            type="number"
            min="1"
            value={maxBookingsPerDay}
            onChange={(e) => setMaxBookingsPerDay(parseInt(e.target.value))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Blocked Dates */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Blocked Dates
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleAddBlockedDate}
              className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
            >
              Add
            </button>
          </div>

          {blockedDates.length === 0 ? (
            <p className="text-sm text-slate-500">No blocked dates</p>
          ) : (
            <div className="space-y-2">
              {blockedDates.map((date) => (
                <div
                  key={date}
                  className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200"
                >
                  <span className="text-sm text-slate-900">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    onClick={() => handleRemoveBlockedDate(date)}
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Preview */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Summary</h3>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              Available: {DAYS_OF_WEEK.filter((d) => availableDays.includes(d.value))
                .map((d) => d.label)
                .join(", ")}
            </p>
            <p>
              Hours: {startHour}:00 - {endHour}:00
            </p>
            <p>Slot Duration: {slotDuration} minutes</p>
            <p>Max Bookings Per Day: {maxBookingsPerDay}</p>
            <p>Timezone: {timezone}</p>
            <p>Blocked Dates: {blockedDates.length}</p>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-6 py-3 bg-[#00b4c3] text-white font-medium rounded-lg hover:bg-[#009ba8] disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
