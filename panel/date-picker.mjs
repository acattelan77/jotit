import { pad2, parseDateValue } from "./date-time.mjs";

/** Owns date-picker state, rendering, commands, and DOM event wiring. */
export const createDatePicker = ({
  elements,
  formatDateTime,
  onChange,
  now = () => new Date(),
  documentRef = document,
}) => {
  const {
    input,
    display,
    picker,
    grid,
    monthLabel,
    openButton,
    previousButton,
    nextButton,
    todayButton,
    doneButton,
    setNowButton,
    hourDecreaseButton,
    hourIncreaseButton,
    minuteDecreaseButton,
    minuteIncreaseButton,
    hourValue,
    minuteValue,
  } = elements;

  let open = false;
  let pickerMonth = null;

  const getSelectedDate = () => parseDateValue(input.value) || now();

  const updateDisplay = () => {
    const parsed = parseDateValue(input.value);
    display.textContent = parsed ? formatDateTime(parsed) : "";
  };

  const setValue = (date, { notify = true } = {}) => {
    if (!date) return;
    input.value = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
      date.getDate()
    )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    updateDisplay();
    if (notify) onChange?.(input.value);
  };

  const render = () => {
    if (!grid || !monthLabel || !pickerMonth) return;
    const selected = getSelectedDate();
    const year = pickerMonth.getFullYear();
    const month = pickerMonth.getMonth();
    monthLabel.textContent = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(pickerMonth);

    grid.innerHTML = "";
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset);

    for (let index = 0; index < 42; index += 1) {
      const current = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + index
      );
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "date-picker__day";
      if (current.getMonth() !== month) button.classList.add("is-muted");
      if (
        current.getFullYear() === selected.getFullYear() &&
        current.getMonth() === selected.getMonth() &&
        current.getDate() === selected.getDate()
      ) {
        button.classList.add("is-selected");
      }
      button.textContent = String(current.getDate());
      button.dataset.date = `${current.getFullYear()}-${pad2(
        current.getMonth() + 1
      )}-${pad2(current.getDate())}`;
      button.addEventListener("click", () => {
        const updated = new Date(selected);
        updated.setFullYear(
          current.getFullYear(),
          current.getMonth(),
          current.getDate()
        );
        setValue(updated);
        render();
      });
      grid.appendChild(button);
    }

    hourValue.textContent = pad2(selected.getHours());
    minuteValue.textContent = pad2(selected.getMinutes());
  };

  const openPicker = () => {
    open = true;
    picker.classList.add("is-open");
    picker.setAttribute("aria-hidden", "false");
    const selected = getSelectedDate();
    pickerMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    render();
  };

  const closePicker = () => {
    open = false;
    picker.classList.remove("is-open");
    picker.setAttribute("aria-hidden", "true");
  };

  const setNow = () => {
    setValue(now());
    render();
  };

  const shiftMonth = (delta) => {
    if (!open) openPicker();
    pickerMonth = new Date(
      pickerMonth.getFullYear(),
      pickerMonth.getMonth() + delta,
      1
    );
    render();
  };

  const setToday = () => {
    const current = now();
    setValue(current);
    pickerMonth = new Date(current.getFullYear(), current.getMonth(), 1);
    render();
  };

  const adjustTime = ({ hourDelta = 0, minuteDelta = 0 } = {}) => {
    const selected = getSelectedDate();
    const minutesPerDay = 24 * 60;
    const currentMinutes = selected.getHours() * 60 + selected.getMinutes();
    const adjustedMinutes =
      (currentMinutes + hourDelta * 60 + minuteDelta + minutesPerDay) %
      minutesPerDay;
    selected.setHours(
      Math.floor(adjustedMinutes / 60),
      adjustedMinutes % 60,
      0,
      0
    );
    setValue(selected);
    render();
  };

  const handleGridKeydown = (event) => {
    const days = Array.from(grid.querySelectorAll(".date-picker__day"));
    const currentIndex = days.findIndex((day) =>
      day.classList.contains("is-selected")
    );
    if (currentIndex < 0) return;
    const offsets = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const nextIndex = Math.max(0, Math.min(currentIndex + offset, days.length - 1));
    if (nextIndex === currentIndex || !days[nextIndex]) return;
    const [year, month, day] = days[nextIndex].dataset.date.split("-").map(Number);
    const updated = getSelectedDate();
    updated.setFullYear(year, month - 1, day);
    setValue(updated);
    render();
    grid.querySelector(`[data-date="${year}-${pad2(month)}-${pad2(day)}"]`)?.focus();
  };

  openButton?.addEventListener("click", openPicker);
  display?.addEventListener("click", openPicker);
  display?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  });
  previousButton?.addEventListener("click", () => shiftMonth(-1));
  nextButton?.addEventListener("click", () => shiftMonth(1));
  grid?.addEventListener("keydown", handleGridKeydown);
  todayButton?.addEventListener("click", setToday);
  doneButton?.addEventListener("click", closePicker);
  setNowButton?.addEventListener("click", setNow);
  hourDecreaseButton?.addEventListener("click", () => adjustTime({ hourDelta: -1 }));
  hourIncreaseButton?.addEventListener("click", () => adjustTime({ hourDelta: 1 }));
  minuteDecreaseButton?.addEventListener("click", () =>
    adjustTime({ minuteDelta: -1 })
  );
  minuteIncreaseButton?.addEventListener("click", () =>
    adjustTime({ minuteDelta: 1 })
  );

  documentRef.addEventListener("click", (event) => {
    if (!open) return;
    const target = event.target;
    if (
      target &&
      (picker.contains(target) ||
        openButton?.contains(target) ||
        display?.contains(target))
    ) {
      return;
    }
    closePicker();
  });
  documentRef.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) closePicker();
  });

  return {
    adjustTime,
    close: closePicker,
    isOpen: () => open,
    open: openPicker,
    render,
    setNow,
    setToday,
    setValue,
    shiftMonth,
    updateDisplay,
  };
};
