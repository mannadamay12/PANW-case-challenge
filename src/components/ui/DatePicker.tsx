import { useState, useRef, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  parseISO,
} from "date-fns";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  onClose: () => void;
}

export function DatePicker({ value, onChange, onClose }: DatePickerProps) {
  const selectedDate = parseISO(value);
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSelectDate = (day: Date) => {
    // Set time to noon to avoid timezone issues
    const dateWithTime = new Date(day);
    dateWithTime.setHours(12, 0, 0, 0);
    onChange(dateWithTime.toISOString());
    onClose();
  };

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-30 rounded-lg border border-sanctuary-border bg-sanctuary-card p-3 shadow-lg animate-scale-in origin-top-left"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={handlePrevMonth}
          className="p-1 rounded-md hover:bg-sanctuary-hover text-sanctuary-muted transition-colors"
        >
          <CaretLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium text-sanctuary-text">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={handleNextMonth}
          disabled={isSameMonth(currentMonth, today)}
          className={cn(
            "p-1 rounded-md transition-colors",
            isSameMonth(currentMonth, today)
              ? "text-sanctuary-border cursor-not-allowed"
              : "hover:bg-sanctuary-hover text-sanctuary-muted"
          )}
        >
          <CaretRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-sanctuary-muted py-1 w-7"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const isFuture = isAfter(day, today);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleSelectDate(day)}
              disabled={isFuture}
              className={cn(
                "w-7 h-7 text-sm rounded-full flex items-center justify-center transition-colors",
                !isCurrentMonth && "text-sanctuary-border",
                isCurrentMonth && !isSelected && !isFuture && "text-sanctuary-text hover:bg-sanctuary-hover",
                isSelected && "bg-sanctuary-accent text-white",
                isToday && !isSelected && "font-bold underline underline-offset-2",
                isFuture && "cursor-not-allowed text-sanctuary-border"
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
