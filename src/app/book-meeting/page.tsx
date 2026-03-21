"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

export default function BookMeetingPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [successMeeting, setSuccessMeeting] = useState<any>(null);

  // Generate next 4 weeks of dates
  const [visibleDates, setVisibleDates] = useState<Date[]>([]);
  useEffect(() => {
    const today = new Date();
    const dates = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    setVisibleDates(dates);
  }, []);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const res = await fetch(`/api/availability/slots?date=${selectedDate}`);
        const data = await res.json();
        if (data.ok) {
          setSlots(data.slots);
        } else {
          setSlots([]);
        }
      } catch {
        setSlots([]);
      }
      setSlotsLoading(false);
    };

    fetchSlots();
  }, [selectedDate]);

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    setSelectedDate(dateStr);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    if (slot.available) {
      setSelectedSlot(slot);
      setTitle(""); // Reset form when changing slot
      setDescription("");
      setBookingError("");
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !selectedDate) return;

    setBooking(true);
    setBookingError("");

    try {
      const res = await fetch("/api/availability/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          startTime: selectedSlot.startTime,
          brandId: user?.brandId || null,
          title: title || "FUZE Meeting",
          description: description || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setBookingSuccess(true);
        setSuccessMeeting(data.meeting);
        setSelectedSlot(null);
        setSelectedDate(null);
        setTitle("");
        setDescription("");
      } else {
        setBookingError(data.error || "Failed to book meeting");
      }
    } catch (e: any) {
      setBookingError(e.message || "Network error");
    } finally {
      setBooking(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const dayOfWeekName = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const isAvailableDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    return [2, 4].includes(dayOfWeek); // Tuesday=2, Thursday=4
  };

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Success Modal */}
      {bookingSuccess && successMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-green-200">
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Meeting Booked!
              </h2>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase font-semibold">
                  Title
                </p>
                <p className="text-slate-900 font-medium">
                  {successMeeting.title}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase font-semibold">
                  Time
                </p>
                <p className="text-slate-900 font-medium">
                  {formatTime(successMeeting.startTime)} -{" "}
                  {formatTime(successMeeting.endTime)}
                </p>
              </div>
              {successMeeting.teamsLink && (
                <div>
                  <p className="text-slate-500 text-xs uppercase font-semibold">
                    Meeting Link
                  </p>
                  <a
                    href={successMeeting.teamsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00b4c3] hover:underline text-xs break-all"
                  >
                    Open in Teams
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setBookingSuccess(false);
                setSuccessMeeting(null);
              }}
              className="w-full px-4 py-2 bg-[#00b4c3] text-white font-medium rounded-lg hover:bg-[#009ba8] transition-colors"
            >
              Book Another Meeting
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Schedule a Meeting
        </h1>
        <p className="text-slate-600">
          Select an available date and time to book your meeting with our team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Select Date
          </h2>

          <div className="grid grid-cols-7 gap-2 mb-6">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-slate-500 py-2"
              >
                {day}
              </div>
            ))}

            {visibleDates.map((date) => {
              const isSelected = selectedDate === date.toISOString().split("T")[0];
              const isAvailable = isAvailableDay(date);
              const dateStr = date.toISOString().split("T")[0];

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateSelect(date)}
                  disabled={!isAvailable}
                  className={`
                    h-10 rounded-lg text-sm font-medium transition-all
                    ${
                      isSelected
                        ? "bg-[#00b4c3] text-white shadow-lg shadow-[#00b4c3]/30"
                        : isAvailable
                        ? "bg-slate-100 text-slate-900 hover:bg-[#00b4c3]/10 cursor-pointer"
                        : "bg-slate-50 text-slate-300 cursor-not-allowed"
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time Slots Section */}
          {selectedDate && (
            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-4">
                Available Times on {formatDate(new Date(selectedDate))}
              </h3>

              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-slate-400 text-sm">Loading slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-amber-700">
                    No available slots for this date
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {slots.map((slot, idx) => {
                    const isSlotSelected =
                      selectedSlot === slot ||
                      (selectedSlot &&
                        selectedSlot.startTime === slot.startTime);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSlotSelect(slot)}
                        disabled={!slot.available}
                        className={`
                          px-3 py-2 rounded-lg text-xs font-medium transition-all
                          ${
                            isSlotSelected
                              ? "bg-[#00b4c3] text-white border-2 border-[#00b4c3]"
                              : slot.available
                              ? "border-2 border-green-300 text-green-700 bg-green-50 hover:bg-green-100 cursor-pointer"
                              : "border-2 border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
                          }
                        `}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Meeting Details
          </h2>

          {!selectedSlot ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">
                Select a date and time to continue
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBook();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                  Date & Time
                </label>
                <div className="bg-[#00b4c3]/10 border border-[#00b4c3]/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-slate-900">
                    {formatDate(new Date(selectedDate!))}
                  </p>
                  <p className="text-sm text-slate-600">
                    {formatTime(selectedSlot.startTime)} -{" "}
                    {formatTime(selectedSlot.endTime)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                  Meeting Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="FUZE Meeting"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4c3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any additional details..."
                  rows={4}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00b4c3] resize-none"
                />
              </div>

              {bookingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700">{bookingError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={booking}
                className="w-full px-4 py-2 bg-[#00b4c3] text-white font-medium rounded-lg hover:bg-[#009ba8] disabled:opacity-50 transition-colors"
              >
                {booking ? "Booking..." : "Confirm Booking"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
